// NexCargo MOD-008 — Mobile Applications & Edge Operations Module BC Coordination Interfaces
// Wave 3 — Increment 4 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD008-AUTH-001 (D-S3-001)
// Reference: MOD-008 §§8 Events and Integration Boundaries, §7 Rules of Operation, D-MOD016-001
//
// Key BC coupling points:
// - MOD-008 consumes from MOD-003, MOD-004, MOD-005, MOD-006, MOD-007, MOD-010, MOD-016
// - MOD-016 notification surfaces consumed via consumer-side design-time stubs (D-MOD016-001)
// - MOD-008 output signals consumed by MOD-003/MOD-005/MOD-006/MOD-012/MOD-016/MOD-017

// ============================================================
// CONSUMER-SIDE DESIGN-TIME STUBS FOR MOD-016
// Per D-MOD016-001: Contract interfaces defined as local type definitions consuming
// MOD-016 conceptually without importing actual MOD-016 implementation types.
// Pattern follows D-S2B-002 provisional-assumption approach.
// ============================================================

/**
 * MOD-016 Notification Channel Stub — conceptual interface representing MOD-016 channels.
 * DESIGN-TIME STUB ONLY. Does not import any MOD-016 types.
 */
export interface NotificationChannelStub {
  /** Channel identifier */
  channelId: string;
  /** Whether this channel is configured and active */
  isActive: boolean;
  /** Last successful delivery timestamp */
  lastDeliveryTime?: Date;
}

/**
 * MOD-016 Notification Template Stub — conceptual template definition from MOD-016.
 */
export interface NotificationTemplateStub {
  /** Template identifier */
  templateId: string;
  /** Template title format string */
  titleFormat: string;
  /** Template body format string */
  bodyFormat: string;
  /** Supported channels */
  supportedChannels: string[];
  /** Default priority */
  defaultPriority: string;
}

// ============================================================
// UPSTREAM CONSUMPTION INTERFACES — INPUTS TO MOD-008 FROM DEPENDENT MODULES
// ============================================================

/**
 * TrackingFeed — primary data source from MOD-003 tracking module.
 * Provides shipment lifecycle context for mobile task assignment and edge event capture.
 * Pattern follows MOD-007 → TrackingStateFeed consumption model.
 */
