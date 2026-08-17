// NexCargo Module Template — MOD-006 AI Intelligence Platform
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: AI/Intelligence | Constraint: No Execution (CRITICAL)
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 809–811)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-006',
  name: 'AI Intelligence Platform',
  domain: 'ai',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-001', types: ['DO', 'ES'] },
    { target: 'MOD-012', types: ['DO', 'AU'] },
    { target: 'MOD-018', types: ['ES', 'DO'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-007', types: ['AU'] },
    { moduleId: 'MOD-018', types: ['ES', 'DO'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'No Execution (CRITICAL): AI does NOT execute actions. All outputs advisory only.',
    'Deterministic: identical inputs produce identical outputs',
    'Every output must include reasoning trace and confidence score',
    'Cannot approve financial operations, trigger settlements, auto-assign carriers',
  ],
  schemas: ['ai_schema'],
} as const;

export default MODULE_CONFIG;
