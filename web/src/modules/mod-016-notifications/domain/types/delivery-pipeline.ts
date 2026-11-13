// NexCargo MOD-016 — Delivery Pipeline Types (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002
// Purpose: Type definitions for notification delivery processor, channel executors, and retry engine

import type { NotificationChannel } from '@/shared/types/enums';
import type { PriorityLevel, DeliveryStatus, DeliveryEventStatus } from '../enums';

// ============================================================
// Claimed Notification (from SQL RPC)
// ============================================================

/** Represents a claimed notification row returned by claim_one_queued_notification() RPC */
export interface ClaimedNotification {
  id: string;
  recipientId: string;
  sourceModule: string;
  eventType: string;
  title: string;
  body: string;
  priorityLevel: PriorityLevel;
  channelType: NotificationChannel;
  locale: string;
  templateId: string | null;
  eventCorrelationId: string | null;
  /** Raw correlation text, preserved when it is not UUID-shaped (059 deviation D1). */
  correlationRef: string | null;
  /** Originating event_id — the idempotency key shared with the event store. */
  sourceEventId: string | null;
  deliveryStatus: DeliveryStatus;
  retryCount: number;
  providerChannel: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Channel Execution Result
// ============================================================

/** Outcome of a channel execution attempt */
export enum ChannelExecutionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYABLE = 'RETRYABLE',
}

/** Result returned by a ChannelExecutor.execute() call */
export interface ChannelExecutionResult {
  /** Whether the execution succeeded */
  status: ChannelExecutionStatus;
  /** Provider-side reference ID (if applicable) */
  providerReferenceId?: string;
  /** Error message if execution failed */
  errorMessage?: string;
  /** Whether this failure is retryable (transient error) vs terminal */
  isRetryable: boolean;
  /** Timestamp of result generation */
  timestamp: Date;
}

// ============================================================
// Channel Executor Interface
// ============================================================

/**
 * Abstract interface defining how each notification channel executes delivery.
 *
 * Each channel type (IN_APP, EMAIL, SMS, PUSH, WHATSAPP) gets its own implementation.
 * The delivery processor invokes the appropriate executor based on notification.channel_type.
 *
 * I-3 §9: an executor with no authorized provider MUST return FAILED with a
 * PROVIDER_NOT_CONFIGURED reason. Returning SUCCESS without a real delivery
 * disguises an unimplemented integration as a completed one.
 */
export interface ChannelExecutor {
  /** The channel type this executor handles */
  channelType: NotificationChannel;

  /**
   * Executes delivery of a single notification through this channel.
   * Must be idempotent — safe to call multiple times with the same notification.
   * 
   * @param notification — The claimed notification to deliver
   * @param recipientTarget — The actual delivery target (email address, phone number, device token, etc.)
   * @returns Execution result with success/failure status
   */
  execute(
    notification: ClaimedNotification,
    recipientTarget: string,
  ): Promise<ChannelExecutionResult>;

  /**
   * Verifies delivery status using the channel-specific confirmation mechanism.
   * An executor with no provider must report FAILED, not a cached SUCCESS.
   *
   * @param providerReferenceId — Reference ID from original execution
   * @returns Verification result
   */
  verifyDelivery(providerReferenceId: string): Promise<ChannelExecutionResult>;
}

// ============================================================
// Retry Configuration
// ============================================================

/**
 * Maximum delivery attempts before terminal FAILED (ESS-001C §4.1 range 5–10).
 * Must match v_max_attempts in communication_schema.record_delivery_attempt (059).
 */
export const MAX_RETRY_COUNT = 5;

/** Base delay in milliseconds for exponential backoff */
export const RETRY_BASE_DELAY_MS = 1000;

/** Upper bound on the retry exponent, matching the SQL LEAST(...,10) clamp. */
export const MAX_BACKOFF_EXPONENT = 10;

/** Jitter fraction required by ESS-001C §4.2; matches the SQL random()*0.30 term. */
export const BACKOFF_JITTER_RATIO = 0.3;

/**
 * Exponential backoff with jitter: base * 2^min(retryCount,10), plus 0–30%.
 * Mirrors communication_schema.record_delivery_attempt so the TypeScript and
 * SQL paths schedule the same retry window.
 */
export function computeBackoffDelay(retryCount: number, baseDelayMs: number = RETRY_BASE_DELAY_MS): number {
  const exponent = Math.min(Math.max(retryCount, 0), MAX_BACKOFF_EXPONENT);
  const delay = baseDelayMs * Math.pow(2, exponent);
  return Math.floor(delay + Math.random() * BACKOFF_JITTER_RATIO * delay);
}

// ============================================================
// Delivery Processing Result
// ============================================================

/** Result of processing a single notification through the delivery pipeline */
export interface DeliveryProcessingResult {
  /** The notification ID that was processed */
  notificationId: string;
  /** Whether the overall processing succeeded */
  success: boolean;
  /** The delivery event status recorded */
  deliveryEventStatus: DeliveryEventStatus;
  /** The final notification delivery status */
  finalDeliveryStatus: DeliveryStatus;
  /** Channel executor used (if any) */
  channelUsed: string | null;
  /** Retry count after processing */
  retryCount: number;
  /** Failure reason if processing failed */
  failureReason?: string;
  /** Correlation ID linking back to the original business event */
  correlationId: string | null;
  /** Timestamp of processing */
  processedAt: Date;
}

// ============================================================
// Batch Processing Result
// ============================================================

/** Result of processing a batch of queued notifications */
export interface BatchProcessingResult {
  /** Total notifications attempted */
  processedCount: number;
  /** Notifications successfully delivered */
  successCount: number;
  /** Notifications that failed permanently */
  failedCount: number;
  /** Notifications re-queued for retry */
  requeuedCount: number;
  /** Individual results for each processed notification */
  results: DeliveryProcessingResult[];
  /** Wall-clock time in milliseconds */
  durationMs: number;
}
