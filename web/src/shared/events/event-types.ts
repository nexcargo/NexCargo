// NexCargo Event Types — Standard event format per PROMPT 2 + Event Registry
// All events emitted across modules MUST conform to this structure.

import { EventClassification, EventCriticality } from '@/shared/types/enums';

/** Standard event payload structure */
export interface NexCargoEvent<T = unknown> {
  event_id: string; // UUID
  event_type: string; // camelCase entity+transition (e.g., listingCreated)
  timestamp: string; // ISO 8601
  source_module: string; // MOD-XXX identifier
  aggregate_id: string; // The domain object being acted upon
  aggregate_type: string; // Entity type (e.g., ShipmentListing, Contract)
  payload: T; // Domain-specific data
  correlation_id: string; // Distributed tracing correlation
  causation_id?: string; // What triggered this event
  version: number; // Event store version
  classification: EventClassification;
  criticality: EventCriticality;
}

/** Event handler signature */
export type EventHandler<T = unknown> = (event: NexCargoEvent<T>) => Promise<void>;

/** Event subscription filter */
export interface EventSubscription {
  eventTypes: string[];
  handler: EventHandler;
  priority?: number; // Lower number = higher priority (default: 0)
  maxRetries?: number; // Default: 3
}

/** Event emitter interface */
export interface EventEmitter {
  emit<T>(event: NexCargoEvent<T>): Promise<void>;
  emitBatch(events: NexCargoEvent[]): Promise<void>;
}

/** Event bus interface — central event coordination */
export interface EventBus {
  subscribe(subscription: EventSubscription): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
  publish<T>(event: NexCargoEvent<T>): Promise<void>;
  publishBatch(events: NexCargoEvent[]): Promise<void>;
}
