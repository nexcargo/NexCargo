// NexCargo MOD-012 — Data Platform Analytics & BI Layer BC Coordination Interfaces
// Wave 2 — Stage 3, Increment 1 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-012 §§8–9 Events and Integration Boundaries, ESS-009 Data Governance
//
// D-S3-001 condition applied: corridorId references use string type (provisional assumption
// following D-S2B-002 pattern). No MOD-009 types imported.

import type { SourceModule } from '../enums';
import type { ProcessedDataset, CorridorAnalyticsDataset, FinancialReconciliationDataset, AITrainingDatasetObject } from './entities';

// ============================================================
// Signals PRODUCED by MOD-012 → consumed by downstream modules
// ============================================================

/**
 * Dataset Generation Signal — emitted when a new dataset version is created.
 * Consumed by: MOD-006 (AI intelligence), MOD-007 (dashboards)
 * Per MOD-012 §8 event model: DatasetGenerated, DatasetVersioned
 */
export interface DatasetGenerationSignal {
  /** Unique identifier of the generated dataset */
  datasetId: string;
  /** Name of the dataset */
  datasetName: string;
  /** Version number of the generated dataset */
  version: number;
  /** Owning module */
  ownerModule: SourceModule;
  /** Access level for consumers */
  accessLevel: string;
  /** Timestamp of generation */
  timestamp: Date;
}

/**
 * Corridor Analytics Report Signal — emits corridor-level analytics for AI modeling.
 * Consumed by: MOD-006 (predictive models), MOD-018 (commercial optimization)
 * Per MOD-012 §8 event model: CorridorAnalyticsGenerated
 */
export interface CorridorAnalyticsReport {
  /** Corridor ID (string per D-S3-001 provisional assumption) */
  corridorId: string;
  /** Structured corridor analytics data */
  analytics: CorridorAnalyticsDataset;
  /** Whether this data is approved for AI consumption */
  aiReady: boolean;
  /** Generated timestamp */
  generatedAt: Date;
}

/**
 * Financial Reconciliation Audit Signal — emits reconciliation records for audit trail.
 * Consumed by: MOD-010 (compliance monitoring), MOD-017 (observability)
 * Per MOD-012 §8 event model: FinancialReconciliationPerformed
 */
export interface FinancialReconciliationAuditSignal {
  /** Reconciliation record ID */
  reconciliationId: string;
  /** Alignment status (ALIGNED / MISMATCH_DETECTED) */
  alignmentStatus: string;
  /** Escrow reference */
  escrowId: string;
  /** Discrepancy description if any */
  discrepancyNote?: string;
}

/**
 * AITrainingDatasetReady Signal — notifies when a training dataset is prepared.
 * Consumed by: MOD-006 (AI model ingestion pipeline)
 * Per MOD-012 §8 event model: AITrainingDatasetPrepared
 */
export interface AITrainingDatasetReadySignal {
  /** Training dataset identifier */
  trainingDatasetId: string;
  /** Purpose classification */
  purpose: string;
  /** Anonymization status confirmation */
  anonymized: boolean;
  /** Version ready for consumption */
  version: number;
  /** Dataset availability timestamp */
  readyAt: Date;
}

// ============================================================
// Requests/Interfaces CONSUMED by MOD-012 from upstream modules
// ============================================================

/**
 * Tracking Analytics Feed Interface — consumes tracking event stream from MOD-003.
 * Consumed from: MOD-003 (Tracking & Visibility)
 * Per MOD-012 §3.1: structured event ingestion from all modules
 * Per MOD-012 §3.3: analytical data store (warehouse concept)
 */
export interface TrackingAnalyticsFeed {
  /** Shipment identifier from MOD-003 tracking system */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Latest GPS coordinates (if available) */
  locationLat?: number;
  /** Latest GPS longitude (if available) */
  locationLon?: number;
  /** Estimated time of arrival */
  eta?: Date;
  /** Any delay notifications */
  delayReason?: string;
  /** Feed timestamp */
  feedTimestamp: Date;
}

/**
 * Market Activity Feed Interface — consumes marketplace data from MOD-001.
 * Consumed from: MOD-001 (Marketplace Layer)
 * Per MOD-012 §9: MOD-001 → marketplace data generation (listings, offers, matches)
 */
export interface MarketActivityFeed {
  /** Listing or offer identifier */
  entityId: string;
  /** Entity type: LISTING | OFFER | MATCH */
  entityType: 'LISTING' | 'OFFER' | 'MATCH';
  /** Entity status */
  status: string;
  /** Price information if applicable */
  price?: number;
  /** Currency code */
  currency?: string;
  /** Feed timestamp */
  feedTimestamp: Date;
}

/**
 * Compliance Audit Log Feed Interface — consumes compliance events from MOD-010.
 * Consumed from: MOD-010 (Security & Compliance)
 * Per MOD-012 §9: MOD-010 → audit logs and compliance data
 */
export interface ComplianceAuditLogFeed {
  /** Compliance event identifier */
  eventId: string;
  /** Event type: VIOLATION | AUDIT | ACCESS_CONTROL | POLICY_CHECK */
  eventType: string;
  /** Severity level */
  severity: string;
  /** Descriptive message */
  message: string;
  /** User or system identifier involved */
  actorId: string;
  /** Feed timestamp */
  feedTimestamp: Date;
}

/**
 * Dataset Catalog Query Request Interface — allows downstream modules to query available datasets.
 * Consumed from: MOD-006 (structured dataset requests), MOD-007 (dashboard data discovery)
 */
export interface DatasetCatalogQuery {
  /** Filter by access level */
  accessLevelFilter?: string;
  /** Filter by source module */
  moduleFilter?: SourceModule;
  /** Return only datasets matching these type keywords */
  keywords?: string[];
  /** Maximum results to return */
  limit?: number;
}

/**
 * Structured Dataset Consumer Interface — primary interface through which MOD-006
 * consumes structured analytics datasets from MOD-012.
 * Per MOD-012 §6.6 AI Data Preparation: "Structuring datasets for MOD-006"
 * Per MOD-012 §7.5 AI Data Isolation Rule: "MOD-006 consumes data but does not define structure"
 *
 * This is the KEY BC coupling between MOD-012 (data provider) and MOD-006 (data consumer).
 */
export interface StructuredDatasetConsumerInterface {
  /** Requested dataset identifier */
  datasetId: string;
  /** Required data fields */
  requiredFields: string[];
  /** Time range filter */
  timeRangeStart?: Date;
  /** Time range end filter */
  timeRangeEnd?: Date;
  /** Minimum confidence level required */
  minConfidence?: number;
  /** Response envelope for dataset output */
  consume(): DatasetResponse;
}

/**
 * Dataset Response — standardized response from StructuredDatasetConsumerInterface.
 */
export interface DatasetResponse {
  /** Dataset identifier */
  datasetId: string;
  /** Dataset name */
  datasetName: string;
  /** Dataset version */
  version: number;
  /** Data rows (structure only, no actual computation) */
  dataStructure: Record<string, unknown>[];
  /** Metadata about the response */
  metadata: {
    /** Number of records */
    recordCount: number;
    /** Refresh policy used */
    refreshPolicy: string;
    /** Lineage summary */
    lineageSummary: string;
  };
}
