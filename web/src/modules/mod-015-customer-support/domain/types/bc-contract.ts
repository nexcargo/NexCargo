// NexCargo MOD-015 — Customer Support & Dispute Resolution Module BC Coordination Interfaces
// Wave 3 — Increment 2 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-015 §§8 Events and Integration Boundaries, §7 Rules of Operation, D-MOD016-001
//
// Key BC coupling points:
// - MOD-015 consumes from MOD-003, MOD-004, MOD-005, MOD-013
// - MOD-016 notification surfaces consumed via consumer-side design-time stubs (D-MOD016-001)
// - MOD-015 output signals consumed by MOD-006, MOD-012, MOD-017
// - RefundCoordinationContract bridges MOD-015 ↔ MOD-013 financial interface

// ============================================================
// CONSUMER-SIDE DESIGN-TIME STUBS FOR MOD-016
// Per D-MOD016-001: Contract interfaces defined as local type definitions consuming
// MOD-016 conceptually without importing actual MOD-016 implementation types.
// Pattern follows D-S2B-002 provisional-assumption approach.
// ============================================================

/**
 * MOD-016 Notification Channel Stub — conceptual interface representing MOD-016 channels.
 * DESIGN-TIME STUB ONLY. Does not import any MOD-016 types.
 */
export interface NotificationChannelStub {
  /** Channel identifier */
  channelId: string;
  /** Whether this channel is configured and active */
  isActive: boolean;
  /** Last successful delivery timestamp */
  lastDeliveryTime?: Date;
}

/**
 * MOD-016 Notification Template Stub — conceptual template definition from MOD-016.
 */
export interface NotificationTemplateStub {
  /** Template identifier */
  templateId: string;
  /** Template title format string */
  titleFormat: string;
  /** Template body format string */
  bodyFormat: string;
  /** Supported channels */
  supportedChannels: string[];
  /** Default priority */
  defaultPriority: string;
}

// ============================================================
// UPSTREAM CONSUMPTION INTERFACES — INPUTS TO MOD-015 FROM DEPENDENT MODULES
// ============================================================

/**
 * ShipmentContextFeed — primary data source from MOD-003 tracking module.
 * Provides shipment lifecycle context for dispute/incident resolution.
 * Pattern follows MOD-007 → TrackingStateFeed consumption model.
 */
