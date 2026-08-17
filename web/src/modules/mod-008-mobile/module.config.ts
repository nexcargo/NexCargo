// NexCargo Module Template — MOD-008 Mobile Applications
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Mobile/Edge | Constraint: Server state is ALWAYS authoritative
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 817–820)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-008',
  name: 'Mobile Applications',
  domain: 'mobile',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-003', types: ['DO', 'AU'] },
    { target: 'MOD-004', types: ['DO', 'AU'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
  ] satisfies TypedDependency[],
  // No modules depend on MOD-008 (no inbound relationships in PROMPT 0 v1.1).
  usedBy: [] satisfies ReverseDependency[],
  constraints: [
    'Server state is ALWAYS authoritative',
    'Event order integrity preserved during sync',
    'No autonomous decision-making at edge',
    'No financial or contractual logic at edge',
  ],
  schemas: [],
} as const;

export default MODULE_CONFIG;
