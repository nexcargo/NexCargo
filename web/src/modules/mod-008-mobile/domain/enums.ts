// NexCargo MOD-008 — Mobile Applications & Edge Operations Module Local Enums
// Wave 3 — Increment 4 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD008-AUTH-001 (D-S3-001)
// Reference: MOD-008 §§4 Core Domain Entities (§§4.1–§4.7), §5 Flow Models, §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO native device implementation or hardware integration
// - NO actual synchronization execution or network client code
// - All structures are design-time specification artifacts only
// - Server state is ALWAYS authoritative (§7.3 Sync Authority Rule)

/** Device type classification per MOD-008 §4.1 */
export enum DeviceType {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

/** Connectivity state for mobile session context per MOD-008 §4.1, §5.2 */
export enum ConnectivityState {
  ONLINE = 'ONLINE',
  DEGRADED = 'DEGRADED',
  OFFLINE = 'OFFLINE',
}

/** Edge event types per MOD-008 §4.2, §5.1 Field Execution Flow */
export enum EventType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  CHECKPOINT = 'CHECKPOINT',
  EXCEPTION = 'EXCEPTION',
}

/** Task types assigned to mobile users per MOD-008 §4.3 */
export enum TaskType {
  TRIP = 'TRIP',
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  INSPECTION = 'INSPECTION',
}

/** Task lifecycle states per MOD-008 §4.3, §5.1 */
export enum TaskState {
  ASSIGNED = 'ASSIGNED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/** Priority levels for tasks and sync events per MOD-008 §4.3, §7.10 */
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Synchronization status for edge events per MOD-008 §4.2, §5.3 Sync Lifecycle */
export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  CONFLICT = 'CONFLICT',
}

/** Sync queue attempt tracking per MOD-008 §4.4, §5.3 */
export enum SyncAttemptStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SERVER_VALIDATED = 'SERVER_VALIDATED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

/** Conflict resolution modes per MOD-008 §4.4, §7.3 */
export enum ConflictResolutionStatus {
  PENDING = 'PENDING',
  RESOLVED_SERVER = 'RESOLVED_SERVER',
  RESOLVED_MANUAL = 'RESOLVED_MANUAL',
}

/** Notification delivery statuses per MOD-008 §4.5 */
export enum NotificationDeliveryStatus {
  QUEUED = 'QUEUED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

/** Compression types for lightweight payloads per MOD-008 §4.6 */
export enum CompressionType {
  GZIP = 'GZIP',
  NONE = 'NONE',
}

/** Payload format specification per MOD-008 §4.6 */
export enum PayloadFormat {
  PROTOBUF = 'PROTOBUF',
  JSON_COMPRESSED = 'JSON_COMPRESSED',
}

/** Dashboard types for mobile endpoints per MOD-008 §4.7 */
export enum DashboardType {
  DRIVER = 'DRIVER',
  SHIPPER = 'SHIPPER',
  TRANSPORTER = 'TRANSPORTER',
}

/** Mobile role types referenced in MOD-008 §4.1 (maps to shared UserRole) */
export enum MobileRoleType {
  DRIVER = 'DRIVER',
  TRANSPORTER = 'TRANSPORTER',
  DISPATCHER = 'DISPATCHER',
}
