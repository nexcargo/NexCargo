// NexCargo MOD-008 — Advisory Services Tests
// Wave 3 — Increment 4 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD008-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type { MobileSessionContextObject, EdgeEventObject, MobileTaskObject, SyncQueueObject, NotificationQueueObject, OptimizedTransmissionSpecObject, MobileAggregatedEndpointObject } from '../domain/types/entities';
import { DeviceType, ConnectivityState, EventType, TaskType, TaskState, Priority, SyncStatus, SyncAttemptStatus, ConflictResolutionStatus, NotificationDeliveryStatus, DashboardType, MobileRoleType } from '../domain/enums';
import { enforceEdgeAutonomyRule, enforceEventIntegrity, enforceSyncAuthority, enforceMinimalDataPrinciple, enforceSecurityRule, enforceNeutralityRule, validateNetworkEfficiency, validateBatteryOptimization, validateOfflineSyncPriority, validateTaskStateTransition } from '../domain/services/advisory-services';

const now = new Date('2026-08-31T10:00:00Z');

function stubEntity() {
  return { id: 'stub', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) };
}

function buildValidSession(): MobileSessionContextObject {
  return { ...stubEntity(), sessionId: 'sess-001', userId: 'user-001', roleType: MobileRoleType.DRIVER, deviceType: DeviceType.ANDROID, connectivityState: ConnectivityState.ONLINE, activeModuleContext: 'MOD-003', lastSyncTimestamp: now, deviceFingerprint: 'fp-android-001', expiryTimestamp: new Date('2026-09-30T23:59:59Z') };
}

function buildValidEdgeEvent(): EdgeEventObject {
  return { ...stubEntity(), eventId: 'evt-001', eventType: EventType.PICKUP, trackingId: 'shipment-001', sequenceNumber: 1, timestamp: now, geoReference: { latitude: -15.0, longitude: 35.0, accuracyMeters: 10, timestamp: now }, payload: { data: { driverNotes: 'Package secured' }, metadata: { appVersion: '1.0.0' } }, syncStatus: SyncStatus.PENDING, deviceTimestamp: now };
}

function buildValidSyncQueue(): SyncQueueObject {
  return { ...stubEntity(), queueId: 'queue-001', deviceId: 'device-001', pendingEvents: ['evt-001'], syncAttempts: 0, syncStatus: SyncAttemptStatus.PENDING, lastSyncAttemptTimestamp: now, conflictResolutionStatus: ConflictResolutionStatus.PENDING, maxRetries: 3 };
}

function buildValidMobileTask(): MobileTaskObject {
  return { ...stubEntity(), taskId: 'task-001', assignedTo: 'driver-001', taskType: TaskType.PICKUP, relatedShipmentId: 'shipment-001', priorityLevel: Priority.HIGH, taskState: TaskState.ASSIGNED, dueTimestamp: new Date('2026-09-01T12:00:00Z'), cachedInstructions: 'Collect package at warehouse A' };
}

function buildValidNotification(): NotificationQueueObject {
  return { ...stubEntity(), notificationQueueId: 'nq-001', deviceId: 'device-001', notificationId: 'notif-001', deliveryStatus: NotificationDeliveryStatus.QUEUED, queuedAt: now, retryCount: 0, effectivePriority: Priority.CRITICAL };
}

function buildValidTransmissionSpec(): OptimizedTransmissionSpecObject {
  return { ...stubEntity(), specId: 'spec-001', protocolPreference: 'MQTT', maxPayloadBytes: 5120, batchEnabled: true, batchIntervalMs: 30000, retryPolicyRef: 'ESS-001C-STANDARD' };
}

function buildValidDashboardEndpoint(): MobileAggregatedEndpointObject {
  return { ...stubEntity(), endpointId: 'ep-001', dashboardType: DashboardType.DRIVER, includedDataFields: ['shipmentId', 'currentStatus', 'eta'], batchLoadSupport: true, responseFormat: 'COMPACT', maxStaleTimeMs: 60000 };
}

// ============================================================
// Edge Autonomy Rule tests (§7.1)
// ============================================================

