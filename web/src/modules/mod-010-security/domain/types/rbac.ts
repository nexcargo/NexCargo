// NexCargo MOD-010 Domain Types — RBAC Model Definition
// Authoritative source: MOD-010 §4.1 (Role Definition Object) + §4.2 (Permission Boundary Object)
// Implements exit criteria X-15: RoleDefinition and PermissionBoundary interfaces with full attribute sets

/**
 * Role category enum per MOD-010 §4.1
 */
export enum RoleCategory {
  OPERATIONAL = 'OPERATIONAL',
  GOVERNANCE = 'GOVERNANCE',
  SYSTEM = 'SYSTEM',
}

/**
 * Restriction level enum per MOD-010 §4.1
 */
export enum RestrictionLevel {
  FULL = 'FULL',
  RESTRICTED = 'RESTRICTED',
  READ_ONLY = 'READ_ONLY',
  NONE = 'NONE',
}

/**
 * Role Definition Object — represents system access roles.
 * Per MOD-010 §4.1.
 */
export interface RoleDefinition {
  // Required attributes from MOD-010 §4.1
  roleId: string;               // UUID v4
  roleName: 'SHIPPER' | 'TRANSPORTER' | 'DRIVER' | 'MODERATOR' | 'ADMIN' | 'SYSTEM';
  roleCategory: RoleCategory;
  permissionScope: Record<string, unknown>; // Structured permission set
  moduleAccessList: string[];   // Array of module references (MOD-001 through MOD-018)
  restrictionLevel: RestrictionLevel;
}

/**
 * Action type enum per MOD-010 §4.2
 */
export enum ActionType {
  READ = 'READ',
  WRITE = 'WRITE',
  APPROVE = 'APPROVE',
  EXECUTE = 'EXECUTE',
  DELETE = 'DELETE',
}

/**
 * Constraint level enum per MOD-010 §4.2
 */
export enum ConstraintLevel {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
  CONDITIONAL = 'CONDITIONAL',
}

/**
 * Enforcement source enum per MOD-010 §4.2
 */
export enum EnforcementSource {
  ESS = 'ESS',
  MOD = 'MOD',
  SYSTEM = 'SYSTEM',
}

/**
 * Permission Boundary Object — represents structural access limits.
 * Per MOD-010 §4.2.
 */
export interface PermissionBoundary {
  // Core attributes from MOD-010 §4.2
  permissionId: string;         // UUID v4
  roleId: string;               // References RoleDefinition.roleId
  moduleId: string;             // Module reference (MOD-001 through MOD-018)
  actionType: ActionType;
  constraintLevel: ConstraintLevel;
  enforcementSource: EnforcementSource;
  conditionRules?: Record<string, unknown>; // Optional conditional logic structure
}
