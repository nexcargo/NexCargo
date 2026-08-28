// NexCargo MOD-004 — Document Validation Services
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-004 §4 Core Domain Entities validation rules, §7 Rules of Operation

import { ValidationError } from '@/shared/errors/app-errors';
import { DocumentStatus } from '../enums';
import type { DocumentTypeExtended, LinkedEntityType, SignatureVerificationMethod, RelationshipType } from '../enums';

// ============================================================
// Constants for validation per MOD-004 specifications
// ============================================================

const MAX_FILE_HASH_LENGTH = 256; // SHA-256 hex representation
const MIN_CONTENT_SNAPSHOT_FIELDS = 1;
const MAX_DOCUMENT_VERSIONS = 100; // Soft cap to prevent unbounded version chains

/** Configurable notification schedules per MOD-004 §4.7 */
const DEFAULT_EXPIRY_SCHEDULES = [90, 60, 30, 7, 1]; // days before expiry

/** Supported formats for document acceptance (design-time placeholder per §7.3) */
const SUPPORTED_FORMATS = ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'TIFF'];

// ============================================================
// validateDocumentUpload — validates new document creation parameters
// Per MOD-004 §4.1: "Every uploaded document receives a unique identifier."
// Per MOD-004 §7.3: "Documents MUST be scanned for malware before acceptance."
// ============================================================

export function validateDocumentUpload(input: {
  documentId: string;
  documentType: DocumentTypeExtended;
  linkedEntityType: LinkedEntityType;
  linkedEntityId: string;
  fileReference: string;
  fileHash: string;
}): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new ValidationError('documentId is required', { field: 'documentId' });
  }
  if (!input.linkedEntityId || input.linkedEntityId.trim().length === 0) {
    throw new ValidationError('linkedEntityId is required', { field: 'linkedEntityId' });
  }
  if (!input.fileReference || input.fileReference.trim().length === 0) {
    throw new ValidationError('fileReference is required (pointer to encrypted storage)', { field: 'fileReference' });
  }
  if (!input.fileHash || input.fileHash.trim().length === 0) {
    throw new ValidationError('fileHash is required (integrity checksum)', { field: 'fileHash' });
  }
  if (input.fileHash.length > MAX_FILE_HASH_LENGTH) {
    throw new ValidationError(`fileHash must not exceed ${MAX_FILE_HASH_LENGTH} characters`, { field: 'fileHash' });
  }
}

// ============================================================
// validateDocumentVersioning — validates immutability and version control rules
// Per MOD-004 §4.2: "Once a document version is approved or signed, it CANNOT be modified."
// Per MOD-004 §7.1: "Updates MUST create a new version." / "Approved documents are locked against modification."
// ============================================================

