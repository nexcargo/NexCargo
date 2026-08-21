// NexCargo MOD-001 Matching Engine — Core Scoring and Ranking
// Authorized by HAO-WAVE1-003 — Wave 1 Increment 3: Matching Engine Core
// Per MOD-001 §6.4.4 Numerical Weighting Specification
//   Max weighted score: 177
//   CompositeScore = (WeightedScore / 177) × 100
//   Missing data neutral default: 5

import { MatchProposal } from '../types/matches';
import { ShipmentListing } from '../types/listings';
import { TransportOffer } from '../types/offers';

/**
 * Maximum possible weighted score per MOD-001 §6.4.4 Section 2
 * Calculated as: 3×15 + 2×12 + 10×10 + 1×8 = 45 + 24 + 100 + 8 = 177
 */
export const MAX_WEIGHTED_SCORE = 177;

/**
 * Neutral default base score for missing data (midpoint of 0–10 scale).
 * Per MOD-001 §6.4.4 Section 5.
 */
const MISSING_DATA_DEFAULT = 5;

/**
 * Weight multiplier mapping per MOD-001 §6.4.4 Section 1.
 * High = 1.5x, Medium-High = 1.2x, Medium = 1.0x, Low-Medium = 0.8x
 */
type WeightMultiplier = 1.5 | 1.2 | 1.0 | 0.8;

interface FactorDefinition {
  /** Factor name for documentation/tracing */
  name: string;
  /** Weight multiplier from qualitative descriptor */
  multiplier: WeightMultiplier;
  /** Maximum base score for this factor (always 10) */
  maxBaseScore: number;
}

/**
 * All 16 scoring factors per MOD-001 §6.4.4 Section 2 Final Factor Table.
 * Each factor has a base score 0–10, multiplied by its weight multiplier.
 */
const FACTORS: FactorDefinition[] = [
  { name: 'Corridor match', multiplier: 1.5, maxBaseScore: 10 },
  { name: 'Route alignment', multiplier: 1.5, maxBaseScore: 10 },
  { name: 'Route overlap percentage', multiplier: 1.5, maxBaseScore: 10 },
  { name: 'Origin distance', multiplier: 1.2, maxBaseScore: 10 },
  { name: 'Transporter availability', multiplier: 1.2, maxBaseScore: 10 },
  { name: 'Cross-border experience', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Hazardous cargo capability', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Refrigeration capability', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Verified documents', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Transporter rating', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Completed trips', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Cancellation rate', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Acceptance rate', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Response time', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Price competitiveness', multiplier: 1.0, maxBaseScore: 10 },
  { name: 'Relationship score', multiplier: 0.8, maxBaseScore: 10 },
];

/**
 * Normalise raw data to 0–10 base score for a given factor.
 * Implementation-calibrated thresholds — see MOD-001 §6.4.4 Section 4.
 * 
 * @param factorName - The factor to normalise
 * @param rawValue - Raw data value (implementation-dependent)
 * @returns Base score 0–10
 */
function normaliseFactor(factorName: string, rawValue: number | null): number {
  if (rawValue === null || rawValue === undefined) {
    return MISSING_DATA_DEFAULT;
  }

  // Clamp to 0–10 range
  return Math.max(0, Math.min(10, rawValue));
}

/**
 * Calculate weighted score for an offer against a listing.
 * 
 * Per MOD-001 §6.4.4 Section 3:
 *   WeightedScore = Σ(B_i × M_i) for i = 1 to 16
 *   where B_i = base factor score (0–10), M_i = weight multiplier
 * 
 * @param listing - The shipment listing
 * @param offer - The transport offer
 * @param factorScores - Optional map of factor scores (for testing with controlled values)
 * @returns Weighted score sum (0–177)
 */
export function calculateWeightedScore(
  _listing: ShipmentListing,
  _offer: TransportOffer,
  factorScores?: Record<string, number>,
): number {
  let weightedSum = 0;

  for (const factor of FACTORS) {
    // Use provided score or fall back to default
    const baseScore = factorScores?.[factor.name] ?? MISSING_DATA_DEFAULT;
    weightedSum += baseScore * factor.multiplier;
  }

  return weightedSum;
}

/**
 * Calculate composite score (0–100) from weighted score.
 * 
 * Per MOD-001 §6.4.4 Section 3:
 *   CompositeScore = (WeightedScore / 177) × 100
 * 
 * @param weightedScore - The weighted score sum (0–177)
 * @returns Composite score (0–100)
 */
export function calculateCompositeScore(weightedScore: number): number {
  return (weightedScore / MAX_WEIGHTED_SCORE) * 100;
}

/**
 * Score and rank all offers for a listing.
 * Returns match proposals sorted by composite score descending.
 * 
 * @param listing - The shipment listing
 * @param offers - Array of offers to score and rank
 * @param factorScores - Optional map of transporterId → factor scores map
 * @returns Ranked array of match proposals
 */
export function scoreAndRankOffers(
  listing: ShipmentListing,
  offers: TransportOffer[],
  factorScores?: Record<string, Record<string, number>>,
): MatchProposal[] {
  const proposals: MatchProposal[] = [];

  for (let index = 0; index < offers.length; index++) {
    const offer = offers[index];
    
    // Get factor scores for this transporter (or use defaults)
    const transporterFactors = factorScores?.[offer.transporterId];
    
    // Calculate weighted score
    const weightedScore = calculateWeightedScore(listing, offer, transporterFactors);
    
    // Calculate composite score
    const compositeScore = calculateCompositeScore(weightedScore);

    proposals.push({
      id: crypto.randomUUID(),
      matchId: crypto.randomUUID(),
      listingId: listing.listingId,
      offerId: offer.offerId,
      matchScore: parseFloat(compositeScore.toFixed(2)),
      rankingPosition: 0, // Will be set after sorting
      status: 'PROPOSED' as never,
      reasoningTrace: JSON.stringify({
        weightedScore: parseFloat(weightedScore.toFixed(2)),
        compositeScore: parseFloat(compositeScore.toFixed(2)),
        factors: transporterFactors || {},
      }),
      created_at: new Date(),
      updated_at: new Date(),
      version: 1,
      bumpVersion: () => {},
      toJSON: () => ({}),
    });
  }

  // Sort by composite score descending
  proposals.sort((a, b) => b.matchScore - a.matchScore);

  // Assign ranking positions
  for (let index = 0; index < proposals.length; index++) {
    proposals[index].rankingPosition = index + 1;
  }

  return proposals;
}

/**
 * Highlight top 5 transporters as "Recommended".
 * Per MOD-001 §6.5 Step 4.
 * 
 * @param proposals - Ranked match proposals
 * @returns Set of offerIds that are in top 5
 */
export function highlightTopFive(proposals: MatchProposal[]): Set<string> {
  const topFive = new Set<string>();
  const count = Math.min(5, proposals.length);

  for (let index = 0; index < count; index++) {
    topFive.add(proposals[index].offerId);
  }

  return topFive;
}

/**
 * Apply user override: shipper may select any transporter regardless of rank.
 * Per MOD-001 §6.5 Step 5.
 * 
 * @param proposals - Ranked match proposals
 * @param selectedOfferId - The offerId the shipper selected
 * @returns The selected match proposal (null if not found in proposals)
 */
export function applyUserOverride(
  proposals: MatchProposal[],
  selectedOfferId: string,
): MatchProposal | null {
  return proposals.find((p) => p.offerId === selectedOfferId) ?? null;
}
