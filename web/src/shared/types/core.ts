// NexCargo Core Types — Canonical domain objects from Primitive Registry (Priority 0)
// All modules MUST import from this file. No local redefinitions allowed.

import { UserRole, LanguagePreference, Region, CurrencyCode } from './enums';

/** Standard base fields for every entity per PROMPT 2 */
export interface BaseEntity {
  id: string; // UUID
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  version: number; // Optimistic locking version
}

/** Auditable entity with user tracking per ESS-009 */
export interface AuditableEntity extends BaseEntity {
  created_by: string; // userId
  updated_by: string; // userId
  correlation_id: string; // Traceability across modules
}

/** Soft-deletable entity per ESS-009 */
export interface SoftDeletableEntity extends AuditableEntity {
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
}

/** User profile per MOD-010 + PROMPT 2 */
export interface UserProfile {
  id: string; // Maps to Supabase Auth user ID
  email: string;
  role: UserRole;
  language_preference: LanguagePreference;
  region: Region;
  phone_number?: string;
  is_verified: boolean;
  kyc_level?: number;
  created_at: string;
  updated_at: string;
}

/** Session per PROMPT 7 */
export interface Session {
  sessionId: string;
  userId: string;
  role: UserRole;
  permissions: Permission[];
  issuedAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

/** Permission model per PROMPT 7 */
export interface Permission {
  resource: string;
  action: string;
  scope: string;
}

/** Correlation context for distributed tracing per PROMPT 6 + MOD-017 */
export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  userId?: string;
  moduleId?: string;
  timestamp: string;
}

/** Standard API response format per PROMPT 6 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ResponseMeta;
}

/** API error structure per PROMPT 6 */
export interface ApiError {
  code: string; // ESS-001E standardized codes
  message: string; // Human-readable
  details?: Record<string, unknown>;
}

/** Response metadata per PROMPT 6 */
export interface ResponseMeta {
  timestamp: string;
  correlationId: string;
  requestId?: string;
}

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Paginated response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Locale dictionary entry */
export type LocaleDictionary = Record<string, string | LocaleDictionary>;
