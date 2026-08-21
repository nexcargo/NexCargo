// NexCargo MOD-001 — RBAC Middleware Utility
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Wrapper around MOD-010 RBAC evaluation for use in API route handlers.

import type { RBACEvaluationResult } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';

/**
 * Evaluates RBAC permissions for marketplace API operations.
 * This is a wrapper that provides consistent error handling for API routes.
 * 
 * @param role - User role (e.g., 'SHIPPER', 'TRANSPORTER')
 * @param resource - Resource being accessed (e.g., 'listings', 'offers')
 * @param action - Action being performed (e.g., 'create', 'read', 'update', 'delete')
 * @returns RBACEvaluationResult with permitted boolean
 */
export async function validateRBAC(
  role: string,
  resource: string,
  action: string,
): Promise<RBACEvaluationResult> {
  // Synchronous evaluation (no async dependencies)
  return evaluateRBAC(role, resource, action);
}
