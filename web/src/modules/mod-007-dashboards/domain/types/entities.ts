// NexCargo MOD-007 — User Dashboards & Experience Module Domain Types
// Wave 3 — Stage 3, Increment 1 — Authorized per HAO-WAVE3-AUTH-001 (D-S3-001)
// Reference: MOD-007 §4 Core Domain Entities (§§4.1–§4.9), §5 Dashboard Architecture, §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO actual UI rendering or React components
// - All structures are design-time specification artifacts only
// - Every output enforces non-execution rules per MOD-007 §7.1, §7.5
// - Data binding must reference module-defined structures per §7.2

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { UserRole, LayoutType, WidgetType, AccessLevel, NotificationType, Channel, Priority, ActionType, DisplayFormat, PreferredLanguage } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Visibility rule constraint for dashboard access per MOD-007 §4.1 */
export interface VisibilityRule {
  /** Rule identifier */
  ruleId: string;
  /** User roles permitted by this rule */
  allowedRoles: UserRole[];
  /** Required permission level */
  requiredPermission: string;
  /** Condition expression for dynamic visibility */
  condition?: string;
}

/** Individual widget reference within a dashboard collection per MOD-007 §4.1 */
export interface WidgetReference {
  /** Widget identifier */
  widgetId: string;
  /** Widget type classification */
  widgetType: WidgetType;
  /** Configuration override for this specific instance */
  configurationOverride?: Record<string, unknown>;
  /** Whether this widget is currently visible */
  isVisible: boolean;
  /** Position/ordering index on the dashboard */
  position: number;
}

/** Arbitrary structured action parameters per MOD-007 §4.3 */
export interface ActionPayload {
  [key: string]: unknown;
}

/** Reasoning trace element for AI explanations */
export interface ReasoningTraceElement {
  /** Step identifier */
  stepId: string;
  /** Human-readable reasoning description */
  description: string;
  /** Data sources cited */
  dataSources: string[];
  /** Confidence contribution of this step (0–100) */
  confidenceContribution: number;
}

/** Active filter definition applied to a dashboard view per MOD-007 §4.4 */
export interface ActiveFilter {
  /** Filter identifier */
  filterId: string;
  /** Field name being filtered */
  field: string;
  /** Filter operator (EQUALS, CONTAINS, BETWEEN, etc.) */
  operator: string;
  /** Filter value(s) */
  value: unknown | unknown[];
}

/** Loaded module references in a UI state snapshot per MOD-007 §4.4 */
export interface LoadedModuleRef {
  /** Module identifier (MOD-XXX) */
  moduleId: string;
  /** Loading timestamp */
  loadedAt: Date;
  /** Data freshness indicator */
  isFresh: boolean;
}

/** Deep link action reference in notification per MOD-007 §4.5 */
export interface ActionLink {
  /** Target screen/path */
  target: string;
  /** Display text */
  displayText: string;
  /** Whether clicking triggers execution (always false per §7.5) */
  executesAction: boolean;
}

/** AI insight display metadata per MOD-007 §4.6 */
export interface InsightDisplayMetadata {
  /** Recommended display format */
  displayFormat: DisplayFormat;
  /** Contextual label shown with insight */
  contextualLabel: string;
  /** Reference to original MOD-006 insight */
  sourceInsightId: string;
  /** Confidence score inherited from MOD-006 */
  confidenceScore: number;
  /** Explanation trace for transparency per MOD-007 §7.5 */
  explanationTrace: ReasoningTraceElement[];
}

/** Translation entry for localization per MOD-007 §4.7 */
export interface TranslationEntry {
  /** Unique key identifier for the translatable string */
  key: string;
  /** Language code (pt/en) */
  language: PreferredLanguage;
  /** Translated string value */
  value: string;
  /** Optional context namespace (e.g., "dashboard", "notification") */
  context?: string;
}

/** Refresh mode for dashboard data refresh policies per MOD-007 §4.1 */
export enum RefreshMode {
  POLLING = 'POLLING',
  EVENT_DRIVEN = 'EVENT_DRIVEN',
  MANUAL = 'MANUAL',
}

