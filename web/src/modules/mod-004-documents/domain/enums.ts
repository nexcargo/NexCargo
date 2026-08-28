// NexCargo MOD-004 — Document Management Module Local Enums
// Wave 2 — Stage 2B, Increment 2 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-004 §4 Core Domain Entities, §5 Lifecycle Model
//
// Note: DocumentType base values (CONTRACT, POD, BILL_OF_LADING, CUSTOMS_DOCUMENT,
// VEHICLE_REGISTRATION, DRIVER_LICENSE, INSURANCE_CERTIFICATE) are defined in the
// shared @/shared/types/enums. MOD-004 extends with additional types required by
// §4.1 that are not present in the shared set.

/** Extended document type — adds MOD-004-specific types beyond shared DocumentType */
export type DocumentTypeExtended = `${SharedDocumentType}` | 'INVOICE' | 'COMPLIANCE' | 'SHIPPING_MANIFEST' | 'DELIVERY_ORDER' | 'OPERATING_LICENSE' | 'COMPLIANCE_CERTIFICATE';

type SharedDocumentType = 'CONTRACT' | 'POD' | 'BILL_OF_LADING' | 'CUSTOMS_DOCUMENT' | 'VEHICLE_REGISTRATION' | 'DRIVER_LICENSE' | 'INSURANCE_CERTIFICATE';

/** Document lifecycle status per MOD-004 §4.1 */
export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  VALIDATED = 'VALIDATED',
  ACTIVE = 'ACTIVE',
  REVIEW = 'REVIEW',
  SIGNED = 'SIGNED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  RENEWED = 'RENEWED',
  ARCHIVED = 'ARCHIVED',
}

/** Renewal status for documents with validity periods per MOD-004 §4.7 */
export enum RenewalStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  RENEWED = 'RENEWED',
  RENEWAL_PENDING = 'RENEWAL_PENDING',
}

/** Operational impact of expired mandatory documents per MOD-004 §4.7 */
export enum OperationalImpact {
  NONE = 'NONE',
  WARNING = 'WARNING',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
}

/** Verification method for digital signatures per MOD-004 §4.6 */
export enum SignatureVerificationMethod {
  OTP = 'OTP',
  BIOMETRIC = 'BIOMETRIC',
  DIGITAL_CERTIFICATE = 'DIGITAL_CERTIFICATE',
  PIN = 'PIN',
}

/** Entity types that a document can link to per MOD-004 §4.1 */
export type LinkedEntityType = 'shipment' | 'booking' | 'contract' | 'user' | 'vehicle' | 'driver';

/** Relationship types between documents and system modules per MOD-004 §4.4 */
export enum RelationshipType {
  SUPPORTS = 'supports',
  DERIVES = 'derives',
  VERIFIES = 'verifies',
  VALIDATES = 'validates',
}

/** OCR processing state per MOD-004 §4.5 */
export enum OcrProcessingState {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
