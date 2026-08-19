// NexCargo MOD-010 Domain Types — KYC/KYB Verification Record Structure
// Authoritative source: MOD-010 §4.3 (KYC/KYB Verification Record)
// Implements exit criteria X-16: Verification levels, status workflows, MOD-004 document linkage

/**
 * Verification type enum per MOD-010 §4.3
 */
export enum VerificationType {
  KYC = 'KYC',
  KYB = 'KYB',
}

/**
 * Verification level enum per MOD-010 §4.3
 */
export enum VerificationLevel {
  BASIC = 'BASIC',                          // Email/phone
  VERIFIED_INDIVIDUAL = 'VERIFIED_INDIVIDUAL',
  VERIFIED_BUSINESS = 'VERIFIED_BUSINESS',
  ENHANCED = 'ENHANCED',
}

/**
 * Verification status enum per MOD-010 §4.3
 */
export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/**
 * KYC/KYB Verification Record Object — represents identity verification status for a user.
 * Per MOD-010 §4.3. Links to MOD-004 Document Management via documents array.
 */
export interface VerificationRecord {
  // Core attributes from MOD-010 §4.3
  verificationId: string;           // UUID v4
  userId: string;                   // Supabase Auth user ID
  verificationType: VerificationType;
  verificationLevel: VerificationLevel;
  verificationStatus: VerificationStatus;
  verifiedAt: string;               // ISO 8601
  expiryDate?: string;              // Optional — when verification expires
  documents: string[];              // Array of document references (MOD-004 document IDs)
  externalReferenceId?: string;     // Reference to external verification provider
}
