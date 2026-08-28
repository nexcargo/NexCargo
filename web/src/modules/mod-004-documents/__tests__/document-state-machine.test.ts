// NexCargo MOD-004 — Document Lifecycle State Machine Tests
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect } from 'vitest';
import { DocumentStatus } from '../domain/enums';
import { validateDocumentTransition, applyDocumentTransition, isDocumentTerminal, isDocumentImmutable } from '../domain/services/document-state-machine';

describe('MOD-004 Document State Machine — Main Lifecycle', () => {
  describe('UPLOADED → VALIDATED / REJECTED', () => {
    it('allows UPLOADED to VALIDATED (virus scan passed)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.UPLOADED, DocumentStatus.VALIDATED)).not.toThrow();
    });

    it('allows UPLOADED to REJECTED (malware detected or invalid format)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.UPLOADED, DocumentStatus.REJECTED)).not.toThrow();
    });

    it('rejects UPLOADED directly to ACTIVE (skips validation)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.UPLOADED, DocumentStatus.ACTIVE))
        .toThrow(/Invalid document transition/);
    });
  });

  describe('VALIDATED → ACTIVE / REJECTED', () => {
    it('allows VALIDATED to ACTIVE (document available and valid)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.VALIDATED, DocumentStatus.ACTIVE)).not.toThrow();
    });

    it('allows VALIDATED to REJECTED (post-validation rejection)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.VALIDATED, DocumentStatus.REJECTED)).not.toThrow();
    });

    it('rejects VALIDATED to SIGNED (must pass through ACTIVE and review)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.VALIDATED, DocumentStatus.SIGNED))
        .toThrow(/Invalid document transition/);
    });
  });

  describe('ACTIVE → [optional OCR] → REVIEW → SIGNED | APPROVED → ARCHIVED', () => {
    it('allows ACTIVE to REVIEW (submit for user review of OCR data)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.ACTIVE, DocumentStatus.REVIEW)).not.toThrow();
    });

    it('allows ACTIVE to EXPIRING (expiry notification window reached)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.ACTIVE, DocumentStatus.EXPIRING)).not.toThrow();
    });

    it('allows ACTIVE to REJECTED (validation failure during active phase)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.ACTIVE, DocumentStatus.REJECTED)).not.toThrow();
    });

    it('allows REVIEW to SIGNED (digital signature applied)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.REVIEW, DocumentStatus.SIGNED)).not.toThrow();
    });

    it('allows REVIEW to APPROVED (approval applied)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.REVIEW, DocumentStatus.APPROVED)).not.toThrow();
    });

    it('allows REVIEW to REJECTED (review outcome rejection)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.REVIEW, DocumentStatus.REJECTED)).not.toThrow();
    });

    it('allows SIGNED to ARCHIVED (signed document finalized)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.SIGNED, DocumentStatus.ARCHIVED)).not.toThrow();
    });

    it('allows APPROVED to ARCHIVED (approved document finalized)', () => {
      expect(() => validateDocumentTransition(DocumentStatus.APPROVED, DocumentStatus.ARCHIVED)).not.toThrow();
    });
  });
});

describe('MOD-004 Document State Machine — Expiry Lifecycle', () => {
  it('allows ACTIVE to EXPIRING (within notification window)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.ACTIVE, DocumentStatus.EXPIRING)).not.toThrow();
  });

  it('allows EXPIRING to EXPIRED (past expiry date, operational impact applied)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.EXPIRING, DocumentStatus.EXPIRED)).not.toThrow();
  });

  it('allows EXPIRED to RENEWED (new version uploaded, history preserved)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.EXPIRED, DocumentStatus.RENEWED)).not.toThrow();
  });

  it('allows RENEWED to ACTIVE (renewal complete, new version becomes active)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.RENEWED, DocumentStatus.ACTIVE)).not.toThrow();
  });

  it('supports full expiry cycle: ACTIVE → EXPIRING → EXPIRED → RENEWED → ACTIVE', () => {
    let status = DocumentStatus.ACTIVE;
    status = applyDocumentTransition(status, DocumentStatus.EXPIRING);
    status = applyDocumentTransition(status, DocumentStatus.EXPIRED);
    status = applyDocumentTransition(status, DocumentStatus.RENEWED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    expect(status).toBe(DocumentStatus.ACTIVE);
  });

  it('rejects EXPIRING directly to RENEWED (must pass through EXPIRED)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.EXPIRING, DocumentStatus.RENEWED))
      .toThrow(/Invalid document transition/);
  });

  it('rejects ACTIVE directly to EXPIRED (must go through EXPIRING first)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.ACTIVE, DocumentStatus.EXPIRED))
      .toThrow(/Invalid document transition/);
  });
});

