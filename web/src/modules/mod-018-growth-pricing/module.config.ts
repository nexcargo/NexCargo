// NexCargo Module Template — MOD-018 Marketplace Growth & Pricing
// Generated per PROMPT 1 + PROMPT 3 architecture template
// Domain: Commercial | Constraint: Does NOT set/enforce prices
// Dependencies reconciled against PROMPT 0 v1.1 Authoritative Module Dependency Relationship Table (lines 848–851)

import type { TypedDependency, ReverseDependency } from '@/shared/types/enums';

export const MODULE_CONFIG = {
  id: 'MOD-018',
  name: 'Marketplace Growth & Pricing',
  domain: 'commercial',
  version: '1.0.0',
  status: 'SCHEDULED' as const,
  dependencies: [
    { target: 'MOD-001', types: ['DO', 'ES'] },
    { target: 'MOD-006', types: ['ES', 'DO'] },
    { target: 'MOD-012', types: ['DO', 'AU'] },
    { target: 'MOD-016', types: ['IS', 'ES'] },
  ] satisfies TypedDependency[],
  usedBy: [
    { moduleId: 'MOD-001', types: ['DO', 'ES'] },
    { moduleId: 'MOD-006', types: ['ES', 'DO'] },
  ] satisfies ReverseDependency[],
  constraints: [
    'Does NOT set/enforce prices, execute financial incentives, modify escrow/payment logic',
    'All outputs are non-binding recommendations only',
    'Market neutrality — no favoring specific users/fleets',
    'All commercial signals must originate from real system data',
    'Experiments must be reversible',
  ],
  schemas: ['analytics_schema'],
} as const;

export default MODULE_CONFIG;
