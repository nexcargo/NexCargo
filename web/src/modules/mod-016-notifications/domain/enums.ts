// NexCargo MOD-016 — Notifications & Messaging Module Local Enums
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Reference: MOD-016 §4.x (Core Domain Entities), §5.x (Lifecycle Models), §7.x (Rules of Operation)
//
// Shared enums (NotificationChannel) imported from @/shared/types/enums.
// Only enums NOT present in the shared set require local definition.

/** Notification priority levels per MOD-016 §4.1, §5.3, §7.6 */
export enum PriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Delivery status states per MOD-016 §4.1, §4.4, §7.3 */
export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

/** Delivery event attempt statuses per MOD-016 §4.4 */
export enum DeliveryEventStatus {
  ATTEMPTED = 'ATTEMPTED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  RETRY_SCHEDULED = 'RETRY_SCHEDULED',
}

/** Template status per MOD-016 §4.3 */
export enum TemplateStatus {
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
}

/** Notification channel types — alias to shared enum for compatibility */
import { NotificationChannel as SharedNotificationChannel } from '@/shared/types/enums';
export const NotificationChannel = SharedNotificationChannel;