describe('MOD-004 Document State Machine — Rejection Paths', () => {
  const nonTerminalStates = [
    DocumentStatus.UPLOADED,
    DocumentStatus.VALIDATED,
    DocumentStatus.ACTIVE,
    DocumentStatus.REVIEW,
  ] as const;

  it.each(nonTerminalStates)('allows %s to REJECTED', (status) => {
    expect(() => validateDocumentTransition(status, DocumentStatus.REJECTED)).not.toThrow();
  });

  it('does NOT allow EXPIRING to REJECTED (expiry states follow their own path)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.EXPIRING, DocumentStatus.REJECTED))
      .toThrow(/Invalid document transition/);
  });

  it('does NOT allow EXPIRED to REJECTED (expiry states follow their own path)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.EXPIRED, DocumentStatus.REJECTED))
      .toThrow(/Invalid document transition/);
  });

  it('does NOT allow RENEWED to REJECTED (renewal states follow their own path)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.RENEWED, DocumentStatus.REJECTED))
      .toThrow(/Invalid document transition/);
  });

  it('does NOT allow SIGNED to REJECTED (immutable once signed)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.SIGNED, DocumentStatus.REJECTED))
      .toThrow(/Invalid document transition/);
  });

  it('does NOT allow APPROVED to REJECTED (immutable once approved)', () => {
    expect(() => validateDocumentTransition(DocumentStatus.APPROVED, DocumentStatus.REJECTED))
      .toThrow(/Invalid document transition/);
  });

  it('REJECTED has no outgoing transitions', () => {
    expect(() => validateDocumentTransition(DocumentStatus.REJECTED, DocumentStatus.UPLOADED))
      .toThrow(/terminal/);
  });
});

describe('MOD-004 Document State Machine — Terminal States', () => {
  it('ARCHIVED has no outgoing transitions', () => {
    expect(() => validateDocumentTransition(DocumentStatus.ARCHIVED, DocumentStatus.ACTIVE))
      .toThrow(/terminal/);
  });

  it('REJECTED has no outgoing transitions', () => {
    expect(() => validateDocumentTransition(DocumentStatus.REJECTED, DocumentStatus.VALIDATED))
      .toThrow(/terminal/);
  });

  it('no terminal state allows self-transition', () => {
    expect(() => validateDocumentTransition(DocumentStatus.ARCHIVED, DocumentStatus.ARCHIVED))
      .toThrow(/terminal/);
    expect(() => validateDocumentTransition(DocumentStatus.REJECTED, DocumentStatus.REJECTED))
      .toThrow(/terminal/);
  });

  it('isDocumentTerminal returns true for ARCHIVED', () => {
    expect(isDocumentTerminal(DocumentStatus.ARCHIVED)).toBe(true);
  });

  it('isDocumentTerminal returns true for REJECTED', () => {
    expect(isDocumentTerminal(DocumentStatus.REJECTED)).toBe(true);
  });

  it('isDocumentTerminal returns false for all non-terminal states', () => {
    expect(isDocumentTerminal(DocumentStatus.UPLOADED)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.VALIDATED)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.ACTIVE)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.REVIEW)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.SIGNED)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.APPROVED)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.EXPIRING)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.EXPIRED)).toBe(false);
    expect(isDocumentTerminal(DocumentStatus.RENEWED)).toBe(false);
  });
});

