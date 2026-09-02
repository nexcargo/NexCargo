// NexCargo MOD-008 — Enum & Type Definition Tests
// Wave 3 — Increment 4 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD008-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type {
  MobileSessionContextObject,
  EdgeEventObject,
  MobileTaskObject,
  SyncQueueObject,
  NotificationQueueObject,
  OptimizedTransmissionSpecObject,
  MobileAggregatedEndpointObject,
} from '../domain/types/entities';
import {
  DeviceType,
  ConnectivityState,
  EventType,
  TaskType,
  TaskState,
  Priority,
  SyncStatus,
  SyncAttemptStatus,
  ConflictResolutionStatus,
  NotificationDeliveryStatus,
  CompressionType,
  PayloadFormat,
  DashboardType,
  MobileRoleType,
} from '../domain/enums';

const now = new Date('2026-08-31T10:00:00Z');

// ============================================================
// Enum value tests
// ============================================================

describe('MOD-008 DeviceType enum', () => {
  it('contains all device types', () => {
    expect(DeviceType.ANDROID).toBe('ANDROID');
    expect(DeviceType.IOS).toBe('IOS');
  });
});

describe('MOD-008 ConnectivityState enum', () => {
  it('contains all connectivity states', () => {
    expect(ConnectivityState.ONLINE).toBe('ONLINE');
    expect(ConnectivityState.DEGRADED).toBe('DEGRADED');
    expect(ConnectivityState.OFFLINE).toBe('OFFLINE');
  });
});

describe('MOD-008 EventType enum', () => {
  it('contains all event types', () => {
    expect(EventType.PICKUP).toBe('PICKUP');
    expect(EventType.DELIVERY).toBe('DELIVERY');
    expect(EventType.CHECKPOINT).toBe('CHECKPOINT');
    expect(EventType.EXCEPTION).toBe('EXCEPTION');
  });
});

describe('MOD-008 TaskType enum', () => {
  it('contains all task types', () => {
    expect(TaskType.TRIP).toBe('TRIP');
    expect(TaskType.PICKUP).toBe('PICKUP');
    expect(TaskType.DELIVERY).toBe('DELIVERY');
    expect(TaskType.INSPECTION).toBe('INSPECTION');
  });
});

describe('MOD-008 TaskState enum', () => {
  it('contains all task states', () => {
    expect(TaskState.ASSIGNED).toBe('ASSIGNED');
    expect(TaskState.ACKNOWLEDGED).toBe('ACKNOWLEDGED');
    expect(TaskState.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(TaskState.COMPLETED).toBe('COMPLETED');
  });
});

describe('MOD-008 Priority enum', () => {
  it('contains all priority levels', () => {
    expect(Priority.LOW).toBe('LOW');
    expect(Priority.MEDIUM).toBe('MEDIUM');
    expect(Priority.HIGH).toBe('HIGH');
    expect(Priority.CRITICAL).toBe('CRITICAL');
  });
});

describe('MOD-008 SyncStatus enum', () => {
  it('contains all sync statuses', () => {
    expect(SyncStatus.PENDING).toBe('PENDING');
    expect(SyncStatus.SYNCED).toBe('SYNCED');
    expect(SyncStatus.CONFLICT).toBe('CONFLICT');
  });
});

describe('MOD-008 SyncAttemptStatus enum', () => {
  it('contains all attempt statuses', () => {
    expect(SyncAttemptStatus.PENDING).toBe('PENDING');
    expect(SyncAttemptStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(SyncAttemptStatus.SERVER_VALIDATED).toBe('SERVER_VALIDATED');
    expect(SyncAttemptStatus.CONFIRMED).toBe('CONFIRMED');
    expect(SyncAttemptStatus.FAILED).toBe('FAILED');
  });
});

describe('MOD-008 ConflictResolutionStatus enum', () => {
  it('contains all conflict resolution statuses', () => {
    expect(ConflictResolutionStatus.PENDING).toBe('PENDING');
    expect(ConflictResolutionStatus.RESOLVED_SERVER).toBe('RESOLVED_SERVER');
    expect(ConflictResolutionStatus.RESOLVED_MANUAL).toBe('RESOLVED_MANUAL');
  });
});

describe('MOD-008 NotificationDeliveryStatus enum', () => {
  it('contains all delivery statuses', () => {
    expect(NotificationDeliveryStatus.QUEUED).toBe('QUEUED');
    expect(NotificationDeliveryStatus.DELIVERED).toBe('DELIVERED');
    expect(NotificationDeliveryStatus.FAILED).toBe('FAILED');
  });
});

describe('MOD-008 CompressionType enum', () => {
  it('contains all compression types', () => {
    expect(CompressionType.GZIP).toBe('GZIP');
    expect(CompressionType.NONE).toBe('NONE');
  });
});

describe('MOD-008 PayloadFormat enum', () => {
  it('contains all payload formats', () => {
    expect(PayloadFormat.PROTOBUF).toBe('PROTOBUF');
    expect(PayloadFormat.JSON_COMPRESSED).toBe('JSON_COMPRESSED');
  });
});

describe('MOD-008 DashboardType enum', () => {
  it('contains all dashboard types', () => {
    expect(DashboardType.DRIVER).toBe('DRIVER');
    expect(DashboardType.SHIPPER).toBe('SHIPPER');
    expect(DashboardType.TRANSPORTER).toBe('TRANSPORTER');
  });
});

describe('MOD-008 MobileRoleType enum', () => {
  it('contains all mobile role types', () => {
    expect(MobileRoleType.DRIVER).toBe('DRIVER');
    expect(MobileRoleType.TRANSPORTER).toBe('TRANSPORTER');
    expect(MobileRoleType.DISPATCHER).toBe('DISPATCHER');
  });
});

// ============================================================
// BC Contract Interface Tests
// ============================================================

describe('MOD-008 BC Contract Interface Integrity', () => {
  it('can import bc-contract module without circular dependency errors', async () => {
    const mod = await import('../domain/types/bc-contract');
    expect(mod).toBeDefined();
  });
});