describe('enforceEdgeAutonomyRule — MOD-008 §7.1', () => {
  it('validates a proper session', () => {
    const result = enforceEdgeAutonomyRule(buildValidSession());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid device type', () => {
    const s = buildValidSession();
    (s as any).deviceType = 'UNKNOWN_DEVICE';
    const result = enforceEdgeAutonomyRule(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_DEVICE_TYPE')).toBe(true);
  });

  it('rejects missing session expiry in offline mode', () => {
    const s = buildValidSession();
    s.connectivityState = ConnectivityState.OFFLINE;
    (s as any).expiryTimestamp = undefined;
    const result = enforceEdgeAutonomyRule(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SESSION_EXPIRY_REQUIRED_OFFLINE')).toBe(true);
  });
});

// ============================================================
// Event Integrity Rule tests (§7.2)
// ============================================================

describe('enforceEventIntegrity — MOD-008 §7.2', () => {
  it('validates a proper edge event', () => {
    const result = enforceEventIntegrity(buildValidEdgeEvent());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects event without tracking reference', () => {
    const e = buildValidEdgeEvent();
    e.trackingId = '';
    const result = enforceEventIntegrity(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'TRACKING_REFERENCE_REQUIRED')).toBe(true);
  });

  it('rejects event with invalid GPS coordinates', () => {
    const e = buildValidEdgeEvent();
    e.geoReference = { latitude: 999, longitude: 0, timestamp: now };
    const result = enforceEventIntegrity(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'GEO_LATITUDE_INVALID')).toBe(true);
  });

  it('rejects event without device timestamp', () => {
    const e = buildValidEdgeEvent();
    (e as any).deviceTimestamp = undefined;
    const result = enforceEventIntegrity(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'DEVICE_TIMESTAMP_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Sync Authority Rule tests (§7.3)
// ============================================================

describe('enforceSyncAuthority — MOD-008 §7.3', () => {
  it('validates a proper sync queue', () => {
    const result = enforceSyncAuthority(buildValidSyncQueue());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects queue exceeding max retries', () => {
    const q = buildValidSyncQueue();
    q.syncAttempts = 5;
    q.maxRetries = 3;
    const result = enforceSyncAuthority(q);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'RETRY_EXCEEDS_MAX')).toBe(true);
  });

  it('rejects queue without max retries defined', () => {
    const q = buildValidSyncQueue();
    delete (q as any).maxRetries;
    const result = enforceSyncAuthority(q);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'MAX_RETRIES_REQUIRED')).toBe(true);
  });

  it('rejects empty pending events array', () => {
    const q = buildValidSyncQueue();
    q.pendingEvents = [];
    const result = enforceSyncAuthority(q);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'PENDING_EVENTS_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Minimal Data Principle tests (§7.4)
// ============================================================

describe('enforceMinimalDataPrinciple — MOD-008 §7.4', () => {
  it('validates a proper dashboard endpoint', () => {
    const result = enforceMinimalDataPrinciple(buildValidDashboardEndpoint());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects wildcard field inclusion', () => {
    const ep = buildValidDashboardEndpoint();
    ep.includedDataFields = ['*'];
    const result = enforceMinimalDataPrinciple(ep);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code.includes('WILDCARD'))).toBe(true);
  });

  it('rejects empty required fields list', () => {
    const ep = buildValidDashboardEndpoint();
    ep.includedDataFields = [];
    const result = enforceMinimalDataPrinciple(ep);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'REQUIRED_DATA_FIELDS_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Security Rule tests (§7.6)
// ============================================================

describe('enforceSecurityRule — MOD-008 §7.6', () => {
  it('validates a secure session', () => {
    const result = enforceSecurityRule(buildValidSession());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects session without device fingerprint', () => {
    const s = buildValidSession();
    (s as any).deviceFingerprint = undefined;
    const result = enforceSecurityRule(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'DEVICE_FINGERPRINT_REQUIRED')).toBe(true);
  });

  it('rejects session expiring before last sync', () => {
    const s = buildValidSession();
    s.expiryTimestamp = new Date('2026-08-01T00:00:00Z');
    const result = enforceSecurityRule(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'EXPIRY_BEFORE_LAST_SYNC')).toBe(true);
  });
});

// ============================================================
// Neutrality Rule tests (§7.7)
// ============================================================

describe('enforceNeutralityRule — MOD-008 §7.7', () => {
  it('validates a neutral mobile task', () => {
    const result = enforceNeutralityRule(buildValidMobileTask());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects task without shipment reference', () => {
    const t = buildValidMobileTask();
    t.relatedShipmentId = '';
    const result = enforceNeutralityRule(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'SHIPMENT_REFERENCE_REQUIRED')).toBe(true);
  });

  it('rejects task without instructions for offline use', () => {
    const t = buildValidMobileTask();
    t.cachedInstructions = '';
    const result = enforceNeutralityRule(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'CACHED_INSTRUCTIONS_REQUIRED_OFFLINE')).toBe(true);
  });
});

// ============================================================
// Network Efficiency Rule tests (§7.8)
// ============================================================

describe('validateNetworkEfficiency — MOD-008 §7.8', () => {
  it('validates a proper transmission spec', () => {
    const result = validateNetworkEfficiency(buildValidTransmissionSpec());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-positive max payload bytes', () => {
    const spec = buildValidTransmissionSpec();
    spec.maxPayloadBytes = 0;
    const result = validateNetworkEfficiency(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'MAX_PAYLOAD_BYTES_MUST_BE_POSITIVE')).toBe(true);
  });
});

// ============================================================
// Battery Optimization Rule tests (§7.9)
// ============================================================

describe('validateBatteryOptimization — MOD-008 §7.9', () => {
  it('validates a battery-conscious notification', () => {
    const result = validateBatteryOptimization(buildValidNotification());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects negative retry count', () => {
    const n = buildValidNotification();
    n.retryCount = -1;
    const result = validateBatteryOptimization(n);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'RETRY_COUNT_NON_NEGATIVE')).toBe(true);
  });
});

// ============================================================
// Offline Sync Priority Rule tests (§7.10)
// ============================================================

describe('validateOfflineSyncPriority — MOD-008 §7.10', () => {
  it('validates a low-priority checkpoint event', () => {
    const result = validateOfflineSyncPriority(buildValidEdgeEvent());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags critical delivery event without tracking reference', () => {
    const e = buildValidEdgeEvent();
    e.eventType = EventType.DELIVERY;
    e.trackingId = '';
    const result = validateOfflineSyncPriority(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'CRITICAL_EVENT_MISSING_TRACKING_REF')).toBe(true);
  });
});

// ============================================================
// Task State Transition tests (§5.1 Field Execution Flow)
// ============================================================

describe('validateTaskStateTransition — MOD-008 §5.1', () => {
  it('validates an ASSIGNED task', () => {
    const result = validateTaskStateTransition(buildValidMobileTask());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates a COMPLETED task with acknowledgement', () => {
    const t = buildValidMobileTask();
    t.taskState = TaskState.COMPLETED;
    t.acknowledgedAt = now;
    const result = validateTaskStateTransition(t);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags completed task without acknowledgement timestamp', () => {
    const t = buildValidMobileTask();
    t.taskState = TaskState.COMPLETED;
    t.acknowledgedAt = undefined;
    const result = validateTaskStateTransition(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some(c => c.code === 'COMPLETION_REQUIRES_ACKNOWLEDGEMENT')).toBe(true);
  });
});
