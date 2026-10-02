// NexCargo MOD-016 — Notification Delivery Processor (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002
// Purpose: Core orchestration of notification delivery pipeline
//
// Pipeline flow:
//   discover → claim → validate → select channel → execute → persist attempt → update state → release
//
// Uses PostgreSQL RPC functions for atomic claiming and result persistence.
// Channel executors handle the actual delivery mechanism.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClaimedNotification, DeliveryProcessingResult, BatchProcessingResult, ChannelExecutionResult } from '../../domain/types/delivery-pipeline';
import { MAX_RETRY_COUNT, ChannelExecutionStatus, RETRY_BASE_DELAY_MS } from '../../domain/types/delivery-pipeline';
import { DeliveryEventStatus, DeliveryStatus } from '../../domain/enums';
import { NotificationChannel } from '@/shared/types/enums';
import { ChannelExecutorRegistry, resolveRecipientTarget } from '@/modules/mod-016-notifications/infrastructure/adapters/channel-executor-registry';
import { StubChannelExecutor } from '@/modules/mod-016-notifications/infrastructure/adapters/channel-executors/stub-channel-executor';

// ============================================================
// Environment & Client Setup
// ============================================================

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for delivery processing');
    }

    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ============================================================
// Lazy channel executor initialization
// ============================================================

/**
 * Ensures all default channel executors are registered.
 * Called once on first processor invocation.
 */
function ensureChannelExecutorsRegistered(registry: ChannelExecutorRegistry): void {
  // Register stub executors for channels without real implementations
  const channelsToRegister: NotificationChannel[] = [
    NotificationChannel.EMAIL,
    NotificationChannel.SMS,
    NotificationChannel.PUSH,
    NotificationChannel.WHATSAPP,
  ];

  for (const channel of channelsToRegister) {
    if (!registry.hasExecutor(channel)) {
      registry.register(new StubChannelExecutor(channel));
    }
  }
}

// ============================================================
// Delivery Processor Service
// ============================================================

/**
 * NotificationDeliveryProcessor — Orchestrates the full delivery pipeline.
 * 
 * Thread-safe singleton pattern for use in serverless environments.
 */
export class NotificationDeliveryProcessor {
  private static instance: NotificationDeliveryProcessor;
  private registry: ChannelExecutorRegistry;
  private initialized = false;

  private constructor() {
    this.registry = ChannelExecutorRegistry.getInstance();
  }

  /** Get singleton instance */
  static getInstance(): NotificationDeliveryProcessor {
    if (!NotificationDeliveryProcessor.instance) {
      NotificationDeliveryProcessor.instance = new NotificationDeliveryProcessor();
    }
    return NotificationDeliveryProcessor.instance;
  }