export interface TrackingFeed {
  /** MOD-003 shipment identifier */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Latest GPS coordinates */
  locationLat?: number;
  locationLon?: number;
  /** Estimated time of arrival */
  eta?: Date;
  /** POD submission status */
  podSubmitted: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * DocumentFeed — document retrieval data from MOD-004 document management.
 * Provides document references accessible at the mobile edge (contract, POD, customs).
 */
export interface DocumentFeed {
  /** MOD-004 document identifier */
  documentId: string;
  /** Document type classification */
  documentType: string;
  /** Current validation status */
  status: string;
  /** File reference URL for download */
  fileRef: string;
  /** Whether locally cached for offline access */
  offlineAvailable: boolean;
  /** Content hash for integrity verification during sync */
  fileHash: string;
  /** Timestamp of last update */
  updated_at: Date;
}

/**
 * TaskAssignmentFeed — task generation data originating from MOD-002 contracts.
 * Provides mobile task assignments aligned to booking/contract state.
 */
export interface TaskAssignmentFeed {
  /** Task identifier */
  taskId: string;
  /** Assigned user ID */
  assignedTo: string;
  /** Associated shipment/tracking ID */
  relatedShipmentId: string;
  /** Task type */
  taskType: string;
  /** Priority level */
  priorityLevel: string;
  /** Due timestamp */
  dueTimestamp: Date;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * AISuggestionFeed — AI recommendation caching data from MOD-006.
 * Provides route suggestions, pricing recommendations, anomaly alerts for offline use.
 * Pattern follows MOD-007 → AIIntelligenceFeed consumption model.
 */
export interface AISuggestionFeed {
  /** Insight or prediction identifier from MOD-006 */
  insightId: string;
  /** Type: PREDICTION / ANOMALY / RECOMMENDATION / RISK_SCORE */
  insightType: string;
  /** Confidence score (0–100) */
  confidenceScore: number;
  /** Severity or risk category */
  severityLevel: string;
  /** Target entity this insight applies to */
  targetEntity?: string;
  /** Whether suitable for offline caching on mobile device */
  offlineCachable: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * FinancialStateFeed — read-only financial status data from MOD-005.
 * Provides settlement/delivery confirmation visibility restricted to read-only at edge.
 */
export interface FinancialStateFeed {
  /** Escrow/account identifier */
  escrowId: string;
  /** Current escrow state */
  state: string;
  /** Settlement readiness flag */
  readyForSettlement: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

// ============================================================
// DOWNSTREAM OUTPUT SIGNALS — PRODUCED BY MOD-008 → CONSUMED BY OTHER MODULES
// ============================================================

/**
 * MobileSessionStartedSignal — emitted when a mobile session begins.
 * Consumed by: MOD-010 (security audit trail), MOD-017 (observability), MOD-007 (dashboard awareness)
 * Pattern follows established signal-to-module convention.
 */
export interface MobileSessionStartedSignal {
  /** Session identifier */
  sessionId: string;
  /** User who started session */
  userId: string;
  /** Device type */
  deviceType: string;
  /** Role type of the user */
  roleType: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * EdgeEventCapturedSignal — emitted when an operational field event is captured locally.
 * Consumed by: MOD-003 (tracking updates), MOD-012 (operational analytics), MOD-017 (monitoring)
 */
export interface EdgeEventCapturedSignal {
  /** Event identifier */
  eventId: string;
  /** Event type */
  eventType: string;
  /** Shipment reference */
  shipmentId: string;
  /** Geo-reference summary (lat/lon snapshot) */
  geoSnapshot: Record<string, unknown>;
  /** Sync status at capture time */
  syncStatus: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * OfflineEventQueuedSignal — emitted when events are queued during connectivity loss.
 * Consumed by: MOD-003 (event ordering awareness), MOD-017 (offline duration monitoring)
 */
export interface OfflineEventQueuedSignal {
  /** Queue identifier */
  queueId: string;
  /** Device where events are queued */
  deviceId: string;
  /** Number of events in this queue batch */
  eventCount: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * SyncInitiatedSignal — emitted when synchronization attempt begins.
 * Consumed by: MOD-017 (sync monitoring), MOD-010 (audit trail)
 */
export interface SyncInitiatedSignal {
  /** Sync queue identifier */
  queueId: string;
  /** Device initiating sync */
  deviceId: string;
  /** Attempt number */
  attemptNumber: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * SyncCompletedSignal — emitted when synchronization completes successfully.
 * Consumed by: MOD-003 (confirm event ingestion), MOD-012 (sync analytics)
 */
export interface SyncCompletedSignal {
  /** Sync queue identifier */
  queueId: string;
  /** Events synced count */
  eventsSynced: number;
  /** Duration of sync operation in ms */
  syncDurationMs: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * SyncConflictDetectedSignal — emitted when server rejects event or detects conflict.
 * Consumed by: MOD-003 (conflict resolution coordination), MOD-010 (compliance audit)
 */
export interface SyncConflictDetectedSignal {
  /** Sync queue identifier */
  queueId: string;
  /** Event causing conflict */
  conflictingEventId: string;
  /** Conflict resolution status */
  resolutionStatus: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * NotificationQueuedSignal — emitted when a notification is queued for offline delivery.
 * Consumed by: MOD-016 (notification pipeline status), MOD-017 (delivery monitoring)
 */
export interface NotificationQueuedSignal {
  /** Notification queue entry identifier */
  notificationQueueId: string;
  /** Target device */
  deviceId: string;
  /** Original notification ID */
  notificationId: string;
  /** Effective priority */
  effectivePriority: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * OfflineDataSyncedSignal — emitted when bulk offline data synchronization completes.
 * Consumed by: MOD-003 (tracking consistency), MOD-012 (analytics aggregation)
 * Pattern consistent with MOD-007 → OfflineDataSyncedSignal.
 */
export interface OfflineDataSyncedSignal {
  /** Device identifier that completed sync */
  deviceId: string;
  /** Total entries synchronized */
  entryCount: number;
  /** Duration of sync process in milliseconds */
  syncDurationMs: number;
  /** Any conflicts detected during sync */
  conflictsDetected: boolean;
  /** Timestamp */
  timestamp: Date;
}
