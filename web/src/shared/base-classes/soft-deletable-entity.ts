// NexCargo Soft Deletable Entity — Adds soft delete support per ESS-009
// Financial data is NEVER deleted (only archived). Operational data uses soft delete.

import { AuditableEntity } from './auditable-entity';

export abstract class SoftDeletableEntity extends AuditableEntity {
  is_deleted: boolean;
  deleted_at?: Date;
  deleted_by?: string;

  constructor(createdBy: string, updatedBy: string) {
    super(createdBy, updatedBy);
    this.is_deleted = false;
  }

  /** Mark entity as deleted (soft delete) */
  softDelete(by: string): void {
    this.is_deleted = true;
    this.deleted_at = new Date();
    this.deleted_by = by;
    this.markUpdated(by);
  }

  /** Restore a soft-deleted entity */
  restore(by: string): void {
    this.is_deleted = false;
    this.deleted_at = undefined;
    this.deleted_by = undefined;
    this.markUpdated(by);
  }
}
