// NexCargo Module Template — MOD-017 System Observability & DevOps
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Observability | Constraint: No Intervention (CRITICAL)
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (line 847)
// NOTE: "All Modules" is a special OB (Observability) declaration per PROMPT 0 v1.1 Rule DS-008.
//       OB relationships are non-blocking — MOD-017 observing does not block normal module operation.

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-017',
  name: 'System Observability & DevOps',
  domain: 'observability',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'All Modules', types: ['OB'] },
  ] satisfies TypedDependency[],
  // Mechanical reverse lookup of all modules that depend on MOD-017 [OB].
  usedBy: [
    { moduleId: 'MOD-002', types: ['OB'] },
    { moduleId: 'MOD-005', types: ['OB'] },
    { moduleId: 'MOD-010', types: ['OB'] },
    { moduleId: 'MOD-012', types: ['OB'] },
    { moduleId: 'MOD-013', types: ['OB'] },
  ] satisfies ReverseDependency[],
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
