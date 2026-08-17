// NexCargo Module Template — MOD-014 Asset & Logistics Operations Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Logistics/Assets | Constraint: Read-only asset registry

export const MODULE_CONFIG = {
  id: 'MOD-014',
  name: 'Asset & Logistics Operations Management',
  domain: 'logistics',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-001', 'MOD-002', 'MOD-003', 'MOD-006', 'MOD-009', 'MOD-010', 'MOD-012'],
  usedBy: ['MOD-001', 'MOD-007'],
  constraints: [
    'Read-only asset registry',
    'Does NOT dispatch vehicles, assign shipments, manage fleets operationally',
    'Vehicles under maintenance cannot be assigned',
  ],
  schemas: ['logistics_schema'],
} as const;

export default MODULE_CONFIG;
