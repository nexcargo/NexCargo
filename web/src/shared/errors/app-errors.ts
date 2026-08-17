// NexCargo Application Error Classes — Standardized error handling per PROMPT 6 + ESS-001E
// All errors use standardized codes for consistent API responses.

/** Standardized error codes per ESS-001E */
export enum ErrorCode {
  // Generic (1xxx)
  INTERNAL_ERROR = 'ERR_1000',
  VALIDATION_ERROR = 'ERR_1001',
  NOT_FOUND = 'ERR_1002',
  UNAUTHORIZED = 'ERR_1003',
  FORBIDDEN = 'ERR_1004',
  CONFLICT = 'ERR_1005',
  RATE_LIMITED = 'ERR_1006',

  // Authentication (2xxx)
  AUTH_INVALID_CREDENTIALS = 'ERR_2001',
  AUTH_TOKEN_EXPIRED = 'ERR_2002',
  AUTH_SESSION_REVOKED = 'ERR_2003',
  AUTH_ROLE_ESCALATION = 'ERR_2004',

  // Authorization (3xxx)
  AUTHZ_INSUFFICIENT_PERMISSIONS = 'ERR_3001',
  AUTHZ_RESOURCE_OWNERSHIP_VIOLATION = 'ERR_3002',

  // Business logic (4xxx)
  BUSINESS_CONTRACT_IMMUTABLE = 'ERR_4001',
  BUSINESS_AUTO_BOOKING_FORBIDDEN = 'ERR_4002',
  BUSINESS_CUSTODY_VIOLATION = 'ERR_4003',
  BUSINESS_EXECUTION_VIOLATION = 'ERR_4004',
  BUSINESS_STATE_TRANSITION_INVALID = 'ERR_4005',

  // Financial (5xxx)
  FINANCIAL_IDEMPOTENCY_KEY_EXISTS = 'ERR_5001',
  FINANCIAL_LEDGER_MISMATCH = 'ERR_5002',
  FINANCIAL_ESCROW_INVALID_STATE = 'ERR_5003',

  // Integration (6xxx)
  INTEGRATION_PROVIDER_UNAVAILABLE = 'ERR_6001',
  INTEGRATION_TIMEOUT = 'ERR_6002',
  INTEGRATION_AUTH_FAILED = 'ERR_6003',
  INTEGRATION_WEBHOOK_INVALID = 'ERR_6004',

  // AI (7xxx)
  AI_MODEL_UNAVAILABLE = 'ERR_7001',
  AI_INSUFFICIENT_DATA = 'ERR_7002',

  // Module-specific (8xxx)
  MOD_MARKETPLACE_LISTING_NOT_FOUND = 'ERR_8001',
  MOD_TRACKING_POD_MISSING = 'ERR_8002',
  MOD_DOCUMENTS_SIGNING_FAILED = 'ERR_8003',
}

/** Main application error class */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /** Convert to API error response format per PROMPT 6 */
  toApiError(): { code: string; message: string; details?: Record<string, unknown> } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/** Validation error */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/** Not found error */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(ErrorCode.NOT_FOUND, `${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

/** Unauthorized error */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message);
    this.name = 'UnauthorizedError';
  }
}

/** Forbidden error (insufficient permissions) */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}
