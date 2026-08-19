// NexCargo MOD-010 Domain Types — AI Governance Constraint Framework
// Authoritative source: MOD-010 §4.9 (AI Governance Constraint) + §3.5 (Governance Model)
// Implements exit criteria X-22: Constraint types, enforcement levels, violation actions

/**
 * AI module reference — always MOD-006 per MOD-010 §4.9
 */
export const AIMODULE_REF = 'MOD-006';

/**
 * Constraint type enum per MOD-010 §4.9
 */
export enum ConstraintType {
  NO_EXECUTION = 'NO_EXECUTION',
  ADVISORY_ONLY = 'ADVISORY_ONLY',
  EXPLAINABLE = 'EXPLAINABLE',
  LOGGED = 'LOGGED',
}

/**
 * Enforcement level enum per MOD-010 §4.9
 */
export enum EnforcementLevel {
  MANDATORY = 'MANDATORY',
  RECOMMENDED = 'RECOMMENDED',
}

/**
 * Violation action enum per MOD-010 §4.9
 */
export enum ViolationAction {
  LOG = 'LOG',
  BLOCK = 'BLOCK',
  ESCALATE = 'ESCALATE',
}

/**
 * AI Governance Constraint Object — represents governance rules for AI behavior.
 * Per MOD-010 §4.9. Constrains MOD-006 AI engine behavior.
 */
export interface AIGovernanceConstraint {
  // Core attributes from MOD-010 §4.9
  constraintId: string;           // UUID v4
  aiModule: typeof AIMODULE_REF;  // Always 'MOD-006'
  constraintType: ConstraintType;
  enforcementLevel: EnforcementLevel;
  violationAction: ViolationAction;
}
