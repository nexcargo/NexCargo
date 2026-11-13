// NexCargo Payment Provider Interface — C4 Provider Abstraction Layer
// Authoritative: ESS-001F §4 (Payment Channels), MOD-005 §4.2
// All payment providers MUST implement this interface.
// No production provider is live during C4. Sandbox adapter provides deterministic execution.

/** Valid payment method types matching EscrowState.PaymentMethod enum */
export type PaymentMethodType = 'MPESA' | 'MKESH' | 'EMOLA' | 'CARD' | 'PAYPAL' | 'BANK_TRANSFER';

/**
 * Registry keys for future production adapter boundaries. These identify a provider
 * environment, not a canonical payment method — MOD-005 + MOD-013 define only the six
 * above. They are reported by list() and can never be resolved through get() or has().
 */
export type ProductionProviderKey =
  | 'MPESA_PROD'
  | 'EMOLA_PROD'
  | 'MKESH_PROD'
  | 'CARD_PROD'
  | 'BANK_TRANSFER_PROD';

/** Valid payment intent statuses */
export type PaymentIntentStatus = 'INITIATED' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';

/** Provider-specific payment initiation request */
export interface PaymentInitiationRequest {
  /** Unique payment intent ID from NexCargo */
  paymentIntentId: string;
  /** Amount to charge */
  amount: number;
  /** Currency code (MZN, USD, ZAR) */
  currency: string;
  /** Payment method type */
  paymentMethod: PaymentMethodType;
  /** Customer phone/account identifier (provider-specific) */
  customerIdentifier: string;
  /** Callback URL for webhook notification */
  callbackUrl: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Provider response to payment initiation */
export interface PaymentInitiationResponse {
  /** Whether the initiation was accepted by the provider */
  success: boolean;
  /** Provider's unique transaction reference */
  providerReferenceId: string | null;
  /** Provider-specific status after initiation */
  providerStatus: string;
  /** Human-readable message */
  message: string;
  /** Error details if failed */
  error?: {
    code: string;
    description: string;
  };
}

/** Query a payment by provider reference */
export interface PaymentQueryRequest {
  paymentIntentId: string;
  providerReferenceId: string;
}

/** Payment query result */
export interface PaymentQueryResponse {
  paymentIntentId: string;
  providerReferenceId: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  confirmedAt: string | null;
  failureReason: string | null;
}

/** Webhook/callback payload from provider */
export interface ProviderWebhookPayload {
  /** Unique event ID for deduplication */
  eventId: string;
  /** Provider's transaction reference */
  providerReferenceId: string;
  /** NexCargo payment intent ID */
  paymentIntentId: string;
  /** Payment status from provider */
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';
  /** Amount paid (may differ from initiated if partial) */
  amount: number;
  /** Currency */
  currency: string;
  /** Failure reason if applicable */
  failureReason?: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Refund request */
export interface RefundRequest {
  paymentIntentId: string;
  providerReferenceId: string;
  amount: number;
  reason: string;
}

/** Refund response */
export interface RefundResponse {
  success: boolean;
  refundReferenceId: string | null;
  providerStatus: string;
  message: string;
  error?: { code: string; description: string };
}

/** Settlement/release request via provider */
export interface SettlementRequest {
  escrowId: string;
  payerReferenceId: string;
  payeeReferenceId: string;
  amount: number;
  currency: string;
  purpose: string;
}

/** Settlement response */
export interface SettlementResponse {
  success: boolean;
  settlementReferenceId: string | null;
  providerStatus: string;
  message: string;
  error?: { code: string; description: string };
}

/**
 * Core payment provider interface.
 * All adapters (sandbox, M-Pesa, e-Mola, mKesh, Card, Bank Transfer) must implement this.
 */
export interface PaymentProviderAdapter {
  /** Provider name/identifier */
  readonly providerName: string;

  /** Whether this provider is configured and ready for production use */
  readonly isProductionReady: boolean;

  /** Initiate a payment through the provider */
  initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse>;

  /** Query payment status from the provider */
  queryPayment(request: PaymentQueryRequest): Promise<PaymentQueryResponse>;

  /** Process an incoming webhook/callback from the provider */
  processWebhook(rawBody: string, headers: Record<string, string>, payload: ProviderWebhookPayload): Promise<{ valid: boolean; processed: boolean }>;

  /** Verify webhook authenticity (signature verification) */
  verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean>;

  /** Process a refund */
  processRefund(request: RefundRequest): Promise<RefundResponse>;

  /** Execute settlement/release to payee */
  executeSettlement(request: SettlementRequest): Promise<SettlementResponse>;
}

/** Factory function type for creating provider instances */
export type PaymentProviderFactory = () => PaymentProviderAdapter;

/** Registry of all available payment providers */
export interface PaymentProviderRegistry {
  /** Get a provider by payment method type */
  get(method: PaymentMethodType): PaymentProviderAdapter;

  /** Check if a provider is registered for the given method */
  has(method: PaymentMethodType): boolean;

  /** List all registered providers, including non-resolvable production boundaries */
  list(): { name: string; method: PaymentMethodType | ProductionProviderKey; productionReady: boolean }[];
}