/** Polling interval settings for refresh policies */
export interface PollingInterval {
  /** Interval in milliseconds */
  intervalMs: number;
  /** Maximum stale time before forced refresh (ms) */
  maxStaleTimeMs?: number;
}

/** Dashboard refresh policy combining mode + optional interval */
export type RefreshPolicy = PollingInterval | { mode: RefreshMode.POLLING; intervalMs: number } | { mode: RefreshMode.EVENT_DRIVEN } | { mode: RefreshMode.MANUAL };

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Dashboard View Object — structured dashboard configuration.
 * Per MOD-007 §4.1
 * RBAC-based visibility constraints enforced per ESS-006 and MOD-007 §7.1.
 * Must bind to module-defined data structures per §7.2.
 */
export interface DashboardViewObject extends BaseEntity {
  /** Unique identifier for this dashboard view */
  dashboardId: string;
  /** Role context this dashboard serves */
  roleContext: UserRole;
  /** Modules whose data this dashboard presents */
  moduleScope: string[];
  /** Layout type: OPERATIONAL | ANALYTICAL | HYBRID */
  layoutType: LayoutType;
  /** Collection of widgets displayed on this dashboard */
  widgetCollection: WidgetReference[];
  /** How the dashboard refreshes its data */
  refreshPolicy: RefreshPolicy;
  /** Visibility constraints based on RBAC rules */
  visibilityRules: VisibilityRule[];
}

/**
 * Widget Object — functional UI data block structure.
 * Per MOD-007 §4.2
 * Data source modules MUST be valid NexCargo modules per §7.2 Data Binding Rule.
 * Access level controls which roles can see this widget.
 */
export interface WidgetObject extends BaseEntity {
  /** Unique identifier for this widget */
  widgetId: string;
  /** Widget type classification */
  widgetType: WidgetType;
  /** Source module providing data for this widget */
  dataSourceModule: string;
  /** System event that triggers a widget data refresh */
  refreshTriggerEvent: string;
  /** Access control level for widget visibility */
  accessLevel: AccessLevel;
  /** JSON schema defining configurable widget properties */
  configurationSchema: Record<string, unknown>;
}

/**
 * User Interaction Event — records user actions within the experience layer.
 * Per MOD-007 §4.3
 * Events capture VIEW/CREATE/UPDATE/SUBMIT/APPROVE/REJECT actions.
 * All actions are logged and auditable per MOD-007 §7.8.
 */
export interface UserInteractionEvent extends BaseEntity {
  /** Unique identifier for this interaction event */
  eventId: string;
  /** User performing the action */
  userId: string;
  /** Type of action performed */
  actionType: ActionType;
  /** Target module affected by this action */
  targetModule: string;
  /** Structured payload containing action-specific data */
  payload: ActionPayload;
  /** Timestamp of the interaction */
  timestamp: Date;
}

/**
 * UI State Snapshot — system-renderable UI state at a given moment.
 * Per MOD-007 §4.4
 * Represents the complete rendered state including active filters, loaded modules, and data.
 * Used for offline sync reconciliation per MOD-007 §7.4.
 */
export interface UISnapshot extends BaseEntity {
  /** Unique identifier for this snapshot */
  snapshotId: string;
  /** Associated dashboard view */
  dashboardId: string;
  /** Currently active filter set */
  activeFilters: ActiveFilter[];
  /** Modules currently loaded in this snapshot */
  loadedModules: LoadedModuleRef[];
  /** Aggregated data payload rendered in this state */
  dataPayload: Record<string, unknown>;
  /** Timestamp of snapshot generation */
  timestamp: Date;
}

/**
 * Notification Object — structured notification for delivery to a user.
 * Per MOD-007 §4.5
 * Critical alerts override user preferences per §7.6.
 * Notifications are triggered by events from all modules.
 */
