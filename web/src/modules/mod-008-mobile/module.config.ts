// NexCargo Module Template — MOD-008 Mobile Applications
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Mobile/Edge | Constraint: Server state is ALWAYS authoritative

export const MODULE_CONFIG = {
  id: 'MOD-008',
  name: 'Mobile Applications',
  domain: 'mobile',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-003', 'MOD-005', 'MOD-006', 'MOD-007', 'MOD-010'],
  usedBy: [],
  constraints: [
    'Server state is ALWAYS authoritative',
    'Event order integrity preserved during sync',
    'No autonomous decision-making at edge',
    'No financial or contractual logic at edge',
  ],
  schemas: [],
} as const;

export default MODULE_CONFIG;
