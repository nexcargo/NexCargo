// NexCargo MOD-015 — Case ID Generation Service
// C7-Increment-002 — Support ticket automatic case-ID generation
// Generates unique case identifiers following CASE-{8-char UUID prefix} format.

/**
 * Validates a user-supplied caseId against the accepted pattern.
 * Pattern: CASE-{alphanumeric characters, minimum 3 after dash}
 */
export function isValidCaseId(caseId: unknown): boolean {
  if (!caseId || typeof caseId !== 'string' || !caseId.trim()) {
    return false;
  }
  const trimmed = caseId.trim();
  return /^CASE-[A-Za-z0-9]{3,}$/.test(trimmed);
}

/**
 * Generates a unique case ID using crypto.randomUUID() prefix.
 * Format: CASE-{first 8 chars of UUID, uppercased}
 */
export function generateCaseId(): string {
  const uuid = crypto.randomUUID();
  return `CASE-${uuid.slice(0, 8).toUpperCase()}`;
}
