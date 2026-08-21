// NexCargo MOD-001 AdvisoryQuote Type Definition
// Authorized by HAO-WAVE1-001 — Wave 1 Increment 1: Domain Foundations
// Per MOD-001 §5.4

import { BaseEntity } from '@/shared/base-classes/base-entity';

/**
 * Advisory Quote — an AI-generated, non-binding price recommendation for a listing.
 * 
 * Business rules (MOD-001 §5.4):
 *   - The quote is advisory only — it does not auto-confirm a booking
 *   - The quote respects defined corridor pricing boundaries (if provided by external reference data)
 *   - The quote is visible to the shipper alongside the listing
 */
export interface AdvisoryQuote extends BaseEntity {
  /** Unique identifier for this quote */
  quoteId: string;

  /** The listing this quote references */
  listingId: string;

  /** Suggested minimum price */
  suggestedPriceMin: number;

  /** Suggested maximum price */
  suggestedPriceMax: number;

  /** Confidence in the price range suggestion (0–100) */
  confidenceScore: number;

  /**
   * Reference to the basis for this quote:
   * corridor data, historical pricing, or market trends.
   */
  basis: string;
}
