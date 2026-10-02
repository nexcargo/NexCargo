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
  deliveryStatus: DeliveryStatus;
  retryCount: number;
  providerChannel: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
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
 * C5-II constraint: No real external provider integrations required.
 * Stub implementations are acceptable for Increment 2.
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
   * Verifies delivery status using channel-specific confirmation mechanism.
   * C5 constraint: May return cached/stored state; no live provider lookup required.
   * 
   * @param providerReferenceId — Reference ID from original execution
   * @returns Verification result
   */
  verifyDelivery(providerReferenceId: string): Promise<ChannelExecutionResult>;
}

// ============================================================
// Retry Configuration
// ============================================================

/** Maximum number of delivery attempts before marking as terminal FAILED */
export const MAX_RETRY_COUNT = 3;

/** Base delay in milliseconds for exponential backoff */
export const RETRY_BASE_DELAY_MS = 1000;

/**
 * Computes the backoff delay for a given retry count.
 * Uses exponential backoff: baseDelay * 2^retryCount
 * 
 * @param retryCount — Current retry count (0-based)
 * @param baseDelayMs — Base delay in milliseconds (default 1000)
 * @returns Delay in milliseconds
 */
export function computeBackoffDelay(retryCount: number, baseDelayMs: number = RETRY_BASE_DELAY_MS): number {
  return baseDelayMs * Math.pow(2, retryCount);
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
