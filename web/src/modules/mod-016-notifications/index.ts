// NexCargo MOD-016 — Barrel Exports (C5 Increment 1 + C5 Increment 2)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// C5 Increment 2 — Authorized per HAO-C5-002 (Notification Delivery Pipeline)

// Enums
export * from './domain/enums';

// Entity Types
export type {
  NotificationObject,
  TemplateObject,
  DeliveryEventObject,
  CommunicationAuditRecord,
  LocalizationDictionary,
  TemplateVariable,
} from './domain/types/entities';

// Delivery Pipeline Types (C5-II)
export type {
  ClaimedNotification,
  ChannelExecutionResult,
  DeliveryProcessingResult,
  BatchProcessingResult,
} from './domain/types/delivery-pipeline';
export {
  ChannelExecutionStatus,
  MAX_RETRY_COUNT,
  RETRY_BASE_DELAY_MS,
  computeBackoffDelay,
} from './domain/types/delivery-pipeline';

// Validation Services
export {
  validateNotificationCreation,
  applyNotificationDefaults,
  normalizePriorityLevel,
  normalizeChannelType,
  validateTemplateStructure,
  isValidChannelType,
  isPriorityLevelValid,
  isValidTemplateStatus,
  validateDeliveryEventInput,
  isValidDeliveryEventStatus,
} from './domain/services/notification-validation';

// Provider Adapter Interface + Mock Stub
export type {
  NotificationProviderAdapter,
  SendNotificationParams,
  ProviderSendResult,
  ProviderCredentialConfig,
  ProviderErrorMapping,
} from './infrastructure/adapters/notification-provider-adapter';
export { StubEmailProviderAdapter } from './infrastructure/adapters/notification-provider-adapter';

// Channel Executor Abstraction (C5-II)
export type { ChannelExecutor } from './domain/types/delivery-pipeline';
export { ChannelExecutorRegistry, ChannelExecutorFactory, resolveRecipientTarget } from './infrastructure/adapters/channel-executor-registry';
export { StubInAppChannelExecutor } from './infrastructure/adapters/channel-executors/stub-in-app-channel-executor';
export { StubChannelExecutor } from './infrastructure/adapters/channel-executors/stub-channel-executor';

// Delivery Processor Service (C5-II)
export { NotificationDeliveryProcessor, getDeliveryProcessor } from './infrastructure/services/notification-delivery-processor';

// Template Rendering Engine
export {
  renderTemplate,
  selectLocalizedContent,
  injectVariables,
  buildLocalizedContent,
  isTemplateReadable,
} from './application/template-rendering-engine';
