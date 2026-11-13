// NexCargo Payment Provider Registry — C4
// Maps payment method types to their corresponding adapter instances.
// During C4, only the Sandbox adapter is active for all methods.
// Future production providers will be plugged into this registry.

import type { PaymentProviderAdapter, PaymentMethodType, ProductionProviderKey, PaymentProviderRegistry } from './provider-interface';
import { SandboxPaymentProvider } from './sandbox-adapter';

/**
 * M-Pesa Provider Adapter Boundary — NOT production ready.
 * Placeholder for future Safaricom M-Pesa integration.
 * Implementation: ESS-001F §4.2 (Mobile Money Channels)
 */
export class MPesaProviderAdapter implements PaymentProviderAdapter {
  readonly providerName = 'MPESA';
  readonly isProductionReady = false;

  private requireProduction(): never {
    throw new Error('M-Pesa production integration not yet available. Use SandboxPaymentProvider for testing.');
  }

  async initiatePayment(): Promise<never> { this.requireProduction(); }
  async queryPayment(): Promise<never> { this.requireProduction(); }
  async processWebhook(): Promise<never> { this.requireProduction(); }
  async verifyWebhookSignature(): Promise<boolean> { return false; }
  async processRefund(): Promise<never> { this.requireProduction(); }
  async executeSettlement(): Promise<never> { this.requireProduction(); }
}

/**
 * e-Mola Provider Adapter Boundary — NOT production ready.
 * Placeholder for future e-Mola (Vodacom Mozambique) integration.
 * Implementation: ESS-001F §4.2 (Mobile Money Channels)
 */
export class EMolaProviderAdapter implements PaymentProviderAdapter {
  readonly providerName = 'EMOLA';
  readonly isProductionReady = false;

  private requireProduction(): never {
    throw new Error('e-Mola production integration not yet available. Use SandboxPaymentProvider for testing.');
  }

  async initiatePayment(): Promise<never> { this.requireProduction(); }
  async queryPayment(): Promise<never> { this.requireProduction(); }
  async processWebhook(): Promise<never> { this.requireProduction(); }
  async verifyWebhookSignature(): Promise<boolean> { return false; }
  async processRefund(): Promise<never> { this.requireProduction(); }
  async executeSettlement(): Promise<never> { this.requireProduction(); }
}

/**
 * mKesh Provider Adapter Boundary — NOT production ready.
 * Placeholder for future mKesh (Microcred Mozambique) integration.
 * Implementation: ESS-001F §4.2 (Mobile Money Channels)
 */
export class MKeshProviderAdapter implements PaymentProviderAdapter {
  readonly providerName = 'MKESH';
  readonly isProductionReady = false;

  private requireProduction(): never {
    throw new Error('mKesh production integration not yet available. Use SandboxPaymentProvider for testing.');
  }

  async initiatePayment(): Promise<never> { this.requireProduction(); }
  async queryPayment(): Promise<never> { this.requireProduction(); }
  async processWebhook(): Promise<never> { this.requireProduction(); }
  async verifyWebhookSignature(): Promise<boolean> { return false; }
  async processRefund(): Promise<never> { this.requireProduction(); }
  async executeSettlement(): Promise<never> { this.requireProduction(); }
}

/**
 * Card Processor Provider Adapter Boundary — NOT production ready.
 * Placeholder for future Visa/Mastercard card processor integration.
 * Implementation: ESS-001F §4.3 (Card Payment Channels)
 */
export class CardProcessorProviderAdapter implements PaymentProviderAdapter {
  readonly providerName = 'CARD_PROCESSOR';
  readonly isProductionReady = false;

  private requireProduction(): never {
    throw new Error('Card processor production integration not yet available. Use SandboxPaymentProvider for testing.');
  }

  async initiatePayment(): Promise<never> { this.requireProduction(); }
  async queryPayment(): Promise<never> { this.requireProduction(); }
  async processWebhook(): Promise<never> { this.requireProduction(); }
  async verifyWebhookSignature(): Promise<boolean> { return false; }
  async processRefund(): Promise<never> { this.requireProduction(); }
  async executeSettlement(): Promise<never> { this.requireProduction(); }
}

/**
 * Bank Transfer Provider Adapter Boundary — NOT production ready.
 * Placeholder for future bank transfer / banking API integration.
 * Implementation: ESS-001F §4.4 (Bank Transfer Channels)
 */
export class BankTransferProviderAdapter implements PaymentProviderAdapter {
  readonly providerName = 'BANK_TRANSFER';
  readonly isProductionReady = false;

  private requireProduction(): never {
    throw new Error('Bank transfer production integration not yet available. Use SandboxPaymentProvider for testing.');
  }

  async initiatePayment(): Promise<never> { this.requireProduction(); }
  async queryPayment(): Promise<never> { this.requireProduction(); }
  async processWebhook(): Promise<never> { this.requireProduction(); }
  async verifyWebhookSignature(): Promise<boolean> { return false; }
  async processRefund(): Promise<never> { this.requireProduction(); }
  async executeSettlement(): Promise<never> { this.requireProduction(); }
}

/**
 * Singleton registry instance.
 * Maps each payment method to its adapter.
 * During C4: all methods resolve to SandboxPaymentProvider.
 * Future: each method resolves to its production adapter when available.
 */
class PaymentProviderRegistryImpl implements PaymentProviderRegistry {
  private readonly adapters = new Map<PaymentMethodType | ProductionProviderKey, PaymentProviderAdapter>();

  constructor() {
    // C4: All methods use sandbox adapter
    const sandbox = new SandboxPaymentProvider();

    this.adapters.set('MPESA', sandbox);
    this.adapters.set('MKESH', sandbox);
    this.adapters.set('EMOLA', sandbox);
    this.adapters.set('CARD', sandbox);
    this.adapters.set('PAYPAL', sandbox);
    this.adapters.set('BANK_TRANSFER', sandbox);

    // Production boundaries: held for list() visibility only. get()/has() accept
    // canonical PaymentMethodType, so these keys can never be resolved to an adapter.
    this.adapters.set('MPESA_PROD', new MPesaProviderAdapter());
    this.adapters.set('EMOLA_PROD', new EMolaProviderAdapter());
    this.adapters.set('MKESH_PROD', new MKeshProviderAdapter());
    this.adapters.set('CARD_PROD', new CardProcessorProviderAdapter());
    this.adapters.set('BANK_TRANSFER_PROD', new BankTransferProviderAdapter());
  }

  get(method: PaymentMethodType): PaymentProviderAdapter {
    const adapter = this.adapters.get(method);
    if (!adapter) {
      throw new Error(`No payment provider registered for method: ${method}`);
    }
    return adapter;
  }

  has(method: PaymentMethodType): boolean {
    return this.adapters.has(method);
  }

  list(): { name: string; method: PaymentMethodType | ProductionProviderKey; productionReady: boolean }[] {
    return Array.from(this.adapters.entries()).map(([method, adapter]) => ({
      name: adapter.providerName,
      method,
      productionReady: adapter.isProductionReady,
    }));
  }
}

// Export singleton instance
export const paymentProviderRegistry = new PaymentProviderRegistryImpl();

// Re-export individual adapter classes for direct use if needed
export { SandboxPaymentProvider };
