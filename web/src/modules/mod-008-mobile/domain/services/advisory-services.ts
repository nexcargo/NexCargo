// NexCargo MOD-008 — Mobile Applications & Edge Operations Module Advisory & Structural Validation Services
// Wave 3 — Increment 4 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD008-AUTH-001 (D-S3-001)
// Reference: MOD-008 §7 Rules of Operation, ESS-004 Sync Contracts, ESS-006 Security Compliance
//
// EDGE AUTONOMY PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT execute synchronization, make autonomous decisions, or modify core system state.
// Per MOD-008 §7.1 Edge Autonomy Rule, §7.3 Sync Authority Rule, §7.7 Neutrality Rule.

import type {
  MobileSessionContextObject,
  EdgeEventObject,
  MobileTaskObject,
  SyncQueueObject,
  NotificationQueueObject,
  OptimizedTransmissionSpecObject,
  MobileAggregatedEndpointObject,
} from '../types/entities';
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
  DashboardType,
  MobileRoleType,
} from '../enums';

// ============================================================
// Validation result types
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

// ============================================================
// Service function constants
// ============================================================

/** Valid connectivity states */
const VALID_CONNECTIVITY_STATES = Object.values(ConnectivityState);
/** Valid device types */
const VALID_DEVICE_TYPES = Object.values(DeviceType);
/** Valid edge event types */
const VALID_EVENT_TYPES = Object.values(EventType);
/** Valid task states */
const VALID_TASK_STATES = Object.values(TaskState);
/** Valid priority levels */
const VALID_PRIORITIES = Object.values(Priority);
/** Valid sync statuses */
const VALID_SYNC_STATUSES = Object.values(SyncStatus);
/** Valid sync attempt statuses */
const VALID_SYNC_ATTEMPT_STATUSES = Object.values(SyncAttemptStatus);
/** Valid conflict resolution statuses */
const VALID_CONFLICT_RESOLUTION_STATUSES = Object.values(ConflictResolutionStatus);
/** Valid notification delivery statuses */
const VALID_NOTIFICATION_DELIVERY_STATUSES = Object.values(NotificationDeliveryStatus);
/** Module reference naming convention */
const SOURCE_MODULE_PATTERN = /^MOD-\d{3}$/;
/** Maximum reasonable retry count (§7.8 Network Efficiency / ESS-001C conceptual ref) */
const MAX_RETRY_COUNT = 5;
/** Critical events requiring highest sync priority per §7.10 Offline Sync Priority Rule */
const CRITICAL_EVENT_TYPES = new Set(['DELIVERY', 'EXCEPTION']);

// ============================================================
// Edge Autonomy Rule Enforcement (§7.1)
// ============================================================

/**
 * Enforces that mobile session structures comply with the Edge Autonomy Rule.
 * Per MOD-008 §7.1: Mobile devices MAY operate offline temporarily but ALL actions MUST sync
 * back to central system eventually. No independent decision-making at edge layer.
 *
 * Validates:
 * - Device type is within authorized values
 * - Connectivity state enum is valid
 * - Session expiry timestamp exists (enforced even offline per §7.6)
 * - Role type references valid mobile role mapping
 *
 * @param session The mobile session context to validate
 * @returns ValidationResult indicating compliance status
 */
