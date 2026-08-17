// NexCargo Module Template — MOD-012 Data Platform Analytics & BI
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Analytics | Constraint: Does NOT compute KPIs at runtime

export const MODULE_CONFIG = {
  id: 'MOD-012',
  name: 'Data Platform Analytics & BI',
  domain: 'analytics',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['All modules'],
  usedBy: ['MOD-006', 'MOD-007', 'MOD-013', 'MOD-015', 'MOD-017'],
  constraints: [
    'Does NOT compute KPIs, execute analytics logic, or perform data transformations at runtime',
    'ALL data must originate from immutable event streams',
    'Raw event data never modified',
    'Corrections are new events, not overwrites',
  ],
  schemas: ['analytics_schema'],
} as const;

export default MODULE_CONFIG;
