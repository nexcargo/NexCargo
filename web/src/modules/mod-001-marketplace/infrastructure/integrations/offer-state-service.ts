// NexCargo MOD-001 — Offer State Machine Service
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Provides offer-specific state transition validation for API routes.

import { OfferStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyOfferTransition, isOfferTerminal } from '@/modules/mod-001-marketplace/domain/services/offer-state-machine';

/**
 * Validates and applies an offer state transition.
 * Used by API routes to enforce state machine constraints.
 * 
 * @param currentStatus - Current offer status
 * @param targetStatus - Desired new status
 * @returns { newStatus, isTerminal } result object
 */
export function validateAndApplyOfferTransition(
  currentStatus: OfferStatus,
  targetStatus: OfferStatus,
): { newStatus: OfferStatus; isTerminal: boolean } {
  const newStatus = applyOfferTransition(currentStatus, targetStatus);
  return {
    newStatus,
    isTerminal: isOfferTerminal(newStatus),
  };
}
