// NexCargo MOD-016 — Stub Channel Executor (Fallback for non-IN_APP channels) (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002
// Purpose: Provides a deterministic stub implementation for channels not yet fully implemented

import type { ChannelExecutor, ClaimedNotification, ChannelExecutionResult } from '../../../domain/types/delivery-pipeline';
import { ChannelExecutionStatus } from '../../../domain/types/delivery-pipeline';
import { NotificationChannel } from '@/shared/types/enums';

/**
 * StubChannelExecutor — Fallback executor for channels without real implementations.
 * 
 * Used for EMAIL, SMS, PUSH, WHATSAPP during C5-II development.
 * Simulates successful delivery without external network calls.
 * 
 * In production, this would be replaced by real provider adapters.
 */
export class StubChannelExecutor implements ChannelExecutor {
  readonly channelType: NotificationChannel;

  constructor(channelType: NotificationChannel) {
    if (!Object.values(NotificationChannel).includes(channelType)) {
      throw new Error(`Invalid channel type for StubChannelExecutor: ${channelType}`);
    }
    this.channelType = channelType;
  }

  async execute(
    notification: ClaimedNotification,
    recipientTarget: string,
  ): Promise<ChannelExecutionResult> {
    // Validate input
    if (!recipientTarget || recipientTarget.length === 0) {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: `Empty recipient target for ${this.channelType}`,
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    // Deterministic success for stub delivery
    // In production, this would make an API call to the actual provider
    const providerReferenceId = `STUB-${this.channelType}-${notification.id}`;

    return {
      status: ChannelExecutionStatus.SUCCESS,
      providerReferenceId,
      isRetryable: false,
      timestamp: new Date(),
    };
  }

  async verifyDelivery(providerReferenceId: string): Promise<ChannelExecutionResult> {
    if (!providerReferenceId || typeof providerReferenceId !== 'string') {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: 'Invalid provider reference',
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    if (!providerReferenceId.startsWith(`STUB-${this.channelType}-`)) {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: `Invalid ${this.channelType} provider reference format`,
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    return {
      status: ChannelExecutionStatus.SUCCESS,
      providerReferenceId,
      isRetryable: false,
      timestamp: new Date(),
    };
  }
}