export interface ShipmentContextFeed {
  /** MOD-003 shipment identifier */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Latest GPS coordinates */
  locationLat?: number;
  locationLon?: number;
  /** Estimated time of arrival */
  eta?: Date;
  /** Distance remaining */
  distanceRemaining?: number;
  /** Delay reason if applicable */
  delayReason?: string;
  /** POD submission status */
  podSubmitted: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * DocumentEvidenceFeed — evidence documents from MOD-004 document management.
 * Provides linked document references for dispute evidence attachments.
 */
export interface DocumentEvidenceFeed {
  /** MOD-004 document identifier */
  documentId: string;
  /** Document type classification */
  documentType: string;
  /** Current validation status */
  status: string;
  /** File reference URL */
  fileRef: string;
  /** Content hash for integrity verification */
  fileHash: string;
  /** Timestamp of last update */
  updated_at: Date;
}

/**
 * ComplianceAlertFeed — compliance/security events from MOD-010.
 * Used for investigation tooling to inspect user behavior patterns.
 */
export interface ComplianceAlertFeed {
  /** Event identifier */
  eventId: string;
  /** Event type */
  eventType: 'VIOLATION' | 'AUDIT' | 'ACCESS_CONTROL' | 'POLICY_CHECK';
  /** Severity level */
  severity: string;
  /** Descriptive message */
  message: string;
  /** Actor/user involved */
  actorId: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * EscrowStateView — read-only view of escrow state from MOD-013.
 * Used for refund coordination and dispute-related fund visibility.
 * Consumes MOD-013 EscrowAccount entity as a structural reference only.
 */
export interface EscrowStateView {
  /** Escrow account identifier */
  escrowId: string;
  /** Current escrow state/status */
  state: string;
  /** Total amount held in escrow */
  totalAmount: number;
  /** Currency code */
  currency: string;
  /** Whether funds are currently frozen due to a dispute */
  isFrozen: boolean;
  /** Timestamp of last state change */
  updatedAt: Date;
}

/**
 * FleetIncidentSignal — vehicle/fleet incident data from MOD-014.
 * Provides vehicle breakdown and asset-related incident context.
 */
export interface FleetIncidentSignal {
  /** Asset or vehicle identifier */
  assetId: string;
  /** Incident description */
  incidentDescription: string;
  /** Asset status affected */
  assetStatus: string;
  /** Timestamp */
  signalTimestamp: Date;
}

// ============================================================
// DOWNSTREAM OUTPUT SIGNALS — PRODUCED BY MOD-015 → CONSUMED BY OTHER MODULES
// ============================================================

/**
 * CustomerSupportFeed Signal — operational support data for analytics.
 * Consumed by: MOD-012 (analytics aggregation), MOD-006 (behavioral analysis)
 * Pattern follows established signal-to-module convention.
 */
export interface CustomerSupportFeed {
  /** Support ticket or case identifier */
  caseId: string;
  /** Case category */
  category: string;
  /** Current status */
  status: string;
  /** Priority level */
  priority: string;
  /** Time since creation in hours */
  ageHours: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * DisputeResolutionSignal — emits when a dispute reaches a new resolution stage.
 * Consumed by: MOD-012 (resolution analytics), MOD-017 (monitoring)
 */
export interface DisputeResolutionSignal {
  /** Dispute identifier */
  disputeId: string;
  /** Dispute type */
  disputeType: string;
  /** New status reached */
  newStatus: string;
  /** Resolution summary if resolved */
  resolutionSummary?: string;
  /** Decision maker ID */
  decisionMakerId?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * IncidentDetectedSignal — emitted when an operational incident is identified.
 * Consumed by: MOD-012 (incident analytics), MOD-017 (observability correlation)
 */
export interface IncidentDetectedSignal {
  /** Incident identifier */
  incidentId: string;
  /** Shipment reference */
  shipmentId: string;
  /** Incident type */
  incidentType: string;
  /** Severity level */
  severityLevel: string;
  /** Detection source */
  detectionSource: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * EscalationTriggeredSignal — emitted when a case is escalated to a higher level.
 * Consumed by: MOD-017 (alert monitoring), MOD-012 (escalation analytics)
 */
export interface EscalationTriggeredSignal {
  /** Escalation identifier */
  escalationId: string;
  /** Source case ID */
  sourceCaseId: string;
  /** Target escalation level */
  targetLevel: string;
  /** Assigned user ID */
  assignedUserId?: string;
  /** Reason */
  reason: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * SLABreachDetectedSignal — emitted when an SLA timer breaches its target.
 * Consumed by: MOD-017 (SLA alerting), MOD-012 (compliance reporting)
 */
export interface SLABreachDetectedSignal {
  /** Associated case or ticket ID */
  caseId: string;
  /** Type of entity breached (TICKET / DISPUTE / ESCALATION) */
  entityType: string;
  /** Target SLA in hours */
  targetHours: number;
  /** Actual elapsed hours */
  elapsedHours: number;
  /** Timestamp of breach */
  timestamp: Date;
}

/**
 * RefundCoordinatedSignal — emitted when a refund coordination record is finalized.
 * Consumed by: MOD-012 (financial reconciliation analytics)
 */
export interface RefundCoordinatedSignal {
  /** Refund coordination identifier */
  refundCoordinationId: string;
  /** Related dispute ID */
  disputeId: string;
  /** Refund type */
  refundType: string;
  /** Amount */
  amount: number;
  /** Approval status */
  approvalStatus: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * AISupportSuggestionGeneratedSignal — emitted when AI generates a support recommendation.
 * Consumed by: MOD-006 (advisory outcome tracking), MOD-012 (AI effectiveness analytics)
 */
export interface AISupportSuggestionGeneratedSignal {
  /** Interaction identifier */
  interactionId: string;
  /** Parent case ID */
  caseId: string;
  /** Suggestion type */
  suggestionType: string;
  /** Confidence score */
  confidenceScore: number;
  /** Human approval status */
  humanApprovalStatus: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * InvestigationInitiatedSignal — emitted when an admin investigation begins.
 * Consumed by: MOD-010 (compliance audit trail), MOD-017 (investigation monitoring)
 */
export interface InvestigationInitiatedSignal {
  /** Investigation identifier */
  investigationId: string;
  /** Related case ID */
  caseId: string;
  /** Investigator ID */
  investigatorId: string;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================
// REFUND COORDINATION CONTRACT (MOD-015 ↔ MOD-013)
// Resolves AMB-001: Structural SC relationship between MOD-015 and MOD-013
// This is a design-time-only interface defining how MOD-015 coordinates
// refund decisions with MOD-013's escrow/financial infrastructure.
// ============================================================

/**
 * RefundCoordinationContract — standardized interface through which MOD-015
 * requests financial adjustments from MOD-013 escrow system.
 * Design-time specification only. No execution authority.
 * Financial execution remains strictly under MOD-013 + ESS-001F control.
 */
export interface RefundCoordinationContract {
  /** Unique request identifier */
  requestId: string;
  /** Reference to the originating MOD-015 dispute ID */
  disputeRef: string;
  /** MOD-013 escrow account identifier */
  escrowRef: string;
  /** Requested refund amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Refund type (FULL, PARTIAL, COMPENSATION) */
  refundType: string;
  /** Recipient party identifier */
  recipientId: string;
  /** MOD-015 approval status before forwarding to MOD-013 */
  moderationStatus: string;
  /** Structured justification required for financial actions */
  justification: string;
  /** Request timestamp */
  createdAt: Date;
  /** Status of the coordination request within MOD-013 pipeline */
  executionStatus: string; // PENDING_REVIEW / APPROVED_FOR_EXECUTION / EXECUTED / REJECTED_BY_FINANCIAL
  /** Who approved at MOD-015 level */
  moderatedBy?: string;
  /** When approved by MOD-015 moderation */
  moderatedAt?: Date;
}
