// NexCargo MOD-010 Domain Types — Fraud Detection Record Structure
// Authoritative source: MOD-010 §4.6 (Fraud Detection Record) + §3.3 (Fraud Detection & Prevention Framework)
// Implements exit criteria X-19: Fraud categories, risk scores, evidence references

/**
 * Entity type enum per MOD-010 §4.6
 */
export enum FraudEntityType {
  USER = 'USER',
  SHIPMENT = 'SHIPMENT',
  PAYMENT = 'PAYMENT',
  DOCUMENT = 'DOCUMENT',
  SESSION = 'SESSION',
}

/**
 * Fraud category enum per MOD-010 §4.6
 */
export enum FraudCategory {
  PAYMENT_FRAUD = 'PAYMENT_FRAUD',
  IDENTITY_FRAUD = 'IDENTITY_FRAUD',
  ROUTE_MANIPULATION = 'ROUTE_MANIPULATION',
  DOCUMENT_FALSIFICATION = 'DOCUMENT_FALSIFICATION',
  ACCOUNT_ABUSE = 'ACCOUNT_ABUSE',
}

/**
 * Risk category enum per MOD-010 §4.6
 */
export enum RiskCategory {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Detection method enum per MOD-010 §4.6
 */
export enum DetectionMethod {
  AI = 'AI',           // From MOD-006 AI engine
  RULE = 'RULE',
  MANUAL = 'MANUAL',
}

/**
 * Action taken enum per MOD-010 §4.6
 */
export enum FraudActionTaken {
  FLAGGED = 'FLAGGED',
  REVIEW = 'REVIEW',
  BLOCKED = 'BLOCKED',
  RESOLVED = 'RESOLVED',
}

/**
 * Fraud Detection Record Object — represents a fraud detection event.
 * Per MOD-010 §4.6. Integrates with MOD-006 AI engine for risk scoring.
 */
export interface FraudDetectionRecord {
  // Core attributes from MOD-010 §4.6
  fraudId: string;                // UUID v4
  entityType: FraudEntityType;
  entityId: string;
  fraudCategory: FraudCategory;
  riskScore: number;              // 0–100 from MOD-006 AI engine
  riskCategory: RiskCategory;
  detectionMethod: DetectionMethod;
  evidenceReferences: string[];   // Array of evidence links
  actionTaken: FraudActionTaken;
  resolvedAt?: string;            // Optional ISO 8601
  resolvedBy?: string;            // Optional user ID
}
