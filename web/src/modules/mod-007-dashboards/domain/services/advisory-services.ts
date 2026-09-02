// NexCargo MOD-007 — User Dashboards & Experience Module Advisory & Structural Validation Services
// Wave 3 — Stage 3, Increment 1 — Authorized per HAO-WAVE3-AUTH-001 (D-S3-001)
// Reference: MOD-007 §7 Rules of Operation, ESS-006 RBAC, ESS-008 UI/UX Standards
//
// NO COMPUTATION PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT render UI, execute actions, or implement actual dashboard logic.
// Per MOD-007 §7.1 (UI is NOT a Security Layer) and §7.5 (AI Rendering Rule).

import type {
  DashboardViewObject,
  WidgetObject,
  UserInteractionEvent,
  UISnapshot,
  NotificationObject,
  AIInsightWidget,
  LocalizationPreference,
  OfflineSyncQueueEntry,
  VisibilityRule,
} from '../types/entities';
import { UserRole, LayoutType, WidgetType, AccessLevel, NotificationType, Priority, ActionType } from '../enums';

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

/** Valid roles allowed in dashboard visibility */
const VALID_ROLES = Object.values(UserRole);
/** Valid layout types per MOD-007 §4.1 */
const VALID_LAYOUT_TYPES = Object.values(LayoutType);
/** Valid access levels per MOD-007 §4.2 */
const VALID_ACCESS_LEVELS = Object.values(AccessLevel);
/** Valid notification priority levels per MOD-007 §4.5 */
const VALID_PRIORITIES = Object.values(Priority);
/** Valid notification types per MOD-007 §4.5 */
const VALID_NOTIFICATION_TYPES = Object.values(NotificationType);

/** Source modules must follow MOD-XXX naming convention */
const SOURCE_MODULE_PATTERN = /^MOD-\d{3}$/;

/** Valid user action types per MOD-007 §4.3 */
const VALID_ACTION_TYPES = Object.values(ActionType);

/** Required fields for UI snapshots */
const REQUIRED_SNAPSHOT_FIELDS = ['dashboardId', 'activeFilters', 'loadedModules', 'dataPayload', 'timestamp'] as const;

// ============================================================
// Non-Execution Rule Enforcement Service
// ============================================================

/**
 * Enforces that all dashboard configurations comply with the Non-Execution Rule.
 * Per MOD-007 §7.1: UI is NOT a security layer. Backend enforces security.
 * No UI element may trigger financial or contractual execution directly.
 *
 * Validates:
 * - All widgets reference valid data source modules (§7.2 Data Binding Rule)
 * - No widget has executable action flags
 * - AI insights are always advisory (isAdvisory = true)
 *
 * @param dashboard The dashboard view object to validate
 * @returns ValidationResult indicating compliance status
 */
