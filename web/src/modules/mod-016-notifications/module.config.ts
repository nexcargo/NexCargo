// NexCargo Module Template — MOD-016 Notifications & Messaging
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Communication | Constraint: Does NOT trigger business logic

export const MODULE_CONFIG = {
  id: 'MOD-016',
  name: 'Notifications & Messaging',
  domain: 'communication',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-011'],
  usedBy: ['All modules'],
  constraints: [
    'Does NOT decide what messages mean, trigger business logic, change states',
    'Only transmits structured information',
    'All messages must originate from system events with correlationId',
    'Critical alerts bypass user restrictions',
  ],
  schemas: ['communication_schema'],
} as const;

export default MODULE_CONFIG;
