// NexCargo MOD-009 — Regional & Cross-Border Logistics Operations Module BC Coordination Interfaces
// Wave 4 — Increment 1 — Authorized per HAO-WAVE3-AUTH-001 execution order D-SEQ-W3-001
// Reference: MOD-009 §§8 Events and Integration Boundaries, §7 Rules of Operation, D-MOD016-001
//
// Key BC coupling points:
// - MOD-009 consumes from MOD-003, MOD-004, MOD-008, MOD-010, MOD-011, MOD-014
// - MOD-009 produces signals consumed by MOD-003, MOD-005, MOD-006, MOD-010, MOD-012, MOD-016
// - MOD-016 notification surfaces via consumer-side design-time stubs (D-MOD016-001)
// - MOD-010 IS/AU dependency authorized per PROMPT 0 v1.1; uses actual MOD-010 interfaces

import type { ComplianceRule, SecurityEventRecord } from '@/modules/mod-010-security/domain/types/compliance';
import type { AIGovernanceConstraint } from '@/modules/mod-010-security/domain/types/ai-governance';

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
// UPSTREAM CONSUMPTION INTERFACES — INPUTS TO MOD-009 FROM DEPENDENT MODULES
// ============================================================

/**
 * TrackingFeed — primary data source from MOD-003 tracking module.
 * Provides shipment lifecycle context for border transition and segment management.
 */
