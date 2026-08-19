// NexCargo Wave 0 Shared Standard S-01: Audit Event Format
// Authoritative source: MOD-010 §4.5 (Audit Event Object) + MOD-017 §4.1 (Log Entry Object)
// All Wave 0 modules MUST use this format for audit events.
// Immutable once written — no UPDATE or DELETE operations on audit records.

/**
 * Unified audit event structure used by MOD-010, MOD-011, and MOD-017.
 * Conforms to MOD-010 §4.5 attributes with MOD-017 §4.1 log entry alignment.
 */
export interface AuditEvent {
  // Required fields
  auditEventId: string;       // UUID v4
  eventType: string;          // camelCase business event name (per Event Registry §7)
  moduleSource: 'MOD-010' | 'MOD-011' | 'MOD-017';
  userId?: string;            // Supabase Auth user ID
  userRole?: string;          // UserRole enum value
  timestamp: string;          // ISO 8601 with timezone
  affectedEntityType?: string;
  affectedEntityId?: string;
  actionType: 'READ' | 'WRITE' | 'APPROVE' | 'EXECUTE' | 'DELETE';
  metadata?: Record<string, unknown>;

  // Optional snapshot fields (for state-changing actions)
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;

  // Context fields
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;      // Must match originating request correlationId
}

/**
 * Creates a new audit event record.
 * @param params - Partial audit event parameters
 * @returns Complete audit event with generated ID and timestamp
 */
export function createAuditEvent(params: Partial<AuditEvent>): AuditEvent {
  const now = new Date().toISOString();
  return {
    auditEventId: crypto.randomUUID(),
    timestamp: now,
    ...params,
  } as AuditEvent;
}
