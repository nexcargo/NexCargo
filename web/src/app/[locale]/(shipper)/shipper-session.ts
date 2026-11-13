// NexCargo I-4 — Shipper session and membership resolution.
// The membership gate resolves the role from the database, never from user_metadata or any
// client-supplied role claim (I-4 §3A/§4). I-5 lifted the role-agnostic body into
// @/lib/auth/marketplace-session so the Transporter area resolves identity through the same
// implementation instead of duplicating it; this module keeps the Shipper-facing name and shape.

export {
  getMarketplaceContext as getShipperContext,
  type MarketplaceContext as ShipperContext,
} from '@/lib/auth/marketplace-session';
