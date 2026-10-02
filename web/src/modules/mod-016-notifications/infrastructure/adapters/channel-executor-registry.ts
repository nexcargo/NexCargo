// NexCargo MOD-016 — Channel Executor Abstraction (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002
// Purpose: Defines the ChannelExecutor interface and provides a registry for channel resolution

import { NotificationChannel } from '@/shared/types/enums';
import type { ChannelExecutor, ClaimedNotification, ChannelExecutionResult } from '../../domain/types/delivery-pipeline';

// ============================================================
// Channel Executor Registry
// ============================================================

/**
 * Registry that maps channel types to their executor implementations.
 * 
 * The delivery processor uses this registry to select the appropriate
 * ChannelExecutor based on notification.channel_type.
 * 
 * C5-II: Only IN_APP is registered by default. Additional channels
 * (EMAIL, SMS, PUSH, WHATSAPP) are registered as they are implemented.
 */
export class ChannelExecutorRegistry {
  private static instance: ChannelExecutorRegistry;
  private executors: Map<NotificationChannel, ChannelExecutor> = new Map();

  private constructor() {}

  /** Get singleton instance */
  static getInstance(): ChannelExecutorRegistry {
    if (!ChannelExecutorRegistry.instance) {
      ChannelExecutorRegistry.instance = new ChannelExecutorRegistry();
    }
    return ChannelExecutorRegistry.instance;
  }

  /** Register a channel executor for a specific channel type */
  register(executor: ChannelExecutor): void {
    this.executors.set(executor.channelType, executor);
  }

  /** Get the executor for a given channel type */
  getExecutor(channelType: NotificationChannel): ChannelExecutor | undefined {
    return this.executors.get(channelType);
  }

  /** Check if an executor is registered for a channel type */
  hasExecutor(channelType: NotificationChannel): boolean {
    return this.executors.has(channelType);
  }

  /** Get all registered channel types */
  getRegisteredChannels(): NotificationChannel[] {
    return Array.from(this.executors.keys());
  }
}

// ============================================================
// Channel Executor Factory
// ============================================================

/**
 * Factory for creating channel executors.
 * Used during application initialization to set up the registry.
 */
export class ChannelExecutorFactory {
  /**
   * Creates and registers all default channel executors.
   * Call this once during application initialization.
   */
  static createAndRegisterDefaults(registry: ChannelExecutorRegistry): void {
    // Import lazily to avoid circular dependencies
    const { StubInAppChannelExecutor } = require('./channel-executors/stub-in-app-channel-executor');
    
    const inAppExecutor = new StubInAppChannelExecutor();
    registry.register(inAppExecutor);
  }
}

// ============================================================
// Utility: Resolve recipient target for a channel
// ============================================================

/**
 * Resolves the actual delivery target string for a given channel type.
 * 
 * In production, this would look up the recipient's contact information
 * from the user profile or a separate contacts table.
 * 
 * C5-II: Returns a deterministic stub value since real recipient
 * contact data lookup is deferred to future increments.
 * 
 * @param recipientId — The auth.users UUID of the recipient
 * @param channelType — The channel to resolve target for
 * @returns Delivery target string (email, phone, device token, etc.)
 */
export function resolveRecipientTarget(
  recipientId: string,
  channelType: NotificationChannel,
): string {
  switch (channelType) {
    case NotificationChannel.IN_APP:
      // For IN_APP, the recipientId itself is sufficient
      // (notification is visible in the user's inbox)
      return recipientId;

    case NotificationChannel.EMAIL:
      // Stub: In production, fetch from user.email or contacts table
      return `${recipientId}@nexcargo.stub`;

    case NotificationChannel.SMS:
      // Stub: In production, fetch from user.phone or contacts table
      return `+2589${recipientId.slice(0, 8)}`;

    case NotificationChannel.PUSH:
      // Stub: In production, fetch from user.device_tokens
      return `device-token-${recipientId.slice(0, 16)}`;

    case NotificationChannel.WHATSAPP:
      // Stub: In production, fetch from user.whatsapp_number
      return `+2588${recipientId.slice(0, 8)}`;

    default:
      throw new Error(`Unknown channel type: ${channelType}`);
  }
}
