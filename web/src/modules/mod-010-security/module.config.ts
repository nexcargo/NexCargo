// NexCargo Module Template — MOD-010 Security, Compliance & Governance
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Security | Constraint: Does NOT implement runtime security mechanisms

export const MODULE_CONFIG = {
  id: 'MOD-010',
  name: 'Security, Compliance & Governance',
  domain: 'security',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-011', 'MOD-017'],
  usedBy: ['All modules'],
  constraints: [
    'Does NOT implement runtime security mechanisms or authentication logic',
    'Roles strictly separated',
    'Audit records immutable',
    'AI cannot execute financial transactions or override compliance rules',
  ],
  schemas: ['compliance_schema'],
} as const;

export default MODULE_CONFIG;
