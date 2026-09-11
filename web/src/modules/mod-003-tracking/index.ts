// NexCargo MOD-003 — Tracking & Visibility Module Barrel Exports
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// C7-001 Phase 1 adds: infrastructure repositories + application services

export * from './domain/enums';
export * from './domain/types/entities';
export * from './domain/types/bc-contract';
export * from './domain/services/tracking-state-machine';
export * from './domain/services/tracking-services';

// C7-001 Infrastructure Repositories
export { TrackingRecordRepository } from './infrastructure/repositories/tracking-record-repository';
export type { CreateTrackingRecordParams, TrackingRecordApiShape } from './infrastructure/repositories/tracking-record-repository';
export { TrackingEventRepository } from './infrastructure/repositories/tracking-event-repository';
export type { CreateTrackingEventParams } from './infrastructure/repositories/tracking-event-repository';
export { PodRepository } from './infrastructure/repositories/pod-repository';
export type { CreatePodParams, VerifyPodParams, PodApiShape } from './infrastructure/repositories/pod-repository';
export { GpsUpdateRepository } from './infrastructure/repositories/gps-update-repository';
export type { CreateGpsUpdateParams, GpsUpdateApiShape } from './infrastructure/repositories/gps-update-repository';
export { DriverIdentityVerificationRepository } from './infrastructure/repositories/driver-identity-verification-repository';
export type { CreateDriverIdentityVerificationParams, UpdateDriverIdentityVerificationStatusParams } from './infrastructure/repositories/driver-identity-verification-repository';
export { DriverAssignmentRepository } from './infrastructure/repositories/driver-assignment-repository';
export type { DriverAssignmentApiShape } from './infrastructure/repositories/driver-assignment-repository';

// C7-001 Application Services
export { TrackingOrchestratorService } from './application/services/tracking-orchestrator-service';
export { PodSubmissionService } from './application/services/pod-submission-service';
export { GpsIngestionService } from './application/services/gps-ingestion-service';
