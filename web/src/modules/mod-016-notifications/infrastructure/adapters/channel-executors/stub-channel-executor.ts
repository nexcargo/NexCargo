// NexCargo MOD-016 — Unconfigured Channel Executor (EMAIL / SMS / PUSH / WHATSAPP)
// Originally C5-II (HAO-C5-002). Behavior corrected under I-3 §4C/§9.
//
// I-3 §9: "A provider or external infrastructure limitation must be reported
// honestly; it must not be disguised as a completed integration." The previous
// implementation returned SUCCESS with a fabricated STUB- provider reference and
// made no network call, which caused the pipeline to mark notifications SENT that
// were never delivered. This executor now reports a terminal, non-retryable
// PROVIDER_NOT_CONFIGURED failure so the notification reaches FAILED and the
// dead-letter queue instead of silently pretending to deliver.
//
// The failure reason shares the PROVIDER_NOT_CONFIGURED prefix with
// communication_schema.drain_notification_queue (migration 059), which appends a
// DLQ-retention sentence. Both paths agree on the prefix, and that prefix is what
// the ESS-001C §5.2 circuit breaker excludes from its provider-outage window.

import type { ChannelExecutor, ClaimedNotification, ChannelExecutionResult } from '../../../domain/types/delivery-pipeline';
import { ChannelExecutionStatus } from '../../../domain/types/delivery-pipeline';
import { NotificationChannel } from '@/shared/types/enums';

/** Channels that have no authorized provider integration (ESS-001A §5). */
export const UNCONFIGURED_CHANNELS: readonly NotificationChannel[] = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
];

/** Terminal failure reason shared with the SQL drain path. */
export function providerNotConfiguredReason(channelType: NotificationChannel | string): string {
  return `PROVIDER_NOT_CONFIGURED: no authorized ${channelType} provider integration exists (ESS-001A §5)`;
}

/**
 * Reports an honest terminal failure for channels with no provider integration.
 * Replace this registration with a real adapter once a provider is authorized;
 * do not restore a simulated SUCCESS.
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
    _notification: ClaimedNotification,
    _recipientTarget: string,
  ): Promise<ChannelExecutionResult> {
    return {
      status: ChannelExecutionStatus.FAILED,
      errorMessage: providerNotConfiguredReason(this.channelType),
      // Not retryable: retrying cannot conjure a provider that does not exist.
      isRetryable: false,
      timestamp: new Date(),
    };
  }

  async verifyDelivery(_providerReferenceId: string): Promise<ChannelExecutionResult> {
    return {
      status: ChannelExecutionStatus.FAILED,
      errorMessage: providerNotConfiguredReason(this.channelType),
      isRetryable: false,
      timestamp: new Date(),
    };
  }
}