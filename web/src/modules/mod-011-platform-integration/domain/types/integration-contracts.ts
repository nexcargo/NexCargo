// NexCargo MOD-011 Domain Types — Integration Contract Framework
// Authoritative source: MOD-011 §4.1 (Integration Contract Object) + §4.2 (API Endpoint Definition) + §4.6 (API Version Record)
// Implements exit criteria X-01: ≥3 TypeScript interfaces with full attribute sets from MOD-011 spec

import { BaseContractSchema, ApiContractStatus } from '@/shared/standards/api-contract-schema';

/**
 * Provider type enum per MOD-011 §4.1
 */
export enum IntegrationProviderType {
  BANK = 'BANK',
  PAYMENT = 'PAYMENT',
  LOGISTICS = 'LOGISTICS',
  CUSTOMS = 'CUSTOMS',
  ERP = 'ERP',
  TMS = 'TMS',
  GOVERNMENT = 'GOVERNMENT',
  PARTNER = 'PARTNER',
}

/**
 * Protocol type enum per MOD-011 §4.1
 */
export enum IntegrationProtocolType {
  REST = 'REST',
  WEBHOOK = 'WEBHOOK',
  EVENT_STREAM = 'EVENT_STREAM',
  BATCH = 'BATCH',
  MQTT = 'MQTT',
  GRPC = 'GRPC',
}

/**
 * Authentication method enum per MOD-011 §4.1
 */
export enum IntegrationAuthMethod {
  OAUTH = 'OAUTH',
  JWT = 'JWT',
  API_KEY = 'API_KEY',
  NONE = 'NONE',
}

/**
 * Integration Contract Object — represents a formal external system integration definition.
 * Per MOD-011 §4.1. Extends BaseContractSchema (Standard S-03).
 */
export interface IntegrationContract extends BaseContractSchema {
  // Core attributes from MOD-011 §4.1
  integrationName: string;
  providerType: IntegrationProviderType;
  protocolType: IntegrationProtocolType;
  authenticationMethod: IntegrationAuthMethod;
  dataSchemaReference?: string;
  partnerTier?: 'ENTERPRISE' | 'STANDARD';
  rateLimitPolicyReference?: string;
  contactInformation?: string;
}

/**
 * HTTP method enum per MOD-011 §4.2
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

/**
 * API Endpoint Definition Object — represents system API exposure structure.
 * Per MOD-011 §4.2. Extends BaseContractSchema (Standard S-03).
 */
export interface ApiEndpointDefinition extends BaseContractSchema {
  // Core attributes from MOD-011 §4.2
  path: string;
  method: HttpMethod;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  authenticationRequirement: IntegrationAuthMethod;
  rateLimitPolicyReference?: string;
  moduleOwner: string; // MOD-001 through MOD-018
  deprecationDate?: string;
  sunsetDate?: string;
}

/**
 * API Version Record — represents API version lifecycle.
 * Per MOD-011 §4.6. Extends BaseContractSchema (Standard S-03).
 */
export interface ApiVersionRecord extends BaseContractSchema {
  apiName: string;
  versionNumber: string;       // Semantic versioning MAJOR.MINOR.PATCH
  releaseDate: string;         // ISO 8601
  changelog?: string;          // Structured summary of changes
}
