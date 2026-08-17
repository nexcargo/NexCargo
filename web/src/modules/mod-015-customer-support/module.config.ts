// NexCargo Module Template — MOD-015 Customer Support & Dispute Resolution
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Support | Constraint: Does NOT decide dispute outcomes
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 841–845)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-015',
  name: 'Customer Support & Dispute Resolution',
  domain: 'support',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-002', types: ['DO', 'AU'] },
    { target: 'MOD-004', types: ['DO', 'AU'] },
    { target: 'MOD-010', types: ['IS', 'AU'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
  ] satisfies TypedDependency[],
  usedBy: [] satisfies ReverseDependency[],
  constraints: [
    'Does NOT decide dispute outcomes',
    'Does NOT override financial/operational systems',
    'Does NOT execute corrective actions automatically',
    'Evidence-based — all disputes must reference MOD-004 evidence',
  ],
  schemas: ['compliance_schema'],
} as const;

export default MODULE_CONFIG;
