// NexCargo Module Template — MOD-001 Marketplace
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Marketplace | Constraint: No Auto-Booking, Advisory Only

/** Module configuration */
export const MODULE_CONFIG = {
  id: 'MOD-001',
  name: 'Marketplace Layer',
  domain: 'marketplace',
  version: '1.0.0',
  status: 'SCHEDULED' as const, // SCHEDULED | IN_PROGRESS | COMPLETED | FROZEN
  dependencies: [],
  usedBy: ['MOD-003', 'MOD-007', 'MOD-014'],
  constraints: [
    'No Auto-Booking: Final selection requires explicit shipper confirmation',
    'Advisory Only: Ranking and quoting are recommendations, not decisions',
    'Platform Neutrality: Does not own trucks or manage fleet operations',
  ],
  schemas: ['marketplace_schema'],
} as const;

export default MODULE_CONFIG;
