// NexCargo I-5 §5 — shared presentation helpers for the Transporter screens.
// The Intl formatters and the offer/booking status vocabularies are the ones I-4 delivered, so they are
// re-exported rather than copied. What is added here is the MOD-014 asset vocabulary, which has no
// Shipper equivalent. Framework-free so both Server and Client Components can import it.

export {
  formatDate,
  formatDateTime,
  formatMoney,
  formatWeight,
  toDateTimeLocalValue,
  offerStatusVariant,
  bookingStatusVariant,
  type BadgeVariant,
} from '../(shipper)/presentation';

import type { BadgeVariant } from '../(shipper)/presentation';

/** MOD-014 §4.1 FleetOperationalStatus */
const FLEET_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'danger',
};

/** MOD-014 AssetAvailabilityState (vehicles) */
const VEHICLE_STATE_VARIANT: Record<string, BadgeVariant> = {
  AVAILABLE: 'success',
  ASSIGNED: 'info',
  MAINTENANCE: 'warning',
  INACTIVE: 'neutral',
  SUSPENDED: 'danger',
};

/** MOD-014 §4.3 DriverCertificationStatus */
const DRIVER_CERTIFICATION_VARIANT: Record<string, BadgeVariant> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  EXPIRED: 'danger',
  SUSPENDED: 'danger',
};

/** MOD-014 AssetAvailabilityState (drivers) */
const DRIVER_AVAILABILITY_VARIANT: Record<string, BadgeVariant> = {
  AVAILABLE: 'success',
  ASSIGNED: 'info',
  OFF_DUTY: 'neutral',
  UNAVAILABLE: 'danger',
};

/** MOD-014 §4.4 AssignmentStatus */
const ASSIGNMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PLANNED: 'info',
  ACTIVE: 'success',
  COMPLETED: 'default',
  CANCELLED: 'neutral',
};

/** MOD-014 §4.2 CrossBorderPermitStatus */
const PERMIT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NONE: 'neutral',
  TEMPORARY_OBTAINABLE: 'warning',
  PRE_EXISTING: 'success',
};

/** ShipmentStatus (shared/types/enums) — the vocabulary `shipment_tracking_records.status` uses. */
const TRACKING_STATUS_VARIANT: Record<string, BadgeVariant> = {
  CREATED: 'neutral',
  BOOKED: 'info',
  AWAITING_PICKUP: 'warning',
  PICKUP_ACKNOWLEDGED: 'info',
  IN_TRANSIT: 'info',
  AT_BORDER: 'warning',
  DELAYED: 'danger',
  DELIVERED: 'success',
  COMPLETED: 'default',
  CANCELLED: 'neutral',
};

export function trackingStatusVariant(status: string): BadgeVariant {
  return TRACKING_STATUS_VARIANT[status] ?? 'neutral';
}

/**
 * `contracts.acceptance_status` is written by confirm_booking_with_contract (DRAFT) and
 * accept_and_finalize_contract (ACTIVE). The shared ContractStatus enum lists further states that no
 * live code path writes, so an unrecognised value is shown verbatim rather than given an invented label.
 */
const CONTRACT_STATUS_KEYS = ['DRAFT', 'ACTIVE'];

export function contractStatusLabelKey(status: string): string | null {
  return CONTRACT_STATUS_KEYS.includes(status) ? `contract_status_${status}` : null;
}

export function contractStatusVariant(status: string): BadgeVariant {
  return status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'warning' : 'neutral';
}

/** MOD-004 §4.1 document types — the shared set plus the MOD-004 extensions. */
const DOCUMENT_TYPES = [
  'CONTRACT', 'POD', 'BILL_OF_LADING', 'CUSTOMS_DOCUMENT', 'VEHICLE_REGISTRATION', 'DRIVER_LICENSE',
  'INSURANCE_CERTIFICATE', 'INVOICE', 'COMPLIANCE', 'SHIPPING_MANIFEST', 'DELIVERY_ORDER',
  'OPERATING_LICENSE', 'COMPLIANCE_CERTIFICATE',
];

/** MOD-004 §4.1 DocumentStatus. */
const DOCUMENT_STATUSES = [
  'UPLOADED', 'VALIDATED', 'ACTIVE', 'REVIEW', 'SIGNED', 'APPROVED', 'REJECTED', 'EXPIRING', 'EXPIRED',
  'RENEWED', 'ARCHIVED',
];

// Neither column carries a CHECK constraint, so an unexpected stored value is shown verbatim instead of
// asking next-intl for a key that does not exist.
export function documentTypeLabelKey(type: string): string | null {
  return DOCUMENT_TYPES.includes(type) ? `document_type_${type}` : null;
}

export function documentStatusLabelKey(status: string): string | null {
  return DOCUMENT_STATUSES.includes(status) ? `document_status_${status}` : null;
}

export function fleetStatusVariant(status: string): BadgeVariant {
  return FLEET_STATUS_VARIANT[status] ?? 'neutral';
}

export function vehicleStateVariant(state: string): BadgeVariant {
  return VEHICLE_STATE_VARIANT[state] ?? 'neutral';
}

export function driverCertificationVariant(status: string): BadgeVariant {
  return DRIVER_CERTIFICATION_VARIANT[status] ?? 'neutral';
}

export function driverAvailabilityVariant(state: string): BadgeVariant {
  return DRIVER_AVAILABILITY_VARIANT[state] ?? 'neutral';
}

export function assignmentStatusVariant(status: string): BadgeVariant {
  return ASSIGNMENT_STATUS_VARIANT[status] ?? 'neutral';
}

export function permitStatusVariant(status: string): BadgeVariant {
  return PERMIT_STATUS_VARIANT[status] ?? 'neutral';
}

/** MOD-014 §4.2 vehicle types — the values `logistics_schema.vehicles.type` accepts. */
export const VEHICLE_TYPES = ['HEAVY_TRUCK', 'LIGHT_DELIVERY', 'TRAILER', 'REFRIGERATED', 'SPECIALISED'] as const;

/** MOD-014 availability states a Transporter may set on its own vehicle. */
export const VEHICLE_AVAILABILITY_STATES = ['AVAILABLE', 'ASSIGNED', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED'] as const;

export const DRIVER_CERTIFICATION_STATUSES = ['VERIFIED', 'PENDING', 'EXPIRED', 'SUSPENDED'] as const;

export const DRIVER_AVAILABILITY_STATES = ['AVAILABLE', 'ASSIGNED', 'OFF_DUTY', 'UNAVAILABLE'] as const;

export const PERMIT_STATUSES = ['NONE', 'TEMPORARY_OBTAINABLE', 'PRE_EXISTING'] as const;

export const FLEET_OPERATIONAL_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
