// NexCargo Module Template — MOD-014 Asset & Logistics Operations Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Logistics/Assets | Constraint: Read-only asset registry
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 837–840)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-014',
  name: 'Asset & Logistics Operations Management',
  domain: 'logistics',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-003', types: ['DO', 'AU'] },
    { target: 'MOD-009', types: ['BC'], bidirectional: true },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-009', types: ['BC'], bidirectional: true },
  ] satisfies ReverseDependency[],
  constraints: [
    'Read-only asset registry',
    'Does NOT dispatch vehicles, assign shipments, manage fleets operationally',
    'Vehicles under maintenance cannot be assigned',
  ],
  schemas: ['logistics_schema'],
} as const;

export default MODULE_CONFIG;