  /** Initialize the processor (register default channel executors) */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    ensureChannelExecutorsRegistered(this.registry);
    this.initialized = true;
  }

  /**
   * Processes a single queued notification through the full delivery pipeline.
   * 
   * @returns Processing result with status, delivery event info, and retry state
   */
  async processOne(): Promise<DeliveryProcessingResult | null> {
    await this.initialize();

    const db = getSupabase();

    // Step 1: Claim one QUEUED notification atomically
    const claimed = await this.claimNotification(db);
    if (!claimed) {
      return null; // No notifications to process
    }

    const startTime = Date.now();

    try {
      // Step 2: Validate the claimed notification
      this.validateClaimedNotification(claimed);

      // Step 3: Select and execute the appropriate channel
      const executionResult = await this.executeChannel(db, claimed);

      // Step 4: Persist the delivery attempt result
      const finalStatus = await this.persistDeliveryResult(db, claimed, executionResult);

      return {
        notificationId: claimed.id,
        success: finalStatus.success,
        deliveryEventStatus: finalStatus.deliveryEventStatus,
        finalDeliveryStatus: finalStatus.finalDeliveryStatus,
        channelUsed: claimed.channelType,
        retryCount: finalStatus.retryCount,
        failureReason: finalStatus.failureReason,
        correlationId: claimed.eventCorrelationId,
        processedAt: new Date(),
      };
    } catch (error) {
      // On unexpected error, record failure and re-queue for retry
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DeliveryProcessor] Unexpected error processing notification ${claimed.id}:`, errorMessage);

      await this.recordFailureAndRequeue(db, claimed, errorMessage);

      return {
        notificationId: claimed.id,
        success: false,
        deliveryEventStatus: DeliveryEventStatus.FAILED,
        finalDeliveryStatus: DeliveryStatus.FAILED,
        channelUsed: claimed.channelType,
        retryCount: claimed.retryCount + 1,
        failureReason: `Processing error: ${errorMessage}`,
        correlationId: claimed.eventCorrelationId,
        processedAt: new Date(),
      };
    }
  }

  /**
   * Processes up to batch_size queued notifications.
   * Useful for cron/scheduled invocations.
   * 
   * @param batchSize — Maximum notifications to process (default 10)
   * @returns Batch processing result with aggregate statistics
   */
  async processBatch(batchSize: number = 10): Promise<BatchProcessingResult> {
    await this.initialize();

    const results: DeliveryProcessingResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let requeuedCount = 0;

    for (let i = 0; i < batchSize; i++) {
      const result = await this.processOne();

      if (!result) {
        break; // No more queued notifications
      }

      results.push(result);

      if (result.success) {
        successCount++;
      } else if (result.finalDeliveryStatus === DeliveryStatus.FAILED) {
        failedCount++;
      } else {
        requeuedCount++;
      }
    }

    return {
      processedCount: results.length,
      successCount,
      failedCount,
      requeuedCount,
      results,
      durationMs: Date.now(), // Will be updated by caller
    };
  }

  // ============================================================
  // Private Pipeline Steps
  // ============================================================

  /** Step 1: Atomically claim one QUEUED notification via SQL RPC */
  private async claimNotification(db: SupabaseClient): Promise<ClaimedNotification | null> {
    const { data, error } = await db.rpc('claim_one_queued_notification');

    if (error) {
      console.error('[DeliveryProcessor] Failed to claim notification:', error.message);
      return null;
    }

    if (!data) {
      return null; // No notifications available
    }

    // Map SQL composite type to TypeScript interface
    return {
      id: data.id,
      recipientId: data.recipient_id,
      sourceModule: data.source_module,
      eventType: data.event_type,
      title: data.title,
      body: data.body,
      priorityLevel: data.priority_level as any,
      channelType: data.channel_type as any,
      locale: data.locale,
      templateId: data.template_id,
      eventCorrelationId: data.event_correlation_id,
      deliveryStatus: data.delivery_status as any,
      retryCount: data.retry_count,
      providerChannel: data.provider_channel,
      nextRetryAt: data.next_retry_at ? new Date(data.next_retry_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      version: data.version,
    };
  }

  /** Step 2: Validate the claimed notification has required fields */
  private validateClaimedNotification(notification: ClaimedNotification): void {
    if (!notification.id) {
      throw new Error('Claimed notification missing ID');
    }
    if (!notification.recipientId) {
      throw new Error(`Claimed notification ${notification.id} missing recipientId`);
    }
    if (!notification.channelType) {
      throw new Error(`Claimed notification ${notification.id} missing channelType`);
    }
    if (!Object.values(NotificationChannel).includes(notification.channelType)) {
      throw new Error(`Claimed notification ${notification.id} has invalid channelType: ${notification.channelType}`);
    }
  }

  /** Step 3: Execute the appropriate channel for this notification */
  private async executeChannel(
    db: SupabaseClient,
    notification: ClaimedNotification,
  ): Promise<ChannelExecutionResult> {
    const executor = this.registry.getExecutor(notification.channelType);

    if (!executor) {
      throw new Error(`No channel executor registered for: ${notification.channelType}`);
    }

    // Resolve the actual delivery target for this channel
    const recipientTarget = resolveRecipientTarget(notification.recipientId, notification.channelType);

    // Execute delivery through the channel
    return executor.execute(notification, recipientTarget);
  }

  /** Step 4: Persist delivery attempt result and update notification state */
  private async persistDeliveryResult(
    db: SupabaseClient,
    notification: ClaimedNotification,
    executionResult: ChannelExecutionResult,
  ): Promise<Omit<DeliveryProcessingResult, 'notificationId' | 'correlationId' | 'processedAt'>> {
    const newRetryCount = executionResult.status === ChannelExecutionStatus.FAILED
      ? notification.retryCount + 1
      : notification.retryCount;

    let deliveryEventStatus: DeliveryEventStatus;
    let finalDeliveryStatus: DeliveryStatus;
    let failureReason: string | undefined;

    if (executionResult.status === ChannelExecutionStatus.SUCCESS) {
      deliveryEventStatus = DeliveryEventStatus.SUCCEEDED;
      finalDeliveryStatus = notification.channelType === NotificationChannel.IN_APP
        ? DeliveryStatus.DELIVERED
        : DeliveryStatus.SENT;
    } else if (executionResult.isRetryable && newRetryCount < MAX_RETRY_COUNT) {
      deliveryEventStatus = DeliveryEventStatus.RETRY_SCHEDULED;
      finalDeliveryStatus = DeliveryStatus.QUEUED; // Re-queue for retry

      // Record delivery attempt with retryable flag and backoff delay
      await db.rpc('record_delivery_attempt', {
        p_notification_id: notification.id,
        p_status: deliveryEventStatus,
        p_channel_used: notification.channelType,
        p_retry_count: newRetryCount,
        p_failure_reason: failureReason || null,
        p_new_delivery_status: finalDeliveryStatus,
        p_is_retryable: true,
        p_base_delay_ms: RETRY_BASE_DELAY_MS,
      });
    } else {
      deliveryEventStatus = DeliveryEventStatus.FAILED;
      finalDeliveryStatus = DeliveryStatus.FAILED;
      failureReason = executionResult.errorMessage || 'Delivery failed';

      // Record terminal failure (not retryable)
      await db.rpc('record_delivery_attempt', {
        p_notification_id: notification.id,
        p_status: deliveryEventStatus,
        p_channel_used: notification.channelType,
        p_retry_count: newRetryCount,
        p_failure_reason: failureReason,
        p_new_delivery_status: finalDeliveryStatus,
        p_is_retryable: false,
        p_base_delay_ms: RETRY_BASE_DELAY_MS,
      });
    }

    return {
      success: executionResult.status === ChannelExecutionStatus.SUCCESS,
      deliveryEventStatus,
      finalDeliveryStatus,
      channelUsed: notification.channelType,
      retryCount: newRetryCount,
      failureReason,
    };
  }

  /** Handle unexpected errors: record failure and re-queue */
  private async recordFailureAndRequeue(
    db: SupabaseClient,
    notification: ClaimedNotification,
    errorMessage: string,
  ): Promise<void> {
    const newRetryCount = notification.retryCount + 1;

    if (newRetryCount >= MAX_RETRY_COUNT) {
      // Terminal failure — mark as FAILED permanently
      await db.rpc('record_delivery_attempt', {
        p_notification_id: notification.id,
        p_status: DeliveryEventStatus.FAILED,
        p_channel_used: notification.channelType,
        p_retry_count: newRetryCount,
        p_failure_reason: errorMessage,
        p_new_delivery_status: DeliveryStatus.FAILED,
        p_is_retryable: false,
        p_base_delay_ms: RETRY_BASE_DELAY_MS,
      });
    } else {
      // Retryable — increment count and re-queue with backoff
      await db.rpc('record_delivery_attempt', {
        p_notification_id: notification.id,
        p_status: DeliveryEventStatus.RETRY_SCHEDULED,
        p_channel_used: notification.channelType,
        p_retry_count: newRetryCount,
        p_failure_reason: errorMessage,
        p_new_delivery_status: null, // Don't change delivery_status yet
        p_is_retryable: true,
        p_base_delay_ms: RETRY_BASE_DELAY_MS,
      });

      // Re-queue with backoff enforcement
      await db.rpc('requeue_notification', {
        p_notification_id: notification.id,
        p_is_retryable: true,
        p_base_delay_ms: RETRY_BASE_DELAY_MS,
      });
    }
  }
}

// ============================================================
// Export singleton accessor for direct use
// ============================================================

/** Get the shared delivery processor instance */
export function getDeliveryProcessor(): NotificationDeliveryProcessor {
  return NotificationDeliveryProcessor.getInstance();
}
