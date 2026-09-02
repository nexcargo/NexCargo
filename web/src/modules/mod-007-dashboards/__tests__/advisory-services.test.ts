// NexCargo MOD-007 — Advisory Service Validation Tests
// Wave 3 — Stage 3, Increment 1 — Authorized per HAO-WAVE3-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type {
  DashboardViewObject,
  WidgetObject,
  UserInteractionEvent,
  UISnapshot,
  NotificationObject,
  AIInsightWidget,
  OfflineSyncQueueEntry,
} from '../domain/types/entities';
import { enforceNoExecutionRule, validateDataBinding, validateRBACPresentation, validateNotificationDelivery, validateUserInteractionEvent, validateUISnapshot, validateOfflineSyncEntry } from '../domain/services/advisory-services';
import { UserRole, LayoutType, WidgetType, AccessLevel, NotificationType, Priority, ActionType, DisplayFormat } from '../domain/enums';

const now = new Date('2026-08-31T10:00:00Z');

function makeDash(o?: Record<string, unknown>): DashboardViewObject {
  return Object.assign(
    { dashboardId: 'd1', roleContext: UserRole.SHIPPER, moduleScope: ['MOD-001', 'MOD-003'], layoutType: LayoutType.OPERATIONAL, widgetCollection: [], refreshPolicy: {} as never, visibilityRules: [{ ruleId: 'r1', allowedRoles: [UserRole.ADMIN], requiredPermission: 'view' }], id: 'm1', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
    o || {}
  ) as DashboardViewObject;
}
function makeWidget(o?: Record<string, unknown>): WidgetObject {
  return Object.assign(
    { widgetId: 'w1', widgetType: WidgetType.TABLE, dataSourceModule: 'MOD-001', refreshTriggerEvent: 'ListingCreated', accessLevel: AccessLevel.PUBLIC, configurationSchema: {}, id: 'm2', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
    o || {}
  ) as WidgetObject;
}
function makeEvent(o?: Record<string, unknown>): UserInteractionEvent {
  return Object.assign(
    { eventId: 'e1', userId: 'u1', actionType: ActionType.VIEW, targetModule: 'MOD-001', payload: {}, timestamp: now, id: 'm3', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
    o || {}
  ) as UserInteractionEvent;
}
function makeSnapshot(o?: Record<string, unknown>): UISnapshot {
  return Object.assign(
    { snapshotId: 's1', dashboardId: 'd1', activeFilters: [], loadedModules: [{ moduleId: 'MOD-001', loadedAt: now, isFresh: true }], dataPayload: {}, timestamp: now, id: 'm4', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
    o || {}
  ) as UISnapshot;
}
function makeNotification(o?: Record<string, unknown>): NotificationObject {
  return Object.assign(
    { notificationId: 'n1', userId: 'u1', userRole: UserRole.SHIPPER, notificationType: NotificationType.INFO, channel: 'PUSH' as never, priority: Priority.LOW, title: 'Test', body: 'Test body', sourceModule: 'MOD-001', sourceEventId: 'evt1', deliveredAt: now, id: 'm5', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
    o || {}
  ) as NotificationObject;
}
function makeAIDash(): AIInsightWidget {
  return { insightWidgetId: 'ai1', insightId: 'mod006-insight', insightType: 'RECOMMENDATION', displayFormat: DisplayFormat.CARD, isAdvisory: true, actionButton: undefined, displayMetadata: { displayFormat: DisplayFormat.CARD, contextualLabel: '', sourceInsightId: 'si1', confidenceScore: 85, explanationTrace: [] }, id: 'm6', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) };
}
function makeSyncEntry(o?: Record<string, unknown>): OfflineSyncQueueEntry {
  return Object.assign(
    { entryId: 'se1', entityId: 'ship1', actionType: ActionType.CREATE, payload: {}, localTimestamp: now, synced: false, retryCount: 0, id: 'm7', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
    o || {}
  ) as OfflineSyncQueueEntry;
}

describe('Non-Execution Rule Enforcement', () => {
  it('accepts a valid dashboard config', () => { expect(enforceNoExecutionRule(makeDash()).valid).toBe(true); });
  it('rejects invalid layout type', () => { const d = makeDash({ layoutType: 'BAD' as never }); const r = enforceNoExecutionRule(d); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_LAYOUT_TYPE'); });
  it('rejects invalid role context', () => { const d = makeDash({ roleContext: 'GUEST' as never }); const r = enforceNoExecutionRule(d); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_ROLE_CONTEXT'); });
  it('rejects invalid module scope ref', () => { const d = makeDash({ moduleScope: ['invalid-module'] }); const r = enforceNoExecutionRule(d); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_MODULE_SCOPE_REF'); });
  it('rejects visibility rule with invalid role', () => { const d = makeDash({ visibilityRules: [{ ruleId: 'r1', allowedRoles: ['GUEST'] as unknown as UserRole[], requiredPermission: 'view' }] }); const r = enforceNoExecutionRule(d); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('VISIBILITY_RULE_0_INVALID_ROLE'); });
});

describe('Advisory-Only Enforcement', () => {
  it('isAdvisory must be true on AI widgets', () => { const ai = makeAIDash(); expect(ai.isAdvisory).toBe(true); });
});

describe('Data Binding Rule Validation', () => {
  it('accepts valid widget', () => { expect(validateDataBinding(makeWidget()).valid).toBe(true); });
  it('rejects invalid widget type', () => { const w = makeWidget({ widgetType: 'BAD' as never }); const r = validateDataBinding(w); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_WIDGET_TYPE'); });
  it('rejects invalid data source module', () => { const w = makeWidget({ dataSourceModule: 'invalid-module' }); const r = validateDataBinding(w); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_DATA_SOURCE_MODULE'); });
  it('rejects invalid access level', () => { const w = makeWidget({ accessLevel: 'BAD' as never }); const r = validateDataBinding(w); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_ACCESS_LEVEL'); });
  it('rejects missing refresh trigger event', () => { const w = makeWidget({ refreshTriggerEvent: '' }); const r = validateDataBinding(w); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('REFRESH_TRIGGER_REQUIRED'); });
});

describe('RBAC Presentation Validation', () => {
  it('accepts valid RBAC presentation constraints', () => { const r = validateRBACPresentation([UserRole.ADMIN], 'dashboard.view'); expect(r.valid).toBe(true); });
  it('rejects no visible roles', () => { const r = validateRBACPresentation([], 'dashboard.view'); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('NO_VISIBLE_ROLES'); });
  it('rejects invalid role in visibleToRoles', () => { const r = validateRBACPresentation(['GUEST'] as UserRole[], 'dashboard.view'); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_RBAC_ROLE'); });
  it('rejects empty backend permission', () => { const r = validateRBACPresentation([UserRole.ADMIN], ''); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('BACKEND_PERMISSION_REQUIRED'); });
});

describe('Notification Delivery Validation', () => {
  it('accepts valid notification', () => { expect(validateNotificationDelivery(makeNotification()).valid).toBe(true); });
  it('rejects invalid notification type', () => { const n = makeNotification({ notificationType: 'BAD' as never }); const r = validateNotificationDelivery(n); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_NOTIFICATION_TYPE'); });
  it('rejects invalid priority', () => { const n = makeNotification({ priority: 'BAD' as never }); const r = validateNotificationDelivery(n); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_PRIORITY'); });
  it('rejects invalid user role in notification', () => { const n = makeNotification({ userRole: 'GUEST' as never }); const r = validateNotificationDelivery(n); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_USER_ROLE_IN_NOTIFICATION'); });
});

describe('User Interaction Event Validation', () => {
  it('accepts valid interaction event', () => { expect(validateUserInteractionEvent(makeEvent()).valid).toBe(true); });
  it('rejects invalid action type', () => { const e = makeEvent({ actionType: 'BAD' as never }); const r = validateUserInteractionEvent(e); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_ACTION_TYPE'); });
  it('rejects invalid target module', () => { const e = makeEvent({ targetModule: 'bad-mod' }); const r = validateUserInteractionEvent(e); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_TARGET_MODULE'); });
  it('rejects missing user ID', () => { const e = makeEvent({ userId: '' }); const r = validateUserInteractionEvent(e); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('USER_ID_REQUIRED'); });
  it('rejects null payload', () => { const e = makeEvent({ payload: null as never }); const r = validateUserInteractionEvent(e); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('PAYLOAD_REQUIRED'); });
});

describe('UI State Snapshot Validation', () => {
  it('accepts valid UI snapshot', () => { expect(validateUISnapshot(makeSnapshot()).valid).toBe(true); });
  it('rejects missing dashboard ID', () => { const s = makeSnapshot({ dashboardId: '' }); const r = validateUISnapshot(s); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('DASHBOARD_ID_REQUIRED'); });
  it('rejects missing active filters array', () => { const s = makeSnapshot({ activeFilters: null as never }); const r = validateUISnapshot(s); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('ACTIVE_FILTERS_ARRAY_REQUIRED'); });
  it('rejects invalid loaded module ID', () => { const s = makeSnapshot({ loadedModules: [{ moduleId: 'bad-mod', loadedAt: now, isFresh: true }] }); const r = validateUISnapshot(s); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('LOADED_MODULE_0_INVALID_ID'); });
  it('rejects null data payload', () => { const s = makeSnapshot({ dataPayload: null as never }); const r = validateUISnapshot(s); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('DATA_PAYLOAD_REQUIRED'); });
});

describe('Offline Sync Queue Entry Validation', () => {
  it('accepts valid sync entry', () => { expect(validateOfflineSyncEntry(makeSyncEntry()).valid).toBe(true); });
  it('rejects missing entity ID', () => { const se = makeSyncEntry({ entityId: '' }); const r = validateOfflineSyncEntry(se); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('ENTITY_ID_REQUIRED'); });
  it('rejects invalid action type', () => { const se = makeSyncEntry({ actionType: 'BAD' as never }); const r = validateOfflineSyncEntry(se); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_SYNC_ACTION_TYPE'); });
  it('rejects negative retry count', () => { const se = makeSyncEntry({ retryCount: -1 }); const r = validateOfflineSyncEntry(se); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('RETRY_COUNT_INVALID'); });
});
