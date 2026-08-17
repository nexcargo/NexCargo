// NexCargo Module Template — MOD-004 Document Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Logistics Execution → Documentation | Constraint: Signed documents immutable
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 802–804)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-004',
  name: 'Document Management',
  domain: 'documents',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-002', types: ['DO', 'AU'] },
    { target: 'MOD-003', types: ['DO', 'AU'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-008', types: ['DO', 'AU'] },
    { moduleId: 'MOD-015', types: ['DO', 'AU'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'Signed/approved documents cannot be modified',
    'Orphan documents are invalid system states',
    'Malware scanning required before acceptance',
  ],
  schemas: ['logistics_schema', 'compliance_schema'],
} as const;

export default MODULE_CONFIG;
