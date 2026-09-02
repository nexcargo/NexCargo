// NexCargo MOD-007 — User Dashboards & Experience Module Local Enums
// Wave 3 — Stage 3, Increment 1 — Authorized per HAO-WAVE3-AUTH-001 (D-S3-001)
// Reference: MOD-007 §§4 Core Domain Entities (4.1–4.9), §5 Dashboard Architecture, §7 Rules of Operation

/** User role context per MOD-007 §4.1, §5 Dashboards */
export enum UserRole {
  SHIPPER = 'SHIPPER',
  TRANSPORTER = 'TRANSPORTER',
  DRIVER = 'DRIVER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

/** Dashboard layout type per MOD-007 §4.1 */
export enum LayoutType {
  OPERATIONAL = 'OPERATIONAL',
  ANALYTICAL = 'ANALYTICAL',
  HYBRID = 'HYBRID',
}

/** Widget type per MOD-007 §4.2 */
export enum WidgetType {
  TABLE = 'TABLE',
  CHART = 'CHART',
  TIMELINE = 'TIMELINE',
  KPI = 'KPI',
  AI_INSIGHT = 'AI_INSIGHT',
  MAP = 'MAP',
  FORM = 'FORM',
  LIST = 'LIST',
}

/** Widget access level per MOD-007 §4.2 */
export enum AccessLevel {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
  ADMIN_ONLY = 'ADMIN_ONLY',
}

/** Notification type per MOD-007 §4.5 */
export enum NotificationType {
  INFO = 'INFO',
  ALERT = 'ALERT',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/** Delivery channel per MOD-007 §4.5 */
export enum Channel {
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

/** Notification priority per MOD-007 §4.5 */
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Action type in user interaction event per MOD-007 §4.3 */
export enum ActionType {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

/** Insight display format per MOD-007 §4.6 */
export enum DisplayFormat {
  CARD = 'CARD',
  LIST = 'LIST',
  CHART = 'CHART',
  BANNER = 'BANNER',
}

/** Language preference per MOD-007 §4.7 */
export enum PreferredLanguage {
  PORTUGUESE = 'pt',
  ENGLISH = 'en',
}
