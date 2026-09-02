// NexCargo MOD-011 Mobile Money Gateway — Provider Coordination Layer
// Authoritative source: MOD-011 §5.4 (Event Gateway Model), §5.5 (Deterministic Integration Rule)
// Coordinates mobile money provider adapters with retry, idempotency, and normalized error handling.
// Does NOT execute business logic — delegates payment authorization to MOD-005/MOD-013.

import type {
  IMobileMoneyAdapter,
  RetryConfiguration,
  MobileMoneyHealthStatus,
} from '../adapters/base.adapter';
import {
  MobileMoneyProvider,
  MobileMoneyTransactionStatus,
  MobileMoneyErrorCategory,
  MobileMoneyPaymentRequest,
  MobileMoneyPaymentResponse,
  MobileMoneyError,
  MobileMoneyWebhookPayload,
} from '../adapters/mobile-money.types';
import { calculateRetryDelay } from '../adapters/mkesh.helpers';
import { MpesaAdapter } from '../adapters/mpesa.adapter';
import { MkeshAdapter } from '../adapters/mkesh.adapter';
import { EMolaAdapter } from '../adapters/emola.adapter';

/**
 * Provider adapter factory — creates appropriate adapter for each provider.
 * In production, this would also validate provider configuration availability.
 */
export function createMobileMoneyAdapter(provider: MobileMoneyProvider): IMobileMoneyAdapter {
  switch (provider) {
    case MobileMoneyProvider.MPESA:
      return new MpesaAdapter();
    case MobileMoneyProvider.MKESH:
      return new MkeshAdapter();
    case MobileMoneyProvider.E_MOLA:
      return new EMolaAdapter();
    default:
      throw new Error(`Unknown mobile money provider: ${provider}`);
  }
}

/**
 * Registry of initialized mobile money adapters.
 * Adapters are lazily initialized on first use.
 */
export class MobileMoneyRegistry {
  private adapters: Map<MobileMoneyProvider, IMobileMoneyAdapter> = new Map();

  /** Register a pre-configured adapter (for testing or custom providers) */
  register(provider: MobileMoneyProvider, adapter: IMobileMoneyAdapter): void {
    this.adapters.set(provider, adapter);
  }

  /** Get an adapter by provider — initializes if not already registered */
  get(provider: MobileMoneyProvider): IMobileMoneyAdapter {
    if (!this.adapters.has(provider)) {
      this.adapters.set(provider, createMobileMoneyAdapter(provider));
    }
    return this.adapters.get(provider)!;
  }

  /** List all registered providers */
  listProviders(): MobileMoneyProvider[] {
    return [...this.adapters.keys()];
  }

  /** Check health status for all registered providers */
  async getAllHealth(): Promise<Map<MobileMoneyProvider, MobileMoneyHealthStatus>> {
    const result = new Map<MobileMoneyProvider, MobileMoneyHealthStatus>();
    for (const provider of this.listProviders()) {
      try {
        result.set(provider, await this.get(provider).getHealth());
      } catch {
        result.set(provider, {
          provider, operational: false, lastChecked: new Date().toISOString(),
          error: 'Health check failed',
        } as MobileMoneyHealthStatus);
      }
    }
    return result;
  }
}

/**
 * Mobile Money Gateway — coordinates calls across providers with retry and idempotency.
 * This is the PRIMARY integration surface for MOD-011 mobile money operations.
 */
export class MobileMoneyGateway {
  private registry: MobileMoneyRegistry;

  constructor(registry?: MobileMoneyRegistry) {
    this.registry = registry ?? new MobileMoneyRegistry();
  }

  /**
   * Initiate payment through specified provider with retry logic.
   * Per ESS-001C: applies timeout/retry policy based on provider configuration.
   * Per ESS-004: uses referenceId as idempotency key.
   * @param provider - Target mobile money provider
   * @param request - Payment request parameters
   * @returns Normalized response or error
   */
  async initiatePayment(
    provider: MobileMoneyProvider,
    request: MobileMoneyPaymentRequest
  ): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    const adapter = this.registry.get(provider);
    const retryPolicy = adapter.getRetryPolicy();
    let lastError: MobileMoneyError | null = null;

    // Execute with retry loop
    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt - 1, retryPolicy);
        await sleep(delay);
      }

      const result = await adapter.initiatePayment(request);

      // Check if result is transient (retryable)
      if ('isTransient' in result && !('transactionId' in result)) {
        const error = result as MobileMoneyError;
        lastError = error;
        if (retryPolicy.retryableErrors.includes(error.errorCode)) {
          continue; // Will retry
        }
        return error; // Non-transient error — fail fast
      }

      // Success — transaction ID present
      return result as MobileMoneyPaymentResponse;
    }

    // All retries exhausted
    return lastError ?? createGenericError(MobileMoneyErrorCategory.PROVIDER_TIMEOUT, request.referenceId);
  }

  /** Query transaction status with optional retry */
  async queryTransaction(
    provider: MobileMoneyProvider,
    referenceId: string,
    transactionId?: string
  ): Promise<MobileMoneyPaymentResponse | MobileMoneyError> {
    const adapter = this.registry.get(provider);
    return adapter.queryTransaction(referenceId, transactionId)
      .then(result => result as MobileMoneyPaymentResponse | MobileMoneyError);
  }

  /**
   * Process webhook callback with signature verification.
   * Per ESS-001D + MOD-011 §7.6: webhooks MUST be signed and verifiable.
   * @param provider - Source provider of the webhook
   * @param rawBody - Raw HTTP body from provider
   * @param signatureHeader - Signature header value
   * @returns Parsed and verified webhook payload or error
   */
  async processWebhook(
    provider: MobileMoneyProvider,
    rawBody: string,
    signatureHeader: string
  ): Promise<MobileMoneyWebhookPayload | MobileMoneyError> {
    const adapter = this.registry.get(provider);
    return adapter.processWebhook(rawBody, signatureHeader);
  }

  /**
   * Register credentials for a provider.
   * Credentials are loaded from environment variables in production.
   * @param provider - Target provider
   * @param credentials - Authentication credentials
   */
  async configureProvider(provider: MobileMoneyProvider, credentials: Parameters<IMobileMoneyAdapter['initialize']>[0]): Promise<void> {
    const adapter = this.registry.get(provider);
    await adapter.initialize(credentials);
  }

  /** Get health status for a specific provider */
  async getProviderHealth(provider: MobileMoneyProvider): Promise<ReturnType<IMobileMoneyAdapter['getHealth']>> {
    return this.registry.get(provider).getHealth();
  }
}

// --- Shared helper functions ---

/** Sleep utility for retry delays */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Create a generic provider error when no other context is available */
function createGenericError(
  category: MobileMoneyErrorCategory,
  requestId: string
): MobileMoneyError {
  return {
    errorCode: category,
    message: `${category.toLowerCase().replace(/_/g, ' ')}`,
    isTransient: category === MobileMoneyErrorCategory.PROVIDER_TIMEOUT ||
                 category === MobileMoneyErrorCategory.PROVIDER_UNAVAILABLE,
    requiresManualIntervention: false,
    requestId,
  };
}
