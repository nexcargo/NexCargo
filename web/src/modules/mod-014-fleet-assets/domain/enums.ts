// NexCargo MOD-014 — Asset & Logistics Operations Management Module Local Enums
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-014 §§4–5 Core Domain Entities, Asset Model

import type { VehicleType } from '@/shared/types/enums';
export type { AssetAvailabilityState } from '@/shared/types/enums';

/** Extended vehicle types — adds MOD-014-specific values beyond shared VehicleType */
export type VehicleTypeExtended = `${VehicleType}` | 'HEAVY_TRUCK' | 'LIGHT_DELIVERY' | 'TRAILER' | 'REFRIGERATED' | 'SPECIALISED';

/** Fleet operational status per MOD-014 §4.1 */
export enum FleetOperationalStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** Vehicle registration status per MOD-014 §4.2 */
export enum VehicleRegistrationStatus {
  REGISTERED = 'REGISTERED',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
}

/** Driver certification status per MOD-014 §4.3 */
export enum DriverCertificationStatus {
  VERIFIED = 'VERIFIED',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

/** Asset assignment status per MOD-014 §4.4 */
export enum AssignmentStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Cross-border permit type per MOD-014 §4.5 */
export enum PermitType {
  INSURANCE = 'INSURANCE',
  TRANSPORT_PERMIT = 'TRANSPORT_PERMIT',
  CUSTOMS_BOND = 'CUSTOMS_BOND',
  OPERATING_LICENSE = 'OPERATING_LICENSE',
}

/** Permit status per MOD-014 §4.5 */
export enum PermitStatus {
  VALID = 'VALID',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
}

/** Cross-border permit availability per MOD-014 §4.2 */
export enum CrossBorderPermitStatus {
  NONE = 'NONE',
  TEMPORARY_OBTAINABLE = 'TEMPORARY_OBTAINABLE',
  PRE_EXISTING = 'PRE_EXISTING',
}

/** Backhaul opportunity status per MOD-014 §4.6 */
export enum BackhaulOpportunityStatus {
  IDENTIFIED = 'IDENTIFIED',
  MATCHED = 'MATCHED',
  DECLINED = 'DECLINED',
  BOOKED = 'BOOKED',
}
