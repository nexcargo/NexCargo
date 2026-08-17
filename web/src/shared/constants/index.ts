// NexCargo Constants — System-wide configuration values per PROMPT 1 + ESS standards

/** GPS tracking intervals per MOD-003 + MOD-008 */
export const GPS_TRACKING_INTERVALS = {
  MOVING_MINUTES: 15,
  STATIONARY_MINUTES: 60,
} as const;

/** Document expiry notification schedule per MOD-004 */
export const DOCUMENT_EXPIRY_SCHEDULE_DAYS = [90, 60, 30, 7, 1] as const;

/** Default pagination limits */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** Session token expiration (in seconds) */
export const SESSION = {
  ACCESS_TOKEN_TTL: 3600, // 1 hour
  REFRESH_TOKEN_TTL: 604800, // 7 days
} as const;

/** Retry policy defaults per ESS-001C */
export const RETRY_POLICY = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
} as const;

/** Alert severity escalation per ESS-005 */
export const ALERT_SEVERITY_ORDER = ['SEV_3', 'SEV_2', 'SEV_1'] as const;

/** SLO targets per PROMPT 8 */
export const SLO_TARGETS = {
  AVAILABILITY_PERCENT: 99.9,
  API_P95_MS: 300,
  AUTH_P95_MS: 200,
  SHIPMENT_SEARCH_P95_MS: 500,
  ESCROW_P95_MS: 2000,
} as const;

/** Localization defaults per ESS-007 + ESS-008 */
export const LOCALIZATION = {
  DEFAULT_LANGUAGE: 'pt' as const,
  SUPPORTED_LANGUAGES: ['pt', 'en'] as const,
  DATE_FORMAT_PT: 'DD/MM/YYYY',
  DATE_FORMAT_EN: 'MM/DD/YYYY',
  CURRENCY_FORMAT_PT: 'pt-PT',
  CURRENCY_FORMAT_EN: 'en-US',
} as const;
