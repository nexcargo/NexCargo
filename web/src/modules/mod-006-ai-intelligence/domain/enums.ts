// NexCargo MOD-006 — AI Intelligence Platform Module Local Enums
// Wave 2 — Stage 3, Increment 2 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-006 §§4–7 Core Domain Entities & Rules of Operation

/** Insight type per MOD-006 §4.1 */
export enum InsightType {
  PREDICTION = 'PREDICTION',
  ANOMALY = 'ANOMALY',
  RECOMMENDATION = 'RECOMMENDATION',
  RISK_SCORE = 'RISK_SCORE',
  FORECAST = 'FORECAST',
}

/** Prediction subtype per MOD-006 §4.2 */
export enum PredictionType {
  ETA = 'ETA',
  DELAY_PROBABILITY = 'DELAY_PROBABILITY',
  DEMAND_FORECAST = 'DEMAND_FORECAST',
  CAPACITY_FORECAST = 'CAPACITY_FORECAST',
}

/** Anomaly subtype per MOD-006 §4.3 */
export enum AnomalyType {
  ROUTE_DEVIATION = 'ROUTE_DEVIATION',
  TIMING_ANOMALY = 'TIMING_ANOMALY',
  PAYMENT_PATTERN = 'PAYMENT_PATTERN',
  DOCUMENT_IRREGULARITY = 'DOCUMENT_IRREGULARITY',
  BEHAVIORAL = 'BEHAVIORAL',
}

/** Severity level per MOD-006 §§4.1, 4.3, 4.5 */
export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Recommendation subtype per MOD-006 §4.4 */
export enum RecommendationType {
  CARRIER_MATCH = 'CARRIER_MATCH',
  ROUTE_OPTIMIZATION = 'ROUTE_OPTIMIZATION',
  PRICING = 'PRICING',
  DISPATCH = 'DISPATCH',
  RISK_MITIGATION = 'RISK_MITIGATION',
}

/** Entity type for fraud risk assessment per MOD-006 §4.5 */
export enum EntityType {
  USER = 'USER',
  SHIPMENT = 'SHIPMENT',
  PAYMENT = 'PAYMENT',
  CONTRACT = 'CONTRACT',
}

/** Risk category for fraud scoring per MOD-006 §4.5 */
export enum RiskCategory {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** AI chat user role per MOD-006 §4.9 */
export enum UserRole {
  SHIPPER = 'SHIPPER',
  TRANSPORTER = 'TRANSPORTER',
  DRIVER = 'DRIVER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

/** AI chat session status per MOD-006 §4.9 */
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/** Message sender in AI chat per MOD-006 §4.9 */
export enum MessageSender {
  USER = 'USER',
  AI = 'AI',
}
