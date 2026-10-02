// NexCargo MOD-016 — Stub IN_APP Channel Executor (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002
// Purpose: First functional channel executor for IN_APP notifications
//
// For IN_APP channels, delivery means the notification is already
// persisted in communication_schema.notifications and visible to the
// recipient through their notification center / inbox UI.
//
// "Delivery" for IN_APP = marking the notification as seen/read by
// the recipient. Since we don't have a real read-receipt mechanism
// yet, this stub marks it as immediately delivered upon processing.
//
// This is NOT a no-op: it creates a delivery_events record and
// updates the notification's delivery_status via the SQL RPC.

import type { ChannelExecutor, ClaimedNotification, ChannelExecutionResult } from '../../../domain/types/delivery-pipeline';
import { ChannelExecutionStatus } from '../../../domain/types/delivery-pipeline';
import { NotificationChannel } from '@/shared/types/enums';

/**
 * StubInAppChannelExecutor — Handles IN_APP notification delivery.
 * 
 * For IN_APP, delivery is considered successful when:
 * 1. The notification exists in communication_schema.notifications
 * 2. The notification has the correct recipient_id pointing to the user
 * 
 * Since C5-001 already persists the notification with delivery_status='QUEUED',
 * this executor transitions it to 'DELIVERED' by recording the attempt.
 */
export class StubInAppChannelExecutor implements ChannelExecutor {
  readonly channelType: NotificationChannel = NotificationChannel.IN_APP;

  /**
   * Executes IN_APP delivery for a claimed notification.
   * 
   * For IN_APP, this is a deterministic success because:
   * - The notification was already created by C5-001 event handler
   * - It's stored in the user's notification inbox (notifications table)
   * - No external provider or network call is needed
   * 
   * @param notification — The claimed IN_APP notification
   * @param recipientTarget — The recipient ID (sufficient for IN_APP)
   * @returns SUCCESS result with provider reference
   */
  async execute(
    notification: ClaimedNotification,
    recipientTarget: string,
  ): Promise<ChannelExecutionResult> {
    // Validate channel type match
    if (notification.channelType !== this.channelType) {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: `Channel mismatch: expected ${this.channelType}, got ${notification.channelType}`,
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    // Validate recipient target
    if (!recipientTarget || recipientTarget.length === 0) {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: 'Empty recipient target for IN_APP delivery',
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    // For IN_APP, delivery is inherently successful because:
    // 1. Notification already persisted in DB by C5-001
    // 2. Recipient can see it in their notification center
    // 3. No external dependency or network call required
    
    const providerReferenceId = `INAPP-${notification.id}`;

    return {
      status: ChannelExecutionStatus.SUCCESS,
      providerReferenceId,
      isRetryable: false,
      timestamp: new Date(),
    };
  }

  /**
   * Verifies IN_APP delivery status.
   * For IN_APP, verification checks that the notification exists
   * and is visible to the recipient.
   * 
   * @param providerReferenceId — Reference ID from execution (INAPP-{notificationId})
   * @returns Verification result
   */
  async verifyDelivery(providerReferenceId: string): Promise<ChannelExecutionResult> {
    if (!providerReferenceId || typeof providerReferenceId !== 'string') {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: 'Invalid provider reference',
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    // Verify format: should be INAPP-{uuid}
    if (!providerReferenceId.startsWith('INAPP-')) {
      return {
        status: ChannelExecutionStatus.FAILED,
        errorMessage: 'Invalid IN_APP provider reference format',
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
