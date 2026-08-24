// NexCargo MOD-001 — Advisory Quote Generation Service
// Authorized by HAO-WAVE1-005 — Wave 1 Increment 5: Match Proposals & Quote Generation
// Per MOD-001 §5.4 (Advisory Quote) — non-binding AI-generated price range suggestion
// 
// Advisory-only: does NOT auto-confirm, trigger financial actions, or create contracts.

import { AdvisoryQuote } from '@/modules/mod-001-marketplace/domain/types/quotes';
import { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';
import { CargoType, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Corridor pricing base rates (SADC context, per MOD-001 §6.2)
// These are implementation-calibrated defaults representing
// typical SADC corridor pricing per weight tier.
// Per MOD-001 §6.4.4: normalization thresholds are implementation details.
// ============================================================

interface CorridorPriceRange {
  /** Minimum price per ton (per trip) */
  minPerTon: number;
  /** Maximum price per ton (per trip) */
  maxPerTon: number;
}

/**
 * Base corridor pricing by cargo type.
 * Represents standard SADC domestic/cross-border corridor rates.
 * These are advisory-only default values, not binding prices.
 */
const CORRIDOR_PRICING: Record<CargoType, CorridorPriceRange | undefined> = {
  [CargoType.GENERAL]: { minPerTon: 80, maxPerTon: 160 },
  [CargoType.REFRIGERATED]: { minPerTon: 150, maxPerTon: 280 },
  [CargoType.HAZARDOUS]: { minPerTon: 200, maxPerTon: 400 },
  [CargoType.OVERSIZED]: { minPerTon: 250, maxPerTon: 500 },
  [CargoType.LIQUID_BULK]: { minPerTon: 40, maxPerTon: 90 },
  [CargoType.GRAIN_BULK]: { minPerTon: 35, maxPerTon: 80 },
  [CargoType.CONSTRUCTION]: { minPerTon: 100, maxPerTon: 200 },
  [CargoType.PERISHABLE]: { minPerTon: 160, maxPerTon: 300 },
  [CargoType.EQUIPMENT]: { minPerTon: 180, maxPerTon: 350 },
  [CargoType.OTHER]: { minPerTon: 70, maxPerTon: 150 },
};

// ============================================================
// Confidence score factors
// ============================================================

interface ConfidenceFactors {
  /** How well-documented the corridor is in historical data */
  corridorDataAvailable: boolean;
  /** Whether comparable offers exist for this cargo type */
  comparableOffersExist: boolean;
  /** Weight/volume completeness */
  listingComplete: boolean;
  /** Time window urgency */
  timeWindowStandard: boolean;
}

/**
 * Computes a confidence score (0–100) for an advisory quote.
 * Higher confidence = more reliable pricing suggestion.
 * 
 * Factors considered:
 * - Corridor data availability (historical pricing matches)
 * - Comparable offer density
 * - Listing data completeness
 * - Time window reasonableness
 */
function computeConfidenceScore(factors: ConfidenceFactors): number {
  let score = 0;
  const totalWeight = 4; // Equal weighting of 4 factors
  
  if (factors.corridorDataAvailable) score += 1;
  if (factors.comparableOffersExist) score += 1;
  if (factors.listingComplete) score += 1;
  if (factors.timeWindowStandard) score += 1;
  
  return Math.round((score / totalWeight) * 100);
}

/**
 * Determines if a time window is within standard delivery range.
 * Standard range: 2-14 days between pickup and delivery.
 */
function isTimeWindowStandard(timeWindow: ShipmentListing['timeWindow']): boolean {
  const earliestPickup = new Date(timeWindow.earliestPickup).getTime();
  const latestDelivery = new Date(timeWindow.latestDelivery).getTime();
  const daysDiff = (latestDelivery - earliestPickup) / (1000 * 60 * 60 * 24);
  return daysDiff >= 2 && daysDiff <= 14;
}

/**
 * Generates an advisory quote for a shipment listing.
 * 
 * Per MOD-001 §5.4:
 * - Non-binding price range suggestion
 * - Based on corridor data, historical pricing, market trends
 * - Advisory only — does NOT auto-confirm a booking
 * 
 * Pricing model:
 * - Uses corridor base rates × weight factor
 * - Adjusted by time window urgency premium/discount
 * - Range reflects market variability (min/max)
 * 
 * @param listing - Partial listing data needed for pricing
 * @param comparableOffers - Optional list of offers for market benchmarking
 * @returns AdvisoryQuote data object (without BaseEntity persistence fields)
 */
export function generateAdvisoryQuote(
  listing: Pick<ShipmentListing, 'cargoType' | 'weightKg' | 'volumeM3' | 'timeWindow' | 'pricingModel'>,
  comparableOffers?: TransportOffer[],
): Omit<AdvisoryQuote, 'id' | 'created_at' | 'updated_at' | 'version' | 'bumpVersion' | 'toJSON' | 'listingId'> {
  const { cargoType, weightKg, volumeM3, timeWindow, pricingModel } = listing;

  // Validate inputs
  if (!cargoType) {
    throw new ValidationError('cargoType is required for quote generation');
  }
  if (!weightKg || weightKg <= 0) {
    throw new ValidationError('Valid weightKg (>0) is required for quote generation');
  }

  // Get corridor pricing for cargo type
  const pricing = CORRIDOR_PRICING[cargoType];
  if (!pricing) {
    throw new ValidationError(`Unknown cargo type: ${cargoType}`);
  }

  // Convert weight to tons for pricing calculation
  const weightTons = weightKg / 1000;

  // Calculate base price range from corridor rates
  const baseMin = pricing.minPerTon * weightTons;
  const baseMax = pricing.maxPerTon * weightTons;

  // Apply time window urgency adjustment
  let urgencyMultiplier = 1.0;
  const earliestPickup = new Date(timeWindow.earliestPickup).getTime();
  const now = Date.now();
  const daysUntilPickup = (earliestPickup - now) / (1000 * 60 * 60 * 24);

  // Urgency surcharge: less than 48 hours = +25%, less than 7 days = +15%
  if (daysUntilPickup <= 2) {
    urgencyMultiplier = 1.25;
  } else if (daysUntilPickup <= 7) {
    urgencyMultiplier = 1.15;
  }

  // Volume override: if volume specified but volumetric weight exceeds actual weight
  let priceMin = baseMin * urgencyMultiplier;
  let priceMax = baseMax * urgencyMultiplier;

  if (volumeM3 && volumeM3 > 0) {
    // Freight pricing typically uses volumetric weight: volume_m3 * 167 kg/m3
    const volumetricWeightKg = volumeM3 * 167;
    if (volumetricWeightKg > weightKg) {
      // Charge based on volumetric weight instead
      const volTons = volumetricWeightKg / 1000;
      priceMin = pricing.minPerTon * volTons * urgencyMultiplier;
      priceMax = pricing.maxPerTon * volTons * urgencyMultiplier;
    }
  }

  // Apply pricing model adjustments
  // For negotiated pricing, widen the range to reflect flexibility
  if (pricingModel === PricingModel.NEGOTIATED) {
    priceMin *= 0.85;
  }

  // Market benchmark adjustment from comparable offers (if available)
  if (comparableOffers && comparableOffers.length > 0) {
    const avgPrice = comparableOffers.reduce((sum, o) => sum + o.priceProposal, 0) / comparableOffers.length;
    // Blend corridor pricing with market average (60% corridor, 40% market)
    const blendedMin = (priceMin * 0.6) + (avgPrice * 0.4);
    const blendedMax = (priceMax * 0.6) + (avgPrice * 0.4);
    
    // Ensure min doesn't exceed max
    if (blendedMin > blendedMax) {
      return {
        quoteId: generateQuoteId(),
        suggestedPriceMin: Math.round(blendedMax * 0.9),
        suggestedPriceMax: Math.round(blendedMax),
        confidenceScore: computeConfidence({ comparableOffers, listing }),
        basis: `market_benchmark_blend_corridor_${cargoType}`,
      };
    }

    priceMin = blendedMin;
    priceMax = blendedMax;
  }

  return {
    quoteId: generateQuoteId(),
    suggestedPriceMin: Math.round(priceMin),
    suggestedPriceMax: Math.round(priceMax),
    confidenceScore: computeConfidence({ comparableOffers, listing }),
    basis: `corridor_pricing_${cargoType.toLowerCase()}`,
  };
}

interface ComputeConfidenceParams {
  comparableOffers?: TransportOffer[];
  listing: Pick<ShipmentListing, 'cargoType' | 'weightKg' | 'volumeM3' | 'timeWindow'>;
}

function computeConfidence(params: ComputeConfidenceParams): number {
  const { comparableOffers, listing } = params;

  const factors: ConfidenceFactors = {
    corridorDataAvailable: CORRIDOR_PRICING[listing.cargoType] !== undefined,
    comparableOffersExist: !!comparableOffers && comparableOffers.length >= 2,
    listingComplete: !!(listing.volumeM3 && listing.volumeM3 > 0),
    timeWindowStandard: isTimeWindowStandard(listing.timeWindow),
  };

  return computeConfidenceScore(factors);
}

/**
 * Generates a unique quote ID.
 * In production, this would use a proper UUID generator.
 */
function generateQuoteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `quote-${timestamp}-${random}`;
}
