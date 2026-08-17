// NexCargo Module Template — MOD-013 Payments, Escrow & Financial Infrastructure
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Financial Infrastructure | Constraint: ABSOLUTE No Custody
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 834–836)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-013',
  name: 'Payments, Escrow & Financial Infrastructure',
  domain: 'financial',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-005', types: ['BC'], bidirectional: true },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-017', types: ['OB'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-005', types: ['BC'], bidirectional: true },
  ] satisfies ReverseDependency[],
  constraints: [
    'ABSOLUTE: NexCargo MUST NEVER hold customer funds',
    'External banks are ONLY execution authority',
    'Double-entry recording required',
    'Zero tolerance mismatch between ledger and escrow records',
    'Daily reconciliation mandatory',
    'AI cannot initiate financial transfers',
  ],
  schemas: ['financial_schema'],
} as const;

export default MODULE_CONFIG;
