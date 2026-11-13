// NexCargo MOD-016 — Notification Delivery Processor
// Originally C5-II (HAO-C5-002). Corrected under I-3 §4B/§4C/§5.
//
// Pipeline: claim → validate → select channel → execute → persist attempt → release
//
// I-3 corrections applied here:
//   * RPCs are addressed to communication_schema. The previous client had no
//     schema option, so .rpc() resolved against public and every call failed
//     PGRST202 (the SB-3A schema-resolution defect).
//   * claim_one_queued_notification RETURNS TABLE, so PostgREST returns an array.
//   * The SUCCESS branch now persists the attempt. Previously it returned without
//     calling record_delivery_attempt, leaving claimed rows stuck in PROCESSING.
//   * failureReason is assigned before it is passed to the retry RPC.
//   * IN_APP is registered; unconfigured channels report PROVIDER_NOT_CONFIGURED.
//   * The phantom `version` column is gone; correlation_ref/source_event_id map instead.
//   * durationMs is a duration, not a timestamp.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClaimedNotification, DeliveryProcessingResult, BatchProcessingResult, ChannelExecutionResult } from '../../domain/types/delivery-pipeline';
import { MAX_RETRY_COUNT, ChannelExecutionStatus, RETRY_BASE_DELAY_MS } from '../../domain/types/delivery-pipeline';
import { DeliveryEventStatus, DeliveryStatus } from '../../domain/enums';
import { NotificationChannel } from '@/shared/types/enums';
import { ChannelExecutorRegistry, ChannelExecutorFactory, resolveRecipientTarget } from '@/modules/mod-016-notifications/infrastructure/adapters/channel-executor-registry';
import { providerNotConfiguredReason } from '@/modules/mod-016-notifications/infrastructure/adapters/channel-executors/stub-channel-executor';

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

    // Every RPC this processor calls lives in communication_schema, so each call
    // is addressed explicitly through comm() below. That is the SB-3A
    // schema-resolution fix: the previous bare .rpc() resolved against public and
    // failed PGRST202. service_role is the only role granted EXECUTE (059 Part 6).
    supabaseInstance = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseInstance;
}

/** Addresses the communication_schema PostgREST profile (056 exposes it). */
function comm(db: SupabaseClient) {
  return db.schema('communication_schema');
}

/** RPC errors must not be swallowed: a lost attempt record strands the row. */
function assertRpcOk(error: { message: string } | null, fn: string): void {
  if (error) throw new Error(`${fn} failed: ${error.message}`);
}

// ============================================================
// Delivery Processor Service
// ============================================================

export class NotificationDeliveryProcessor {
  private static instance: NotificationDeliveryProcessor;
  private registry: ChannelExecutorRegistry;
  private initialized = false;

  private constructor() {
    this.registry = ChannelExecutorRegistry.getInstance();
  }

  static getInstance(): NotificationDeliveryProcessor {
    if (!NotificationDeliveryProcessor.instance) {
      NotificationDeliveryProcessor.instance = new NotificationDeliveryProcessor();
    }
    return NotificationDeliveryProcessor.instance;
  }

