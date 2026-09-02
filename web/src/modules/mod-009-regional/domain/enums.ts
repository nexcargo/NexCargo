// NexCargo MOD-009 — Regional & Cross-Border Logistics Operations Module Local Enums
// Wave 4 — Increment 1 — Authorized per HAO-WAVE3-AUTH-001 execution order D-SEQ-W3-001
// Reference: MOD-009 §§4 Core Domain Entities (§§4.1–§4.7), §5 Flow Models, §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO customs law enforcement or regulatory compliance execution (§7.1 No Legal Execution Rule)
// - NO routing optimization, pricing calculation, or dispatch execution (§7.9 Neutrality Rule)
// - NO modification of MOD-003 tracking state directly (§7.9 + §11 Architecture Boundary)
// - All structures are design-time specification artifacts only

/** Border crossing status per MOD-009 §4.2 CrossBorderShipmentSegment */
export enum BorderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
}

/** Shipment segment lifecycle per MOD-009 §4.2, §5.2 Multi-Region Model */
export enum SegmentStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

/** Validation status for border transition events per MOD-009 §4.4 */
export enum ValidationStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED',
}

/** Customs clearance status per MOD-009 §4.4 BorderTransitionEvent */
export enum ClearanceStatus {
  PENDING = 'PENDING',
  PRE_CLEARED = 'PRE_CLEARED',
  CLEARED = 'CLEARED',
  HELD = 'HELD',
}

/** Congestion level for border intelligence per MOD-009 §4.7 */
export enum CongestionLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  SEVERE = 'SEVERE',
}

/** Corridor risk level per MOD-009 §4.3 LogisticsCorridor */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/** Temporary permit availability states per MOD-009 §3.6, §5.4 Permit Flow */
export enum PermitAvailabilityState {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  PENDING_ISSUANCE = 'PENDING_ISSUANCE',
  AT_BORDER_AVAILABLE = 'AT_BORDER_AVAILABLE',
}

/** Compliance checkpoint type per MOD-009 §7.6 Compliance Checkpoint Rule */
export enum ComplianceCheckpointType {
  CUSTOMS_DOCUMENTATION = 'CUSTOMS_DOCUMENTATION',
  VEHICLE_LICENSING = 'VEHICLE_LICENSING',
  DRIVER_AUTHORIZATION = 'DRIVER_AUTHORIZATION',
  CARGO_RESTRICTION = 'CARGO_RESTRICTION',
  INSURANCE_VERIFICATION = 'INSURANCE_VERIFICATION',
}

/** Currency conversion action type per MOD-009 §4.6, §7.5 Currency Specification Rule */
export enum CurrencyConversionAction {
  APPLY_RATE = 'APPLY_RATE',
  STORE_RATE = 'STORE_RATE',
  CONVERT_SETTLEMENT = 'CONVERT_SETTLEMENT',
}

/** Segmentation method for cross-border shipments per MOD-009 §7.2 Segmentation Rule */
export enum SegmentationMethod {
  REGION_TRANSITION = 'REGION_TRANSITION',
  BORDER_CROSSING = 'BORDER_CROSSING',
  JURISDICTION_CHANGE = 'JURISDICTION_CHANGE',
}

/** Corridor assignment method per MOD-009 §7.3 Corridor Assignment Rule */
export enum CorridorAssignmentMethod {
  ORIGIN_DESTINATION_MATCH = 'ORIGIN_DESTINATION_MATCH',
  HISTORICAL_CORRIDOR = 'HISTORICAL_CORRIDOR',
  USER_CONFIRMED = 'USER_CONFIRMED',
}

/** Compliance enforcement level per MOD-009 §7.6 */
export enum EnforcementLevel {
  ADVISORY_ONLY = 'ADVISORY_ONLY',
  FLAG_FOR_REVIEW = 'FLAG_FOR_REVIEW',
  BLOCK_PLANNING = 'BLOCK_PLANNING',
  MOD_010_ENFORCED = 'MOD_010_ENFORCED',
}

/** Event source types for border transitions per MOD-009 §4.4 */
export enum BorderEventSource {
  GPS_GEOFENCE = 'GPS',
  MANUAL_ENTRY = 'MANUAL',
  OSBP_INTEGRATION = 'OSBP_INTEGRATION',
}
