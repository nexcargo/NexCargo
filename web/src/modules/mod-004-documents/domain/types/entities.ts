// NexCargo MOD-004 — Document Management Module Domain Types
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-004 §4 Core Domain Entities (4.1–4.7)

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { UserRole } from '@/shared/types/enums';
import type { DocumentTypeExtended, DocumentStatus, RenewalStatus, OperationalImpact, SignatureVerificationMethod, LinkedEntityType, RelationshipType } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Content snapshot for immutable document versioning per MOD-004 §4.2 */
export interface ContentSnapshot {
  /** Structured payload representation, not a file blob */
  data: Record<string, unknown>;
  /** Description of what changed in this version */
  changeSummary: string;
}

/** File metadata reference (pointer to encrypted external storage) per MOD-004 §4.1 */
export interface FileMetadata {
  /** Pointer to encrypted storage location (not the file itself) */
  fileReference: string;
  /** Integrity checksum hash */
  fileHash: string;
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * Document — the core structured logistics document entity.
 * Per MOD-004 §4.1
 * Every uploaded document receives a unique identifier and is linked to at least one system entity.
 * Documents cannot be permanently deleted if referenced by completed transactions.
 * Soft deletion applies where permitted by policy.
 * Files are scanned for malware before acceptance (design-time validation only).
 */
export interface Document extends BaseEntity {
  /** Business identifier for the document */
  documentId: string;
  /** Type classification — includes shared DocumentType values plus MOD-004 extensions */
  documentType: DocumentTypeExtended;
  /** The type of entity this document links to (shipment/booking/contract/user/vehicle/driver) */
  linkedEntityType: LinkedEntityType;
  /** Identifier of the linked entity */
  linkedEntityId: string;
  /** Current lifecycle status per MOD-004 §4.1 / §5 */
  status: DocumentStatus;
  /** User who created or last updated the document */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Pointer to encrypted external storage (not the file binary itself) */
  fileReference: string;
  /** Integrity checksum for verification */
  fileHash: string;
  /** Optional expiry date for documents with validity periods */
  expiryDate?: Date;
  /** Optional issue date for documents with validity periods */
  issueDate?: Date;
}

/**
 * DocumentVersion — immutable version of a document.
 * Per MOD-004 §4.2
 * Once approved or signed, a version CANNOT be modified; updates MUST create a new version.
 */
export interface DocumentVersion extends BaseEntity {
  /** Business identifier for the version */
  versionId: string;
  /** The document this version belongs to */
  documentId: string;
  /** Sequential version number (starts at 1) */
  versionNumber: number;
  /** Structured content snapshot — not the file blob */
  contentSnapshot: ContentSnapshot;
  /** ISO 8601 creation timestamp */
  createdAt: Date;
  /** User who created this version */
  createdBy: string;
}

/**
 * DocumentApprovalRecord — tracks approval flow state for documents requiring review.
 * Per MOD-004 §4.3
 */
export interface DocumentApprovalRecord extends BaseEntity {
  /** Business identifier for the approval record */
  approvalId: string;
  /** The document being approved */
  documentId: string;
  /** Role of the person performing approval */
  approverRole: UserRole;
  /** Approval outcome */
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** Timestamp of the approval action */
  timestamp: Date;
  /** Optional reviewer comments */
  comments?: string;
}

/**
 * DocumentLinkageObject — represents relationships between documents and system modules/entities.
 * Per MOD-004 §4.4
 * Traceability rule: Every document MUST be linked to at least one system entity.
 * Orphan documents are not valid system states.
 */
export interface DocumentLinkageObject extends BaseEntity {
  /** Business identifier for the linkage record */
  linkageId: string;
  /** The document being linked */
  documentId: string;
  /** Module reference (MOD-001 through MOD-018) */
  moduleReference: string;
  /** Reference to the specific entity within that module */
  entityReference: string;
  /** How this document relates to the referenced entity */
  relationshipType: RelationshipType;
}

/**
 * OcrExtractionResult — structured data extracted from an uploaded document.
 * Per MOD-004 §4.5
 * OCR confidence score is generated for every extraction.
 * Manual correction is supported and tracked.
 * OCR data is advisory — manually corrected values supersede OCR output.
 */
export interface OcrExtractionResult extends BaseEntity {
  /** Business identifier for the extraction result */
  extractionId: string;
  /** The document being processed */
  documentId: string;
  /** Extracted key-value pairs from the document */
  extractedFields: Record<string, string>;
  /** Overall OCR confidence score (0–100) */
  confidenceScore: number;
  /** Per-field confidence scores keyed by field name */
  fieldConfidenceScores: Record<string, number>;
  /** Whether a user has reviewed the extraction */
  userReviewed: boolean;
  /** JSON object of corrected values (where applicable) */
  userCorrections: Record<string, string>;
  /** Processing completion timestamp */
  processedAt: Date;
}

/**
 * DigitalSignatureRecord — records a legally binding electronic signature applied to a document.
 * Per MOD-004 §4.6
 * Signer identity MUST be verified before signature.
 * Signed documents become immutable.
 * Signature certificates are retained for verification.
 * Duplicate signatures are prevented.
 */
export interface DigitalSignatureRecord extends BaseEntity {
  /** Business identifier for the signature record */
  signatureId: string;
  /** The document being signed */
  documentId: string;
  /** ID of the signer */
  signerId: string;
  /** Role of the signer (SHIPPER/TRANSPORTER/DRIVER/RECIPIENT) */
  signerRole: UserRole;
  /** ISO 8601 timestamp when signature was applied */
  signatureTimestamp: Date;
  /** Reference to the certificate authority */
  signatureCertificate: string;
  /** Method used for identity verification before signing */
  verificationMethod: SignatureVerificationMethod;
  /** IP address of the signer (optional, for audit purposes) */
  ipAddress?: string;
  /** User agent of the signer (optional, for audit purposes) */
  userAgent?: string;
}

/**
 * DocumentExpiryRecord — tracks expiry monitoring and renewal for documents with validity periods.
 * Per MOD-004 §4.7
 * Every applicable document stores: issue date, expiry date, and renewal status.
 * Expired mandatory documents automatically affect operational eligibility.
 * Renewal replaces the previous version while preserving document history.
 * Expired documents remain archived for audit purposes.
 */
export interface DocumentExpiryRecord extends BaseEntity {
  /** Business identifier for the expiry record */
  expiryRecordId: string;
  /** The document whose expiry is being tracked */
  documentId: string;
  /** Type of document (for filtering/expiry policies) */
  documentType: DocumentTypeExtended;
  /** Identifier of the entity this document is linked to */
  linkedEntityId: string;
  /** Date the document was issued */
  issueDate: Date;
  /** Date the document expires */
  expiryDate: Date;
  /** Current renewal status */
  renewalStatus: RenewalStatus;
  /** Array of timestamps when reminders were sent */
  reminderSentAt: string[]; // ISO 8601 timestamps
  /** Reference to the renewed document version (if already renewed) */
  renewedDocumentId?: string;
  /** Operational impact level on expiry */
  operationalImpact: OperationalImpact;
}