export interface TrackingFeed {
  /** MOD-003 shipment identifier */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Latest GPS coordinates */
  locationLat?: number;
  locationLon?: number;
  /** ETA */
  eta?: Date;
  /** POD submission status */
  podSubmitted: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * DocumentFeed — customs document data from MOD-004 document management.
 * Provides document references needed for cross-border compliance validation.
 */
export interface DocumentFeed {
  /** MOD-004 document identifier */
  documentId: string;
  /** Document type classification */
  documentType: string;
  /** Current validation status */
  status: string;
  /** File reference URL for download */
  fileRef: string;
  /** Whether locally cached for offline access */
  offlineAvailable: boolean;
  /** Content hash for integrity verification during sync */
  fileHash: string;
  /** Timestamp of last update */
  updated_at: Date;
}

/**
 * MobileBorderEventFeed — mobile-generated border events from MOD-008.
 * Provides field-level border crossing triggers at the edge.
 */
export interface MobileBorderEventFeed {
  /** Event identifier from mobile device */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** Border post being crossed */
  borderPostId: string;
  /** Geofencing trigger accuracy */
  geofenceAccuracyMeters: number;
  /** Local device timestamp */
  deviceTimestamp: Date;
  /** Whether connection was available when captured */
  connectivityState: 'ONLINE' | 'OFFLINE';
}

/**
 * ComplianceAlertFeed — security/compliance events from MOD-010.
 * Used for compliance checkpoint enforcement per §7.6.
 * Consumes MOD-010 actual exported interfaces.
 */
export interface ComplianceAlertFeed {
  /** Event identifier */
  eventId: string;
  /** Event type: VIOLATION | AUDIT | ACCESS_CONTROL | POLICY_CHECK */
  eventType: string;
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
 * ComplianceRuleFeed — structural compliance rules from MOD-010.
 * Used to validate regional requirements against global compliance framework.
 * Consumes MOD-010 ComplianceRule authoritative interface.
 */
export interface ComplianceRuleFeed extends ComplianceRule {
  /** Scope region(s) this rule applies to */
  applicableRegions: string[];
  /** Enforcement level for this module's use case */
  moduleEnforcementLevel: string;
}

/**
 * AISecurityConstraintFeed — AI governance constraints from MOD-010.
 * Ensures corridor optimization suggestions do not violate AI safety rules.
 * Consumes MOD-010 AIGovernanceConstraint authoritative interface.
 */
export interface AISecurityConstraintFeed extends AIGovernanceConstraint {
  /** Applicable domain (cross-border, pricing, routing) */
  applicableDomain: string;
}

/**
 * IntegrationInfrastructureFeed — platform integration metadata from MOD-011.
 * Provides connectivity and API availability information.
 */
export interface IntegrationInfrastructureFeed {
  /** API endpoint health status */
  apiHealthStatus: string;
  /** Protocol support status */
  protocolSupport: string[];
  /** Last integration check */
  lastCheckAt: Date;
}

/**
 * FleetComplianceDeclaration — bidirectional compliance interface from MOD-014.
 * Shared BC contract already defined in MOD-014 module per D-S2B-002 precedent.
 */
export interface CrossBorderComplianceDeclaration {
  /** Compliance declaration ID */
  declarationId: string;
  /** Asset/vehicle ID */
  assetId: string;
  /** Corridor compliance status */
  corridorCompliant: boolean;
  /** Required documentation checklist */
  requiredDocuments: string[];
  /** Issued at timestamp */
  issuedAt: Date;
}

/**
 * CorridorAvailabilitySignal — fleet capacity signal from MOD-014 for corridor matching.
 * Helps MOD-009 understand corridor usage patterns for assignment optimization.
 */
export interface CorridorAvailabilitySignal {
  /** Corridor ID */
  corridorId: string;
  /** Current utilization percentage */
  utilizationPercent: number;
  /** Available backhaul opportunities */
  hasBackhaulOpportunities: boolean;
  /** Timestamp */
  signalTimestamp: Date;
}

// ============================================================
// DOWNSTREAM OUTPUT SIGNALS — PRODUCED BY MOD-009 → CONSUMED BY OTHER MODULES
// ============================================================

/**
 * RegionEnteredSignal — emitted when a shipment enters a new region.
 * Consumed by: MOD-003 (tracking updates), MOD-010 (compliance monitoring)
 * Per MOD-009 §8: RegionEntered event
 */
export interface RegionEnteredSignal {
  /** Event identifier */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** New region entered */
  targetRegion: string;
  /** Country code */
  countryCode: string;
  /** Regulatory classification triggered */
  regulatoryClassification: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * RegionExitedSignal — emitted when a shipment exits a region.
 * Consumed by: MOD-003 (milestone marking), MOD-012 (analytics)
 * Per MOD-009 §8: RegionExited event
 */
export interface RegionExitedSignal {
  /** Event identifier */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** Region exited */
  regionExited: string;
  /** Next destination region */
  nextDestination: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CrossBorderSegmentCreatedSignal — emitted when a new cross-border segment is generated.
 * Consumed by: MOD-003 (segment continuity), MOD-005 (settlement dependencies)
 * Per MOD-009 §8: CrossBorderSegmentCreated event
 */
export interface CrossBorderSegmentCreatedSignal {
  /** Segment identifier */
  segmentId: string;
  /** Parent tracking ID */
  trackingId: string;
  /** Origin region */
  originRegion: string;
  /** Destination region */
  destinationRegion: string;
  /** Assigned corridor */
  corridorId: string;
  /** Segmentation method used */
  segmentationMethod: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CrossBorderSegmentCompletedSignal — emitted when a segment finishes transit.
 * Consumed by: MOD-003 (milestone completion), MOD-005 (settlement timing)
 * Per MOD-009 §8: CrossBorderSegmentCompleted event
 */
export interface CrossBorderSegmentCompletedSignal {
  /** Segment identifier */
  segmentId: string;
  /** Parent tracking ID */
  trackingId: string;
  /** Actual transit duration (minutes) */
  transitDurationMinutes: number;
  /** Any delays encountered */
  delaysEncountered: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * BorderTransitionInitiatedSignal — emitted when a border crossing begins.
 * Consumed by: MOD-003 (GPS location update force), MOD-010 (customs readiness check)
 * Per MOD-009 §8: BorderTransitionInitiated event
 */
export interface BorderTransitionInitiatedSignal {
  /** Event identifier */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** From-region */
  fromRegion: string;
  /** To-region */
  toRegion: string;
  /** Border post */
  borderPostId: string;
  /** Detection source */
  detectionSource: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * BorderTransitionCompletedSignal — emitted when a border crossing concludes.
 * Consumed by: MOD-003 (milestone marking), MOD-012 (analytics)
 * Per MOD-009 §8: BorderTransitionCompleted event
 */
export interface BorderTransitionCompletedSignal {
  /** Event identifier */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** Final clearance status */
  finalClearanceStatus: string;
  /** Delay duration if any */
  delayMinutes: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * BorderTransitionDelayedSignal — emitted when a border crossing is delayed.
 * Consumed by: MOD-003 (ETA recalculation), MOD-006 (anomaly/risk analysis)
 * Per MOD-009 §8: BorderTransitionDelayed event
 */
export interface BorderTransitionDelayedSignal {
  /** Event identifier */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** Reason for delay */
  delayReason: string;
  /** Estimated additional delay minutes */
  estimatedDelayMinutes: number;
  /** Border congestion alert triggered? */
  congestionAlertTriggered: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CorridorAssignedSignal — emitted when a corridor is assigned to a shipment.
 * Consumed by: MOD-001 (pricing awareness), MOD-006 (optimization feedback), MOD-012 (analytics)
 * Per MOD-009 §8: CorridorAssigned event
 */
export interface CorridorAssignedSignal {
  /** Shipment/tracking ID */
  shipmentId: string;
  /** Assigned corridor ID */
  corridorId: string;
  /** Assignment method used */
  assignmentMethod: string;
  /** Risk level of corridor */
  riskLevel: string;
  /** Expected transit time (days) */
  expectedTransitDays: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CorridorViolationDetectedSignal — emitted when a shipment deviates from assigned corridor.
 * Consumed by: MOD-006 (risk analysis), MOD-010 (compliance monitoring), MOD-003 (route deviation)
 * Per MOD-009 §8: CorridorViolationDetected event
 */
export interface CorridorViolationDetectedSignal {
  /** Event identifier */
  eventId: string;
  /** Shipment/tracking ID */
  shipmentId: string;
  /** Original corridor ID */
  originalCorridorId: string;
  /** Actual path taken (region sequence) */
  actualPath: string[];
  /** Violation type (diversion, unauthorized stop) */
  violationType: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CustomsDocumentationValidatedSignal — emitted when customs docs pass validation.
 * Consumed by: MOD-003 (border milestone), MOD-012 (compliance analytics)
 * Per MOD-009 §8: CustomsDocumentationValidated event
 */
export interface CustomsDocumentationValidatedSignal {
  /** Segment identifier */
  segmentId: string;
  /** Tracking ID */
  trackingId: string;
  /** Documents validated count */
  documentsValidated: number;
  /** Any flags remaining */
  remainingFlags: string[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * CustomsDocumentationRejectedSignal — emitted when customs docs fail validation.
 * Consumed by: MOD-003 (block planning level), MOD-010 (compliance enforcement), MOD-016 (notification)
 * Per MOD-009 §8: CustomsDocumentationRejected event
 */
export interface CustomsDocumentationRejectedSignal {
  /** Segment identifier */
  segmentId: string;
  /** Tracking ID */
  trackingId: string;
  /** Rejected document IDs */
  rejectedDocumentIds: string[];
  /** Rejection reasons */
  rejectionReasons: string[];
  /** Enforced action level */
  enforcedAction: string; // BLOCK_PLANNING / FLAG_FOR_REVIEW / ADVISORY_ONLY
  /** Timestamp */
  timestamp: Date;
}

/**
 * ComplianceCheckPassedSignal — emitted when compliance checkpoint passes.
 * Consumed by: MOD-003 (border advance), MOD-012 (compliance analytics)
 * Per MOD-009 §8: ComplianceCheckPassed event
 */
export interface ComplianceCheckPassedSignal {
  /** Segment identifier */
  segmentId: string;
  /** Tracking ID */
  trackingId: string;
  /** Checkpoint type that passed */
  checkpointType: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * ComplianceCheckFailedSignal — emitted when compliance checkpoint fails.
 * Consumed by: MOD-010 (enforcement), MOD-016 (alert notifications), MOD-003 (review flag)
 * Per MOD-009 §8: ComplianceCheckFailed event
 */
export interface ComplianceCheckFailedSignal {
  /** Segment identifier */
  segmentId: string;
  /** Tracking ID */
  trackingId: string;
  /** Checkpoint type that failed */
  checkpointType: string;
  /** Failure details */
  failureDetails: string;
  /** Enforced action level */
  enforcedAction: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CurrencyConversionAppliedSignal — emitted when currency conversion is applied.
 * Consumed by: MOD-012 (financial analytics), MOD-006 (risk insights)
 * Per MOD-009 §8: CurrencyConversionApplied event
 */
export interface CurrencyConversionAppliedSignal {
  /** Transaction context ID */
  transactionId: string;
  /** Shipment ID */
  shipmentId: string;
  /** Applied rate */
  appliedRate: number;
  /** Origin-to-destination pair */
  currencyPair: string;
  /** Rate source confidence */
  rateConfidence: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * BorderCongestionAlertSignal — emitted when border congestion exceeds threshold.
 * Consumed by: MOD-003 (ETA recalculation), MOD-006 (risk analysis), MOD-016 (alerts), MOD-012 (analytics)
 * Per MOD-009 §8: BorderCongestionAlert event
 */
export interface BorderCongestionAlertSignal {
  /** Report identifier */
  reportId: string;
  /** Border post ID */
  borderPostId: string;
  /** Current congestion level */
  currentCongestionLevel: string;
  /** Estimate waiting time (minutes) */
  waitTimeEstimate: number;
  /** Alert level (LOW/MEDIUM/HIGH/SEVERE) */
  alertLevel: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * TemporaryPermitObtainedSignal — emitted when temporary border permit is obtained.
 * Consumed by: MOD-003 (shipment enablement), MOD-016 (notifications), MOD-012 (analytics)
 * Per MOD-009 §8: TemporaryPermitObtained event
 */
export interface TemporaryPermitObtainedSignal {
  /** Permit authorization ID */
  permitAuthId: string;
  /** Transporter ID */
  transporterId: string;
  /** Valid region */
  validRegion: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Issue type (at_border/pre_issued/emergency) */
  issueType: string;
  /** Timestamp */
  timestamp: Date;
}
