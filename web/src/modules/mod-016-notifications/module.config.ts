// NexCargo Module Template — MOD-016 Notifications & Messaging
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Communication | Constraint: Does NOT trigger business logic
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (line 846)
// NOTE: Many modules have IS/ES relationships TO MOD-016. They appear in each module's config.
//       This module only declares its own outbound dependency on MOD-011.

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-016',
  name: 'Notifications & Messaging',
  domain: 'communication',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-011', types: ['IS', 'AU'] },
  ] satisfies TypedDependency[],
  // Mechanical reverse lookup of all modules that depend on MOD-016 [IS/ES].
  usedBy: [
    { moduleId: 'MOD-001', types: ['IS', 'ES'] },
    { moduleId: 'MOD-002', types: ['IS', 'ES'] },
    { moduleId: 'MOD-003', types: ['IS', 'ES'] },
    { moduleId: 'MOD-005', types: ['IS', 'ES'] },
    { moduleId: 'MOD-007', types: ['AU'] },
    { moduleId: 'MOD-008', types: ['IS', 'ES'] },
    { moduleId: 'MOD-009', types: ['IS', 'ES'] },
    { moduleId: 'MOD-014', types: ['IS', 'ES'] },
    { moduleId: 'MOD-015', types: ['IS', 'ES'] },
    { moduleId: 'MOD-018', types: ['IS', 'ES'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'Does NOT decide what messages mean, trigger business logic, change states',
    'Only transmits structured information',
    'All messages must originate from system events with correlationId',
    'Critical alerts bypass user restrictions',
  ],
  schemas: ['communication_schema'],
} as const;

export default MODULE_CONFIG;
