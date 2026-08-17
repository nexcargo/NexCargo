// NexCargo Module Template — MOD-004 Document Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Logistics Execution → Documentation | Constraint: Signed documents immutable

export const MODULE_CONFIG = {
  id: 'MOD-004',
  name: 'Document Management',
  domain: 'documents',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-002', 'MOD-003', 'MOD-005', 'MOD-010', 'MOD-016'],
  usedBy: ['MOD-007', 'MOD-015'],
  constraints: [
    'Signed/approved documents cannot be modified',
    'Orphan documents are invalid system states',
    'Malware scanning required before acceptance',
  ],
  schemas: ['logistics_schema', 'compliance_schema'],
} as const;

export default MODULE_CONFIG;
