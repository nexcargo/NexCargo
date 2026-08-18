// NexCargo Event Emitter — Abstraction over event publishing per PROMPT 1 + PROMPT 2
// Modules emit events through this abstraction. Actual implementation varies by environment.

import { NexCargoEvent, EventHandler } from './event-types';
import { EventClassification, EventCriticality } from '@/shared/types/enums';

/** In-memory event emitter for development and testing */
export class InMemoryEventEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /** Register a handler for specific event types */
  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /** Remove a handler */
  off(eventType: string, handler: EventHandler): void {
    const set = this.handlers.get(eventType);
    if (set) {
      set.delete(handler);
    }
  }

  /** Emit an event to all registered handlers */
  async emit<T>(event: NexCargoEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.event_type);
    if (!handlers) return;

    const promises = [];
    for (const handler of handlers) {
      promises.push(handler(event).catch((error) => {
        console.error(`[EventEmitter] Handler failed for ${event.event_type}:`, error);
      }));
    }
    await Promise.all(promises);
  }

  /** Emit batch of events */
  async emitBatch(events: NexCargoEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.emit(event)));
  }

  /** Create a standardized event */
  static createEvent<T>({
    eventType,
    sourceModule,
    aggregateId,
    aggregateType,
    payload,
    classification,
    criticality,
    correlationId,
  }: {
    eventType: string;
    sourceModule: string;
    aggregateId: string;
    aggregateType: string;
    payload: T;
    classification: EventClassification;
    criticality: EventCriticality;
    correlationId?: string;
  }): NexCargoEvent<T> {
    return {
      event_id: crypto.randomUUID(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      source_module: sourceModule,
      aggregate_id: aggregateId,
      aggregate_type: aggregateType,
      payload,
      correlation_id: correlationId || crypto.randomUUID(),
      version: 1,
      classification,
      criticality,
    };
  }
}
