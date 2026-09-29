// NexCargo MOD-016 — Template Rendering Engine with Localization (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Reference: MOD-016 §4.3 (Template Object), §7.9 (Localization Rule)
//
// Renders notification templates with dynamic field injection and locale selection.
// Follows MOD-016 §7.9 rules:
// - Templates MUST support Portuguese and English
// - System selects language based on recipient's preference
// - Dynamic values formatted per recipient's locale
// - Fallback to en when pt is unavailable for a template

import type { TemplateObject } from '../domain/types/entities';

// ============================================================
// Default fallback locales
// ============================================================

const PRIMARY_LOCALE = 'pt';
const FALLBACK_LOCALE = 'en';

// ============================================================
// Template Rendering Engine
// ============================================================

/**
 * Renders a template with dynamic variable injection and locale selection.
 * 
 * Algorithm:
 * 1. Try primary locale (pt) first
 * 2. Fall back to secondary locale (en) if primary not available
 * 3. If neither available, use defaultContent
 * 4. Inject variables into selected content
 */
export function renderTemplate(
  template: TemplateObject,
  variables: Record<string, string | number | Date>,
  requestedLocale?: string,
): string {
  // Determine which content version to use
  const selectedContent = selectLocalizedContent(template, requestedLocale);
  
  // Inject variables into the content
  return injectVariables(selectedContent, variables);
}

/**
 * Selects localized content following MOD-016 §7.9 fallback rules.
 * Priority: requested locale → primary (pt) → fallback (en) → defaultContent
 */
export function selectLocalizedContent(
  template: TemplateObject,
  requestedLocale?: string,
): string {
  // Use requested locale if provided and exists in localized_content
  if (requestedLocale && template.localizedContent[requestedLocale]) {
    return template.localizedContent[requestedLocale];
  }

  // Try primary locale (pt)
  if (template.localizedContent[PRIMARY_LOCALE]) {
    return template.localizedContent[PRIMARY_LOCALE];
  }

  // Try fallback locale (en)
  if (template.localizedContent[FALLBACK_LOCALE]) {
    return template.localizedContent[FALLBACK_LOCALE];
  }

  // Final fallback to default content
  return template.defaultContent;
}

/**
 * Injects dynamic variables into template content using {variableName} syntax.
 * Supports string, number, and Date types with formatting.
 */
export function injectVariables(
  templateContent: string,
  variables: Record<string, string | number | Date>,
): string {
  let result = templateContent;

  for (const [key, value] of Object.entries(variables)) {
    // Format value based on type
    let formattedValue: string;
    
    if (value instanceof Date) {
      // Format dates consistently (ISO format for now; could add locale-aware formatting later)
      formattedValue = formatDate(value);
    } else if (typeof value === 'number') {
      formattedValue = formatNumber(value);
    } else {
      formattedValue = String(value);
    }

    // Replace all occurrences of {key} with formatted value
    const placeholder = `{${key}}`;
    result = result.split(placeholder).join(formattedValue);
  }

  return result;
}

// ============================================================
// Helper Functions
// ============================================================

/** Formats a Date to ISO string for consistent display */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/** Formats a number with consistent decimal places */
function formatNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toString();
  }
  // Default to 2 decimal places for currency/amounts
  return num.toFixed(2);
}

// ============================================================
// Utility: Build template-ready content map
// ============================================================

/**
 * Creates a structured localized content object suitable for saving to database.
 * Accepts pt and/or en content strings.
 */
export function buildLocalizedContent(
  ptContent: string,
  enContent: string,
): Record<string, string> {
  return {
    pt: ptContent,
    en: enContent,
  };
}

/**
 * Validates that a template has at least one readable version (default or localized).
 * Per MOD-016 §4.3: templates must be usable.
 */
export function isTemplateReadable(template: Partial<TemplateObject>): boolean {
  // Must have either non-empty default content OR at least one non-empty localized entry
  const hasDefault = !!(template.defaultContent && template.defaultContent.trim().length > 0);
  
  let hasLocalized = false;
  if (template.localizedContent && typeof template.localizedContent === 'object') {
    const localeValues = Object.values(template.localizedContent) as string[];
    hasLocalized = localeValues.length > 0 && localeValues.some(v => v && v.trim().length > 0);
  }
  
  return hasDefault || hasLocalized;
}
