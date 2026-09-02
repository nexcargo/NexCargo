// NexCargo MOD-011 — Platform Integration Module Barrel Export
// Wave 0 foundation + Wave 5 Increment 1 Mobile Money integration layer.
// Authoritative source: MOD-011 specification + ESS-001/ESS-004.

// --- Wave 0 Foundation: Types ---
export {
  IntegrationProviderType,
  IntegrationProtocolType,
  IntegrationAuthMethod,
  HttpMethod,
  type IntegrationContract,
  type ApiEndpointDefinition,
  type ApiVersionRecord,
} from './domain/types/integration-contracts';

export {
  DeliveryGuaranteeLevel,
  type EventMappingObject,
  createEventMapping,
} from './domain/types/event-mapping';

export {
  WebhookDeliveryStatus,
  WebhookVerificationMethod,
  type WebhookSubscription,
  verifyWebhookSignature,
} from './domain/types/webhook-subscription';

export {
  TargetSystem,
  AdapterType,
  SyncFrequency,
  type EnterpriseIntegrationAdapter,
} from './domain/types/enterprise-gateway';

// --- Wave 0 Foundation: Utilities ---
export {
  ApiContractStatus,
  type BaseContractSchema,
  isValidSemver,
  incrementVersion,
} from '@/shared/standards/api-contract-schema';

export {
  type ValidationResult,
  type ContractValidationResult,
  isVersionValid,
  getNextMinorVersion,
  validateBaseContract,
  validateIntegrationContract,
  validateApiEndpoint,
} from './domain/utils/contract-validator';

export {
  createIntegrationAdapter,
  validateIntegrationAdapter,
  generateDeterministicAdapterId,
} from './domain/utils/integration-adapter-factory';

export {
  hashApiKey,
  validateKeyPermissions,
  generateApiKeyName,
} from './domain/utils/api-key-management';

export {
  applyFieldFilter,
  paginate,
  generateETag,
  flattenObject,
} from './domain/utils/mobile-payload';

export {
  type ContractRegistryType,
  type ContractRegistryEntry,
  ApiContractRegistry,
} from './domain/utils/api-contract-registry';

// --- Wave 5 Increment 1: Mobile Money Integration Layer ---
export {
  MobileMoneyProvider,
  MobileMoneyChannelType,
  MobileMoneyTransactionStatus,
  MobileMoneyErrorCategory,
  MobileMoneyAuthMethod,
  type MobileMoneyIntegrationMeta,
  type MobileMoneyPaymentRequest,
  type MobileMoneyPaymentResponse,
  type MobileMoneyError,
  type MobileMoneyWebhookPayload,
} from './infrastructure/adapters/mobile-money.types';

export {
  type IMobileMoneyAdapter,
  type MobileMoneyHealthStatus,
  type RetryConfiguration,
  type MobileMoneyCredentials,
  DEFAULT_MOBILE_MONEY_RETRY_POLICY,
  normalizePhone,
} from './infrastructure/adapters/base.adapter';

export { MpesaAdapter } from './infrastructure/adapters/mpesa.adapter';
export { MkeshAdapter } from './infrastructure/adapters/mkesh.adapter';
export { EMolaAdapter } from './infrastructure/adapters/emola.adapter';
export { computeWebhookSignature, verifyWebhookSignature as verifyProviderWebhookSignature, parseStatus, calculateFee, calculateRetryDelay } from './infrastructure/adapters/mkesh.helpers';

export {
  createMobileMoneyAdapter,
  MobileMoneyRegistry,
  MobileMoneyGateway,
} from './infrastructure/gateways/mobile-money-gateway';

export {
  MOBILE_MONEY_DOMAIN,
  type MobileMoneyIntegrationContract,
  type MobileMoneyEndpoint,
  type ErrorMappingEntry,
  MPESA_CONTRACT,
  MKESH_CONTRACT,
  E_MOLA_CONTRACT,
  MOBILE_MONEY_CONTRACTS,
} from './domain/contracts/mobile-money-contracts';
