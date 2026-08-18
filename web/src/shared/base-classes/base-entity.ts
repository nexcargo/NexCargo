// NexCargo Base Entity — Foundation for all domain entities per PROMPT 1 + PROMPT 2
// All entity models extend this class to ensure standard field consistency.

export abstract class BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  version: number;

  constructor() {
    this.id = crypto.randomUUID();
    const now = new Date();
    this.created_at = now;
    this.updated_at = now;
    this.version = 1;
  }

  /** Increment version for optimistic locking */
  bumpVersion(): void {
    this.version += 1;
    this.updated_at = new Date();
  }

  /** Convert entity to plain object for serialization */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      version: this.version,
    };
  }
}
