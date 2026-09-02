// NexCargo MOD-007 — User Dashboards & Experience Module BC Coordination Interfaces
// Wave 3 — Stage 3, Increment 1 — Authorized per HAO-WAVE3-AUTH-001 (D-S3-001)
// Reference: MOD-007 §§8–9 Events and Integration Boundaries, MOD-012 §7.5 AI Data Isolation Rule
//
// Key BC coupling points:
// - MOD-007 consumes data from MOD-001, MOD-002, MOD-003, MOD-006
// - MOD-016 notification surfaces consumed via consumer-side design-time stubs (D-MOD016-001)
// - MOD-007 output signals consumed by MOD-006, MOD-012, MOD-016, MOD-017, MOD-018

// ============================================================
// CONSUMER-SIDE DESIGN-TIME STUBS FOR MOD-016
// Per D-MOD016-001: Contract interfaces defined as local type definitions consuming
// MOD-016 conceptually without importing actual MOD-016 implementation types.
// ============================================================

/**
 * MOD-016 Notification Channel Stub — conceptual interface representing what MOD-016 provides.
 * This is a DESIGN-TIME STUB only. Does not import any MOD-016 types.
 * Follows D-S2B-002 provisional-assumption approach.
 */
export interface NotificationChannelStub {
  /** Channel identifier (matching MOD-016 channel enum values conceptually) */
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
  /** Channels this template supports */
  supportedChannels: string[];
  /** Default priority */
  defaultPriority: string;
}

/**
 * Structured Dataset Request Interface — primary interface through which MOD-007
 * requests structured analytics/display datasets from MOD-012 for dashboard widgets.
 * Pattern follows established MOD-006 → MOD-012 dependency model.
 */
export interface DashboardDatasetRequest {
  /** Required dataset identifier */
  datasetId: string;
  /** Fields needed for display */
  requiredFields: string[];
  /** Time range for the requested data */
  timeRangeStart?: Date;
  /** Time range end for the requested data */
  timeRangeEnd?: Date;
  /** Minimum confidence threshold */
  minConfidenceThreshold?: number;
  /** Execute request and return display-ready envelope */
  execute(): DisplayDataEnvelope;
}

/**
 * Display Data Envelope — standardized response wrapper containing display-ready data.
 */
export interface DisplayDataEnvelope {
  /** Source dataset identifier */
  datasetId: string;
  /** Dataset name */
  datasetName: string;
  /** Version of returned data */
  version: number;
  /** Rows formatted for widget display */
  displayRows: Record<string, unknown>[];
  /** Metadata about the response */
  metadata: {
    recordCount: number;
    refreshPolicy: string;
    lineageSummary: string;
  };
}

// ============================================================
// OUTPUT SIGNALS PRODUCED BY MOD-007 → consumed by downstream modules
// Per MOD-007 §8 declared event model (specification only)
// ============================================================

/**
 * DashboardLoaded Signal — emitted when a dashboard view loads successfully.
 * Consumed by: MOD-006 (user behavior analytics), MOD-012 (BI reporting)
 * Per MOD-007 §8: DashboardLoaded event
 */
