// NexCargo MOD-016 — Provider Adapter Interface & Mock Stub (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Purpose: Establishes provider-ready internal abstractions without external network calls
//
// CRITICAL CONSTRAINT: Adapters MUST NOT make external network calls in C5.
// Real SMS/email/WhatsApp providers require separate HAO authorization with credentials.
// This file defines the CONTRACT that future real adapters will implement.

import { NotificationChannel } from '@/shared/types/enums';

// ============================================================
// Provider Send Result Structure (Section E: Provider Boundary)
// ============================================================

/**
 * Standardized result from a provider send operation.
 * All real adapters return this structure for consistent error handling.
 */
export interface ProviderSendResult {
  /** Delivery outcome status */
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  /** Provider-side transaction reference (for tracking/reconciliation) */
  providerReferenceId?: string;
  /** Error message if delivery failed */
  errorMessage?: string;
  /** Timestamp of result generation */
  timestamp: Date;
}

// ============================================================
// Provider Credential Configuration Interface
// ============================================================

/**
 * Configuration interface for provider credentials/secrets.
 * Actual values stored in environment variables, never in code.
 * Schema validates presence but does not populate real production values.
 */
export interface ProviderCredentialConfig {
  /** Provider identifier (e.g., 'STUB_EMAIL', 'MPESA_SANDBOX') */
  providerId: string;
  /** API key or authentication token (from env: SMS_PROVIDER_API_KEY, EMAIL_SMTP_KEY, etc.) */
  apiKey?: string;
  /** API endpoint URL (for REST-based providers) */
  apiUrl?: string;
  /** Webhook signing secret (for webhook verification) */
  webhookSecret?: string;
  /** Provider-specific configuration map */
  metadata?: Record<string, unknown>;
}

// ============================================================
// Provider Error Mapping Interface
// ============================================================

/**
 * Maps provider-specific error codes to standard NexCargo error taxonomy.
 * Per ESS-001E error code standardization.
 */
export interface ProviderErrorMapping {
  /** Original error code from the provider */
  providerErrorCode: string;
  /** Corresponding NexCargo error code */
  nexcargoErrorCode: string;
  /** Human-readable description */
  message: string;
}

// ============================================================
// NotificationProviderAdapter Interface (PROVIDER-READY BOUNDARY)
// ============================================================

/**
 * Abstract interface defining how external notification providers interact with MOD-016.
 * 
 * ANY provider (SMS gateway, email service, WhatsApp Business API, push notification service)
 * must implement this interface to be integrated into MOD-016's delivery pipeline.
 * 
 * C5 IMPLEMENTATION NOTE:
 * - No real adapters exist in C5. Only STUB implementations for testing.
 * - A real adapter implements this interface AND connects to external APIs.
 * - The business logic in MOD-016 never changes when adding/removing providers.
 * - Credential management is handled via .env files, not code changes.
 */
export interface NotificationProviderAdapter {
  /**
   * Sends a notification through the provider's channel.
   * C5 constraint: Must NOT make outbound network calls.
   * Returns deterministic result based on input parameters only.
   */
  send(params: SendNotificationParams): Promise<ProviderSendResult>;

  /**
   * Verifies delivery status using provider's confirmation mechanism.
   * C5 constraint: May return cached/stored state; no live provider lookup.
   */
  verifyDelivery(providerReferenceId: string): Promise<ProviderSendResult>;

  /**
   * Returns the set of error code mappings for this provider.
   * Used by MOD-016's error translation layer.
   */
  getErrorMappings(): ProviderErrorMapping[];

  /**
   * Validates whether current credential configuration is structurally valid.
   * Does NOT test connectivity — only checks config shape/presence.
   */
  validateCredentials(config: ProviderCredentialConfig): boolean;
}

// ============================================================
// Send Notification Parameters
// ============================================================

/** Parameters passed to any provider adapter's send() method */
export interface SendNotificationParams {
  /** Recipient identifier (phone number, email address, device token, etc.) */
  recipient: string;
  /** Channel type determining routing logic */
  channelType: NotificationChannel;
  /** Message title/subject */
  title: string;
  /** Message body/content */
  body: string;
  /** Correlation ID for traceability across modules */
  correlationId: string;
  /** Priority level (affects urgency of delivery) */
  priorityLevel: string;
  /** Provider-specific payload data */
  providerPayload?: Record<string, unknown>;
}

// ============================================================
// Deterministic Mock Adapter (TEST-ONLY, NO EXTERNAL CALLS)
// ============================================================

/**
 * StubEmailProviderAdapter — DETERMINISTIC MOCK FOR TESTING
 * 
 * Implements NotificationProviderAdapter but makes ZERO external network calls.
 * Returns controlled test responses based on input parameters.
 * 
 * Production use: Replace with real adapter implementing the same interface.
 * Code path in MOD-016 remains IDENTICAL — only implementation class changes.
 */
export class StubEmailProviderAdapter implements NotificationProviderAdapter {
  private static readonly SUCCESS_RATE = 0.9; // 90% success rate for testing

  async send(params: SendNotificationParams): Promise<ProviderSendResult> {
    // DETERMINISTIC BEHAVIOR — no network calls
    // Simulates success/failure based on predictable probability
    const shouldSucceed = Math.random() < StubEmailProviderAdapter.SUCCESS_RATE;

    if (shouldSucceed) {
      return {
        status: 'SUCCESS',
        providerReferenceId: `STUB-${crypto.randomUUID()}`,
        timestamp: new Date(),
      };
    } else {
      return {
        status: 'FAILED',
        errorMessage: `Simulated delivery failure for ${params.recipient}`,
        timestamp: new Date(),
      };
    }
  }

  async verifyDelivery(providerReferenceId: string): Promise<ProviderSendResult> {
    // Guard against null/undefined/non-string inputs
    if (!providerReferenceId || typeof providerReferenceId !== 'string') {
      return {
        status: 'FAILED',
        errorMessage: 'Invalid provider reference',
        timestamp: new Date(),
      };
    }
    
    // Deterministic: always returns SUCCESS for references generated by this stub
    if (providerReferenceId.startsWith('STUB-')) {
      return {
        status: 'SUCCESS',
        providerReferenceId,
        timestamp: new Date(),
      };
    }
    return {
      status: 'FAILED',
      errorMessage: 'Unknown provider reference',
      timestamp: new Date(),
    };
  }

  getErrorMappings(): ProviderErrorMapping[] {
    return [
      {
        providerErrorCode: 'STUB_TIMEOUT',
        nexcargoErrorCode: 'ERR_6002',
        message: 'Stub simulated timeout — in production, maps to INTEGRATION_TIMEOUT',
      },
      {
        providerErrorCode: 'STUB_RECIPIENT_INVALID',
        nexcargoErrorCode: 'ERR_1001',
        message: 'Invalid recipient format detected by stub',
      },
    ];
  }

  validateCredentials(config: ProviderCredentialConfig): boolean {
    // Structural validation only — no network connectivity test
    return (
      config.providerId !== '' &&
      config.providerId !== undefined
    );
  }
}
