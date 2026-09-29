// NexCargo MOD-016 — Enum and Type Structure Tests (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Verifies: enum integrity, type exports, provider adapter interface structure

import { describe, it, expect } from 'vitest';
import {
  PriorityLevel,
  DeliveryStatus,
  DeliveryEventStatus,
  TemplateStatus,
  NotificationChannel,
} from '../domain/enums';
import * as mod16Exports from '..';

describe('MOD-016 Module Structure', () => {
  describe('Enum values integrity', () => {
    it('PriorityLevel should have exactly 4 values', () => {
      const values = Object.values(PriorityLevel);
      expect(values).toHaveLength(4);
      expect(values).toContain('LOW');
      expect(values).toContain('MEDIUM');
      expect(values).toContain('HIGH');
      expect(values).toContain('CRITICAL');
    });

    it('DeliveryStatus should have exactly 4 values', () => {
      const values = Object.values(DeliveryStatus);
      expect(values).toHaveLength(4);
      expect(values).toContain('QUEUED');
      expect(values).toContain('SENT');
      expect(values).toContain('DELIVERED');
      expect(values).toContain('FAILED');
    });

    it('DeliveryEventStatus should have exactly 4 values', () => {
      const values = Object.values(DeliveryEventStatus);
      expect(values).toHaveLength(4);
      expect(values).toContain('ATTEMPTED');
      expect(values).toContain('SUCCEEDED');
      expect(values).toContain('FAILED');
      expect(values).toContain('RETRY_SCHEDULED');
    });

    it('TemplateStatus should have exactly 2 values', () => {
      const values = Object.values(TemplateStatus);
      expect(values).toHaveLength(2);
      expect(values).toContain('ACTIVE');
      expect(values).toContain('DEPRECATED');
    });

    it('NotificationChannel should match shared enum', () => {
      const values = Object.values(NotificationChannel);
      expect(values).toContain('IN_APP');
      expect(values).toContain('EMAIL');
      expect(values).toContain('SMS');
      expect(values).toContain('PUSH');
      expect(values).toContain('WHATSAPP');
    });
  });

  describe('Barrel exports completeness', () => {
    it('should export all domain enums', () => {
      expect(mod16Exports.NotificationChannel).toBeDefined();
      expect(mod16Exports.PriorityLevel).toBeDefined();
      expect(mod16Exports.DeliveryStatus).toBeDefined();
    });

    it('should export validation functions', () => {
      expect(typeof mod16Exports.validateNotificationCreation).toBe('function');
      expect(typeof mod16Exports.applyNotificationDefaults).toBe('function');
      expect(typeof mod16Exports.validateTemplateStructure).toBe('function');
    });

    it('should export template rendering functions', () => {
      expect(typeof mod16Exports.renderTemplate).toBe('function');
      expect(typeof mod16Exports.selectLocalizedContent).toBe('function');
      expect(typeof mod16Exports.injectVariables).toBe('function');
    });

    it('should export provider adapter classes', () => {
      // StubEmailProviderAdapter is exported as a class
      expect(typeof mod16Exports.StubEmailProviderAdapter).toBe('function');
    });
  });
});
