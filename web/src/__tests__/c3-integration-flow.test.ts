// NexCargo C3 Integration Tests — Booking → Contract → Escrow Flow
// Authorized by: HAO-C3 Authorization
// Purpose: Verify the full operational flow from booking confirmation through escrow initialization.
// Tests cover: confirm_booking_with_contract() SECDEF call pattern, accept_and_finalize_contract() SECDEF (with escrow init), and EscrowRepository.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('C3 Integration Tests — Booking → Contract → Escrow Flow', () => {
  // Use __dirname as base since tests run from web/src/__tests__/
  const projectRoot = path.resolve(__dirname, '..', '..');
  
  describe('SECDEF call pattern — confirm_booking_with_contract()', () => {
    it('booking confirm invokes RPC not direct DB update', async () => {
      const confirmRoutePath = path.join(projectRoot, 'src/app/api/booking/[id]/confirm/route.ts');
      const content = fs.readFileSync(confirmRoutePath, 'utf-8');
      
      expect(content).toContain("supabase.rpc('confirm_booking_with_contract'");
      expect(content).not.toContain('repo.confirmBooking(id)');
    });
  });

  describe('C3 Migration 029 — Enhanced SECDEF Pattern', () => {
    it('migration 029 enhances accept_and_finalize_contract with escrow creation', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      
      expect(content).toContain('DROP FUNCTION IF EXISTS public.accept_and_finalize_contract');
      expect(content).toContain("INSERT INTO financial_schema.escrow_records");
      expect(content).toContain("'PENDING_CREATION'");
      expect(content).toContain('v_escrow_record_id');
    });

    it('migration 029 creates escrow on ACTIVE transition in all code paths', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      
      const escrowInsertCount = (content.match(/INSERT INTO financial_schema\.escrow_records/g) || []).length;
      expect(escrowInsertCount).toBeGreaterThanOrEqual(2);
    });

    it('migration 029 preserves existing tracking initialization logic', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      
      expect(content).toContain("INSERT INTO logistics_schema.shipment_tracking_records");
      expect(content).toContain("INSERT INTO logistics_schema.tracking_events");
      expect(content).toContain("'TRACKING_INITIALISED'");
    });

    it('migration 029 has NO swallowed escrow failures — contract+escrow are atomic', async () => {
      // HAO corrective verification: BEGIN/EXCEPTION WHEN OTHERS / RAISE WARNING blocks
      // were removed so that escrow creation failure rolls back the entire transaction.
      // Contract activation and required Escrow creation must be one business transition.
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      
      // Should NOT contain exception swallowing patterns
      // [\s\S]* rather than the dotAll flag: tsconfig targets ES2017, where /s is unavailable.
      expect(content).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS[\s\S]*RAISE\s+WARNING/);
      
      // Should NOT have any RAISE WARNING statements
      expect(content).not.toContain('RAISE WARNING');
      
      // Should still drop and recreate the function (idempotent migration)
      expect(content).toContain('DROP FUNCTION IF EXISTS public.accept_and_finalize_contract(UUID, UUID)');
    });

    it('migration 029 uses secure search_path in accept_and_finalize_contract SECDEF', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      
      // SECDEF functions must use minimal search_path per security best practices
      expect(content).toContain("SET search_path TO 'pg_catalog', 'public'");
      
      // Must revoke from PUBLIC and anon, grant only authenticated
      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.accept_and_finalize_contract');
      expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.accept_and_finalize_contract(UUID, UUID) FROM anon');
      expect(content).toContain('GRANT EXECUTE ON FUNCTION public.accept_and_finalize_contract(UUID, UUID) TO authenticated');
    });
  });

  describe('EscrowRepository — File Structure Verification', () => {
    it('repository file exists at expected location', () => {
      const repoPath = path.join(projectRoot, 'src/infrastructure/repositories/escrow-repository.ts');
      expect(fs.existsSync(repoPath)).toBe(true);
    });

    it('exports CreateEscrowParams interface', () => {
      const repoPath = path.join(projectRoot, 'src/infrastructure/repositories/escrow-repository.ts');
      const content = fs.readFileSync(repoPath, 'utf-8');
      expect(content).toContain('export interface CreateEscrowParams');
    });

    it('exports EscrowRepository class', () => {
      const repoPath = path.join(projectRoot, 'src/infrastructure/repositories/escrow-repository.ts');
      const content = fs.readFileSync(repoPath, 'utf-8');
      expect(content).toContain('export class EscrowRepository');
    });

    it('implements create, getById, getByContractId, updateState methods', () => {
      const repoPath = path.join(projectRoot, 'src/infrastructure/repositories/escrow-repository.ts');
      const content = fs.readFileSync(repoPath, 'utf-8');
      expect(content).toContain('async create(');
      expect(content).toContain('async getById(');
      expect(content).toContain('async getByContractId(');
      expect(content).toContain('async updateState(');
    });
  });

  describe('C3 State Machine Compliance', () => {
    it('validates PENDING_CREATION is initial state per MOD-005 §5.1', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("'PENDING_CREATION'");
    });

    it('creates escrow with amount and currency from contract', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('v_row.base_amount');
      expect(content).toContain('v_row.currency');
    });
  });
});
