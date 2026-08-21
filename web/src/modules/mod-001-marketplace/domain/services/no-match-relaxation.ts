// NexCargo MOD-001 No-Match Relaxation Strategy
// Authorized by HAO-WAVE1-003 — Wave 1 Increment 3: Matching Engine Core
// Per MOD-001 §6.8 — When no transporter passes hard filters

import { ShipmentListing } from '../types/listings';
import { TransportOffer } from '../types/offers';
import { VehicleType } from '@/shared/types/enums';

/**
 * Relaxation step definition.
 * Describes what criteria to relax and in what order.
 */
interface RelaxationStep {
  /** Step number (1–6, per §6.8 relaxation order) */
  step: number;
  /** Human-readable description */
  description: string;
  /** Severity level: LEAST_IMPACTFUL to MOST_IMPACTFUL */
  severity: 'LEAST_IMPACTFUL' | 'MILD' | 'MODERATE' | 'SIGNIFICANT' | 'MAJOR' | 'MOST_IMPACTFUL';
  /** Function that checks if this relaxation step would help */
  check: (listing: ShipmentListing, offers: TransportOffer[]) => boolean;
}

/**
 * Relaxed matching result with explanation.
 */
export interface RelaxationResult {
  /** Whether any relaxation was needed */
  relaxationApplied: boolean;
  /** Which relaxation steps were applied */
  stepsApplied: number[];
  /** Explanation for the user */
  suggestion: string;
  /** Number of offers found after relaxation */
  offerCount: number;
}

/**
 * All relaxation steps in order from least to most impactful.
 * Per MOD-001 §6.8 Relaxation order specification.
 */
const RELAXATION_STEPS: RelaxationStep[] = [
  {
    step: 1,
    description: 'Expand radius (50km → 100km → 200km)',
    severity: 'LEAST_IMPACTFUL',
    check: (_listing, _offers) => true, // Always applicable as conceptual expansion
  },
  {
    step: 2,
    description: 'Relax vehicle type (allow "similar" types)',
    severity: 'MILD',
    check: (listing, offers) => {
      // Check if any offers exist with different vehicle types
      const vehicleTypes = new Set(offers.map((o) => o.vehicleType));
      return vehicleTypes.size > 1 || !vehicleTypes.has(listing.acceptedVehicleTypes[0]);
    },
  },
  {
    step: 3,
    description: 'Relax rating requirements',
    severity: 'MODERATE',
    check: () => true, // Always applicable conceptually
  },
  {
    step: 4,
    description: 'Expand to adjacent corridors',
    severity: 'SIGNIFICANT',
    check: () => true, // Always applicable conceptually
  },
  {
    step: 5,
    description: 'Include transporters without immediate availability (future availability window)',
    severity: 'MAJOR',
    check: () => true, // Always applicable conceptually
  },
  {
    step: 6,
    description: 'Escalate to manual search for urgent/high-value shipments',
    severity: 'MOST_IMPACTFUL',
    check: () => true, // Always applicable as last resort
  },
];

/**
 * Determine which relaxation steps should be suggested.
 * 
 * Per MOD-001 §6.8:
 *   If no transporter passes hard filters:
 *     1. Return empty list with clear explanation
 *     2. Suggest relaxation of optional criteria
 *     3. Optionally expand search radius
 *     4. Notify eligible transporters in broader region
 *     5. For cross-border: notify transporters who can obtain temporary permits
 *     6. Escalate to manual search for urgent/high-value shipments
 * 
 * @param listing - The shipment listing with no matches
 * @param allOffers - All offers considered (before hard filter)
 * @returns Relaxation result with suggestions
 */
export function determineRelaxationStrategy(
  listing: ShipmentListing,
  _allOffers: TransportOffer[],
): RelaxationResult {
  const stepsApplied: number[] = [];
  const suggestions: string[] = [];

  // Step 1: Expand radius
  stepsApplied.push(1);
  suggestions.push('Consider expanding the search radius from 50km to 100km or 200km.');

  // Step 2: Relax vehicle type
  stepsApplied.push(2);
  suggestions.push('Allow similar vehicle types beyond the specified requirements.');

  // Step 3: Relax rating
  stepsApplied.push(3);
  suggestions.push('Reduce minimum rating requirements to increase candidate pool.');

  // Step 4: Expand corridors
  stepsApplied.push(4);
  suggestions.push('Expand search to include adjacent corridors.');

  // Step 5: Future availability
  stepsApplied.push(5);
  suggestions.push('Include transporters with future availability windows.');

  // Step 6: Manual escalation
  stepsApplied.push(6);
  suggestions.push('For urgent or high-value shipments, consider manual search escalation.');

  return {
    relaxationApplied: true,
    stepsApplied,
    suggestion: `No transporters meet current requirements. Recommended actions: ${suggestions.join(' ')}`,
    offerCount: 0,
  };
}

/**
 * Generate a clear explanation message for no-match scenario.
 * 
 * Per MOD-001 §6.8 Step 1: Return empty list with clear explanation.
 * 
 * @param listing - The shipment listing
 * @param hardFilterFailures - Array of which hard filters failed (for detailed explanation)
 * @returns User-friendly explanation message
 */
export function generateNoMatchExplanation(
  listing: ShipmentListing,
  hardFilterFailures?: string[],
): string {
  let message = 'No transporters meet your requirements.';

  if (hardFilterFailures && hardFilterFailures.length > 0) {
    message += `\n\nReasons:\n${hardFilterFailures.map((f) => `  - ${f}`).join('\n')}`;
  }

  message += '\n\nSuggestions:';
  message += '\n  • Relax vehicle type requirements';
  message += '\n  • Expand your search radius';
  message += '\n  • Adjust your time window';
  message += '\n  • Consider alternative cargo classifications';

  return message;
}
