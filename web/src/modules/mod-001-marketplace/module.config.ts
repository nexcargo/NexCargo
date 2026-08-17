// NexCargo Module Template — MOD-001 Marketplace
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Marketplace | Constraint: No Auto-Booking, Advisory Only
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 789–792)

import type { DependencyType, TypedDependency, ReverseDependency } from '@/shared/types/enums';

/** Dependency types defined by PROMPT 0 v1.1 (closed taxonomy) */
export type DepType = DependencyType;

/** Module configuration */
export const MODULE_CONFIG = {
  id: 'MOD-001',
  name: 'Marketplace Layer',
  domain: 'marketplace',
  version: '1.0.0',
  status: 'SCHEDULED' as const, // SCHEDULED | IN_PROGRESS | COMPLETED | FROZEN
  dependencies: [
    { target: 'MOD-002', types: ['BC'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
    { target: 'MOD-018', types: ['DO', 'ES'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-002', types: ['BC'], bidirectional: true },
    { moduleId: 'MOD-003', types: ['DO', 'ES'] },
    { moduleId: 'MOD-006', types: ['DO', 'ES'] },
    { moduleId: 'MOD-007', types: ['AU'] },
    { moduleId: 'MOD-012', types: ['DO', 'ES'] },
    { moduleId: 'MOD-018', types: ['DO', 'ES'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'No Auto-Booking: Final selection requires explicit shipper confirmation',
    'Advisory Only: Ranking and quoting are recommendations, not decisions',
    'Platform Neutrality: Does not own trucks or manage fleet operations',
  ],
  schemas: ['marketplace_schema'],
} as const;

export default MODULE_CONFIG;