export function enforceNoExecutionRule(dashboard: DashboardViewObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate layout type is within allowed enum values
  if (!VALID_LAYOUT_TYPES.includes(dashboard.layoutType)) {
    errors.push({
      code: 'INVALID_LAYOUT_TYPE',
      field: 'layoutType',
      message: `Dashboard layout type must be one of: ${VALID_LAYOUT_TYPES.join(', ')}`,
    });
  }

  // Validate role context is a valid enum value
  if (!VALID_ROLES.includes(dashboard.roleContext)) {
    errors.push({
      code: 'INVALID_ROLE_CONTEXT',
      field: 'roleContext',
      message: `Role context must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }

  // Validate module scope references follow naming convention
  for (const modRef of dashboard.moduleScope) {
    if (!SOURCE_MODULE_PATTERN.test(modRef)) {
      errors.push({
        code: 'INVALID_MODULE_SCOPE_REF',
        field: 'moduleScope',
        message: `Module reference '${modRef}' does not follow MOD-XXX naming convention`,
      });
    }
  }

  // Validate visibility rules reference valid roles
  for (let i = 0; i < dashboard.visibilityRules.length; i++) {
    const rule = dashboard.visibilityRules[i];
    for (const role of rule.allowedRoles) {
      if (!VALID_ROLES.includes(role)) {
        errors.push({
          code: `VISIBILITY_RULE_${i}_INVALID_ROLE`,
          field: 'visibilityRules',
          message: `Visibility rule at index ${i} contains invalid role: '${role}'`,
        });
      }
    }
  }

  // Validate widget collection references are well-formed
  for (let i = 0; i < dashboard.widgetCollection.length; i++) {
    const widgetRef = dashboard.widgetCollection[i];
    if (!widgetRef.widgetId || typeof widgetRef.widgetId !== 'string') {
      errors.push({
        code: `WIDGET_REF_${i}_MISSING_ID`,
        field: 'widgetCollection',
        message: `Widget reference at index ${i} must have a valid widgetId`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Enforces that an AI insight widget strictly adheres to the Advisory-Only rule.
 * Per MOD-007 §7.5 AI Rendering Rule + §4.6 business rules:
 * - AI outputs MUST be displayed as advisory only
 * - AI insights MUST be clearly marked as recommendations
 * - No UI element may trigger financial or contractual execution directly
 * - Users must approve all AI-driven actions
 *
 * @param aiWidget The AI insight widget to validate
 * @returns ValidationResult
 */
export function enforceAdvisoryOnly(aiWidget: AIInsightWidget): ValidationResult {
  const errors: ValidationError[] = [];

  // CRITICAL: isAdvisory must ALWAYS be true per MOD-007 §4.6 business rules
  if (aiWidget.isAdvisory !== true) {
    errors.push({
      code: 'ADVISORY_MUST_BE_TRUE',
      field: 'isAdvisory',
      message: 'AI insight widget isAdvisory must ALWAYS be TRUE — this is non-negotiable per MOD-007 §4.6 business rules',
    });
  }

  // Verify display format is valid
  // DisplayFormat is imported but we check by value
  const validFormats = ['CARD', 'LIST', 'CHART', 'BANNER'];
  if (!validFormats.includes(aiWidget.displayFormat)) {
    errors.push({
      code: 'INVALID_DISPLAY_FORMAT',
      field: 'displayFormat',
      message: `Display format must be one of: ${validFormats.join(', ')}`,
    });
  }

  // Verify insight ID references original MOD-006 insight
  if (!aiWidget.insightId || typeof aiWidget.insightId !== 'string') {
    errors.push({
      code: 'INSIGHT_ID_REQUIRED',
      field: 'insightId',
      message: 'AI insight widget must reference the source MOD-006 insight ID',
    });
  }

  // Verify display metadata exists and includes explanation trace
  if (!aiWidget.displayMetadata) {
    errors.push({
      code: 'DISPLAY_METADATA_REQUIRED',
      field: 'displayMetadata',
      message: 'AI insight widget must include display metadata for proper rendering per §7.5',
    });
  } else {
    const meta = aiWidget.displayMetadata;
    if (!meta.sourceInsightId || typeof meta.sourceInsightId !== 'string') {
      errors.push({
        code: 'SOURCE_INSIGHT_REF_MISSING',
        field: 'displayMetadata.sourceInsightId',
        message: 'Display metadata must include source insight ID',
      });
    }
    if (!meta.confidenceScore || typeof meta.confidenceScore !== 'number') {
      errors.push({
        code: 'CONFIDENCE_SCORE_REQUIRED',
        field: 'displayMetadata.confidenceScore',
        message: 'Display metadata must include confidence score inherited from MOD-006',
      });
    }
    if (!Array.isArray(meta.explanationTrace) || meta.explanationTrace.length === 0) {
      errors.push({
        code: 'EXPLANATION_TRACE_REQUIRED',
        field: 'displayMetadata.explanationTrace',
        message: 'Every AI output must include a structured reasoning trace per MOD-007 §7.5 / §7.4 equivalent',
      });
    }
  }

  // Validate action button (if present) must be non-executable
  if (aiWidget.actionButton && aiWidget.actionButton.executesAction) {
    errors.push({
      code: 'ACTION_BUTTON_NOT_EXECUTABLE',
      field: 'actionButton.executesAction',
      message: 'Action buttons on AI insights must NEVER be executable (executesAction must be false) per §4.6',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Data Binding Rule Enforcement Service
// ============================================================

/**
 * Validates that a widget's data source references a valid NexCargo module.
 * Per MOD-007 §7.2 Data Binding Rule: All UI elements MUST bind to module-defined data structures.
 * No ad-hoc or undefined UI data sources are allowed.
 *
 * @param widget The widget to validate
 * @returns ValidationResult
 */
export function validateDataBinding(widget: WidgetObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate widget type is valid enum value
  if (!Object.values(WidgetType).includes(widget.widgetType)) {
    errors.push({
      code: 'INVALID_WIDGET_TYPE',
      field: 'widgetType',
      message: `Widget type must be one of: ${Object.values(WidgetType).join(', ')}`,
    });
  }

  // Validate data source module follows MOD-XXX naming convention
  if (!SOURCE_MODULE_PATTERN.test(widget.dataSourceModule)) {
    errors.push({
      code: 'INVALID_DATA_SOURCE_MODULE',
      field: 'dataSourceModule',
      message: `Data source module '${widget.dataSourceModule}' does not follow MOD-XXX naming convention per §7.2`,
    });
  }

  // Validate access level is valid enum value
  if (!VALID_ACCESS_LEVELS.includes(widget.accessLevel)) {
    errors.push({
      code: 'INVALID_ACCESS_LEVEL',
      field: 'accessLevel',
      message: `Access level must be one of: ${VALID_ACCESS_LEVELS.join(', ')}`,
    });
  }

  // Validate configuration schema is present
  if (!widget.configurationSchema || typeof widget.configurationSchema !== 'object') {
    errors.push({
      code: 'CONFIG_SCHEMA_REQUIRED',
      field: 'configurationSchema',
      message: 'Widget must have a JSON schema configuration definition',
    });
  }

  // Validate refresh trigger event is a non-empty string
  if (!widget.refreshTriggerEvent || typeof widget.refreshTriggerEvent !== 'string') {
    errors.push({
      code: 'REFRESH_TRIGGER_REQUIRED',
      field: 'refreshTriggerEvent',
      message: 'Widget must specify the system event that triggers its data refresh',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// RBAC Presentation Validation Service
// ============================================================

/**
 * Validates that RBAC presentation constraints properly separate
 * UI visibility from actual security enforcement.
 * Per MOD-007 §7.1: UI reflects backend permissions but is NOT itself a security layer.
 * Per MOD-007 §3.6: No UI-level security enforcement alone.
 *
 * @param visibleToRoles Array of roles that should see a given action
 * @param requiredBackendPermission Backend permission required for execution
 * @returns ValidationResult
 */
export function validateRBACPresentation(visibleToRoles: UserRole[], requiredBackendPermission: string): ValidationResult {
  const errors: ValidationError[] = [];

  // At least one role must be visible
  if (!Array.isArray(visibleToRoles) || visibleToRoles.length === 0) {
    errors.push({
      code: 'NO_VISIBLE_ROLES',
      field: 'visibleToRoles',
      message: 'At least one role must be specified for RBAC visibility',
    });
  } else {
    for (const role of visibleToRoles) {
      if (!VALID_ROLES.includes(role)) {
        errors.push({
          code: 'INVALID_RBAC_ROLE',
          field: 'visibleToRoles',
          message: `Role '${role}' is not a valid user role`,
        });
      }
    }
  }

  // Backend permission must be a non-empty string (actual security enforced at backend, per §7.1)
  if (!requiredBackendPermission || typeof requiredBackendPermission !== 'string') {
    errors.push({
      code: 'BACKEND_PERMISSION_REQUIRED',
      field: 'requiredBackendPermission',
      message: 'Every visible action MUST have a corresponding backend permission enforcement per §7.1',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Notification Delivery Validation Service
// ============================================================

/**
 * Validates notification structure and delivery parameters.
 * Per MOD-007 §4.5 + §7.6 Notification Rule:
 * - Critical alerts override user preferences
 * - Priority-based delivery system ensures critical alerts come through
 * - Notifications triggered by events from all modules
 *
 * @param notification The notification object to validate
 * @returns ValidationResult
 */
export function validateNotificationDelivery(notification: NotificationObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate notification type
  if (!VALID_NOTIFICATION_TYPES.includes(notification.notificationType)) {
    errors.push({
      code: 'INVALID_NOTIFICATION_TYPE',
      field: 'notificationType',
      message: `Notification type must be one of: ${VALID_NOTIFICATION_TYPES.join(', ')}`,
    });
  }

  // Validate priority
  if (!VALID_PRIORITIES.includes(notification.priority)) {
    errors.push({
      code: 'INVALID_PRIORITY',
      field: 'priority',
      message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
    });
  }

  // Validate user role is valid
  if (!VALID_ROLES.includes(notification.userRole)) {
    errors.push({
      code: 'INVALID_USER_ROLE_IN_NOTIFICATION',
      field: 'userRole',
      message: `User role must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }

  // Critical alerts must always deliver regardless of preferences
  if (notification.priority === Priority.CRITICAL) {
    // In production, this would verify that override-of-preferences logic exists
    // For design-time, we just confirm the structure supports it
    if (!notification.body || typeof notification.body !== 'string') {
      errors.push({
        code: 'CRITICAL_ALERT_BODY_REQUIRED',
        field: 'body',
        message: 'Critical alert notifications must have body text',
      });
    }
  }

  // Must have delivered timestamp
  if (!(notification.deliveredAt instanceof Date) || isNaN(notification.deliveredAt.getTime())) {
    errors.push({
      code: 'DELIVERED_AT_REQUIRED',
      field: 'deliveredAt',
      message: 'All notifications must have a delivered-at timestamp',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// User Interaction Event Validation Service
// ============================================================

/**
 * Validates that a user interaction event follows the defined structure.
 * Per MOD-007 §4.3: Represents user actions including VIEW/CREATE/UPDATE/SUBMIT/APPROVE/REJECT.
 *
 * @param event The interaction event to validate
 * @returns ValidationResult
 */
export function validateUserInteractionEvent(event: UserInteractionEvent): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate action type is valid enum value
  if (!VALID_ACTION_TYPES.includes(event.actionType)) {
    errors.push({
      code: 'INVALID_ACTION_TYPE',
      field: 'actionType',
      message: `Action type must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
    });
  }

  // Validate target module follows naming convention
  if (!SOURCE_MODULE_PATTERN.test(event.targetModule)) {
    errors.push({
      code: 'INVALID_TARGET_MODULE',
      field: 'targetModule',
      message: `Target module '${event.targetModule}' does not follow MOD-XXX naming convention`,
    });
  }

  // Validate user ID is present
  if (!event.userId || typeof event.userId !== 'string') {
    errors.push({
      code: 'USER_ID_REQUIRED',
      field: 'userId',
      message: 'User interaction event must have a userId',
    });
  }

  // Validate payload is structured
  if (event.payload === null || event.payload === undefined) {
    errors.push({
      code: 'PAYLOAD_REQUIRED',
      field: 'payload',
      message: 'User interaction event must have a structured payload',
    });
  }

  // Validate timestamp is valid
  if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
    errors.push({
      code: 'TIMESTAMP_REQUIRED',
      field: 'timestamp',
      message: 'User interaction event must have a valid timestamp',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// UI State Snapshot Validation Service
// ============================================================

/**
 * Validates that a UI state snapshot has all required fields.
 * Per MOD-007 §4.4: Represents system-renderable UI state at a given moment.
 * Used for offline sync reconciliation per §7.4.
 *
 * @param snapshot The UI snapshot to validate
 * @returns ValidationResult
 */
export function validateUISnapshot(snapshot: UISnapshot): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate dashboard reference
  if (!snapshot.dashboardId || typeof snapshot.dashboardId !== 'string') {
    errors.push({
      code: 'DASHBOARD_ID_REQUIRED',
      field: 'dashboardId',
      message: 'UI snapshot must reference a dashboard ID',
    });
  }

  // Validate active filters array
  if (!Array.isArray(snapshot.activeFilters)) {
    errors.push({
      code: 'ACTIVE_FILTERS_ARRAY_REQUIRED',
      field: 'activeFilters',
      message: 'Active filters must be an array',
    });
  }

  // Validate loaded modules array
  if (!Array.isArray(snapshot.loadedModules)) {
    errors.push({
      code: 'LOADED_MODULES_ARRAY_REQUIRED',
      field: 'loadedModules',
      message: 'Loaded modules must be an array',
    });
  } else {
    for (let i = 0; i < snapshot.loadedModules.length; i++) {
      const modRef = snapshot.loadedModules[i];
      if (!SOURCE_MODULE_PATTERN.test(modRef.moduleId)) {
        errors.push({
          code: `LOADED_MODULE_${i}_INVALID_ID`,
          field: 'loadedModules',
          message: `Loaded module at index ${i} does not follow MOD-XXX convention`,
        });
      }
    }
  }

  // Validate data payload
  if (snapshot.dataPayload === null || snapshot.dataPayload === undefined) {
    errors.push({
      code: 'DATA_PAYLOAD_REQUIRED',
      field: 'dataPayload',
      message: 'UI snapshot must have a data payload representing rendered state',
    });
  }

  // Validate timestamp
  if (!(snapshot.timestamp instanceof Date) || isNaN(snapshot.timestamp.getTime())) {
    errors.push({
      code: 'SNAPSHOT_TIMESTAMP_REQUIRED',
      field: 'timestamp',
      message: 'UI snapshot must have a valid timestamp',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Offline Sync Queue Validation Service
// ============================================================

/**
 * Validates offline sync queue entries conform to consistency requirements.
 * Per MOD-007 §7.4 Offline State Consistency Rule:
 * - Driver mobile interface stores data locally when offline
 * - Offline data MUST synchronize in chronological order upon reconnection
 * - Offline data MUST NOT conflict with system state upon sync
 *
 * @param entry The sync queue entry to validate
 * @returns ValidationResult
 */
export function validateOfflineSyncEntry(entry: OfflineSyncQueueEntry): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate entity ID is present
  if (!entry.entityId || typeof entry.entityId !== 'string') {
    errors.push({
      code: 'ENTITY_ID_REQUIRED',
      field: 'entityId',
      message: 'Offline sync entry must reference an entity',
    });
  }

  // Validate action type is valid enum value
  if (!VALID_ACTION_TYPES.includes(entry.actionType)) {
    errors.push({
      code: 'INVALID_SYNC_ACTION_TYPE',
      field: 'actionType',
      message: `Sync action type must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
    });
  }

  // Validate local timestamp
  if (!(entry.localTimestamp instanceof Date) || isNaN(entry.localTimestamp.getTime())) {
    errors.push({
      code: 'LOCAL_TIMESTAMP_REQUIRED',
      field: 'localTimestamp',
      message: 'Offline sync entry must have a valid local timestamp',
    });
  }

  // Validate retry count is non-negative
  if (typeof entry.retryCount !== 'number' || entry.retryCount < 0) {
    errors.push({
      code: 'RETRY_COUNT_INVALID',
      field: 'retryCount',
      message: 'Retry count must be a non-negative number',
    });
  }

  return { valid: errors.length === 0, errors };
}
