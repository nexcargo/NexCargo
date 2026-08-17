// NexCargo Module Template — MOD-005 Escrow & Payment Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Financial Infrastructure | Constraint: No Custody (CRITICAL)
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 805–808)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-005',
  name: 'Escrow & Payment Management',
  domain: 'financial',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-013', types: ['BC'], bidirectional: true },
    { target: 'MOD-016', types: ['IS', 'ES'] },
    { target: 'MOD-017', types: ['OB'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-002', types: ['DO', 'AU'] },
    { moduleId: 'MOD-013', types: ['BC'], bidirectional: true },
  ] satisfies ReverseDependency[],
  constraints: [
    'No Custody (CRITICAL): NexCargo NEVER holds funds. All funds exist in regulated external banking systems (ESS-001F)',
    'Internal states are non-authoritative mirrors',
    'Bank is final authority',
    'Idempotency required for all payment requests',
  ],
  schemas: ['financial_schema'],
} as const;

export default MODULE_CONFIG;
