// NexCargo MOD-004 — Document Lifecycle State Machine
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-004 §4.1 (Document Entity status), §5 (Lifecycle Model)
//
// Main lifecycle per MOD-004 §5:
//   UPLOADED → VALIDATED → ACTIVE → [OCR Processing] → REVIEW → SIGNED | APPROVED → ARCHIVED
//
// Expiry lifecycle (parallel, for documents with validity periods):
//   ACTIVE → EXPIRING → EXPIRED → RENEWED → ACTIVE
//
// Additional paths:
//   Any active state → REJECTED (validation/review failure)
//   TERMINAL: ARCHIVED (only terminal state)

import { ValidationError } from '@/shared/errors/app-errors';
import type { RenewalStatus } from '../enums';
import { DocumentStatus } from '../enums';

/** Combined document status union for state machine operations */
type DocumentState = DocumentStatus;

// ============================================================
// Valid transition map — single source of truth per MOD-004 §5
// OCR is optional (reflected as branching from ACTIVE to REVIEW)
// ============================================================

const VALID_TRANSITIONS: Record<DocumentState, DocumentState[]> = {
  /** Initial upload, virus scan pending */
  [DocumentStatus.UPLOADED]: [
    DocumentStatus.VALIDATED,
    DocumentStatus.REJECTED,
  ],
  /** Virus scan passed, metadata extracted */
  [DocumentStatus.VALIDATED]: [
    DocumentStatus.ACTIVE,
    DocumentStatus.REJECTED,
  ],
  /** Document is available and valid */
  [DocumentStatus.ACTIVE]: [
    DocumentStatus.REVIEW,
    DocumentStatus.EXPIRING,
    DocumentStatus.REJECTED,
  ],
  /** Optional user review of extracted data */
  [DocumentStatus.REVIEW]: [
    DocumentStatus.SIGNED,
    DocumentStatus.APPROVED,
    DocumentStatus.REJECTED,
  ],
  /** Digital signature applied — immutable once signed */
  [DocumentStatus.SIGNED]: [
    DocumentStatus.ARCHIVED,
  ],
  /** Approval applied — locked against modification */
  [DocumentStatus.APPROVED]: [
    DocumentStatus.ARCHIVED,
  ],
  /** Rejected during any validation/review phase */
  [DocumentStatus.REJECTED]: [],
  /** Approaching expiry notification window */
  [DocumentStatus.EXPIRING]: [
    DocumentStatus.EXPIRED,
  ],
  /** Past expiry date, operational impact applied */
  [DocumentStatus.EXPIRED]: [
    DocumentStatus.RENEWED,
  ],
  /** New version uploaded, history preserved */
  [DocumentStatus.RENEWED]: [
    DocumentStatus.ACTIVE,
  ],
  /** Soft deletion, retained for audit — terminal */
  [DocumentStatus.ARCHIVED]: [],
};

// ============================================================
// Helper: get allowed transitions for a given status
// ============================================================

function getAllowedTransitions(status: DocumentState): DocumentState[] {
  return [...VALID_TRANSITIONS[status]];
}

// ============================================================
// validateDocumentTransition — throws ValidationError if invalid
// Per MOD-004 §7.1: "Once a document version is approved or signed, it CANNOT be modified."
// Per MOD-004 §7.1: "Updates MUST create a new version."
// ============================================================

export function validateDocumentTransition(
  currentStatus: DocumentState,
  targetStatus: DocumentState,
): void {
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid document transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      { currentStatus, targetStatus, allowedTransitions: allowed },
    );
  }
}

// ============================================================
// applyDocumentTransition — returns validated new state (advisory-only, no persistence)
// This is an advisory-only function — it does NOT persist state or emit events.
// Persistence and event emission are handled by the application layer.
// ============================================================

export function applyDocumentTransition(
  currentStatus: DocumentState,
  targetStatus: DocumentState,
): DocumentState {
  validateDocumentTransition(currentStatus, targetStatus);
  return targetStatus;
}

// ============================================================
// isDocumentTerminal — returns true if no further transitions allowed
// Terminal state: ARCHIVED
// ============================================================

export function isDocumentTerminal(status: DocumentState): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

// ============================================================
// isDocumentImmutable — returns true for signed/approved/archived documents
// Per MOD-004 §7.1: "Signed documents are immutable." / "Approved documents are locked against modification."
// ============================================================

export function isDocumentImmutable(status: DocumentState): boolean {
  return status === DocumentStatus.SIGNED
    || status === DocumentStatus.APPROVED
    || status === DocumentStatus.ARCHIVED;
}
