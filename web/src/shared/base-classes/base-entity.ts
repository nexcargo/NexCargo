// NexCargo Base Entity — Foundation for all domain entities per PROMPT 1 + PROMPT 2
// All entity models extend this class to ensure standard field consistency.

import { v4 as uuidv4 } from 'uuid';

export abstract class BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  version: number;

  constructor() {
    this.id = uuidv4();
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
    return { ...this };
  }
}
