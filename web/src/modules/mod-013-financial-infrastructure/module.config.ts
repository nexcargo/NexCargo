// NexCargo Module Template — MOD-013 Payments, Escrow & Financial Infrastructure
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Financial Infrastructure | Constraint: ABSOLUTE No Custody

export const MODULE_CONFIG = {
  id: 'MOD-013',
  name: 'Payments, Escrow & Financial Infrastructure',
  domain: 'financial',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-002', 'MOD-003', 'MOD-006', 'MOD-010', 'MOD-012', 'MOD-015', 'MOD-016'],
  usedBy: ['MOD-005'],
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
