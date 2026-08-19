// NexCargo MOD-010 Domain Utils — RBAC Permission Evaluator
// Authoritative source: MOD-010 §4.1 (Role Definition Object) + §4.2 (Permission Boundary Object)
// Evaluates PermissionBoundary constraints against RoleDefinition for governance workflows.
// No runtime enforcement — results feed into governance review processes.

import { RoleDefinition, ActionType, ConstraintLevel } from '@/modules/mod-010-security/domain/types/rbac';
import type { PermissionBoundary } from '@/modules/mod-010-security/domain/types/rbac';

/** Result of a permission evaluation */
export interface PermissionEvaluationResult {
  granted: boolean;
  reason: string;
  constraintLevel: ConstraintLevel;
}

/**
 * Evaluates whether a role has permission to perform an action on a module resource.
 * @param role - Role definition to evaluate
 * @param permission - Permission boundary to check
 * @returns PermissionEvaluationResult with grant decision and reasoning
 */
export function evaluatePermission(
  role: RoleDefinition,
  permission: PermissionBoundary
): PermissionEvaluationResult {
  // Check if the role is in the permission's scope
  const isRoleMatch = permission.roleId === role.roleId;
  if (!isRoleMatch) {
    return {
      granted: false,
      reason: `Role ${role.roleName} does not match permission target role`,
      constraintLevel: ConstraintLevel.DENY,
    };
  }

  // Check if the module is in the role's access list
  const isInModuleList = role.moduleAccessList.includes(permission.moduleId);
  if (!isInModuleList) {
    return {
      granted: false,
      reason: `${permission.moduleId} not in role's module access list`,
      constraintLevel: ConstraintLevel.DENY,
    };
  }

  // Evaluate constraint level
  switch (permission.constraintLevel) {
    case ConstraintLevel.ALLOW:
      return {
        granted: true,
        reason: `Permission ALLOWED for ${permission.actionType} on ${permission.moduleId}`,
        constraintLevel: ConstraintLevel.ALLOW,
      };
    case ConstraintLevel.DENY:
      return {
        granted: false,
        reason: `Permission DENIED for ${permission.actionType} on ${permission.moduleId}`,
        constraintLevel: ConstraintLevel.DENY,
      };
    case ConstraintLevel.CONDITIONAL:
      return {
        granted: permission.conditionRules !== undefined && Object.keys(permission.conditionRules).length > 0,
        reason: `Conditional permission requires explicit condition rules evaluation`,
        constraintLevel: ConstraintLevel.CONDITIONAL,
      };
    default:
      return {
        granted: false,
        reason: 'Unknown constraint level',
        constraintLevel: ConstraintLevel.DENY,
      };
  }
}

/**
 * Checks whether a restriction level permits a given action type.
 * Per MOD-010 §4.1: Restriction levels define what actions are possible.
 * @param restrictionLevel - Role restriction level
 * @param actionType - Action being requested
 * @returns true if the restriction level permits this action
 */
export function restrictionPermitsAction(
  restrictionLevel: RoleDefinition['restrictionLevel'],
  actionType: ActionType
): boolean {
  switch (restrictionLevel) {
    case 'FULL':
      return true;
    case 'READ_ONLY':
      return actionType === 'READ';
    case 'RESTRICTED':
      return ['READ', 'WRITE'].includes(actionType);
    case 'NONE':
      return false;
    default:
      return false;
  }
}
