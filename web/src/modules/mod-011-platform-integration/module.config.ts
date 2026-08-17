// NexCargo Module Template — MOD-011 Platform Integration APIs
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Integration | Constraint: No ad-hoc integrations allowed
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (line 828)
// NOTE: "All Modules" is a special infrastructure declaration per PROMPT 0 v1.1 Rule DS-009.
//       It MUST NOT be interpreted as literal code imports. Each consuming module declares its own IS/AU relationship to MOD-011.

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-011',
  name: 'Platform Integration APIs',
  domain: 'integration',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'All Modules', types: ['IS', 'ES', 'OB'] },
  ] satisfies TypedDependency[],
  // Mechanical reverse lookup of all modules that depend on MOD-011 [IS/AU].
  usedBy: [
    { moduleId: 'MOD-001', types: ['IS', 'AU'] },
    { moduleId: 'MOD-002', types: ['IS', 'AU'] },
    { moduleId: 'MOD-003', types: ['IS', 'AU'] },
    { moduleId: 'MOD-004', types: ['IS', 'AU'] },
    { moduleId: 'MOD-005', types: ['IS', 'AU'] },
    { moduleId: 'MOD-006', types: ['IS', 'AU'] },
    { moduleId: 'MOD-007', types: ['IS', 'AU'] },
    { moduleId: 'MOD-008', types: ['IS', 'AU'] },
    { moduleId: 'MOD-009', types: ['IS', 'AU'] },
    { moduleId: 'MOD-010', types: ['IS', 'AU'] },
    { moduleId: 'MOD-012', types: ['IS', 'AU'] },
    { moduleId: 'MOD-013', types: ['IS', 'AU'] },
    { moduleId: 'MOD-014', types: ['IS', 'AU'] },
    { moduleId: 'MOD-015', types: ['IS', 'AU'] },
    { moduleId: 'MOD-016', types: ['IS', 'AU'] },
    { moduleId: 'MOD-017', types: ['IS', 'AU'] },
    { moduleId: 'MOD-018', types: ['IS', 'AU'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'No ad-hoc integrations allowed',
    'All integrations defined BEFORE implementation',
    'External systems treated as untrusted — all inputs validated',
    'Breaking changes require new versions',
    'No direct financial execution via external APIs',
  ],
  schemas: ['platform_infrastructure_schema'],
} as const;

export default MODULE_CONFIG;