describe('MOD-004 Document State Machine — Immutability', () => {
  it('isDocumentImmutable returns true for SIGNED', () => {
    expect(isDocumentImmutable(DocumentStatus.SIGNED)).toBe(true);
  });

  it('isDocumentImmutable returns true for APPROVED', () => {
    expect(isDocumentImmutable(DocumentStatus.APPROVED)).toBe(true);
  });

  it('isDocumentImmutable returns true for ARCHIVED', () => {
    expect(isDocumentImmutable(DocumentStatus.ARCHIVED)).toBe(true);
  });

  it('isDocumentImmutable returns false for all other states', () => {
    expect(isDocumentImmutable(DocumentStatus.UPLOADED)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.VALIDATED)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.ACTIVE)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.REVIEW)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.REJECTED)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.EXPIRING)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.EXPIRED)).toBe(false);
    expect(isDocumentImmutable(DocumentStatus.RENEWED)).toBe(false);
  });
});

describe('MOD-004 Document State Machine — Full Lifecycle Chains', () => {
  it('runs through primary path: UPLOADED → VALIDATED → ACTIVE → REVIEW → SIGNED → ARCHIVED', () => {
    let status = DocumentStatus.UPLOADED;
    status = applyDocumentTransition(status, DocumentStatus.VALIDATED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    status = applyDocumentTransition(status, DocumentStatus.REVIEW);
    status = applyDocumentTransition(status, DocumentStatus.SIGNED);
    status = applyDocumentTransition(status, DocumentStatus.ARCHIVED);
    expect(status).toBe(DocumentStatus.ARCHIVED);
    expect(isDocumentTerminal(status)).toBe(true);
  });

  it('runs through primary path without review: UPLOADED → VALIDATED → ACTIVE → REVIEW → APPROVED → ARCHIVED', () => {
    let status = DocumentStatus.UPLOADED;
    status = applyDocumentTransition(status, DocumentStatus.VALIDATED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    status = applyDocumentTransition(status, DocumentStatus.REVIEW);
    status = applyDocumentTransition(status, DocumentStatus.APPROVED);
    status = applyDocumentTransition(status, DocumentStatus.ARCHIVED);
    expect(status).toBe(DocumentStatus.ARCHIVED);
    expect(isDocumentTerminal(status)).toBe(true);
  });

  it('handles rejection mid-lifecycle then archival of rejected document', () => {
    let status = DocumentStatus.UPLOADED;
    status = applyDocumentTransition(status, DocumentStatus.VALIDATED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    status = applyDocumentTransition(status, DocumentStatus.REJECTED);
    expect(status).toBe(DocumentStatus.REJECTED);
    expect(isDocumentTerminal(status)).toBe(true);
  });

  it('completes expiry cycle from ACTIVE through renewal back to ACTIVE', () => {
    let status = DocumentStatus.ACTIVE;
    status = applyDocumentTransition(status, DocumentStatus.EXPIRING);
    status = applyDocumentTransition(status, DocumentStatus.EXPIRED);
    status = applyDocumentTransition(status, DocumentStatus.RENEWED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    expect(status).toBe(DocumentStatus.ACTIVE);
    expect(isDocumentTerminal(status)).toBe(false); // Can continue processing after renewal
  });

  it('handles full lifecycle with expiry interruption: ACTIVE → EXPIRING → EXPIRED → RENEWED → ACTIVE → REVIEW → APPROVED → ARCHIVED', () => {
    let status = DocumentStatus.UPLOADED;
    status = applyDocumentTransition(status, DocumentStatus.VALIDATED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    // Expiry cycle interrupts normal flow
    status = applyDocumentTransition(status, DocumentStatus.EXPIRING);
    status = applyDocumentTransition(status, DocumentStatus.EXPIRED);
    status = applyDocumentTransition(status, DocumentStatus.RENEWED);
    status = applyDocumentTransition(status, DocumentStatus.ACTIVE);
    // Normal flow resumes
    status = applyDocumentTransition(status, DocumentStatus.REVIEW);
    status = applyDocumentTransition(status, DocumentStatus.APPROVED);
    status = applyDocumentTransition(status, DocumentStatus.ARCHIVED);
    expect(status).toBe(DocumentStatus.ARCHIVED);
    expect(isDocumentTerminal(status)).toBe(true);
  });
});
