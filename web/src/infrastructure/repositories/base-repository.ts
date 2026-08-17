// NexCargo API Base Repository — Supabase implementation per PROMPT 1 + PROMPT 2
// All repository implementations extend this class.

import { BaseEntity } from '@/shared/base-classes/base-entity';
import { createServerSupabaseClient } from '@/infrastructure/database/supabase';

export abstract class SupabaseBaseRepository<T extends BaseEntity> {
  protected readonly tableName: string;
  protected readonly schema: string;

  constructor(tableName: string, schema: string = 'public') {
    this.tableName = tableName;
    this.schema = schema;
  }

  /** Execute a query against the table */
  protected async query(query: unknown) {
    const client = createServerSupabaseClient();
    return client
      .from(`${this.schema}.${this.tableName}`)
      .match(query as Record<string, unknown>);
  }
}
