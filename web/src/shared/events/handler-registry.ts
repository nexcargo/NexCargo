// NexCargo Event Handler Registry — Manages event subscriptions per PROMPT 1 + PROMPT 2
// Central registry that tracks all event handlers across modules.

import { EventHandler, EventSubscription, EventBus, NexCargoEvent } from './event-types';
import { InMemoryEventEmitter } from './emitter';

/**
 * Event handler registry with in-memory event bus implementation.
 * In production, this would be replaced with a persistent event bus (Redis, Kafka, etc.).
 */
export class EventHandlerRegistry implements EventBus {
  private emitter: InMemoryEventEmitter;
  private subscriptions: Map<string, EventSubscription[]>;

  constructor() {
    this.emitter = new InMemoryEventEmitter();
    this.subscriptions = new Map();
  }

  /** Subscribe to event types */
  subscribe(subscription: EventSubscription): void {
    const { eventTypes, handler } = subscription;

    for (const eventType of eventTypes) {
      if (!this.subscriptions.has(eventType)) {
        this.subscriptions.set(eventType, []);
      }
      this.subscriptions.get(eventType)!.push(subscription);
      this.emitter.on(eventType, handler);
    }
  }

  /** Unsubscribe from event types */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const subs = this.subscriptions.get(eventType);
    if (subs) {
      const filtered = subs.filter((sub) => sub.handler !== handler);
      this.subscriptions.set(eventType, filtered);
      this.emitter.off(eventType, handler);
    }
  }

  /** Publish an event through the bus */
  async publish<T>(event: NexCargoEvent<T>): Promise<void> {
    await this.emitter.emit(event);
  }

  /** Publish batch of events */
  async publishBatch(events: NexCargoEvent[]): Promise<void> {
    await this.emitter.emitBatch(events);
  }

  /** Get all subscriptions for debugging/monitoring */
  getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }

  /** Clear all subscriptions (useful for testing) */
  clear(): void {
    this.subscriptions.clear();
    this.emitter = new InMemoryEventEmitter();
  }
}

/** Singleton instance */
let registryInstance: EventHandlerRegistry | null = null;

export function getEventBus(): EventBus {
  if (!registryInstance) {
    registryInstance = new EventHandlerRegistry();
  }
  return registryInstance;
}
