// NexCargo I-5 §3E — opportunity eligibility derived from the Transporter's OWN available fleet.
// The verdict is MOD-001 §6.4.1 applied to the transporter's vehicles, not a second matching engine:
// the stored listing and each vehicle capability are both rebuilt through the sanctioned domain mapper
// before the canonical hard-filter predicates run.
//
// Filters 1–3 (vehicle/cargo compatibility, weight, volume) are answerable now. Filters 4–5 compare the
// listing's time window against the availability window the Transporter proposes *with* the quotation, so
// they are evaluated at submission/matching time; filters 6–7 are MOD-010 stubs with no data source here.

import {
  filterVehicleCargoMatch,
  filterVolumeCapacity,
  filterWeightCapacity,
} from '@/modules/mod-001-marketplace/domain/services/hard-filters';
import {
  toShipmentListing,
  toTransportOffer,
} from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import type { ListingApiShape } from '@/infrastructure/repositories/listings-repository';
import type { VehicleApiShape } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';

/**
 * The transporter's vehicles whose type and declared capacity satisfy a published listing.
 * An empty result means the shipment is outside this fleet's current capability.
 */
export function vehiclesThatFit(listingRow: ListingApiShape, vehicles: VehicleApiShape[]): VehicleApiShape[] {
  const listing = toShipmentListing(listingRow);
  return vehicles.filter((vehicle) => {
    const capability = toTransportOffer(candidateOffer(vehicle));
    return (
      filterVehicleCargoMatch(listing, capability) &&
      filterWeightCapacity(listing, capability) &&
      filterVolumeCapacity(listing, capability)
    );
  });
}

/**
 * A fleet vehicle expressed as the shape the domain mapper consumes. It is never persisted: the
 * offer row itself is created only when the Transporter submits a quotation.
 */
function candidateOffer(vehicle: VehicleApiShape): Parameters<typeof toTransportOffer>[0] {
  const now = new Date().toISOString();
  return {
    offerId: vehicle.vehicleId,
    transporterId: vehicle.createdBy,
    listingId: '',
    priceProposal: 0,
    availabilityWindow: {},
    vehicleType: vehicle.type,
    declaredCapacity: { maxWeightKg: vehicle.capacityWeightKg, maxVolumeM3: vehicle.capacityVolumeM3 },
    status: 'SUBMITTED',
    notes: undefined,
    createdAt: now,
    updatedAt: now,
  };
}