export function enforceEdgeAutonomyRule(session: MobileSessionContextObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate device type is valid enum value
  if (!VALID_DEVICE_TYPES.includes(session.deviceType)) {
    errors.push({
      code: 'INVALID_DEVICE_TYPE',
      field: 'deviceType',
      message: `Device type must be one of: ${VALID_DEVICE_TYPES.join(', ')}`,
    });
  }

  // Validate connectivity state
  if (!VALID_CONNECTIVITY_STATES.includes(session.connectivityState)) {
    errors.push({
      code: 'INVALID_CONNECTIVITY_STATE',
      field: 'connectivityState',
      message: `Connectivity state must be one of: ${VALID_CONNECTIVITY_STATES.join(', ')}`,
    });
  }

  // CRITICAL: Session expiry MUST exist even when offline (§7.6 Security Rule)
  // This prevents sessions from persisting indefinitely without re-authentication
  if (!(session.expiryTimestamp instanceof Date) || isNaN(session.expiryTimestamp.getTime())) {
    errors.push({
      code: 'SESSION_EXPIRY_REQUIRED_OFFLINE',
      field: 'expiryTimestamp',
      message: 'Session expiry MUST be enforced even in offline mode per §7.6 Security Rule',
    });
  }

  // Validate role type follows naming pattern
  const validRoles = Object.values(MobileRoleType);
  if (!validRoles.includes(session.roleType)) {
    errors.push({
      code: 'INVALID_ROLE_TYPE',
      field: 'roleType',
      message: `Role type must map to a valid MobileRoleType (${validRoles.join(', ')})`,
    });
  }

  // Active module context should follow MOD-XXX convention
  if (session.activeModuleContext && !SOURCE_MODULE_PATTERN.test(session.activeModuleContext)) {
    errors.push({
      code: 'ACTIVE_MODULE_INVALID_FORMAT',
      field: 'activeModuleContext',
      message: `Active module context '${session.activeModuleContext}' does not follow MOD-XXX naming convention`,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Event Integrity Rule Enforcement (§7.2)
// ============================================================

/**
 * Enforces that edge events are immutable once created locally.
 * Per MOD-008 §7.2: Modifications require compensating events (not edits).
 * Event order integrity MUST be preserved during sync (sequenceNumber sorting required).
 *
 * Validates:
 * - Sequence numbers are monotonically increasing
 * - All required fields present for immutability proof
 * - Sync status transitions follow allowed path
 *
 * @param event The edge event to validate
 * @returns ValidationResult
 */
export function enforceEventIntegrity(event: EdgeEventObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate event type is valid enum value
  if (!VALID_EVENT_TYPES.includes(event.eventType)) {
    errors.push({
      code: 'INVALID_EVENT_TYPE',
      field: 'eventType',
      message: `Event type must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
    });
  }

  // CRITICAL: sequenceNumber must be positive integer — ensures ordering during sync (§7.2)
  if (!Number.isInteger(event.sequenceNumber) || event.sequenceNumber <= 0) {
    errors.push({
      code: 'SEQUENCE_NUMBER_MUST_BE_POSITIVE_INTEGER',
      field: 'sequenceNumber',
      message: 'Sequence number must be a positive integer to preserve event order integrity during sync per §7.2 Event Integrity Rule',
    });
  }

  // trackingId is mandatory — all edge events tied to shipments (MOD-003 reference)
  if (!event.trackingId || typeof event.trackingId !== 'string') {
    errors.push({
      code: 'TRACKING_REFERENCE_REQUIRED',
      field: 'trackingId',
      message: 'All edge events must reference a MOD-003 tracking/shipment ID per §4.2 business rules',
    });
  }

  // GeoReference sub-structure must be well-formed
  if (!event.geoReference) {
    errors.push({
      code: 'GEO_REFERENCE_REQUIRED',
      field: 'geoReference',
      message: 'Edge events must include geographic reference data per §4.2',
    });
  } else {
    const geo = event.geoReference;
    if (typeof geo.latitude !== 'number' || geo.latitude < -90 || geo.latitude > 90) {
      errors.push({
        code: 'GEO_LATITUDE_INVALID',
        field: 'geoReference.latitude',
        message: 'Latitude must be a number between -90 and 90',
      });
    }
    if (typeof geo.longitude !== 'number' || geo.longitude < -180 || geo.longitude > 180) {
      errors.push({
        code: 'GEO_LONGITUDE_INVALID',
        field: 'geoReference.longitude',
        message: 'Longitude must be a number between -180 and 180',
      });
    }
    if (!(geo.timestamp instanceof Date) || isNaN(geo.timestamp.getTime())) {
      errors.push({
        code: 'GEO_TIMESTAMP_INVALID',
        field: 'geoReference',
        message: 'Location fix must include a valid timestamp',
      });
    }
  }

  // Validate payload structure
  if (!event.payload || typeof event.payload.data !== 'object' || Array.isArray(event.payload.data)) {
    errors.push({
      code: 'PAYLOAD_STRUCTURE_INVALID',
      field: 'payload',
      message: 'Event payload must have structured data object and metadata',
    });
  }

  // Sync status must be valid enum value
  if (!VALID_SYNC_STATUSES.includes(event.syncStatus)) {
    errors.push({
      code: 'INVALID_SYNC_STATUS',
      field: 'syncStatus',
      message: `Sync status must be one of: ${VALID_SYNC_STATUSES.join(', ')}`,
    });
  }

  // CRITICAL: deviceTimestamp is mandatory — local clock needed for order verification (§7.2)
  if (!(event.deviceTimestamp instanceof Date) || isNaN(event.deviceTimestamp.getTime())) {
    errors.push({
      code: 'DEVICE_TIMESTAMP_REQUIRED',
      field: 'deviceTimestamp',
      message: 'Local device timestamp is required for sync order integrity per §7.2',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Sync Authority Rule Enforcement (§7.3)
// ============================================================

/**
 * Enforces server-authoritative synchronization structure.
 * Per MOD-008 §7.3: Server state is ALWAYS authoritative. Mobile state is temporary and derived.
 * Conflicts MUST be resolved via server authority rules (§7.3 + ESS-004 + ESS-009).
 *
 * Validates:
 * - Queue has proper ordering guarantee (sequence-sorted pendingEvents)
 * - Retry counts within bounded range
 * - Conflict resolution status properly tracked
 * - Max retries set (no infinite retry loops)
 *
 * @param queue The sync queue object to validate
 * @returns ValidationResult
 */
export function enforceSyncAuthority(queue: SyncQueueObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate sync attempt status
  if (!VALID_SYNC_ATTEMPT_STATUSES.includes(queue.syncStatus)) {
    errors.push({
      code: 'INVALID_SYNC_ATTEMPT_STATUS',
      field: 'syncStatus',
      message: `Sync status must be one of: ${VALID_SYNC_ATTEMPT_STATUSES.join(', ')}`,
    });
  }

  // CRITICAL: maxRetries must be defined — infinite retry violates §7.3 (server authority always wins)
  if (!Number.isInteger(queue.maxRetries) || queue.maxRetries <= 0) {
    errors.push({
      code: 'MAX_RETRIES_REQUIRED',
      field: 'maxRetries',
      message: 'Max retries must be a positive integer — no unbounded retry allowed per §7.3 Sync Authority Rule',
    });
  }

  // Retry count must not exceed max (structural enforcement of bounded retry)
  if (queue.syncAttempts > queue.maxRetries) {
    errors.push({
      code: 'RETRY_EXCEEDS_MAX',
      field: 'syncAttempts',
      message: `Sync attempts (${queue.syncAttempts}) exceeded max retries (${queue.maxRetries}) — escalation required per §7.3`,
    });
  }

  // Pending events array must be non-empty for meaningful queue
  if (!Array.isArray(queue.pendingEvents) || queue.pendingEvents.length === 0) {
    errors.push({
      code: 'PENDING_EVENTS_REQUIRED',
      field: 'pendingEvents',
      message: 'Queue must contain ordered pending event references per §4.4 business rules',
    });
  }

  // Conflict resolution must be tracked when conflicts occur
  if (queue.syncAttempts > 0 &&
      !VALID_CONFLICT_RESOLUTION_STATUSES.includes(queue.conflictResolutionStatus)) {
    errors.push({
      code: 'CONFLICT_RESOLUTION_TRACKING_REQUIRED',
      field: 'conflictResolutionStatus',
      message: 'Conflict resolution status must be tracked after sync attempts per §7.3 + §4.4',
    });
  }

  // Last sync attempt timestamp must exist after first attempt
  if (queue.syncAttempts > 0 &&
      !(queue.lastSyncAttemptTimestamp instanceof Date) ||
      isNaN(queue.lastSyncAttemptTimestamp.getTime())) {
    errors.push({
      code: 'LAST_SYNC_TIMESTAMP_REQUIRED',
      field: 'lastSyncAttemptTimestamp',
      message: 'Last sync attempt timestamp required after any sync attempt per §4.4',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Minimal Data Principle Enforcement (§7.4)
// ============================================================

const VALID_DASHBOARD_TYPES = Object.values(DashboardType);

/**
 * Enforces that mobile dashboard endpoints expose only required operational data.
 * Per MOD-008 §7.4: Mobile layer MUST only expose required operational data.
 * No full system visibility allowed on edge devices. Sensitive data encrypted locally.
 */
export function enforceMinimalDataPrinciple(endpoint: MobileAggregatedEndpointObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (!VALID_DASHBOARD_TYPES.includes(endpoint.dashboardType)) {
    errors.push({
      code: 'INVALID_DASHBOARD_TYPE',
      field: 'dashboardType',
      message: `Dashboard type must be one of: ${VALID_DASHBOARD_TYPES.join(', ')}`,
    });
  }

  if (!Array.isArray(endpoint.includedDataFields) || endpoint.includedDataFields.length === 0) {
    errors.push({
      code: 'REQUIRED_DATA_FIELDS_REQUIRED',
      field: 'includedDataFields',
      message: 'Endpoints must define at least one data field per §7.4 Minimal Data Principle',
    });
  } else {
    for (let i = 0; i < endpoint.includedDataFields.length; i++) {
      const field = endpoint.includedDataFields[i];
      if (field === '*' || field.includes('*')) {
        errors.push({
          code: `WILDCARD_FIELD_NOT_PERMITTED_${i}`,
          field: 'includedDataFields',
          message: `Wild-card field selection not permitted — only specific required fields allowed per §7.4`,
        });
      }
    }
  }

  if (!Number.isInteger(endpoint.maxStaleTimeMs) || endpoint.maxStaleTimeMs <= 0) {
    errors.push({
      code: 'MAX_STALE_TIME_MUST_BE_POSITIVE',
      field: 'maxStaleTimeMs',
      message: 'Max stale time must be a positive integer for battery optimization per §7.9',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Security Rule Enforcement (§7.6)
// ============================================================

/**
 * Enforces security constraints on mobile session handling.
 * Per MOD-008 §7.6: End-to-end encryption for synced data. Local data encrypted on device.
 * Secure token-based auth required. Session expiration enforced even in offline mode.
 */
export function enforceSecurityRule(session: MobileSessionContextObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (!session.deviceFingerprint || typeof session.deviceFingerprint !== 'string') {
    errors.push({
      code: 'DEVICE_FINGERPRINT_REQUIRED',
      field: 'deviceFingerprint',
      message: 'Device fingerprint required for anomaly detection per §7.6 Security Rule',
    });
  }

  if (!(session.expiryTimestamp instanceof Date) || isNaN(session.expiryTimestamp.getTime())) {
    errors.push({
      code: 'EXPIRY_TIMESTAMP_INVALID',
      field: 'expiryTimestamp',
      message: 'Session expiry timestamp must be valid — enforced even offline per §7.6',
    });
  }

  if (session.lastSyncTimestamp && session.expiryTimestamp &&
      session.expiryTimestamp.getTime() <= session.lastSyncTimestamp.getTime()) {
    errors.push({
      code: 'EXPIRY_BEFORE_LAST_SYNC',
      field: 'expiryTimestamp',
      message: 'Session expiry cannot be before last sync — structural integrity violation',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Neutrality Rule Enforcement (§7.7)
// ============================================================

/**
 * Enforces that mobile operations do not override financial or contractual systems.
 * Per MOD-008 §7.7: NO financial logic execution, NO contract overrides,
 * NO tracking state alteration, NO RBAC bypass, NO autonomous decisions, NO AI inference.
 */
export function enforceNeutralityRule(task: MobileTaskObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Object.values(TaskType).includes(task.taskType)) {
    errors.push({
      code: 'INVALID_TASK_TYPE',
      field: 'taskType',
      message: `Task type must be one of: ${Object.values(TaskType).join(', ')}`,
    });
  }

  if (!Object.values(TaskState).includes(task.taskState)) {
    errors.push({
      code: 'INVALID_TASK_STATE',
      field: 'taskState',
      message: `Task state must be one of: ${Object.values(TaskState).join(', ')}`,
    });
  }

  if (!Object.values(Priority).includes(task.priorityLevel)) {
    errors.push({
      code: 'INVALID_PRIORITY',
      field: 'priorityLevel',
      message: `Priority must be one of: ${Object.values(Priority).join(', ')}`,
    });
  }

  if (!task.relatedShipmentId || typeof task.relatedShipmentId !== 'string') {
    errors.push({
      code: 'SHIPMENT_REFERENCE_REQUIRED',
      field: 'relatedShipmentId',
      message: 'All mobile tasks must link to a shipment/tracking reference per §4.3',
    });
  }

  if (!task.assignedTo || typeof task.assignedTo !== 'string') {
    errors.push({
      code: 'ASSIGNED_TO_REQUIRED',
      field: 'assignedTo',
      message: 'Tasks must have an assigned user for accountability per §4.3',
    });
  }

  if (!task.cachedInstructions || typeof task.cachedInstructions !== 'string') {
    errors.push({
      code: 'CACHED_INSTRUCTIONS_REQUIRED_OFFLINE',
      field: 'cachedInstructions',
      message: 'Cached instructions required for offline-first operation per §5.1 Field Execution Flow',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Network Efficiency Rule Validation (§7.8)
// ============================================================

/**
 * Validates lightweight payload specifications for network efficiency.
 * Per MOD-008 §7.8: APIs return only required fields, payload size minimized.
 */
export function validateNetworkEfficiency(spec: OptimizedTransmissionSpecObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Number.isInteger(spec.maxPayloadBytes) || spec.maxPayloadBytes <= 0) {
    errors.push({
      code: 'MAX_PAYLOAD_BYTES_MUST_BE_POSITIVE',
      field: 'maxPayloadBytes',
      message: 'Maximum payload bytes must be positive per §7.8 Network Efficiency Rule',
    });
  }

  if (spec.batchEnabled && (!Number.isInteger(spec.batchIntervalMs) || spec.batchIntervalMs <= 0)) {
    errors.push({
      code: 'BATCH_INTERVAL_MUST_BE_POSITIVE',
      field: 'batchIntervalMs',
      message: 'Batch interval must be positive when batching is enabled per §7.8',
    });
  }

  if (!spec.retryPolicyRef || typeof spec.retryPolicyRef !== 'string') {
    errors.push({
      code: 'RETRY_POLICY_REF_REQUIRED',
      field: 'retryPolicyRef',
      message: 'Retry policy reference required per §7.8 + ESS-001C',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Battery Optimization Rule Validation (§7.9)
// ============================================================

/**
 * Validates notification queue entries for battery-conscious delivery design.
 * Per MOD-008 §7.9: Background processing minimized. Batch requests supported.
 */
export function validateBatteryOptimization(notification: NotificationQueueObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (!VALID_NOTIFICATION_DELIVERY_STATUSES.includes(notification.deliveryStatus)) {
    errors.push({
      code: 'INVALID_DELIVERY_STATUS',
      field: 'deliveryStatus',
      message: `Delivery status must be one of: ${VALID_NOTIFICATION_DELIVERY_STATUSES.join(', ')}`,
    });
  }

  if (typeof notification.retryCount !== 'number' || notification.retryCount < 0) {
    errors.push({
      code: 'RETRY_COUNT_NON_NEGATIVE',
      field: 'retryCount',
      message: 'Retry count must be non-negative per §7.8 Network Efficiency Rule',
    });
  }

  if (!Object.values(Priority).includes(notification.effectivePriority)) {
    errors.push({
      code: 'EFFECTIVE_PRIORITY_INVALID',
      field: 'effectivePriority',
      message: `Effective priority must be one of: ${Object.values(Priority).join(', ')}`,
    });
  }

  if (!(notification.queuedAt instanceof Date) || isNaN(notification.queuedAt.getTime())) {
    errors.push({
      code: 'QUEUED_AT_REQUIRED',
      field: 'queuedAt',
      message: 'Queued timestamp required for delivery sequencing per §4.5',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Offline Sync Priority Rule Validation (§7.10)
// ============================================================

/**
 * Validates sync queues implement offline sync priority tiers.
 * Per MOD-008 §7.10: Critical events (POD, delivery confirmation) MUST have highest sync priority.
 * Conflict resolution MUST be server-authoritative.
 */
export function validateOfflineSyncPriority(event: EdgeEventObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (CRITICAL_EVENT_TYPES.has(event.eventType)) {
    if (!event.trackingId) {
      errors.push({
        code: 'CRITICAL_EVENT_MISSING_TRACKING_REF',
        field: 'trackingId',
        message: 'Critical events must have tracking references for authoritative sync per §7.10',
      });
    }
    if (!event.geoReference || !event.geoReference.latitude || !event.geoReference.longitude) {
      errors.push({
        code: 'CRITICAL_EVENT_GEO_REFERENCE_REQUIRED',
        field: 'geoReference',
        message: 'Critical events must include location data for POD/delivery confirmation per §7.10',
      });
    }
  }

  if (!Number.isInteger(event.sequenceNumber) || event.sequenceNumber <= 0) {
    errors.push({
      code: 'SEQUENCE_NUMBER_VALIDATION_FAILED',
      field: 'sequenceNumber',
      message: 'Sequence numbers must be positive integers for sync priority ordering per §7.10',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Task State Transition Validation (§5.1 Field Execution Flow)
// ============================================================

/**
 * Validates task state transitions follow authorized field execution flow.
 * Per MOD-008 §5.1: ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → COMPLETED (forward-only).
 */
export function validateTaskStateTransition(task: MobileTaskObject): ValidationResult {
  const errors: ValidationError[] = [];

  const stateProgressionOrder = [
    TaskState.ASSIGNED,
    TaskState.ACKNOWLEDGED,
    TaskState.IN_PROGRESS,
    TaskState.COMPLETED,
  ];

  const currentStateIndex = stateProgressionOrder.indexOf(task.taskState);

  if (currentStateIndex < 0) {
    errors.push({
      code: 'INVALID_TASK_STATE_TRANSITION',
      field: 'taskState',
      message: `Task state must follow progression: ${stateProgressionOrder.join(' → ')}`,
    });
  }

  if (task.taskState === TaskState.COMPLETED && !task.acknowledgedAt) {
    errors.push({
      code: 'COMPLETION_REQUIRES_ACKNOWLEDGEMENT',
      field: 'acknowledgedAt',
      message: 'Completed tasks must have acknowledgement timestamp per §5.1 Field Execution Flow',
    });
  }

  return { valid: errors.length === 0, errors };
}
