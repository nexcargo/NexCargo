// PRE-I-6 WS-02 match persistence (LA directive 2026-11-18, D-M1/D-M2 approved).
// Implements the existing IMatchRepository abstraction. Every method runs on the
// authenticated session client so RLS decides visibility and write authority;
// the inherited base query() helper is anon-scoped and deliberately never used.

import { createClient } from '@/lib/supabase/server';
import { SupabaseBaseRepository } from '@/infrastructure/repositories/base-repository';
import { BaseEntity } from '@/shared/base-classes/base-entity';
import { MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import type { MatchProposal } from '@/modules/mod-001-marketplace/domain/types/matches';
import type { IMatchRepository } from '@/modules/mod-001-marketplace/infrastructure/repositories/marketplace-repository';

interface MatchRow {
  id: string;
  listing_id: string;
  offer_id: string;
  match_score: number;
  ranking_position: number;
  reasoning_trace: string | null;
  status: string;
  created_by: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export class MatchProposalEntity extends BaseEntity implements MatchProposal {
  matchId: string;
  listingId: string;
  offerId: string;
  matchScore: number;
  rankingPosition: number;
  status: MatchStatus;
  reasoningTrace?: string;

  constructor(row: MatchRow) {
    super();
    this.id = row.id;
    this.matchId = row.id;
    this.listingId = row.listing_id;
    this.offerId = row.offer_id;
    this.matchScore = Number(row.match_score);
    this.rankingPosition = row.ranking_position;
    this.status = row.status as MatchStatus;
    this.reasoningTrace = row.reasoning_trace ?? undefined;
    this.created_at = new Date(row.created_at);
    this.updated_at = new Date(row.updated_at);
    this.version = row.version;
  }

  toApiShape(): MatchApiShape {
    return {
      matchId: this.id,
      listingId: this.listingId,
      offerId: this.offerId,
      matchScore: this.matchScore,
      rankingPosition: this.rankingPosition,
      status: this.status,
      reasoningTrace: this.reasoningTrace,
      version: this.version,
      createdAt: this.created_at.toISOString(),
      updatedAt: this.updated_at.toISOString(),
    };
  }
}

export interface MatchApiShape {
  matchId: string;
  listingId: string;
  offerId: string;
  matchScore: number;
  rankingPosition: number;
  status: string;
  reasoningTrace: string | undefined;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class MatchesRepository extends SupabaseBaseRepository<MatchProposal> implements IMatchRepository {
  constructor() {
    super('matches', 'marketplace_schema');
  }

  async create(params: {
    listingId: string;
    offerId: string;
    matchScore: number;
    rankingPosition: number;
    reasoningTrace?: string;
    createdBy: string;
    correlationId?: string;
  }): Promise<MatchProposalEntity> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.tableName)
      .insert({
        listing_id: params.listingId,
        offer_id: params.offerId,
        match_score: params.matchScore,
        ranking_position: params.rankingPosition,
        reasoning_trace: params.reasoningTrace ?? null,
        status: 'PROPOSED',
        created_by: params.createdBy,
        correlation_id: params.correlationId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create match: ${result.error.message}`);
    }

    return new MatchProposalEntity(result.data as MatchRow);
  }

  async getById(id: string): Promise<MatchProposalEntity | null> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get match: ${result.error.message}`);
    }

    return new MatchProposalEntity(result.data as MatchRow);
  }

  async findByListing(listingId: string): Promise<MatchProposalEntity[]> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.tableName)
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_deleted', false)
      .order('ranking_position', { ascending: true });

    if (result.error) {
      throw new Error(`Failed to list matches: ${result.error.message}`);
    }

    return (result.data as MatchRow[]).map(row => new MatchProposalEntity(row));
  }

  async findAccepted(): Promise<MatchProposalEntity[]> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.tableName)
      .select('*')
      .eq('status', 'ACCEPTED')
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list accepted matches: ${result.error.message}`);
    }

    return (result.data as MatchRow[]).map(row => new MatchProposalEntity(row));
  }

  async findByOffer(offerId: string): Promise<MatchProposalEntity[]> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.tableName)
      .select('*')
      .eq('offer_id', offerId)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list matches by offer: ${result.error.message}`);
    }

    return (result.data as MatchRow[]).map(row => new MatchProposalEntity(row));
  }

  /**
   * Persisted PROPOSED→REJECTED transition. Only the three columns granted by
   * migration 069 are written; the status filter makes a concurrent transition
   * lose the race instead of overwriting a terminal state.
   */
  async reject(id: string, expectedVersion: number): Promise<void> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.tableName)
      .update({
        status: 'REJECTED',
        updated_at: new Date().toISOString(),
        version: expectedVersion + 1,
      })
      .eq('id', id)
      .eq('status', 'PROPOSED')
      .eq('is_deleted', false)
      .select('id');

    if (result.error) {
      throw new Error(`Failed to reject match: ${result.error.message}`);
    }
    if (!result.data || result.data.length === 0) {
      throw new Error('MATCH_STATE_CONFLICT: match is no longer PROPOSED');
    }
  }
}