export interface DashboardLoadedSignal {
  /** Dashboard identifier that was loaded */
  dashboardId: string;
  /** Role context of the loading user */
  roleContext: string;
  /** Number of widgets rendered */
  widgetCount: number;
  /** Loading duration in milliseconds */
  loadDurationMs: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * WidgetRendered Signal — emitted when a widget renders its data block.
 * Consumed by: MOD-012 (analytics/aggregation), MOD-017 (observability)
 * Per MOD-007 §8: WidgetRendered event
 */
export interface WidgetRenderedSignal {
  /** Widget identifier */
  widgetId: string;
  /** Widget type */
  widgetType: string;
  /** Source module providing data */
  dataSourceModule: string;
  /** Render duration in ms */
  renderDurationMs: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * UserInteractionCaptured Signal — captures user actions within the experience layer.
 * Consumed by: MOD-006 (behavioral analysis), MOD-015 (dispute evidence)
 * Per MOD-007 §8: UserInteractionCaptured event
 */
export interface UserInteractionCapturedSignal {
  /** Interaction event identifier */
  eventId: string;
  /** Action type performed */
  actionType: string;
  /** Target module */
  targetModule: string;
  /** User who performed the action */
  userId: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * FilterApplied Signal — records filtering operations on dashboards.
 * Consumed by: MOD-012 (BI/reporting)
 * Per MOD-007 §8: FilterApplied event
 */
export interface FilterAppliedSignal {
  /** Dashboard being filtered */
  dashboardId: string;
  /** Number of filters applied */
  filterCount: number;
  /** Filter fields targeted */
  filterFields: string[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * InsightViewed Signal — tracks when users view AI insights in the UI.
 * Consumed by: MOD-006 (insight effectiveness tracking)
 * Per MOD-007 §8: InsightViewed event
 */
export interface InsightViewedSignal {
  /** Insight widget identifier */
  insightWidgetId: string;
  /** Original MOD-006 insight ID */
  insightId: string;
  /** User viewing the insight */
  userId: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * NavigationChanged Signal — records navigation between dashboards/views.
 * Consumed by: MOD-012 (BI reporting)
 * Per MOD-007 §8: NavigationChanged event
 */
export interface NavigationChangedSignal {
  /** From-view identifier */
  fromView: string;
  /** To-view identifier */
  toView: string;
  /** User performing navigation */
  userId: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * NotificationDelivered Signal — confirms notification delivery to recipient.
 * Consumed by: MOD-012 (analytics aggregation)
 * Per MOD-007 §8: NotificationDelivered event
 */
export interface NotificationDeliveredSignal {
  /** Notification identifier */
  notificationId: string;
  /** Delivery channel used */
  channel: string;
  /** Priority level */
  priority: string;
  /** Recipient user ID */
  userId: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * NotificationRead Signal — records when a notification is acknowledged by the user.
 * Consumed by: MOD-012 (analytics)
 * Per MOD-007 §8: NotificationRead event
 */
export interface NotificationReadSignal {
  /** Notification identifier */
  notificationId: string;
  /** User who read it */
  userId: string;
  /** Time to read in seconds after delivery */
  timeToReadSeconds: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * OfflineDataSynced Signal — confirms offline data synchronization completion.
 * Consumed by: MOD-003 (tracking consistency), MOD-012 (analytics)
 * Per MOD-007 §8: OfflineDataSynced event
 */
export interface OfflineDataSyncedSignal {
  /** Driver or device identifier */
  deviceId: string;
  /** Number of entries synced */
  entryCount: number;
  /** Sync duration in milliseconds */
  syncDurationMs: number;
  /** Any conflicts detected during sync */
  conflictsDetected: boolean;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================
// REQUEST/CONSUME FEEDS — INPUTS TO MOD-007 FROM UPSTREAM MODULES
// ============================================================

/**
 * Marketplace Activity Feed Interface — consumes marketplace data from MOD-001
 * for shipper/transporter dashboard displays.
 * Per MOD-007 §9: MOD-001 → marketplace UI (listings, offers, matching display)
 */
export interface MarketplaceActivityFeed {
  /** Listing or offer identifier */
  entityId: string;
  /** Entity type */
  entityType: 'LISTING' | 'OFFER' | 'MATCH';
  /** Current status */
  status: string;
  /** Price information if applicable */
  price?: number;
  /** Currency code */
  currency?: string;
  /** Cargo type compatibility */
  cargoType?: string;
  /** Origin and destination */
  origin?: string;
  destination?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * Booking Status Feed Interface — consumes booking/contract state from MOD-002
 * for transporter and admin dashboard views.
 * Per MOD-007 §9: MOD-002 → booking/contract interfaces
 */
export interface BookingStatusFeed {
  /** Contract or booking identifier */
  entityId: string;
  /** Contract status */
  status: string;
  /** Associated listing/shipment */
  referenceId: string;
  /** Parties involved (shipper, transporter IDs) */
  parties: string[];
  /** Total amount */
  totalAmount?: number;
  /** Currency code */
  currency?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * Tracking State Feed Interface — consumes real-time tracking data from MOD-003
 * for driver and transporter dashboards.
 * Per MOD-007 §9: MOD-003 → tracking dashboards (real-time map, status updates)
 */
export interface TrackingStateFeed {
  /** Shipment identifier */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Latest GPS coordinates */
  locationLat?: number;
  locationLon?: number;
  /** Estimated time of arrival */
  eta?: Date;
  /** Distance remaining */
  distanceRemaining?: number;
  /** Delay reason if applicable */
  delayReason?: string;
  /** POD status (submitted/not submitted) */
  podSubmitted: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * AI Intelligence Feed Interface — consumes AI outputs from MOD-006
 * for AI-insight widgets and moderator fraud monitoring.
 * Per MOD-007 §9: MOD-006 → intelligence UI; §3.4 AI-Augmented Interfaces
 */
export interface AIIntelligenceFeed {
  /** Insight or prediction identifier from MOD-006 */
  insightId: string;
  /** Type of AI output: PREDICTION / ANOMALY / RECOMMENDATION / RISK_SCORE */
  insightType: string;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Severity or risk category */
  severityLevel: string;
  /** Structured reasoning trace */
  explanationTrace: Record<string, unknown>;
  /** Target entity this insight applies to */
  targetEntity?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * Compliance Alert Feed Interface — consumes compliance/security events from MOD-010
 * for moderator dashboard monitoring.
 * Per MOD-007 §9: MOD-010 → RBAC enforcement (UI reflection only)
 */
export interface ComplianceAlertFeed {
  /** Event identifier */
  eventId: string;
  /** Event type: VIOLATION | AUDIT | ACCESS_CONTROL | POLICY_CHECK */
  eventType: string;
  /** Severity level */
  severity: string;
  /** Descriptive message */
  message: string;
  /** Actor/user involved */
  actorId: string;
  /** Timestamp */
  feedTimestamp: Date;
}
