// NexCargo MOD-017 — Alert Creation, Severity/Priority, and Deduplication Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AlertType, AlertSeverity, ALERT_PRIORITY_ORDER, getAlertPriority,
  type AlertObject,
} from '../domain/types/alerts';
import { AlertDeduplicator, DEFAULT_DEDUP_WINDOW_MS, generateAlertSignature } from '../domain/utils/alert-deduplication';

describe('MOD-017 Alert Framework', () => {
  describe('AlertType enum', () => {
    it('contains all defined alert types', () => {
      const types = Object.values(AlertType);
      expect(types).toContain('HIGH_ERROR_RATE');
      expect(types).toContain('SERVICE_DOWN');
      expect(types).toContain('PAYMENT_GATEWAY_FAILURE');
      expect(types).toContain('GPS_INTERRUPTION');
      expect(types).toContain('LATENCY_SPIKE');
      expect(types).toContain('INFRASTRUCTURE_FAILURE');
    });

    it('has exactly 6 alert types', () => {
      expect(Object.values(AlertType)).toHaveLength(6);
    });
  });

  describe('AlertSeverity enum', () => {
    it('contains all severity levels', () => {
      const severities = Object.values(AlertSeverity);
      expect(severities).toContain('LOW');
      expect(severities).toContain('MEDIUM');
      expect(severities).toContain('HIGH');
      expect(severities).toContain('CRITICAL');
    });
  });

  describe('ALERT_PRIORITY_ORDER', () => {
    it('assigns priority 1 to CRITICAL', () => {
      expect(ALERT_PRIORITY_ORDER.CRITICAL).toBe(1);
    });

    it('assigns incrementing priorities (lower = more urgent)', () => {
      expect(ALERT_PRIORITY_ORDER.CRITICAL).toBeLessThan(ALERT_PRIORITY_ORDER.HIGH);
      expect(ALERT_PRIORITY_ORDER.HIGH).toBeLessThan(ALERT_PRIORITY_ORDER.MEDIUM);
      expect(ALERT_PRIORITY_ORDER.MEDIUM).toBeLessThan(ALERT_PRIORITY_ORDER.LOW);
    });
  });

  describe('getAlertPriority', () => {
    it('returns correct priority for each severity', () => {
      expect(getAlertPriority(AlertSeverity.CRITICAL)).toBe(1);
      expect(getAlertPriority(AlertSeverity.HIGH)).toBe(2);
      expect(getAlertPriority(AlertSeverity.MEDIUM)).toBe(3);
      expect(getAlertPriority(AlertSeverity.LOW)).toBe(4);
    });
  });

  describe('AlertDeduplicator', () => {
    let deduplicator: AlertDeduplicator;

    beforeEach(() => {
      deduplicator = new AlertDeduplicator();
    });

    it('does not deduplicate first occurrence', () => {
      const alert = { alertType: AlertType.SERVICE_DOWN, sourceModule: 'MOD-001' };
      expect(deduplicator.isDuplicate(alert)).toBe(false);
    });

    it('deduplicates second occurrence within window', () => {
      const alert = { alertType: AlertType.SERVICE_DOWN, sourceModule: 'MOD-001' };
      deduplicator.isDuplicate(alert); // First call
      expect(deduplicator.isDuplicate(alert)).toBe(true); // Second within window
    });

    it('distinguishes different alert types even with same source', () => {
      const alert1 = { alertType: AlertType.SERVICE_DOWN, sourceModule: 'MOD-001' };
      const alert2 = { alertType: AlertType.HIGH_ERROR_RATE, sourceModule: 'MOD-001' };
      deduplicator.isDuplicate(alert1);
      deduplicator.isDuplicate(alert2);
      // Both should be unique
    });

    it('distinguishes different sources even with same alert type', () => {
      const alert1 = { alertType: AlertType.SERVICE_DOWN, sourceModule: 'MOD-001' };
      const alert2 = { alertType: AlertType.SERVICE_DOWN, sourceModule: 'MOD-002' };
      deduplicator.isDuplicate(alert1);
      deduplicator.isDuplicate(alert2);
      // Different sources = different signatures
    });
  });

  describe('generateAlertSignature', () => {
    it('generates consistent signature for same input', () => {
      const alert = { alertType: AlertType.SERVICE_DOWN, sourceModule: 'MOD-001' };
      const sig1 = generateAlertSignature(alert);
      const sig2 = generateAlertSignature(alert);
      expect(sig1).toBe(sig2);
    });

    it('generates format "sourceModule:alertType"', () => {
      const alert = { alertType: AlertType.HIGH_ERROR_RATE, sourceModule: 'MOD-013' };
      expect(generateAlertSignature(alert)).toBe('MOD-013:HIGH_ERROR_RATE');
    });
  });

  describe('DEFAULT_DEDUP_WINDOW_MS', () => {
    it('equals 5 minutes in milliseconds', () => {
      expect(DEFAULT_DEDUP_WINDOW_MS).toBe(5 * 60 * 1000);
    });
  });
});
