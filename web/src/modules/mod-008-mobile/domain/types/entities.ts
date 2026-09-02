// NexCargo MOD-008 — Mobile Applications & Edge Operations Module Domain Types
// Wave 3 — Increment 4 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD008-AUTH-001 (D-S3-001)
// Reference: MOD-008 §4 Core Domain Entities (§§4.1–§4.7), §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO native device implementation, local DB engines, or network clients
// - All structures are design-time specification artifacts only
// - Server state is ALWAYS authoritative (§7.3 Sync Authority Rule)
// - No financial or contractual logic at edge (§7.7 Neutrality Rule)

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type {
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
} from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Abstracted geographic reference for edge events per MOD-008 §4.2 */
export interface GeoReference {
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** Horizontal accuracy in meters (device-reported) */
  accuracyMeters?: number;
  /** Timestamp of location fix */
  timestamp: Date;
}

/** Structured event payload for mobile edge events per MOD-008 §4.2 */
export interface EventPayload {
  /** Key-value structured data specific to event type */
  data: Record<string, unknown>;
  /** Event metadata (source device, app version, etc.) */
  metadata: Record<string, string>;
}

/** Lightweight compressed payload specification per MOD-008 §4.6 */
export interface LightweightPayloadSpecificationObject {
  /** Unique identifier for this payload format definition */
  payloadId: string;
  /** Compression method used (GZIP or NONE) */
  compressionType: CompressionType;
  /** Original transmission format (PROTOBUF or JSON_COMPRESSED) */
  payloadFormat: PayloadFormat;
  /** Size of original uncompressed payload in bytes */
  originalSizeBytes: number;
  /** Size after compression in bytes */
  compressedSizeBytes: number;
  /** Content hash for integrity verification during sync */
  contentHash: string;
  /** Whether batching is supported for this payload type */
  batchable: boolean;
}

/** Mobile dashboard endpoint specification per MOD-008 §4.7 */
export interface MobileDashboardEndpointObject {
  /** Unique endpoint identifier */
  endpointId: string;
  /** Target dashboard type */
  dashboardType: DashboardType;
  /** List of field names included in response */
  includedDataFields: string[];
  /** Whether batch loading is supported */
  batchLoadSupport: boolean;
  /** Response format variant (compact or minimal) */
  responseFormat: 'COMPACT' | 'MINIMAL';
}

/** Local encryption requirement constraint per MOD-008 §7.5, §7.6 */
export interface EncryptionRequirement {
  /** Requirement identifier */
  requirementId: string;
  /** Data category covered (session, events, notifications, payloads) */
  dataCategory: string;
  /** Encryption standard (AES-256, XChaCha20, etc.) — conceptual only */
  encryptionStandard: string;
  /** Key management approach (local keystore, secure enclave) — conceptual */
  keyManagement: string;
  /** Whether fields are encrypted at rest, in transit, or both */
  scope: string;
}

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Mobile Session Context Object — represents an active mobile user session.
 * Per MOD-008 §4.1
 * Session security enforced via token-based authentication (conceptual).
 * Session expiration enforced even in offline mode (§7.6).
 * Device fingerprint used for anomaly detection (§7.6).
 */
export interface MobileSessionContextObject extends BaseEntity {
  /** Unique session identifier */
  sessionId: string;
  /** User owning this session */
  userId: string;
  /** Role type of the mobile user (maps to shared UserRole) */
  roleType: MobileRoleType;
  /** Device platform classification */
  deviceType: DeviceType;
  /** Current connectivity state */
  connectivityState: ConnectivityState;
  /** Currently active module context (MOD-XXX reference) */
  activeModuleContext: string;
  /** Last successful synchronization timestamp */
  lastSyncTimestamp?: Date;
  /** Cryptographic device fingerprint for session integrity */
  deviceFingerprint: string;
  /** When session expires even if offline (§7.6 Security Rule) */
  expiryTimestamp: Date;
}

/**
 * Edge Event Object — represents a field-generated operational event.
 * Per MOD-008 §4.2
 * MUST be immutable once created locally (§7.2 Event Integrity Rule).
 * Modifications require compensating events (not edits).
 * Event order integrity MUST be preserved during sync (§7.2).
 */
export interface EdgeEventObject extends BaseEntity {
  /** Unique event identifier */
  eventId: string;
  /** Type of edge event */
  eventType: EventType;
  /** MOD-003 tracking/shipment reference */
  trackingId: string;
  /** High-water-mark sequence number for sync ordering */
  sequenceNumber: number;
  /** Timestamp of the actual event (source time) */
  timestamp: Date;
  /** Abstracted GPS coordinates (geo reference structure) */
  geoReference: GeoReference;
  /** Structured event-specific data payload */
  payload: EventPayload;
  /** Synchronization status against core system */
  syncStatus: SyncStatus;
  /** Local device clock timestamp when captured */
  deviceTimestamp: Date;
}

