// NexCargo MOD-016 — Barrel Exports (C5 Increment 1)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)

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

// Template Rendering Engine
export {
  renderTemplate,
  selectLocalizedContent,
  injectVariables,
  buildLocalizedContent,
  isTemplateReadable,
} from './application/template-rendering-engine';
