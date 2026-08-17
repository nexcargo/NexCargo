// NexCargo Module Template — MOD-009 Regional & Cross-Border Logistics
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Regional/Cross-Border | Constraint: Does NOT execute customs clearance

export const MODULE_CONFIG = {
  id: 'MOD-009',
  name: 'Regional & Cross-Border Logistics',
  domain: 'regional',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-003', 'MOD-005', 'MOD-006', 'MOD-010', 'MOD-012', 'MOD-016'],
  usedBy: ['MOD-007'],
  constraints: [
    'Does NOT execute customs clearance, legal compliance, or regulatory enforcement',
    'Cross-border shipments MUST be split into logical segments',
    'Customs documentation validated before crossing (via MOD-004)',
  ],
  schemas: ['logistics_schema', 'compliance_schema'],
} as const;

export default MODULE_CONFIG;
