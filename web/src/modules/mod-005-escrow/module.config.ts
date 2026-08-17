// NexCargo Module Template — MOD-005 Escrow & Payment Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Financial Infrastructure | Constraint: No Custody (CRITICAL)

export const MODULE_CONFIG = {
  id: 'MOD-005',
  name: 'Escrow & Payment Management',
  domain: 'financial',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-011', 'MOD-013', 'MOD-016', 'MOD-017'],
  usedBy: ['MOD-002', 'MOD-013'],
  constraints: [
    'No Custody (CRITICAL): NexCargo NEVER holds funds. All funds exist in regulated external banking systems (ESS-001F)',
    'Internal states are non-authoritative mirrors',
    'Bank is final authority',
    'Idempotency required for all payment requests',
  ],
  schemas: ['financial_schema'],
} as const;

export default MODULE_CONFIG;
