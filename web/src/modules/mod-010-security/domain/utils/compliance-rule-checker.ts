// NexCargo MOD-010 Domain Utils — Compliance Rule Checker
// Authoritative source: MOD-010 §4.4 (Compliance Rule Object) + §7.3 (Compliance Dependency Rule)
// Evaluates compliance rules against modules and jurisdictions for governance workflows.
// No runtime enforcement — results feed into compliance review processes.

import { ComplianceRule, RegulationType, SeverityLevel } from '@/modules/mod-010-security/domain/types/compliance';

/** Result of a compliance check */
export interface ComplianceCheckResult {
  applicable: boolean;
  severity: SeverityLevel;
  validationSource: string;
  ruleId: string;
}

/**
 * Checks whether a compliance rule applies to a given module.
 * @param rule - Compliance rule to evaluate
 * @param moduleId - Module identifier to check (e.g., "MOD-001")
 * @returns true if the rule applies to this module
 */
export function ruleAppliesToModule(rule: ComplianceRule, moduleId: string): boolean {
  return rule.applicableModules.includes(moduleId);
}

/**
 * Checks whether a compliance rule applies to a given jurisdiction.
 * @param rule - Compliance rule to evaluate
 * @param country - Country code (e.g., "MZ", "ZA")
 * @returns true if the rule applies in this jurisdiction
 */
export function ruleAppliesToJurisdiction(rule: ComplianceRule, country: string): boolean {
  return rule.applicableJurisdictions.includes(country);
}

/**
 * Evaluates all compliance rules against a module and jurisdiction.
 * Returns matching rules sorted by severity (BLOCKING first).
 * Per MOD-010 §7.3: All compliance rules MUST reference ESS-006.
 * @param rules - Array of compliance rules to evaluate
 * @param moduleId - Target module identifier
 * @param country - Target country code
 * @returns Array of applicable compliance check results
 */
export function evaluateComplianceRules(
  rules: ComplianceRule[],
  moduleId: string,
  country: string
): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];

  for (const rule of rules) {
    const moduleApplies = ruleAppliesToModule(rule, moduleId);
    const jurisdictionApplies = ruleAppliesToJurisdiction(rule, country);

    if (moduleApplies && jurisdictionApplies) {
      results.push({
        applicable: true,
        severity: rule.severityLevel,
        validationSource: rule.validationSource,
        ruleId: rule.ruleId,
      });
    }
  }

  // Sort by severity: BLOCKING > WARNING > INFO
  const severityOrder: Record<SeverityLevel, number> = {
    [SeverityLevel.BLOCKING]: 1,
    [SeverityLevel.WARNING]: 2,
    [SeverityLevel.INFO]: 3,
  };

  return results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
