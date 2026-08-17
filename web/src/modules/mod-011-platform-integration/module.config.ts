// NexCargo Module Template — MOD-011 Platform Integration APIs
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Integration | Constraint: No ad-hoc integrations allowed

export const MODULE_CONFIG = {
  id: 'MOD-011',
  name: 'Platform Integration APIs',
  domain: 'integration',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['All modules'],
  usedBy: ['All modules'],
  constraints: [
    'No ad-hoc integrations allowed',
    'All integrations defined BEFORE implementation',
    'External systems treated as untrusted — all inputs validated',
    'Breaking changes require new versions',
    'No direct financial execution via external APIs',
  ],
  schemas: ['platform_infrastructure_schema'],
} as const;

export default MODULE_CONFIG;
