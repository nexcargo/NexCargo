// NexCargo Module Template — MOD-017 System Observability & DevOps
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Observability | Constraint: No Intervention (CRITICAL)

export const MODULE_CONFIG = {
  id: 'MOD-017',
  name: 'System Observability & DevOps',
  domain: 'observability',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['All modules'],
  usedBy: ['All modules'],
  constraints: [
    'No Intervention (CRITICAL): Observability observes only, does NOT fix issues or restart services',
    'Does NOT fix issues, modify behavior, trigger business logic, resolve incidents automatically',
    'Every system action must be traceable',
    'Logs, metrics, and traces linked via correlationId',
    'No silent modules allowed',
  ],
  schemas: ['platform_infrastructure_schema'],
} as const;

export default MODULE_CONFIG;
