// NexCargo Module Template — MOD-009 Regional & Cross-Border Logistics
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Regional/Cross-Border | Constraint: Does NOT execute customs clearance
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 821–825)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-009',
  name: 'Regional & Cross-Border Logistics',
  domain: 'regional',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-003', types: ['DO', 'AU'] },
    { target: 'MOD-010', types: ['IS', 'AU'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-014', types: ['BC'], bidirectional: true },
    { target: 'MOD-016', types: ['IS', 'ES'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-014', types: ['BC'], bidirectional: true },
  ] satisfies ReverseDependency[],
  constraints: [
    'Does NOT execute customs clearance, legal compliance, or regulatory enforcement',
    'Cross-border shipments MUST be split into logical segments',
    'Customs documentation validated before crossing (via MOD-004)',
  ],
  schemas: ['logistics_schema', 'compliance_schema'],
} as const;

export default MODULE_CONFIG;
