// NexCargo Utility Functions — Common helpers per ESS-007

/** Generate a correlation ID for distributed tracing */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/** Validate UUID format */
export function validateUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/** Sanitize string input (basic XSS prevention) */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Format currency with locale awareness per ESS-007 */
export function formatCurrency(amount: number, currency: string = 'MZN', locale: string = 'pt-PT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Format date with locale awareness per ESS-007 */
export function formatDate(date: Date | string, locale: string = 'pt-PT'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
