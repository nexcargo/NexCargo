// NexCargo Module Template — MOD-006 AI Intelligence Platform
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: AI/Intelligence | Constraint: No Execution (CRITICAL)

export const MODULE_CONFIG = {
  id: 'MOD-006',
  name: 'AI Intelligence Platform',
  domain: 'ai',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [],
  usedBy: ['MOD-001', 'MOD-003', 'MOD-005', 'MOD-007', 'MOD-010', 'MOD-012', 'MOD-018'],
  constraints: [
    'No Execution (CRITICAL): AI does NOT execute actions. All outputs advisory only.',
    'Deterministic: identical inputs produce identical outputs',
    'Every output must include reasoning trace and confidence score',
    'Cannot approve financial operations, trigger settlements, auto-assign carriers',
  ],
  schemas: ['ai_schema'],
} as const;

export default MODULE_CONFIG;
