// NexCargo Module Template — MOD-007 User Dashboards & Experience
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Experience/UI | Constraint: UI is NOT a security layer
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 812–816)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-007',
  name: 'User Dashboards & Experience',
  domain: 'experience',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-001', types: ['AU'] },
    { target: 'MOD-002', types: ['AU'] },
    { target: 'MOD-003', types: ['AU'] },
    { target: 'MOD-006', types: ['AU'] },
    { target: 'MOD-016', types: ['AU'] },
  ] satisfies TypedDependency[],
  // No modules depend on MOD-007 (no inbound relationships in PROMPT 0 v1.1).
  usedBy: [] satisfies ReverseDependency[],
  constraints: [
    'UI is NOT a security layer — backend enforces security',
    'Must bind to module-defined data structures',
    'AI outputs clearly marked as recommendations',
    'No UI element may trigger financial/contractual execution directly',
  ],
  schemas: [],
} as const;

export default MODULE_CONFIG;
