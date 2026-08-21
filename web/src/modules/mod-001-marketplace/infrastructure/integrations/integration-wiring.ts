// NexCargo MOD-001 — Integration Wiring Utilities
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Provides modular integration adapters for Wave 1 API endpoints.
// All integrations are advisory-only; no autonomous action or execution.

import type { AuditEvent } from '@/shared/standards/audit-event-format';
import type { CorrelationContext } from '@/shared/types/core';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import type { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';
import type { MatchProposal } from '@/modules/mod-001-marketplace/domain/types/matches';
import type { AdvisoryQuote } from '@/modules/mod-001-marketplace/domain/types/quotes';

// ============================================================
// MOD-011 Contract Framework Integration
// ============================================================

/**
 * Wraps a marketplace response in the MOD-011 contract framework structure.
 * Per MOD-011 §4.1 (Integration Contract Object) + §4.6 (API Version Record).
 * 
 * This is a structural wrapper — it does NOT execute external API calls.
 * Actual external exposure is handled by MOD-011 infrastructure layer.
 */
export interface MarketplaceContractResponse<T> {
  /** Contract metadata per S-03 */
  contract: {
    version: string;
    status: 'ACTIVE' | 'DEPRECATED' | 'TESTING' | 'SUNSET';
    ownerModule: 'MOD-001';
  };
  /** API response payload */
  data: T;
  /** Request correlation ID for traceability */
  correlationId: string;
}

/**
 * Creates a contract-wrapped response for marketplace API operations.
 * @param data - Response payload
 * @param correlationId - Request correlation ID
 * @returns Contract-wrapped response object
 */
export function wrapInContractFramework<T>(data: T, correlationId: string): MarketplaceContractResponse<T> {
  return {
    contract: {
      version: '1.0.0',
      status: 'ACTIVE',
      ownerModule: 'MOD-001',
    },
    data,
    correlationId,
  };
}

// ============================================================
// MOD-017 Observability Integration
// ============================================================

/**
 * Structured log entry conforming to MOD-017 §4.1 logging format.
 * Per Wave 0 shared standard S-01 audit event alignment.
 */
export interface MarketplaceLogEntry {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  moduleId: 'MOD-001';
  correlationId: string;
  timestamp: string;
  operation: string; // e.g., 'listingCreated', 'matchGenerated'
  metadata?: Record<string, unknown>;
}

/**
 * Creates a structured log entry for marketplace operations.
 * Per MOD-017 §4.1 structured logging requirement.
 * 
 * Note: This creates the log entry object only. Actual emission
 * is handled by the application layer's logging infrastructure.
 * 
 * @param params - Log entry parameters
 * @returns Structured log entry object
 */
export function createMarketplaceLogEntry(params: Partial<MarketplaceLogEntry>): MarketplaceLogEntry {
  return {
    level: 'INFO',
    moduleId: 'MOD-001',
    timestamp: new Date().toISOString(),
    ...params,
  } as MarketplaceLogEntry;
}

/**
 * Records a metric for marketplace operations.
 * Per MOD-017 §4.2 metrics collection framework.
 * 
 * Note: This records the metric object only. Actual metric emission
 * is handled by the application layer's metrics infrastructure.
 * 
 * @param metricName - Name of the metric
 * @param value - Metric value
 * @param unit - Metric unit
 * @param tags - Additional tags
 */
export function recordMarketplaceMetric(
  metricName: string,
  value: number,
  unit: string = 'count',
  tags?: Record<string, string>,
): void {
  // Stub: In production, this would emit to MOD-017 metrics infrastructure.
  // For development, we log the metric creation for observability.
  const logEntry = createMarketplaceLogEntry({
    level: 'INFO',
    message: `Marketplace metric recorded: ${metricName}=${value}${unit}`,
    operation: 'metricRecording',
    metadata: { metricName, value, unit, tags },
  });
  // In production: emit to metrics infrastructure
  // For now, the log entry serves as an observable artifact
  void logEntry;
}

// ============================================================
// MOD-010 RBAC Integration
// ============================================================

/**
 * RBAC permission evaluation result.
 * Per MOD-010 §4.1–§4.2 RBAC model.
 */
export interface RBACEvaluationResult {
  /** Whether the action is permitted */
  permitted: boolean;
  /** Role that was evaluated */
  role: string;
  /** Resource being accessed */
  resource: string;
  /** Action being performed */
  action: string;
  /** Reason if denied */
  reason?: string;
}

/**
 * Evaluates RBAC permissions for marketplace operations.
 * Per MOD-010 §4.1 (RoleDefinition) + §4.2 (PermissionBoundary).
 * 
 * This is an advisory evaluation — it returns the result but does NOT
 * enforce access control at the request level. Enforcement happens via
 * middleware configured in other modules.
 * 
 * @param role - User role (e.g., 'SHIPPER', 'TRANSPORTER')
 * @param resource - Resource being accessed (e.g., 'listings', 'offers')
 * @param action - Action being performed (e.g., 'create', 'read', 'update', 'delete')
 * @returns RBAC evaluation result
 */
export function evaluateRBAC(role: string, resource: string, action: string): RBACEvaluationResult {
  // Simplified RBAC rules for Wave 1
  // Full implementation uses MOD-010 RoleDefinition/PermissionBoundary
  
  const allowedRoles: Record<string, string[]> = {
    listings: ['SHIPPER', 'ADMIN', 'MODERATOR'],
    offers: ['TRANSPORTER', 'SHIPPER', 'ADMIN', 'MODERATOR'],
    matching: ['SHIPPER', 'ADMIN'],
    quotes: ['SHIPPER', 'ADMIN'],
  };
  
  const allowedActions: Record<string, string[]> = {
    create: ['SHIPPER', 'TRANSPORTER', 'ADMIN'],
    read: ['SHIPPER', 'TRANSPORTER', 'ADMIN', 'MODERATOR'],
    update: ['SHIPPER', 'TRANSPORTER', 'ADMIN'],
    delete: ['ADMIN'],
  };
  
  const resourceRoles = allowedRoles[resource] || [];
  const actionRoles = allowedActions[action] || [];
  
  // Role must be in both lists for the resource and action
  const hasResourceAccess = resourceRoles.includes(role);
  const hasActionAccess = actionRoles.includes(action);
  
  if (!hasResourceAccess) {
    return {
      permitted: false,
      role,
      resource,
      action,
      reason: `Role '${role}' is not authorized to access resource '${resource}'`,
    };
  }
  
  if (!hasActionAccess) {
    return {
      permitted: false,
      role,
      resource,
      action,
      reason: `Role '${role}' does not have '${action}' permission on '${resource}'`,
    };
  }
  
  return {
    permitted: true,
    role,
    resource,
    action,
  };
}

// ============================================================
// MOD-002 Handoff Integration (Stub-Compatible Boundary)
// ============================================================

/**
 * Handoff payload for accepted match → MOD-002 Booking & Contract Management.
 * Per MOD-001 §4.3 handoff boundary: "transfers the selected match for contract formation."
 * 
 * This is a stub-compatible boundary — it returns structured data that
 * WILL BE wired to MOD-002 when that module is implemented in Wave 2.
 * For Wave 1, it provides the data structure without executing the handoff.
 */
export interface MOD002HandoffPayload {
  /** The accepted match proposal data */
  matchProposal: Omit<MatchProposal, 'id' | 'created_at' | 'updated_at' | 'version' | 'bumpVersion' | 'toJSON'>;
  /** The associated listing */
  listing: Omit<ShipmentListing, 'id' | 'created_at' | 'updated_at' | 'version' | 'bumpVersion' | 'toJSON'>;
  /** The associated offer */
  offer: Omit<TransportOffer, 'id' | 'created_at' | 'updated_at' | 'version' | 'bumpVersion' | 'toJSON'>;
  /** Correlation ID for traceability */
  correlationId: string;
  /** Handoff timestamp */
  handoffTimestamp: string;
}

/**
 * Prepares accepted-match handoff data for MOD-002.
 * Per MOD-001 §5.3 acceptance rule: "triggers handoff to MOD-002 (Booking & Contract Management)."
 * 
 * WARNING: This does NOT execute the handoff. It only prepares the data structure.
 * Actual handoff execution requires MOD-002 implementation (Wave 2).
 * 
 * @param matchProposal - The accepted match proposal
 * @param listing - The associated listing
 * @param offer - The associated offer
 * @param correlationId - Request correlation ID
 * @returns Prepared handoff payload (NOT executed)
 */
export function prepareMOD002Handoff(
  matchProposal: MatchProposal,
  listing: ShipmentListing,
  offer: TransportOffer,
  correlationId: string,
): MOD002HandoffPayload {
  return {
    matchProposal: {
      matchId: matchProposal.matchId,
      listingId: matchProposal.listingId,
      offerId: matchProposal.offerId,
      matchScore: matchProposal.matchScore,
      rankingPosition: matchProposal.rankingPosition,
      status: matchProposal.status,
      reasoningTrace: matchProposal.reasoningTrace ?? undefined,
    },
    listing: {
      listingId: listing.listingId,
      shipperId: listing.shipperId,
      origin: listing.origin,
      destination: listing.destination,
      cargoType: listing.cargoType,
      weightKg: listing.weightKg,
      volumeM3: listing.volumeM3,
      timeWindow: listing.timeWindow,
      pricingModel: listing.pricingModel,
      status: listing.status,
      publishedAt: listing.publishedAt,
      title: listing.title,
      description: listing.description,
      acceptedVehicleTypes: listing.acceptedVehicleTypes,
    },
    offer: {
      offerId: offer.offerId,
      transporterId: offer.transporterId,
      listingId: offer.listingId,
      priceProposal: offer.priceProposal,
      availabilityWindow: offer.availabilityWindow,
      vehicleType: offer.vehicleType,
      declaredCapacity: offer.declaredCapacity,
      status: offer.status,
      notes: offer.notes,
    },
    correlationId,
    handoffTimestamp: new Date().toISOString(),
  };
}

// ============================================================
// MOD-016 Notification Integration (Stub-Compatible Boundary)
// ============================================================

/**
 * Notification payload for marketplace events.
 * Per MOD-016 notification channel types.
 * 
 * This is a stub-compatible boundary — it structures notification
 * data that WILL BE emitted to MOD-016 when that module is implemented.
 * For Wave 1, it provides the data structure without emitting notifications.
 */
export interface MarketplacenotificationPayload {
  recipientId: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  subject: string;
  body: string;
  eventType: string; // e.g., 'listingPublished', 'offerAccepted'
  correlationId: string;
}

/**
 * Prepares notification payload for marketplace events.
 * Per MOD-001 §8 event consumption by MOD-016.
 * 
 * WARNING: This does NOT emit notifications. It only prepares the payload.
 * Actual notification emission requires MOD-016 implementation (Wave 2).
 * 
 * @param params - Notification parameters
 * @returns Prepared notification payload (NOT emitted)
 */
export function prepareMarketplacenotification(params: {
  recipientId: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  subject: string;
  body: string;
  eventType: string;
  correlationId: string;
}): MarketplacenotificationPayload {
  return {
    recipientId: params.recipientId,
    channel: params.channel,
    subject: params.subject,
    body: params.body,
    eventType: params.eventType,
    correlationId: params.correlationId,
  };
}