export function validateDocumentVersioning(input: {
  currentVersion: number;
  proposedNewVersion: number;
  documentStatus: DocumentStatus;
  isSignedOrApproved: boolean;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.proposedNewVersion <= input.currentVersion) {
    errors.push('New version number must be greater than current version');
  }

  if (input.isSignedOrApproved) {
    errors.push('Cannot modify approved or signed documents; updates must create a new version');
  }

  if (input.proposedNewVersion > MAX_DOCUMENT_VERSIONS) {
    errors.push(`Version count exceeds maximum of ${MAX_DOCUMENT_VERSIONS}; archive previous versions`);
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// assertImmutableDocumentProtected — enforces immutability for signed/approved/archived docs
// Per MOD-004 §7.1: "Signed documents are immutable." / "Approved documents are locked against modification."
// ============================================================

export function assertImmutableDocumentProtected(status: DocumentStatus, requestedAction: string): void {
  const immutableStates = [DocumentStatus.SIGNED, DocumentStatus.APPROVED, DocumentStatus.ARCHIVED] as const;

  if (immutableStates.some(s => s === status)) {
    throw new ValidationError(
      `Document is in ${status} state (immutable). Action "${requestedAction}" is prohibited. Signed, approved, and archived documents cannot be modified.`,
      { status, requestedAction },
    );
  }
}

// ============================================================
// validateDocumentLinkage — enforces traceability rule (no orphan documents)
// Per MOD-004 §7.2: "Every document MUST be linked to at least one system entity."
// Per MOD-004 §4.4: "Orphan documents are not valid system states."
// ============================================================

export function validateDocumentLinkage(input: {
  documentId: string;
  entityReference?: string;
  moduleReference?: string;
  relationshipType?: RelationshipType;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.entityReference || input.entityReference.trim().length === 0) {
    errors.push('entityReference is required (every document must link to at least one system entity)');
  }

  if (!input.moduleReference || input.moduleReference.trim().length === 0) {
    errors.push('moduleReference is required (MOD-001 through MOD-018)');
  } else if (!/^MOD-\d{3}$/.test(input.moduleReference)) {
    errors.push(`moduleReference must match pattern MOD-XXX (e.g., MOD-001), got ${input.moduleReference}`);
  } else {
    const modNum = parseInt(input.moduleReference.replace('MOD-', ''), 10);
    if (modNum < 1 || modNum > 18) {
      errors.push(`moduleReference must be between MOD-001 and MOD-018, got ${input.moduleReference}`);
    }
  }

  if (!input.relationshipType) {
    errors.push('relationshipType is required (supports/derives/verifies/validates)');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateOcrExtraction — validates OCR extraction completeness and advisory nature
// Per MOD-004 §4.5: "OCR confidence score is generated for every extraction."
// Per MOD-004 §7.5: "OCR data is advisory – manually corrected values supersede OCR output."
// ============================================================

export function validateOcrExtraction(input: {
  documentId: string;
  confidenceScore: number;
  extractedFieldsCount: number;
  hasUserCorrections: boolean;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.documentId || input.documentId.trim().length === 0) {
    errors.push('documentId is required');
  }

  if (input.confidenceScore < 0 || input.confidenceScore > 100) {
    errors.push('confidenceScore must be between 0 and 100');
  }

  if (input.extractedFieldsCount < MIN_CONTENT_SNAPSHOT_FIELDS) {
    errors.push('At least one field must be extracted during OCR processing');
  }

  // Advisory note: corrections override OCR — this is informational only
  if (input.hasUserCorrections && input.confidenceScore > 50) {
    // High-confidence extraction with corrections — log but don't reject
    // In production, this would trigger an audit flag
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateDigitalSignature — validates signature requirements
// Per MOD-004 §4.6: "Signer identity MUST be verified before signature."
// Per MOD-004 §7.6: "Duplicate signatures are prevented." / "Signature certificates MUST be retained."
// ============================================================

export function validateDigitalSignature(input: {
  documentId: string;
  signerId: string;
  signerRole: string;
  signatureCertificate: string;
  verificationMethod: SignatureVerificationMethod;
  previousSignatures: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.documentId || input.documentId.trim().length === 0) {
    errors.push('documentId is required');
  }

  if (!input.signerId || input.signerId.trim().length === 0) {
    errors.push('signerId is required (identity must be verified before signature)');
  }

  if (!input.signerRole || input.signerRole.trim().length === 0) {
    errors.push('signerRole is required (SHIPPER/TRANSPORTER/DRIVER/RECIPIENT)');
  }

  if (!input.signatureCertificate || input.signatureCertificate.trim().length === 0) {
    errors.push('signatureCertificate is required (reference to certificate authority, must be retained)');
  }

  if (!input.verificationMethod) {
    errors.push('verificationMethod is required (OTP/BIOMETRIC/DIGITAL_CERTIFICATE/PIN)');
  }

  if (input.previousSignatures > 0) {
    errors.push(`Duplicate signature detected (${input.previousSignatures} existing signature(s) on this document)`);
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateDocumentExpiry — validates expiry tracking parameters
// Per MOD-004 §7.4: "Documents with validity periods MUST store issue and expiry dates."
// Per MOD-004 §4.7: "Expired mandatory documents automatically affect operational eligibility."
// ============================================================

export function validateDocumentExpiry(input: {
  documentId: string;
  hasValidityPeriod: boolean;
  issueDate?: Date;
  expiryDate?: Date;
  renewalStatus: string;
  operationalImpact: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.documentId || input.documentId.trim().length === 0) {
    errors.push('documentId is required');
  }

  if (input.hasValidityPeriod) {
    if (!input.issueDate) {
      errors.push('issueDate is required for documents with validity periods');
    }
    if (!input.expiryDate) {
      errors.push('expiryDate is required for documents with validity periods');
    }
    if (input.issueDate && input.expiryDate && input.expiryDate <= input.issueDate) {
      errors.push('expiryDate must be after issueDate');
    }
  }

  const validRenewalStatuses = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'RENEWAL_PENDING'];
  if (!validRenewalStatuses.includes(input.renewalStatus)) {
    errors.push(`renewalStatus must be one of: ${validRenewalStatuses.join(', ')}`);
  }

  const validImpacts = ['NONE', 'WARNING', 'SUSPENDED', 'BLOCKED'];
  if (!validImpacts.includes(input.operationalImpact)) {
    errors.push(`operationalImpact must be one of: ${validImpacts.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// assertValidNotificationSchedule — validates configurable expiry reminder schedule
// Per MOD-004 §4.7: "Notification schedule is configurable (e.g., 90, 60, 30, 7, and 1 day before expiry)."
// ============================================================

export function assertValidNotificationSchedule(scheduleDays: number[]): boolean {
  if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) {
    return false;
  }

  for (const day of scheduleDays) {
    if (day <= 0 || day > 365) {
      return false;
    }
  }

  // Ensure descending order for chronological processing
  for (let i = 0; i < scheduleDays.length - 1; i++) {
    if (scheduleDays[i] < scheduleDays[i + 1]) {
      return false;
    }
  }

  return true;
}

// ============================================================
// validateAcceptableFormat — validates document format compliance
// Per MOD-004 §7.3: "Accepted file formats and maximum file sizes are configurable."
// ============================================================

export function validateAcceptableFormat(fileExtension: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const strippedExt = fileExtension.replace(/^\./, '').toUpperCase();

  if (!SUPPORTED_FORMATS.includes(strippedExt)) {
    errors.push(`Unsupported file format: ${fileExtension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}
