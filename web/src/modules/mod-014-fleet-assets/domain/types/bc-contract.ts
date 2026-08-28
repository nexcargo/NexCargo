// NexCargo MOD-014 — MOD-014 BC Coordination Contracts (Design-Time)
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-014 §8 Event Model, §9 Integration Boundaries
//
// D-S2B-002 condition applied: corridorId:string is a provisional design-time assumption
// for the bidirectional BC coupling with MOD-009. No BC stabilization review at this time.
//
// Governance note: These are design-time data contracts only. No runtime event emission mechanism.

/**
 * AssetCapacityAvailableSignal — Signal from MOD-014 to MOD-001 when assets become available.
 * CONSUMED BY MOD-001 from MOD-014 outputs.
 * Per MOD-014 §8: "AssetReleased consumed by MOD-001 → marketplace capacity visibility."
 */
export interface AssetCapacityAvailableSignal {
  /** The vehicle becoming available */
  vehicleId: string;
  /** Fleet reference */
  fleetId: string;
  /** Vehicle type */
  vehicleType: string;
  /** Declared weight capacity in kg */
  capacityWeight: number;
  /** Declared volume capacity in cubic metres */
  capacityVolume?: number;
  /** ISO 8601 timestamp of availability */
  availableFrom: string;
  /** Expected availability end (optional) */
  availableUntil?: string;
}

/**
 * AssignmentValidationRequest — Request from MOD-002 to validate asset assignment.
 * PRODUCED BY MOD-002, CONSUMED BY MOD-014.
 * Per MOD-014 §8: "AssetAssigned consumed by MOD-002 → assignment validation."
 */
export interface AssignmentValidationRequest {
  /** Contract being validated */
  contractId: string;
  /** Booking reference */
  bookingId: string;
  /** Suggested vehicle ID */
  suggestedVehicleId: string;
  /** Suggested driver ID */
  suggestedDriverId: string;
  /** Requested start time */
  requestedStartTime: string; // ISO 8601
}

/**
 * AssignmentValidationResult — Result from MOD-014 after validating asset assignment.
 * CONSUMED BY MOD-002 from MOD-014 outputs.
 * Per MOD-014 §7.3: "No double-booking of vehicles or drivers is permitted."
 */
export interface AssignmentValidationResult {
  /** Whether the assignment is valid */
  isValid: boolean;
  /** Reason if invalid (e.g., "vehicle already assigned", "driver not certified") */
  rejectionReason?: string;
  /** Confirmed vehicle details if valid */
  confirmedVehicleId?: string;
  /** Confirmed driver details if valid */
  confirmedDriverId?: string;
}

/**
 * CrossBorderComplianceDeclaration — Compliance data shared between MOD-014 and MOD-009.
 * BILATERAL DESIGN-TIME CONTRACT for MOD-014 ↔ MOD-009 bidirectional BC relationship.
 * Per MOD-014 §4.5 / §7.5: Vehicles must meet country-specific regulatory requirements.
 *
 * D-S2B-002 CONDITION: Both sides use corridorId:string as a provisional assumption.
 * No structured corridor types imported from MOD-009. Reconciling review deferred to MOD-009 Wave 4.
 */
export interface CrossBorderComplianceDeclaration {
  /** Vehicle identifier */
  vehicleId: string;
  /** Corridor identifier — string type per D-S2B-002 provisional assumption */
  corridorId: string;
  /** List of required permits for this corridor */
  requiredPermits: string[];
  /** List of submitted permit numbers */
  submittedPermits: string[];
  /** Overall compliance status */
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  /** Last updated timestamp */
  lastUpdated: string; // ISO 8601
}

/**
 * FleetAnalyticsReport — Data shape for fleet analytics consumption.
 * PRODUCED BY MOD-014, CONSUMED BY MOD-012.
 * Per MOD-014 §8: "FleetRegistered/VehicleAddedToFleet/DriverRegistered consumed by MOD-012 → fleet analytics."
 */
export interface FleetAnalyticsReport {
  /** Total fleets registered */
  totalFleets: number;
  /** Total vehicles across all fleets */
  totalVehicles: number;
  /** Total drivers registered */
  totalDrivers: number;
  /** Average utilisation percentage */
  averageUtilisation: number;
  /** Report generation timestamp */
  generatedAt: string; // ISO 8601
}
