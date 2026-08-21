// NexCargo MOD-001 Hard Filters — Mandatory (Hard) Filter Predicates
// Authorized by HAO-WAVE1-003 — Wave 1 Increment 3: Matching Engine Core
// Per MOD-001 §6.4.1 — If any of these fail, the transporter is never considered

import { CargoType } from '../enums';
import { VehicleType } from '@/shared/types/enums';
import { ShipmentListing } from '../types/listings';
import { TransportOffer } from '../types/offers';

/**
 * Filter 1: Vehicle type matches cargo type.
 * A flatbed cannot carry refrigerated cargo; specialized vehicles required for hazardous materials.
 * 
 * @param listing - The shipment listing
 * @param offer - The transport offer
 * @returns true if vehicle type is compatible with cargo type
 */
export function filterVehicleCargoMatch(listing: ShipmentListing, offer: TransportOffer): boolean {
  // Refrigerated cargo requires refrigerated vehicle
  if (listing.cargoType === CargoType.REFRIGERATED && offer.vehicleType !== VehicleType.REFRIGERATED) {
    return false;
  }

  // Hazardous cargo requires specialised vehicle
  if (listing.cargoType === CargoType.HAZARDOUS && offer.vehicleType !== VehicleType.SPECIALISED) {
    return false;
  }

  // Oversized cargo requires specialised vehicle
  if (listing.cargoType === CargoType.OVERSIZED && offer.vehicleType !== VehicleType.SPECIALISED) {
    return false;
  }

  // Liquid bulk and grain bulk require specialised vehicle
  if ((listing.cargoType === CargoType.LIQUID_BULK || listing.cargoType === CargoType.GRAIN_BULK) && offer.vehicleType !== VehicleType.SPECIALISED) {
    return false;
  }

  // Construction equipment typically requires heavy truck or trailer
  if (listing.cargoType === CargoType.CONSTRUCTION && 
      offer.vehicleType !== VehicleType.HEAVY_TRUCK && 
      offer.vehicleType !== VehicleType.TRAILER) {
    return false;
  }

  // General cargo can use any vehicle type
  if (listing.cargoType === CargoType.GENERAL) {
    return true;
  }

  // Perishable cargo typically requires refrigerated or light delivery
  if (listing.cargoType === CargoType.PERISHABLE && 
      offer.vehicleType !== VehicleType.REFRIGERATED && 
      offer.vehicleType !== VehicleType.LIGHT_DELIVERY) {
    return false;
  }

  // Equipment typically requires heavy truck or trailer
  if (listing.cargoType === CargoType.EQUIPMENT && 
      offer.vehicleType !== VehicleType.HEAVY_TRUCK && 
      offer.vehicleType !== VehicleType.TRAILER) {
    return false;
  }

  return true;
}

/**
 * Filter 2: Vehicle capacity >= shipment weight.
 * Cannot exceed physical weight limits.
 * 
 * @param listing - The shipment listing
 * @param offer - The transport offer
 * @returns true if declared capacity meets or exceeds shipment weight
 */
export function filterWeightCapacity(listing: ShipmentListing, offer: TransportOffer): boolean {
  return offer.declaredCapacity.maxWeightKg >= listing.weightKg;
}

/**
 * Filter 3: Vehicle volume >= shipment volume.
 * Cannot exceed physical volume limits.
 * 
 * Note: Volume is optional per §5.1 — only checked when listing has volume specified.
 * 
 * @param listing - The shipment listing
 * @param offer - The transport offer
 * @returns true if declared volume capacity meets or exceeds shipment volume (when volume is specified)
 */
export function filterVolumeCapacity(listing: ShipmentListing, offer: TransportOffer): boolean {
  // Volume is optional in §5.1 — skip check if not specified
  if (!listing.volumeM3) {
    return true;
  }

  const offerVolume = offer.declaredCapacity.maxVolumeM3 ?? Infinity;
  return offerVolume >= listing.volumeM3;
}

/**
 * Filter 4: Pickup date falls within transporter availability.
 * Transporter must be available on that date.
 * 
 * @param listing - The shipment listing
 * @param offer - The transport offer
 * @returns true if listing pickup date is within transporter's availability window
 */
export function filterPickupAvailability(listing: ShipmentListing, offer: TransportOffer): boolean {
  const pickupDate = new Date(listing.timeWindow.earliestPickup);
  const latestPickup = new Date(offer.availabilityWindow.latestPickup);

  return pickupDate <= latestPickup;
}

/**
 * Filter 5: Delivery deadline is achievable.
 * Transporter must be able to meet the deadline.
 * 
 * @param listing - The shipment listing
 * @param offer - The transport offer
 * @returns true if listing delivery deadline is within transporter's estimated delivery
 */
export function filterDeliveryDeadline(listing: ShipmentListing, offer: TransportOffer): boolean {
  const deliveryDeadline = new Date(listing.timeWindow.latestDelivery);
  const estimatedDelivery = new Date(offer.availabilityWindow.estimatedDelivery);

  // Transporter must be able to deliver ON OR BEFORE the deadline
  return estimatedDelivery <= deliveryDeadline;
}

/**
 * Filter 6: Account is active (not suspended).
 * Platform-level ban check.
 * 
 * This is a stub predicate — actual account status would come from MOD-010 KYC/KYB data.
 * For development, we assume accounts are active unless explicitly marked otherwise.
 * 
 * @param offer - The transport offer
 * @param isActive - Whether the transporter's account is active (injected from MOD-010)
 * @returns true if account is active
 */
export function filterAccountActive(offer: TransportOffer, isActive: boolean = true): boolean {
  return isActive;
}

/**
 * Filter 7: Licences are valid and unexpired.
 * Legal operation required.
 * 
 * This is a stub predicate — actual licence validity would come from MOD-010 verification data.
 * For development, we assume licences are valid unless explicitly marked otherwise.
 * 
 * @param offer - The transport offer
 * @param licencesValid - Whether the transporter's licences are valid (injected from MOD-010)
 * @returns true if licences are valid
 */
export function filterLicencesValid(offer: TransportOffer, licencesValid: boolean = true): boolean {
  return licencesValid;
}

/**
 * Run all 7 mandatory hard filters.
 * Returns array of offers that pass ALL filters.
 * 
 * @param listing - The shipment listing
 * @param offers - Array of transport offers to evaluate
 * @param accountStatus - Map of transporterId → account active status (from MOD-010)
 * @param licenceStatus - Map of transporterId → licences valid status (from MOD-010)
 * @returns Offers that pass all hard filters
 */
export function runHardFilters(
  listing: ShipmentListing,
  offers: TransportOffer[],
  accountStatus?: Record<string, boolean>,
  licenceStatus?: Record<string, boolean>,
): TransportOffer[] {
  return offers.filter((offer) => {
    const isActive = accountStatus?.[offer.transporterId] ?? true;
    const isLicensed = licenceStatus?.[offer.transporterId] ?? true;

    return (
      filterVehicleCargoMatch(listing, offer) &&
      filterWeightCapacity(listing, offer) &&
      filterVolumeCapacity(listing, offer) &&
      filterPickupAvailability(listing, offer) &&
      filterDeliveryDeadline(listing, offer) &&
      filterAccountActive(offer, isActive) &&
      filterLicencesValid(offer, isLicensed)
    );
  });
}