/**
 * Mobile Task Object — represents operational tasks assigned to mobile users.
 * Per MOD-008 §4.3
 * Tasks originate from MOD-002 / MOD-003 backend systems.
 * Driver acknowledges tasks on mobile device per §5.1 Field Execution Flow.
 */
export interface MobileTaskObject extends BaseEntity {
  /** Unique task identifier */
  taskId: string;
  /** User to whom the task is assigned */
  assignedTo: string;
  /** Type of operational task */
  taskType: TaskType;
  /** Associated shipment/tracking reference */
  relatedShipmentId: string;
  /** Urgency priority level */
  priorityLevel: Priority;
  /** Current task lifecycle state */
  taskState: TaskState;
  /** Deadline timestamp */
  dueTimestamp: Date;
  /** Locally cached instructions for offline access */
  cachedInstructions: string;
  /** When the task was acknowledged by the driver */
  acknowledgedAt?: Date;
  /** Time taken to complete (calculated on completion) */
  completionDurationMs?: number;
}

/**
 * Sync Queue Object — represents offline-to-online synchronization structure.
 * Per MOD-008 §4.4
 * Events MUST be queued locally during connectivity loss.
 * No data loss allowed during connectivity interruption (§7.5).
 * Sync MUST preserve event order integrity (§7.2).
 * Conflicts resolved via server authority rules (§7.3).
 */
export interface SyncQueueObject extends BaseEntity {
  /** Unique queue identifier */
  queueId: string;
  /** Source device identifier */
  deviceId: string;
  /** Ordered array of pending event references (sequence-sorted) */
  pendingEvents: string[];
  /** Number of sync attempts made */
  syncAttempts: number;
  /** Overall synchronization status */
  syncStatus: SyncAttemptStatus;
  /** Timestamp of last sync attempt */
  lastSyncAttemptTimestamp: Date;
  /** Conflict resolution outcome (server authority applied manually) */
  conflictResolutionStatus: ConflictResolutionStatus;
  /** Maximum retry count before escalation */
  maxRetries: number;
}

/**
 * Notification Queue Object — represents notifications queued for mobile delivery.
 * Per MOD-008 §4.5
 * Notifications queued during offline periods.
 * Critical alerts override user preferences (§7.10 Offline Sync Priority Rule).
 * Delivery guarantees are best-effort, not absolute.
 */
export interface NotificationQueueObject extends BaseEntity {
  /** Unique notification queue entry identifier */
  notificationQueueId: string;
  /** Target device identifier */
  deviceId: string;
  /** Reference to MOD-007 original notification */
  notificationId: string;
  /** Current delivery status */
  deliveryStatus: NotificationDeliveryStatus;
  /** When the notification was queued */
  queuedAt: Date;
  /** When successfully delivered (optional) */
  deliveredAt?: Date;
  /** Number of delivery retry attempts */
  retryCount: number;
  /** Highest priority among all messages in this queue group */
  effectivePriority: Priority;
}

/**
 * Lightweight Payload Specification Object — represents optimized data transmission formats.
 * Per MOD-008 §4.6
 * Compressed payloads preferred for GPS/telemetry.
 * MQTT/gRPC protocols conceptual preference over heavy REST calls.
 * Redundant transmissions minimized. Updates batched when possible (§7.8).
 */
export interface OptimizedTransmissionSpecObject extends BaseEntity {
  /** Unique specification identifier */
  specId: string;
  /** Protocol preference for this transmission type (MQTT, gRPC, REST_MINIMAL) */
  protocolPreference: string;
  /** Maximum payload size limit in bytes for mobile optimization (§7.8) */
  maxPayloadBytes: number;
  /** Whether batching is enabled for this message type */
  batchEnabled: boolean;
  /** Batch interval in milliseconds (§7.9 Battery Optimization Rule) */
  batchIntervalMs: number;
  /** Retry policy reference (per ESS-001C) */
  retryPolicyRef: string;
}

/**
 * MobileDashboardEndpointObject — represents an aggregated endpoint optimized for mobile dashboard loading.
 * Per MOD-008 §4.7
 * APIs MUST return only required fields for mobile clients (§7.8 Network Efficiency Rule).
 * Aggregated endpoints provided for mobile dashboards (§7.8).
 * Payload size minimized through field filtering and conceptual compression (§7.8).
 */
export interface MobileAggregatedEndpointObject extends BaseEntity {
  /** Unique endpoint identifier */
  endpointId: string;
  /** Target dashboard type */
  dashboardType: DashboardType;
  /** Array of data field names returned by this endpoint */
  includedDataFields: string[];
  /** Whether batch loading is supported */
  batchLoadSupport: boolean;
  /** Response format: COMPACT (all available) or MINIMAL (essential only) */
  responseFormat: 'COMPACT' | 'MINIMAL';
  /** Maximum stale time before forced refresh (ms) — battery optimization (§7.9) */
  maxStaleTimeMs: number;
}
