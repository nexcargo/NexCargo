// NexCargo I-5 §3A/§4 — Transporter session and membership resolution.
// Same database-resolved contract the Shipper area uses; the Transporter layout gates on
// marketplaceRole === 'TRANSPORTER'.

export {
  getMarketplaceContext as getTransporterContext,
  type MarketplaceContext as TransporterContext,
} from '@/lib/auth/marketplace-session';
