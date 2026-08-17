// NexCargo Module Template — MOD-003 Tracking & Visibility
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Logistics Execution | Constraint: No Dispatch Authority

export const MODULE_CONFIG = {
  id: 'MOD-003',
  name: 'Tracking & Visibility',
  domain: 'tracking',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: ['MOD-001', 'MOD-002', 'MOD-011', 'MOD-016'],
  usedBy: ['MOD-007', 'MOD-008', 'MOD-014'],
  constraints: [
    'No Dispatch Authority: Tracking events are informational only',
    'Event-Driven: State changes must originate from recorded events',
    'Append-Only: Events are immutable',
    'POD Mandatory: Proof of Delivery required before completion',
  ],
  schemas: ['logistics_schema'],
} as const;

export default MODULE_CONFIG;
