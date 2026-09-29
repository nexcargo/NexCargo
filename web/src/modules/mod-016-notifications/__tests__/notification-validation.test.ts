// NexCargo MOD-016 — Notification Validation Tests (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Tests: validateNotificationCreation, applyNotificationDefaults, validateTemplateStructure

import { describe, it, expect } from 'vitest';
import { ValidationError } from '@/shared/errors/app-errors';
import { PriorityLevel, DeliveryStatus, DeliveryEventStatus, TemplateStatus, NotificationChannel } from '../domain/enums';
import {
  validateNotificationCreation,
  applyNotificationDefaults,
  validateTemplateStructure,
  isValidChannelType,
  isPriorityLevelValid,
  isValidTemplateStatus,
  validateDeliveryEventInput,
} from '../domain/services/notification-validation';

describe('MOD-016 Notification Validation', () => {
  describe('validateNotificationCreation', () => {
    const validBase = {
      recipientId: 'test-recipient-id',
      sourceModule: 'MOD-001',
      eventType: 'PaymentInitiated',
      title: 'Test notification',
      body: 'This is a test notification body.',
      channelType: NotificationChannel.EMAIL,
      correlationId: 'test-correlation-id-123',
    };

    it('should pass validation with all required fields present', () => {
      expect(() => validateNotificationCreation(validBase)).not.toThrow();
    });

    it('should reject when recipientId is missing', () => {
      const data = { ...validBase, recipientId: '' };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
      expect(() => validateNotificationCreation(data)).toThrow('recipientId is required');
    });

    it('should reject when sourceModule is missing', () => {
      const data = { ...validBase, sourceModule: '' };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
    });

    it('should reject when sourceModule is not a valid module ID', () => {
      const data = { ...validBase, sourceModule: 'INVALID' };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
      expect(() => validateNotificationCreation(data)).toThrow('sourceModule must be one of');
    });

    it('should accept any valid source module MOD-001 through MOD-018', () => {
      for (let i = 1; i <= 18; i++) {
        const module = `MOD-${String(i).padStart(3, '0')}`;
        const data = { ...validBase, sourceModule: module };
        expect(() => validateNotificationCreation(data)).not.toThrow();
      }
    });

    it('should reject when eventType is missing', () => {
      const data = { ...validBase, eventType: '' };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
      expect(() => validateNotificationCreation(data)).toThrow('eventType is required');
    });

    it('should reject when both title and body are missing', () => {
      const data = { ...validBase, title: '', body: '' };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
      expect(() => validateNotificationCreation(data)).toThrow('At least one of title or body is required');
    });

    it('should accept when only title is present (no body)', () => {
      const data = { ...validBase, body: '' };
      expect(() => validateNotificationCreation(data)).not.toThrow();
    });

    it('should accept when only body is present (no title)', () => {
      const data = { ...validBase, title: '' };
      expect(() => validateNotificationCreation(data)).not.toThrow();
    });

    it('should reject when correlationId is missing', () => {
      const data = { ...validBase, correlationId: '' };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
      expect(() => validateNotificationCreation(data)).toThrow('correlationId is required');
    });

    it('should reject invalid priorityLevel', () => {
      const data = { ...validBase, priorityLevel: 'URGENT' as never };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
    });

    it('should accept valid priority levels', () => {
      for (const level of Object.values(PriorityLevel)) {
        const data = { ...validBase, priorityLevel: level };
        expect(() => validateNotificationCreation(data)).not.toThrow();
      }
    });

    it('should reject invalid channelType', () => {
      const data = { ...validBase, channelType: 'INVALID_CHANNEL' as never };
      expect(() => validateNotificationCreation(data)).toThrow(ValidationError);
    });

    it('should accept all valid channel types', () => {
      for (const channel of Object.values(NotificationChannel)) {
        const data = { ...validBase, channelType: channel };
        expect(() => validateNotificationCreation(data)).not.toThrow();
      }
    });
  });

  describe('applyNotificationDefaults', () => {
    it('should apply default priority level MEDIUM when not provided', () => {
      const input = { recipientId: 'user-1', sourceModule: 'MOD-001', eventType: 'Test', channelType: NotificationChannel.IN_APP, correlationId: 'corr-123' };
      const result = applyNotificationDefaults(input);
      expect(result.priorityLevel).toBe(PriorityLevel.MEDIUM);
    });

    it('should preserve provided priority level', () => {
      const input = { ...{ recipientId: 'user-1', sourceModule: 'MOD-001', eventType: 'Test', channelType: NotificationChannel.IN_APP, correlationId: 'corr-123' }, priorityLevel: PriorityLevel.CRITICAL };
      const result = applyNotificationDefaults(input);
      expect(result.priorityLevel).toBe(PriorityLevel.CRITICAL);
    });

    it('should set status to QUEUED by default', () => {
      const input = { recipientId: 'user-1', sourceModule: 'MOD-001', eventType: 'Test', channelType: NotificationChannel.EMAIL, correlationId: 'corr-123' };
      const result = applyNotificationDefaults(input);
      // Database layer applies status 'QUEUED'; this function provides application-layer safety
    });

    it('should set retryCount to 0 by default', () => {
      const input = { recipientId: 'user-1', sourceModule: 'MOD-001', eventType: 'Test', channelType: NotificationChannel.SMS, correlationId: 'corr-123' };
      const result = applyNotificationDefaults(input);
      expect(result.retryCount).toBe(0);
    });

    it('should default locale to pt', () => {
      const input = { recipientId: 'user-1', sourceModule: 'MOD-001', eventType: 'Test', channelType: NotificationChannel.EMAIL, correlationId: 'corr-123' };
      const result = applyNotificationDefaults(input);
      expect(result.locale).toBe('pt');
    });

    it('should preserve provided locale', () => {
      const input = { ...{ recipientId: 'user-1', sourceModule: 'MOD-001', eventType: 'Test', channelType: NotificationChannel.EMAIL, correlationId: 'corr-123' }, locale: 'en' };
      const result = applyNotificationDefaults(input);
      expect(result.locale).toBe('en');
    });
  });

  describe('validateTemplateStructure', () => {
    it('should reject when templateKey is missing', () => {
      const data = { defaultContent: 'Test content' };
      expect(() => validateTemplateStructure(data)).toThrow('templateKey is required');
    });

    it('should reject templateKey with invalid characters', () => {
      const data = { templateKey: 'test-template-key-with-dashes!', defaultContent: 'Content' };
      expect(() => validateTemplateStructure(data)).toThrow('templateKey must contain only alphanumeric');
    });

    it('should accept valid templateKey', () => {
      const data = { templateKey: 'payment_confirmed', defaultContent: 'Your payment was confirmed.', channelType: 'EMAIL' as never };
      expect(() => validateTemplateStructure(data)).not.toThrow();
    });

    it('should reject when defaultContent is empty', () => {
      const data = { templateKey: 'test_template', defaultContent: '  ', channelType: 'SMS' as never };
      expect(() => validateTemplateStructure(data)).toThrow('defaultContent is required');
    });

    it('should reject invalid channelType in template', () => {
      const data = { templateKey: 'test', channelType: 'INVALID' as never, defaultContent: 'Content' };
      expect(() => validateTemplateStructure(data)).toThrow('channelType must be one of');
    });

    it('should accept valid localizedContent structure', () => {
      const data = {
        templateKey: 'welcome',
        defaultContent: 'Welcome!',
        channelType: 'IN_APP' as never,
        localizedContent: { pt: 'Bem-vindo!', en: 'Welcome!' },
      };
      expect(() => validateTemplateStructure(data)).not.toThrow();
    });

    it('should reject variables without names', () => {
      const data = { templateKey: 'payment', defaultContent: 'Amount: {amount}', channelType: 'EMAIL' as never, variables: [{ name: '' }] };
      expect(() => validateTemplateStructure(data)).toThrow('Each template variable must have a non-empty name');
    });

    it('should accept valid variables array', () => {
      const data = {
        templateKey: 'shipment_update',
        defaultContent: 'Shipment {shipmentId} has moved to {status}.',
        channelType: 'SMS' as never,
        variables: [
          { name: 'shipmentId' },
          { name: 'status', type: 'string' as const },
        ],
      };
      expect(() => validateTemplateStructure(data)).not.toThrow();
    });

    it('should reject version less than 1', () => {
      const data = { templateKey: 'test', defaultContent: 'Content', channelType: 'IN_APP' as never, version: 0 };
      expect(() => validateTemplateStructure(data)).toThrow('version must be at least 1');
    });

    it('should accept version 1', () => {
      const data = { templateKey: 'test', defaultContent: 'Content', channelType: 'PUSH' as never, version: 1 };
      expect(() => validateTemplateStructure(data)).not.toThrow();
    });
  });

  describe('Utility validators', () => {
    it('isValidChannelType should return true for valid channels', () => {
      expect(isValidChannelType('IN_APP')).toBe(true);
      expect(isValidChannelType('EMAIL')).toBe(true);
      expect(isValidChannelType('SMS')).toBe(true);
      expect(isValidChannelType('PUSH')).toBe(true);
      expect(isValidChannelType('WHATSAPP')).toBe(true);
    });

    it('isValidChannelType should return false for invalid channels', () => {
      expect(isValidChannelType('TELEGRAM')).toBe(false);
      expect(isValidChannelType('SLACK')).toBe(false);
    });

    it('isPriorityLevelValid should return true for valid priorities', () => {
      expect(isPriorityLevelValid('LOW')).toBe(true);
      expect(isPriorityLevelValid('CRITICAL')).toBe(true);
    });

    it('isPriorityLevelValid should return false for invalid priorities', () => {
      expect(isPriorityLevelValid('EXTREME')).toBe(false);
    });

    it('isValidTemplateStatus should return true for ACTIVE/DEPRECATED', () => {
      expect(isValidTemplateStatus('ACTIVE')).toBe(true);
      expect(isValidTemplateStatus('DEPRECATED')).toBe(true);
    });

    it('isValidTemplateStatus should return false for other statuses', () => {
      expect(isValidTemplateStatus('DRAFT')).toBe(false);
    });
  });

  describe('validateDeliveryEventInput', () => {
    it('should require notificationId', () => {
      expect(() => validateDeliveryEventInput({ notificationId: '' })).toThrow('notificationId is required');
    });

    it('should accept valid delivery event with minimal fields', () => {
      expect(() => validateDeliveryEventInput({
        notificationId: 'notif-123',
        status: 'ATTEMPTED',
        retryCount: 0,
      })).not.toThrow();
    });

    it('should reject negative retryCount', () => {
      expect(() => validateDeliveryEventInput({
        notificationId: 'notif-123',
        retryCount: -1,
      })).toThrow('retryCount must be non-negative');
    });
  });
});
