// NexCargo MOD-016 — Channel Executor Abstraction
// Originally C5-II (HAO-C5-002). Recipient-target fabrication removed under I-3 §4C/§9.
// Defines the ChannelExecutor registry and honest recipient-target resolution.

import { NotificationChannel } from '@/shared/types/enums';
import type { ChannelExecutor } from '../../domain/types/delivery-pipeline';
import { StubInAppChannelExecutor } from './channel-executors/stub-in-app-channel-executor';
import { StubChannelExecutor, UNCONFIGURED_CHANNELS } from './channel-executors/stub-channel-executor';

// ============================================================
// Channel Executor Registry
// ============================================================

/**
 * Maps channel types to their executor implementations. The delivery processor
 * selects an executor by notification.channel_type.
 *
 * IN_APP is genuinely deliverable: the persisted notification row IS the inbox
 * entry. EMAIL/SMS/PUSH/WHATSAPP have no authorized provider and are registered
 * with an executor that reports a terminal PROVIDER_NOT_CONFIGURED failure.
 */
export class ChannelExecutorRegistry {
  private static instance: ChannelExecutorRegistry;
  private executors: Map<NotificationChannel, ChannelExecutor> = new Map();

  private constructor() {}

  static getInstance(): ChannelExecutorRegistry {
    if (!ChannelExecutorRegistry.instance) {
      ChannelExecutorRegistry.instance = new ChannelExecutorRegistry();
    }
    return ChannelExecutorRegistry.instance;
  }

  register(executor: ChannelExecutor): void {
    this.executors.set(executor.channelType, executor);
  }

  getExecutor(channelType: NotificationChannel): ChannelExecutor | undefined {
    return this.executors.get(channelType);
  }

  hasExecutor(channelType: NotificationChannel): boolean {
    return this.executors.has(channelType);
  }

  getRegisteredChannels(): NotificationChannel[] {
    return Array.from(this.executors.keys());
  }

  /** Test-only: empties the singleton without replacing the instance. */
  clear(): void {
    this.executors.clear();
  }
}

// ============================================================
// Channel Executor Factory
// ============================================================

export class ChannelExecutorFactory {
  /** Registers every channel the platform can currently answer for. Idempotent. */
  static createAndRegisterDefaults(registry: ChannelExecutorRegistry): void {
    if (!registry.hasExecutor(NotificationChannel.IN_APP)) {
      registry.register(new StubInAppChannelExecutor());
    }
    for (const channel of UNCONFIGURED_CHANNELS) {
      if (!registry.hasExecutor(channel)) {
        registry.register(new StubChannelExecutor(channel));
      }
    }
  }
}

// ============================================================
// Recipient target resolution
// ============================================================

/**
 * Resolves the delivery target for a channel.
 *
 * IN_APP needs no contact lookup: the recipient_id is the inbox key.
 * Every other channel returns null because no authorized contact source or
 * provider exists. The previous implementation fabricated addresses such as
 * `<uuid>@nexcargo.stub` and `+2589<uuid prefix>`, which made an unimplemented
 * channel look deliverable. Returning null forces an explicit failure instead.
 */
export function resolveRecipientTarget(
  recipientId: string,
  channelType: NotificationChannel,
): string | null {
  switch (channelType) {
    case NotificationChannel.IN_APP:
      return recipientId;

    case NotificationChannel.EMAIL:
    case NotificationChannel.SMS:
    case NotificationChannel.PUSH:
    case NotificationChannel.WHATSAPP:
      return null;

    default:
      throw new Error(`Unknown channel type: ${channelType}`);
  }
}