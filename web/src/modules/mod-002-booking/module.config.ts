// NexCargo Module Template — MOD-002 Booking & Contract Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Marketplace → Contractual | Constraint: Contract Immutability

export const MODULE_CONFIG = {
  id: 'MOD-002',
  name: 'Booking & Contract Management',
  domain: 'booking',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-001', 'MOD-005', 'MOD-011', 'MOD-016', 'MOD-017'],
  usedBy: ['MOD-003', 'MOD-007', 'MOD-015'],
  constraints: [
    'Contract Immutability: Contracts immutable once signed',
    'Tracking Obligation: Tracking is a contractual clause',
    'Completion Tied to MOD-003 DeliveryConfirmed event',
  ],
  schemas: ['marketplace_schema', 'logistics_schema'],
} as const;

export default MODULE_CONFIG;