  /** Registers IN_APP plus honest failure executors for unconfigured channels. */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    ChannelExecutorFactory.createAndRegisterDefaults(this.registry);
    this.initialized = true;
  }

  /** Processes one queued notification. Returns null when the queue is empty. */
  async processOne(): Promise<DeliveryProcessingResult | null> {
    await this.initialize();
    const db = getSupabase();

    const claimed = await this.claimNotification(db);
    if (!claimed) return null;

    try {
      this.validateClaimedNotification(claimed);
      const executionResult = await this.executeChannel(claimed);
      const finalStatus = await this.persistDeliveryResult(db, claimed, executionResult);

      return {
        notificationId: claimed.id,
        ...finalStatus,
        correlationId: claimed.correlationRef ?? claimed.eventCorrelationId,
        processedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DeliveryProcessor] Error processing notification ${claimed.id}:`, errorMessage);

      const requeue = await this.recordFailureAndRequeue(db, claimed, errorMessage);

      return {
        notificationId: claimed.id,
        success: false,
        deliveryEventStatus: requeue.terminal ? DeliveryEventStatus.FAILED : DeliveryEventStatus.RETRY_SCHEDULED,
        finalDeliveryStatus: requeue.terminal ? DeliveryStatus.FAILED : DeliveryStatus.QUEUED,
        channelUsed: claimed.channelType,
        retryCount: requeue.retryCount,
        failureReason: `Processing error: ${errorMessage}`,
        correlationId: claimed.correlationRef ?? claimed.eventCorrelationId,
        processedAt: new Date(),
      };
    }
  }

  /**
   * Executor-driven batch for the on-demand governance endpoint. The automatic
   * path is pg_cron → communication_schema.drain_notification_queue (059 Part 7),
   * which carries the ESS-001C §5.2 circuit breaker. Both share the same atomic
   * claim and record RPCs, so they cannot deliver the same row twice.
   */
  async processBatch(batchSize: number = 10): Promise<BatchProcessingResult> {
    await this.initialize();
    const startedAt = Date.now();
    const bounded = Math.min(Math.max(batchSize, 1), 100);

    const results: DeliveryProcessingResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let requeuedCount = 0;

    for (let i = 0; i < bounded; i++) {
      const result = await this.processOne();
      if (!result) break;

      results.push(result);
      if (result.success) successCount++;
      else if (result.finalDeliveryStatus === DeliveryStatus.FAILED) failedCount++;
      else requeuedCount++;
    }

    return {
      processedCount: results.length,
      successCount,
      failedCount,
      requeuedCount,
      results,
      durationMs: Date.now() - startedAt,
    };
  }

  /** Recovers rows stranded in PROCESSING by a crashed worker (059 Part 5.5). */
  async recoverStalledProcessing(stallTimeoutSeconds: number = 300): Promise<number> {
    const db = getSupabase();
    const { data, error } = await comm(db).rpc('recover_stalled_processing', {
      p_stall_timeout_seconds: stallTimeoutSeconds,
    });
    assertRpcOk(error, 'recover_stalled_processing');
    return typeof data === 'number' ? data : 0;
  }

  // ============================================================
  // Private Pipeline Steps
  // ============================================================

  private async claimNotification(db: SupabaseClient): Promise<ClaimedNotification | null> {
    const { data, error } = await comm(db).rpc('claim_one_queued_notification', {
      p_channel_type: null,
      p_max_retry_count: MAX_RETRY_COUNT,
    });

    if (error) {
      console.error('[DeliveryProcessor] Failed to claim notification:', error.message);
      return null;
    }

    // RETURNS TABLE => PostgREST yields an array, empty when nothing is eligible.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      id: row.id,
      recipientId: row.recipient_id,
      sourceModule: row.source_module,
      eventType: row.event_type,
      title: row.title,
      body: row.body,
      priorityLevel: row.priority_level,
      channelType: row.channel_type,
      locale: row.locale,
      templateId: row.template_id ?? null,
      eventCorrelationId: row.event_correlation_id ?? null,
      correlationRef: row.correlation_ref ?? null,
      sourceEventId: row.source_event_id ?? null,
      deliveryStatus: row.delivery_status,
      retryCount: row.retry_count,
      providerChannel: row.provider_channel ?? null,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

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

  private async executeChannel(notification: ClaimedNotification): Promise<ChannelExecutionResult> {
    const executor = this.registry.getExecutor(notification.channelType);
    if (!executor) {
      throw new Error(`No channel executor registered for: ${notification.channelType}`);
    }

    const recipientTarget = resolveRecipientTarget(notification.recipientId, notification.channelType);

    // No contact source exists for this channel. Fail honestly rather than
    // inventing an address (I-3 §9).
    if (recipientTarget === null) {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: providerNotConfiguredReason(notification.channelType),
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    return executor.execute(notification, recipientTarget);
  }

  private async persistDeliveryResult(
    db: SupabaseClient,
    notification: ClaimedNotification,
    executionResult: ChannelExecutionResult,
  ): Promise<Omit<DeliveryProcessingResult, 'notificationId' | 'correlationId' | 'processedAt'>> {
    const succeeded = executionResult.status === ChannelExecutionStatus.SUCCESS;
    const newRetryCount = succeeded ? notification.retryCount : notification.retryCount + 1;
    const failureReason = succeeded ? undefined : (executionResult.errorMessage || 'Delivery failed');

    let deliveryEventStatus: DeliveryEventStatus;
    let finalDeliveryStatus: DeliveryStatus;
    let isRetryable = false;

    if (succeeded) {
      deliveryEventStatus = DeliveryEventStatus.SUCCEEDED;
      // IN_APP delivery is the persisted inbox row itself. Any other channel
      // reaching SUCCESS means a real provider acknowledged it, hence SENT.
      finalDeliveryStatus = notification.channelType === NotificationChannel.IN_APP
        ? DeliveryStatus.DELIVERED
        : DeliveryStatus.SENT;
    } else if (executionResult.isRetryable && newRetryCount < MAX_RETRY_COUNT) {
      deliveryEventStatus = DeliveryEventStatus.RETRY_SCHEDULED;
      finalDeliveryStatus = DeliveryStatus.QUEUED;
      isRetryable = true;
    } else {
      deliveryEventStatus = DeliveryEventStatus.FAILED;
      finalDeliveryStatus = DeliveryStatus.FAILED;
    }

    const { error } = await comm(db).rpc('record_delivery_attempt', {
      p_notification_id: notification.id,
      p_status: deliveryEventStatus,
      p_channel_used: notification.channelType,
      p_retry_count: newRetryCount,
      p_failure_reason: failureReason ?? null,
      p_new_delivery_status: finalDeliveryStatus,
      p_is_retryable: isRetryable,
      p_base_delay_ms: RETRY_BASE_DELAY_MS,
      p_auto_reset_to_queued: false,
    });
    assertRpcOk(error, 'record_delivery_attempt');

    return {
      success: succeeded,
      deliveryEventStatus,
      finalDeliveryStatus,
      channelUsed: notification.channelType,
      retryCount: newRetryCount,
      failureReason,
    };
  }

  /**
   * Records an unexpected processing error and releases the claim atomically.
   * p_auto_reset_to_queued keeps the event insert and the PROCESSING→QUEUED
   * transition in one SQL transaction (C5-III), so a failed second call cannot
   * strand the row.
   */
  private async recordFailureAndRequeue(
    db: SupabaseClient,
    notification: ClaimedNotification,
    errorMessage: string,
  ): Promise<{ terminal: boolean; retryCount: number }> {
    const newRetryCount = notification.retryCount + 1;
    const terminal = newRetryCount >= MAX_RETRY_COUNT;

    const { error } = await comm(db).rpc('record_delivery_attempt', {
      p_notification_id: notification.id,
      p_status: terminal ? DeliveryEventStatus.FAILED : DeliveryEventStatus.RETRY_SCHEDULED,
      p_channel_used: notification.channelType,
      p_retry_count: newRetryCount,
      p_failure_reason: errorMessage,
      p_new_delivery_status: terminal ? DeliveryStatus.FAILED : null,
      p_is_retryable: !terminal,
      p_base_delay_ms: RETRY_BASE_DELAY_MS,
      p_auto_reset_to_queued: !terminal,
    });

    if (error) {
      // The row stays PROCESSING; recover_stalled_processing will release it.
      console.error('[DeliveryProcessor] Failed to record processing error:', error.message);
    }

    return { terminal, retryCount: newRetryCount };
  }
}

/** Get the shared delivery processor instance */
export function getDeliveryProcessor(): NotificationDeliveryProcessor {
  return NotificationDeliveryProcessor.getInstance();
}