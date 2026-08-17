// NexCargo Auditable Entity — Adds user tracking for audit trails per ESS-006 + ESS-009
// All entities that require audit logging extend this class.

import { BaseEntity } from './base-entity';

export abstract class AuditableEntity extends BaseEntity {
  created_by: string; // userId
  updated_by: string; // userId

  constructor(createdBy: string, updatedBy: string) {
    super();
    this.created_by = createdBy;
    this.updated_by = updatedBy;
  }

  /** Update the updated_by field */
  markUpdated(by: string): void {
    this.updated_by = by;
    this.bumpVersion();
  }
}
