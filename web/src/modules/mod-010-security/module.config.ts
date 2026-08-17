// NexCargo Module Template — MOD-010 Security, Compliance & Governance
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Security | Constraint: Does NOT implement runtime security mechanisms
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 826–827)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-010',
  name: 'Security, Compliance & Governance',
  domain: 'security',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-011', types: ['IS', 'AU'] },
    { target: 'MOD-017', types: ['OB'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-009', types: ['IS', 'AU'] },
    { moduleId: 'MOD-015', types: ['IS', 'AU'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'Does NOT implement runtime security mechanisms or authentication logic',
    'Roles strictly separated',
    'Audit records immutable',
    'AI cannot execute financial transactions or override compliance rules',
  ],
  schemas: ['compliance_schema'],
} as const;

export default MODULE_CONFIG;
