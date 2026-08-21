// NexCargo MOD-001 Marketplace Domain Enums
// Authorized by HAO-WAVE1-001 — Wave 1 Increment 1: Domain Foundations
// Per MOD-001 specification §§3.2, 5.1–5.4

/**
 * Listing lifecycle states per MOD-001 §3.2
 * DRAFT → PUBLISHED → EXPIRED | CANCELLED | BOOKED → COMPLETED
 */
export enum ListingStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
}

/**
 * Offer lifecycle states per MOD-001 §3.2
 * SUBMITTED ↔ WITHDRAWN | ACCEPTED | REJECTED | EXPIRED
 */
export enum OfferStatus {
  SUBMITTED = 'SUBMITTED',
  WITHDRAWN = 'WITHDRAWN',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/**
 * Match proposal states per MOD-001 §3.2
 * PROPOSED → ACCEPTED | REJECTED
 */
export enum MatchStatus {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

/**
 * Pricing models per MOD-001 §5.1
 */
export enum PricingModel {
  FIXED = 'FIXED',
  AUCTION = 'AUCTION',
  NEGOTIATED = 'NEGOTIATED',
}

/**
 * Cargo types per MOD-001 §5.1
 * Aligned with MOD-014 vehicle-cargo compatibility rules (§6.4.1 hard filter).
 */
export enum CargoType {
  GENERAL = 'GENERAL',
  REFRIGERATED = 'REFRIGERATED',
  HAZARDOUS = 'HAZARDOUS',
  OVERSIZED = 'OVERSIZED',
  LIQUID_BULK = 'LIQUID_BULK',
  GRAIN_BULK = 'GRAIN_BULK',
  CONSTRUCTION = 'CONSTRUCTION',
  PERISHABLE = 'PERISHABLE',
  EQUIPMENT = 'EQUIPMENT',
  OTHER = 'OTHER',
}
