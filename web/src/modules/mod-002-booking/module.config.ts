// NexCargo Module Template — MOD-002 Booking & Contract Management
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Marketplace → Contractual | Constraint: Contract Immutability
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 793–797)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-002',
  name: 'Booking & Contract Management',
  domain: 'booking',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-001', types: ['BC'], bidirectional: true },
    { target: 'MOD-005', types: ['DO', 'AU'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
    { target: 'MOD-017', types: ['OB'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-001', types: ['BC'], bidirectional: true },
    { moduleId: 'MOD-003', types: ['DO', 'ES'] },
    { moduleId: 'MOD-004', types: ['DO', 'AU'] },
    { moduleId: 'MOD-007', types: ['AU'] },
    { moduleId: 'MOD-012', types: ['DO', 'ES'] },
    { moduleId: 'MOD-015', types: ['DO', 'AU'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'Contract Immutability: Contracts immutable once signed',
    'Tracking Obligation: Tracking is a contractual clause',
    'Completion Tied to MOD-003 DeliveryConfirmed event',
  ],
  schemas: ['marketplace_schema', 'logistics_schema'],
} as const;

export default MODULE_CONFIG;
