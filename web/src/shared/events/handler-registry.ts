// NexCargo Event Handler Registry — Manages event subscriptions per PROMPT 1 + PROMPT 2
// I-3 §4A/§4B: durable append to analytics_schema.event_store, priority-ordered consumer
// dispatch, and per-consumer processing state in analytics_schema.event_consumer_state.

import { EventHandler, EventSubscription, EventBus, NexCargoEvent } from './event-types';
import { EventClassification, EventCriticality } from '@/shared/types/enums';

type AdminClient = Awaited<ReturnType<typeof import('@/infrastructure/database/supabase')['createAdminClient']>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cachedClient: AdminClient | null | undefined;

/**
 * Resolves the service-role client lazily. Returns null when the key is absent so that
 * unit tests and offline builds still dispatch in-process instead of throwing.
 */
async function getAdminClient(): Promise<AdminClient | null> {
  if (cachedClient !== undefined) return cachedClient;
  try {
    const { createAdminClient } = await import('@/infrastructure/database/supabase');
    cachedClient = createAdminClient();
  } catch {
    cachedClient = null;
  }
  return cachedClient;
}

export class EventHandlerRegistry implements EventBus {
  private subscriptions: Map<string, EventSubscription[]>;

  constructor() {
    this.subscriptions = new Map();
  }

  /** Subscribe to event types. Re-registering the same consumer is a no-op. */
  subscribe(subscription: EventSubscription): void {
    for (const eventType of subscription.eventTypes) {
      const existing = this.subscriptions.get(eventType) ?? [];
      const duplicate = existing.some(
        (sub) => sub.handler === subscription.handler && sub.consumerName === subscription.consumerName,
      );
      if (duplicate) continue;
      existing.push(subscription);
      existing.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      this.subscriptions.set(eventType, existing);
    }
  }

