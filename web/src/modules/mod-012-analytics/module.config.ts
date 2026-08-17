// NexCargo Module Template — MOD-012 Data Platform Analytics & BI
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Analytics | Constraint: Does NOT compute KPIs at runtime
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 829–833)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-012',
  name: 'Data Platform Analytics & BI',
  domain: 'analytics',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-001', types: ['DO', 'ES'] },
    { target: 'MOD-002', types: ['DO', 'ES'] },
    { target: 'MOD-003', types: ['DO', 'ES'] },
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-017', types: ['OB'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-006', types: ['DO', 'AU'] },
    { moduleId: 'MOD-018', types: ['DO', 'AU'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'Does NOT compute KPIs, execute analytics logic, or perform data transformations at runtime',
    'ALL data must originate from immutable event streams',
    'Raw event data never modified',
    'Corrections are new events, not overwrites',
  ],
  schemas: ['analytics_schema'],
} as const;

export default MODULE_CONFIG;
