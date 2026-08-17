// NexCargo Base Repository — Data access abstraction per PROMPT 1 + PROMPT 2
// All repository implementations extend this class to ensure consistent data access patterns.

import { BaseEntity } from './base-entity';

export abstract class BaseRepository<T extends BaseEntity> {
  /** Create a new entity */
  abstract create(entity: Omit<T, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<T>;

  /** Find entity by UUID */
  abstract findById(id: string): Promise<T | null>;

  /** Find all entities with optional filter */
  abstract findAll(filter?: Record<string, unknown>): Promise<T[]>;

  /** Update an existing entity */
  abstract update(id: string, data: Partial<T>): Promise<T>;

  /** Delete an entity (hard delete — use SoftDeletableEntity for soft deletes) */
  abstract delete(id: string): Promise<boolean>;

  /** Check if entity exists */
  abstract exists(id: string): Promise<boolean>;

  /** Count entities matching filter */
  abstract count(filter?: Record<string, unknown>): Promise<number>;
}
