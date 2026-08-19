// NexCargo MOD-010 Domain Utils — KYC/KYB Verification Status Manager
// Authoritative source: MOD-010 §4.3 (KYC/KYB Verification Record) + §4.1 (Role Definition Object)
// Coordinates verification status transitions and document linkage using Standard S-01 (AuditEvent).
// Per MOD-010 §7.2 (Role Isolation Rule): Roles MUST remain strictly separated.

import { VerificationRecord, VerificationType, VerificationLevel, VerificationStatus } from '@/modules/mod-010-security/domain/types/verification';
import type { AuditEvent } from '@/shared/standards/audit-event-format';

/** Valid verification status transitions per MOD-010 §4.3 */
const VALID_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  [VerificationStatus.PENDING]: [VerificationStatus.IN_PROGRESS],
  [VerificationStatus.IN_PROGRESS]: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED, VerificationStatus.PENDING],
  [VerificationStatus.VERIFIED]: [VerificationStatus.EXPIRED],
  [VerificationStatus.REJECTED]: [VerificationStatus.PENDING],
  [VerificationStatus.EXPIRED]: [VerificationStatus.PENDING],
};

/**
 * Checks whether a verification status transition is valid.
 * @param currentStatus - Current verification status
 * @param targetStatus - Desired target status
 * @returns true if the transition is allowed
 */
export function isValidVerificationTransition(currentStatus: VerificationStatus, targetStatus: VerificationStatus): boolean {
  const allowedTargets = VALID_TRANSITIONS[currentStatus];
  return !!allowedTargets && allowedTargets.includes(targetStatus);
}

/**
 * Gets the next possible statuses from a given verification status.
 * @param currentStatus - Current verification status
 * @returns Array of valid next statuses
 */
export function getNextPossibleVerificationStatuses(currentStatus: VerificationStatus): VerificationStatus[] {
  return [...VALID_TRANSITIONS[currentStatus]];
}

/**
 * Determines whether a verification record has reached a terminal state.
 * Terminal states are VERIFIED and REJECTED.
 * @param status - Verification status to check
 * @returns true if the verification cannot be further modified
 */
export function isVerificationTerminal(status: VerificationStatus): boolean {
  return status === VerificationStatus.VERIFIED || status === VerificationStatus.REJECTED;
}

/**
 * Creates a verification audit event for a status change.
 * @param record - Updated verification record
 * @param previousStatus - Previous verification status
 * @param correlationId - Correlation ID from request context
 * @returns AuditEvent documenting the verification status change
 */
export function createVerificationAuditEvent(
  record: VerificationRecord,
  previousStatus: VerificationStatus,
  correlationId: string
): AuditEvent {
  return {
    auditEventId: crypto.randomUUID(),
    eventType: `kyc${record.verificationType}verificationStatusChanged`,
    moduleSource: 'MOD-010',
    userId: record.userId,
    timestamp: new Date().toISOString(),
    affectedEntityType: 'VerificationRecord',
    affectedEntityId: record.verificationId,
    actionType: 'WRITE',
    metadata: {
      previousStatus,
      currentStatus: record.verificationStatus,
      verificationType: record.verificationType,
      verificationLevel: record.verificationLevel,
    },
    correlationId,
  };
}

/**
 * Validates that a verification record has all required fields populated.
 * Per MOD-010 §4.3: No user can operate without minimum verification level.
 * @param record - Verification record to validate
 * @returns true if the record passes completeness check
 */
export function isVerificationRecordComplete(record: VerificationRecord): boolean {
  return !!(
    record.verificationId &&
    record.userId &&
    record.verificationType &&
    record.verificationLevel &&
    record.verificationStatus &&
    record.verifiedAt &&
    record.documents &&
    record.documents.length > 0
  );
}