export interface NotificationObject extends BaseEntity {
  /** Unique identifier for this notification */
  notificationId: string;
  /** Intended recipient user */
  userId: string;
  /** Recipient's role for routing decisions */
  userRole: UserRole;
  /** Classification of this notification */
  notificationType: NotificationType;
  /** Delivery channel(s) to use */
  channel: Channel;
  /** Urgency priority */
  priority: Priority;
  /** Notification title */
  title: string;
  /** Notification body content */
  body: string;
  /** Optional deep link to relevant system state */
  actionLink?: ActionLink;
  /** Source module that originated this notification */
  sourceModule: string;
  /** Original system event ID this notification responds to */
  sourceEventId: string;
  /** Timestamp when user marked as read */
  readAt?: Date;
  /** Timestamp when notification was delivered */
  deliveredAt: Date;
}

/**
 * AI Insight Widget — displays an AI-generated insight in the UI.
 * Per MOD-007 §4.6
 * ALWAYS advisory (isAdvisory = true). No automatic execution from UI.
 * Users must approve all AI-driven actions.
 * Clear labeling as recommendation required per MOD-007 §7.5.
 */
export interface AIInsightWidget extends BaseEntity {
  /** Unique identifier for this AI insight widget */
  insightWidgetId: string;
  /** Reference to the source MOD-006 insight */
  insightId: string;
  /** Classification of the insight */
  insightType: string; // RECOMMENDATION / PREDICTION / ANOMALY / RISK_SCORE
  /** Visual display format */
  displayFormat: DisplayFormat;
  /** Always TRUE — enforcement of advisory-only per §4.6 business rules */
  isAdvisory: boolean;
  /** Optional non-executable action reference button */
  actionButton?: ActionLink;
  /** Metadata about how this insight should be displayed */
  displayMetadata: InsightDisplayMetadata;
}

/**
 * Localization Preference Object — user language and localization settings.
 * Per MOD-007 §4.7
 * Portuguese (pt) default for Mozambique operations; English (en) for regional expansion.
 * Automatic language detection via IP geolocation → country → language mapping.
 * Manual language override stored in user profile.
 */
export interface LocalizationPreference extends BaseEntity {
  /** Unique identifier for this preference record */
  preferenceId: string;
  /** User owning these preferences */
  userId: string;
  /** User's preferred language */
  preferredLanguage: PreferredLanguage;
  /** Detected region for auto-detection */
  detectedRegion: string;
  /** Whether automatic language detection is enabled */
  autoDetectEnabled: boolean;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Fallback language if primary translation unavailable */
  fallbackLanguage: PreferredLanguage;
}

/**
 * Offline Sync Queue Entry — tracks pending offline data to be synchronized.
 * Per MOD-007 §7.4 Offline State Consistency Rule
 * Driver mobile interface stores data locally when offline.
 * Offline data MUST synchronize in chronological order upon reconnection.
 */
export interface OfflineSyncQueueEntry extends BaseEntity {
  /** Unique identifier for this queue entry */
  entryId: string;
  /** Shipment or entity this entry relates to */
  entityId: string;
  /** Action type captured while offline */
  actionType: ActionType;
  /** Structured action data */
  payload: ActionPayload;
  /** GPS coordinates at time of capture (if available) */
  locationLat?: number;
  /** GPS longitude at time of capture */
  locationLon?: number;
  /** Local timestamp before synchronization */
  localTimestamp: Date;
  /** Whether this entry has been successfully synced */
  synced: boolean;
  /** Sync attempt count */
  retryCount: number;
}

/**
 * RBAC Presentation Constraint — defines what actions are visible vs hidden in UI.
 * Per MOD-007 §3.6 Role-Based Access Control UI
 * UI reflects backend permissions; no UI-level security enforcement alone.
 */
export interface RBACPresentationConstraint {
  /** Constraint identifier */
  constraintId: string;
  /** Module and action this constraint applies to */
  scope: string;
  /** Roles that can see the action */
  visibleToRoles: UserRole[];
  /** Whether the action element exists in DOM or is completely removed */
  hideCompletely: boolean;
  /** Backend permission requirement for execution */
  requiredBackendPermission: string;
}
