// NexCargo MOD-007 — Enum & Type Definition Tests
// Wave 3 — Stage 3, Increment 1 — Authorized per HAO-WAVE3-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type {
  DashboardViewObject,
  WidgetObject,
  UserInteractionEvent,
  UISnapshot,
  NotificationObject,
  AIInsightWidget,
  LocalizationPreference,
  OfflineSyncQueueEntry,
} from '../domain/types/entities';
import {
  UserRole,
  LayoutType,
  WidgetType,
  AccessLevel,
  NotificationType,
  Channel,
  Priority,
  ActionType,
  DisplayFormat,
  PreferredLanguage,
} from '../domain/enums';

const now = new Date('2026-08-31T10:00:00Z');

// ============================================================
// Enum value tests
// ============================================================

describe('MOD-007 UserRole enum', () => {
  it('contains all required roles', () => {
    expect(UserRole.SHIPPER).toBe('SHIPPER');
    expect(UserRole.TRANSPORTER).toBe('TRANSPORTER');
    expect(UserRole.DRIVER).toBe('DRIVER');
    expect(UserRole.MODERATOR).toBe('MODERATOR');
    expect(UserRole.ADMIN).toBe('ADMIN');
  });
});

describe('MOD-007 LayoutType enum', () => {
  it('contains all layout types', () => {
    expect(LayoutType.OPERATIONAL).toBe('OPERATIONAL');
    expect(LayoutType.ANALYTICAL).toBe('ANALYTICAL');
    expect(LayoutType.HYBRID).toBe('HYBRID');
  });
});

describe('MOD-007 WidgetType enum', () => {
  it('contains all widget types', () => {
    expect(WidgetType.TABLE).toBe('TABLE');
    expect(WidgetType.CHART).toBe('CHART');
    expect(WidgetType.TIMELINE).toBe('TIMELINE');
    expect(WidgetType.KPI).toBe('KPI');
    expect(WidgetType.AI_INSIGHT).toBe('AI_INSIGHT');
    expect(WidgetType.MAP).toBe('MAP');
    expect(WidgetType.FORM).toBe('FORM');
    expect(WidgetType.LIST).toBe('LIST');
  });
});

describe('MOD-007 AccessLevel enum', () => {
  it('contains all access levels', () => {
    expect(AccessLevel.PUBLIC).toBe('PUBLIC');
    expect(AccessLevel.RESTRICTED).toBe('RESTRICTED');
    expect(AccessLevel.ADMIN_ONLY).toBe('ADMIN_ONLY');
  });
});

describe('MOD-007 Notification enums', () => {
  it('contains notification types', () => {
    expect(NotificationType.INFO).toBe('INFO');
    expect(NotificationType.ALERT).toBe('ALERT');
    expect(NotificationType.WARNING).toBe('WARNING');
    expect(NotificationType.CRITICAL).toBe('CRITICAL');
  });

  it('contains channels', () => {
    expect(Channel.PUSH).toBe('PUSH');
    expect(Channel.EMAIL).toBe('EMAIL');
    expect(Channel.SMS).toBe('SMS');
    expect(Channel.IN_APP).toBe('IN_APP');
  });

  it('contains priorities', () => {
    expect(Priority.LOW).toBe('LOW');
    expect(Priority.MEDIUM).toBe('MEDIUM');
    expect(Priority.HIGH).toBe('HIGH');
    expect(Priority.CRITICAL).toBe('CRITICAL');
  });
});

describe('MOD-007 ActionType enum', () => {
  it('contains all action types', () => {
    expect(ActionType.VIEW).toBe('VIEW');
    expect(ActionType.CREATE).toBe('CREATE');
    expect(ActionType.UPDATE).toBe('UPDATE');
    expect(ActionType.SUBMIT).toBe('SUBMIT');
    expect(ActionType.APPROVE).toBe('APPROVE');
    expect(ActionType.REJECT).toBe('REJECT');
  });
});

describe('MOD-007 DisplayFormat enum', () => {
  it('contains all display formats', () => {
    expect(DisplayFormat.CARD).toBe('CARD');
    expect(DisplayFormat.LIST).toBe('LIST');
    expect(DisplayFormat.CHART).toBe('CHART');
    expect(DisplayFormat.BANNER).toBe('BANNER');
  });
});

describe('MOD-007 PreferredLanguage enum', () => {
  it('contains language codes', () => {
    expect(PreferredLanguage.PORTUGUESE).toBe('pt');
    expect(PreferredLanguage.ENGLISH).toBe('en');
  });
});

// ============================================================
// BC Contract Interface Tests
// ============================================================

describe('MOD-007 BC Contract Interface Integrity', () => {
  it('can import bc-contract module without circular dependency errors', async () => {
    const mod = await import('../domain/types/bc-contract');
    // Interfaces are compile-time only; loading succeeds means no structural issues
    expect(mod).toBeDefined();
  });
});
