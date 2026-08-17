// NexCargo Module Template — MOD-003 Tracking & Visibility
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Logistics Execution | Constraint: No Dispatch Authority
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 798–801)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-003',
  name: 'Tracking & Visibility',
  domain: 'tracking',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-001', types: ['DO', 'ES'] },
    { target: 'MOD-002', types: ['DO', 'ES'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-002', types: ['DO', 'ES'] },
    { moduleId: 'MOD-004', types: ['DO', 'AU'] },
    { moduleId: 'MOD-007', types: ['AU'] },
    { moduleId: 'MOD-008', types: ['DO', 'AU'] },
    { moduleId: 'MOD-009', types: ['DO', 'AU'] },
    { moduleId: 'MOD-012', types: ['DO', 'ES'] },
    { moduleId: 'MOD-014', types: ['DO', 'AU'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'No Dispatch Authority: Tracking events are informational only',
    'Event-Driven: State changes must originate from recorded events',
    'Append-Only: Events are immutable',
    'POD Mandatory: Proof of Delivery required before completion',
  ],
  schemas: ['logistics_schema'],
} as const;

export default MODULE_CONFIG;