  /** Unsubscribe from event types */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const subs = this.subscriptions.get(eventType);
    if (subs) {
      this.subscriptions.set(
        eventType,
        subs.filter((sub) => sub.handler !== handler),
      );
    }
  }

  /** Append durably, then dispatch to consumers in priority order. */
  async publish<T>(event: NexCargoEvent<T>): Promise<void> {
    const appended = await this.appendDurably(event);

    // false means this event_id was already appended — its consumers have already run.
    if (appended === false) return;

    const subscriptions = this.subscriptions.get(event.event_type);
    if (!subscriptions || subscriptions.length === 0) return;

    for (const subscription of subscriptions) {
      await this.dispatch(event, subscription);
    }
  }

  /** Publish batch of events sequentially so priority and causation order are preserved. */
  async publishBatch(events: NexCargoEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /** Get all subscriptions for debugging/monitoring */
  getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }

  /** Clear all subscriptions (useful for testing) */
  clear(): void {
    this.subscriptions.clear();
  }

  /**
   * Returns true when appended, false when the event_id already existed, and null when
   * durable storage was unavailable. A null result still dispatches consumers: the
   * notification row they write is itself durable, and the loss is logged for operators.
   */
  private async appendDurably<T>(event: NexCargoEvent<T>): Promise<boolean | null> {
    const db = await getAdminClient();
    if (!db) return null;
    if (!UUID_PATTERN.test(event.event_id)) return null;

    const { data, error } = await db.rpc('append_platform_event', {
      p_event_id: event.event_id,
      p_event_type: event.event_type,
      p_timestamp: event.timestamp,
      p_source_module: event.source_module,
      p_aggregate_id: event.aggregate_id ?? null,
      p_aggregate_type: event.aggregate_type,
      p_payload: event.payload ?? {},
      p_correlation_id: event.correlation_id ?? null,
      p_causation_id: event.causation_id ?? null,
      p_version: event.version ?? 1,
      p_classification: event.classification ?? null,
      p_criticality: event.criticality ?? null,
    });

    if (error) {
      console.error(`[EventBus] Durable append failed for ${event.event_type} ${event.event_id}:`, error.message);
      return null;
    }
    return data === true;
  }

  /**
   * Runs one consumer and records its terminal state. Failures are recorded, never
   * retried inline — ESS-001C §10 forbids synchronous retry in the request path.
   */
  private async dispatch<T>(event: NexCargoEvent<T>, subscription: EventSubscription): Promise<void> {
    const consumerName = subscription.consumerName ?? 'anonymous';
    let failure: string | null = null;

    try {
      await subscription.handler(event);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      console.error(`[EventBus] Consumer ${consumerName} failed for ${event.event_type}:`, failure);
    }

    const db = await getAdminClient();
    if (!db || !UUID_PATTERN.test(event.event_id)) return;

    const { error } = await db.rpc('record_event_consumption', {
      p_event_id: event.event_id,
      p_consumer_name: consumerName,
      p_status: failure ? 'FAILED' : 'COMPLETED',
      p_attempts: 1,
      p_last_error: failure,
      p_correlation_id: event.correlation_id ?? null,
    });

    if (error) {
      console.error(`[EventBus] Failed to record consumer state for ${consumerName}:`, error.message);
    }
  }

  /**
   * Bounded recovery pass (I-3 §4B, migration 060). Claims FAILED/stalled consumer
   * states atomically, re-runs the registered consumer, and records the outcome
   * with attempts + 1. Consumers must be idempotent; MOD-016 is, via the
   * (source_event_id, recipient_id) unique index.
   */
  async replayFailedConsumptions(
    options: { consumerName?: string; maxAttempts?: number; batchSize?: number } = {},
  ): Promise<EventReplayResult> {
    const empty: EventReplayResult = { claimed: 0, completed: 0, failed: 0, skipped: 0 };
    const db = await getAdminClient();
    if (!db) return empty;

    const { data, error } = await db.rpc('claim_failed_event_consumptions', {
      p_consumer_name: options.consumerName ?? null,
      p_max_attempts: options.maxAttempts ?? 5,
      p_batch_size: options.batchSize ?? 25,
      p_stall_timeout_seconds: 300,
    });

    if (error) {
      console.error('[EventBus] Failed to claim event consumptions for replay:', error.message);
      return empty;
    }

    const rows = (Array.isArray(data) ? data : []) as ReplayRow[];
    const result: EventReplayResult = { claimed: rows.length, completed: 0, failed: 0, skipped: 0 };

    for (const row of rows) {
      const subscriptions = (this.subscriptions.get(row.event_type) ?? []).filter(
        (sub) => (sub.consumerName ?? 'anonymous') === row.consumer_name,
      );

      if (subscriptions.length === 0) {
        // This process has no such consumer. Release the claim immediately instead
        // of leaving it PROCESSING until the stall timeout.
        await db.rpc('record_event_consumption', {
          p_event_id: row.event_id,
          p_consumer_name: row.consumer_name,
          p_status: 'FAILED',
          p_attempts: row.attempts,
          p_last_error: `No consumer "${row.consumer_name}" registered in this process`,
          p_correlation_id: row.correlation_id ?? null,
        });
        result.skipped++;
        continue;
      }

      const event: NexCargoEvent = {
        event_id: row.event_id,
        event_type: row.event_type,
        timestamp: new Date(row.event_timestamp).toISOString(),
        source_module: row.source_module,
        aggregate_id: row.aggregate_id ?? '',
        aggregate_type: row.aggregate_type,
        payload: row.payload,
        correlation_id: row.correlation_id ?? row.event_id,
        causation_id: row.causation_id ?? undefined,
        version: row.version ?? 1,
        classification: (row.classification ?? EventClassification.BUSINESS) as EventClassification,
        criticality: (row.criticality ?? EventCriticality.MEDIUM) as EventCriticality,
      };

      let failure: string | null = null;
      for (const subscription of subscriptions) {
        try {
          await subscription.handler(event);
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
        }
      }

      const { error: recordError } = await db.rpc('record_event_consumption', {
        p_event_id: row.event_id,
        p_consumer_name: row.consumer_name,
        p_status: failure ? 'FAILED' : 'COMPLETED',
        p_attempts: row.attempts + 1,
        p_last_error: failure,
        p_correlation_id: row.correlation_id ?? null,
      });

      if (recordError) {
        console.error('[EventBus] Failed to record replay outcome:', recordError.message);
      }

      if (failure) result.failed++;
      else result.completed++;
    }

    return result;
  }
}

interface ReplayRow {
  event_id: string;
  consumer_name: string;
  attempts: number;
  event_type: string;
  event_timestamp: string;
  source_module: string;
  aggregate_id: string | null;
  aggregate_type: string;
  payload: unknown;
  correlation_id: string | null;
  causation_id: string | null;
  version: number | null;
  classification: string | null;
  criticality: string | null;
}

export interface EventReplayResult {
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
}

/** Singleton instance */
let registryInstance: EventHandlerRegistry | null = null;

export function getEventBus(): EventBus {
  if (!registryInstance) {
    registryInstance = new EventHandlerRegistry();
  }
  return registryInstance;
}

/** Test-only: drop the singleton so a fresh registry can be built. */
export function resetEventBus(): void {
  registryInstance = null;
  cachedClient = undefined;
}

/**
 * Runs the bounded consumer-recovery pass against the shared registry.
 * Called by the governance-tier delivery-processor endpoint; the automatic
 * notification drain and stall recovery are scheduled separately by pg_cron.
 */
export async function replayFailedEventConsumptions(
  options: { consumerName?: string; maxAttempts?: number; batchSize?: number } = {},
): Promise<EventReplayResult> {
  if (!registryInstance) {
    registryInstance = new EventHandlerRegistry();
  }
  return registryInstance.replayFailedConsumptions(options);
}