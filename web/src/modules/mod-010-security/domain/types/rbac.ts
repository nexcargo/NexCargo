// NexCargo MOD-010 Domain Types — RBAC Model Definition
// Authoritative source: MOD-010 §4.1 (Role Definition Object) + §4.2 (Permission Boundary Object)
// Implements exit criteria X-15: RoleDefinition and PermissionBoundary interfaces with full attribute sets
// HAO-R-003 RESOLVED: Super Admin = Moderator permissions + Admin permissions + Super Admin-only capabilities

/** Role category enum per MOD-010 §4.1. GOVERNANCE = Moderator scope; OPERATIONAL = Admin scope; SYSTEM = internal/automated actors only. */
export enum RoleCategory {
  /** Moderator: governance, moderation, dispute oversight */
  GOVERNANCE = 'GOVERNANCE',
  /** Admin: operational management, platform administration */
  OPERATIONAL = 'OPERATIONAL',
  /** System: API/internal services only — not a human application role */
  SYSTEM = 'SYSTEM',
}

/** Restriction level enum per MOD-010 §4.1 */
export enum RestrictionLevel {
  FULL = 'FULL',
  RESTRICTED = 'RESTRICTED',
  READ_ONLY = 'READ_ONLY',
  NONE = 'NONE',
}

/** Application role names per PROMPT 0 v1.1 §9.3 + HAO approved taxonomy. AI/system roles use ROLE_CATEGORY.SYSTEM. */
export type ApplicationRole = 'SHIPPER' | 'TRANSPORTER' | 'DRIVER' | 'DISPATCHER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

/** 
 * Role Definition Object — represents system access roles.
 * Per MOD-010 §4.1.
 * roleName uses ApplicationRole union for human users; SYSTEM for internal/automated actors.
 * 
 * SUPER ADMIN PRIVILEGE HIERARCHY (HAO-R-003 RESOLVED):
 * - Moderator: governance, moderation, dispute oversight
 * - Admin: operational management, platform administration  
 * - Super Admin = full Moderator capability + full Admin capability + Super Admin-only capabilities
 *   (includes global platform administration, privileged user/role admin, system-wide config,
 *    security/audit oversight, payment integration monitoring, escrow-bank monitoring, AI oversight,
 *    global analytics, feature/platform controls)
 * - Regular roles (Shipper, Transporter, Driver, Dispatcher) operate below Admin/Moderator tier
 */
export interface RoleDefinition {
  // Required attributes from MOD-010 §4.1
  roleId: string;               // UUID v4
  roleName: ApplicationRole | 'SYSTEM';
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
