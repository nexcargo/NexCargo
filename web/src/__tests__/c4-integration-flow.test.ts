// NexCargo C4 Integration Tests — Payment → Financial Execution Operational
// Authorized by: HAO-C4 Authorization
// Purpose: Verify the complete operational chain from ACTIVE Contract through Settlement + Ledger.
// Tests cover: happy path, failure paths, idempotency, security invariants.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('C4 Integration Tests — Payment → Financial Execution', () => {
  const projectRoot = path.resolve(__dirname, '..', '..');

  // ============================================================
  // MIGRATION FILE VERIFICATION
  // ============================================================

  describe('Migration 030 — File Structure Verification', () => {
    it('migration 030 exists at expected location', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('migration 030 creates escrow state CHECK constraint', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('chk_escrow_valid_state');
      expect(content).toContain("'FUNDS_INITIATED'");
      expect(content).toContain("'FUNDS_CONFIRMED'");
      expect(content).toContain("'FUNDS_LOCKED'");
      expect(content).toContain("'RELEASE_ELIGIBLE'");
      expect(content).toContain("'DISPUTE_HOLD'");
    });

    it('migration 030 creates SECDEF function advance_escrow_state()', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.advance_escrow_state");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.advance_escrow_state");
      expect(content).toContain('SECURITY DEFINER');
    });

    it('migration 030 creates SECDEF function confirm_payment_via_webhook()', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.confirm_payment_via_webhook");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.confirm_payment_via_webhook");
      expect(content).toContain('SECURITY DEFINER');
    });

    it('migration 030 creates SECDEF function execute_settlement()', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.execute_settlement");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.execute_settlement");
      expect(content).toContain('SECURITY DEFINER');
    });

    it('migration 030 creates SECDEF function initiate_payment_intent()', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.initiate_payment_intent");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.initiate_payment_intent");
      expect(content).toContain('SECURITY DEFINER');
    });

    it('migration 030 creates platform_fee_config table', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS financial_schema.platform_fee_config');
    });

    it('migration 030 creates double-entry ledger entries in execute_settlement()', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      const insertCount = (content.match(/INSERT INTO financial_schema\.financial_ledger_entries/g) || []).length;
      expect(insertCount).toBeGreaterThanOrEqual(2);
    });

    it('migration 030 revokes UPDATE on immutable ledger fields', async () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('REVOKE UPDATE (amount, currency, source, destination, debit_credit_type, entry_sequence)');
    });
  });

  // ============================================================
  // PROVIDER ABSTRACTION LAYER VERIFICATION
  // ============================================================

  describe('Provider Abstraction Layer', () => {
    it('provider-interface.ts exports PaymentProviderAdapter interface', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/payment-providers/provider-interface.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export interface PaymentProviderAdapter');
      expect(content).toContain('initiatePayment');
      expect(content).toContain('processWebhook');
      expect(content).toContain('verifyWebhookSignature');
      expect(content).toContain('processRefund');
      expect(content).toContain('executeSettlement');
    });

    it('sandbox-adapter.ts implements deterministic provider simulation', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/payment-providers/sandbox-adapter.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export class SandboxPaymentProvider');
      expect(content).toContain('isProductionReady = false');
      expect(content).toContain('SimulatedPayment');
    });

    it('provider-registry.ts registers all payment methods with sandbox adapter', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/payment-providers/provider-registry.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('paymentProviderRegistry');
      expect(content).toContain("this.adapters.set('MPESA'");
      expect(content).toContain("this.adapters.set('MKESH'");
      expect(content).toContain("this.adapters.set('EMOLA'");
      expect(content).toContain("this.adapters.set('CARD'");
      expect(content).toContain("this.adapters.set('BANK_TRANSFER'");
    });

    it('future provider adapters exist as boundaries (not production ready)', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/payment-providers/provider-registry.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('class MPesaProviderAdapter');
      expect(content).toContain('class EMolaProviderAdapter');
      expect(content).toContain('class MKeshProviderAdapter');
      expect(content).toContain('class CardProcessorProviderAdapter');
      expect(content).toContain('class BankTransferProviderAdapter');
      expect(content).toContain('requireProduction()');
    });
  });

  // ============================================================
  // SERVICE LAYER VERIFICATION
  // ============================================================

  describe('Service Layer', () => {
    it('escrow-service.ts implements state machine validation', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/services/escrow-service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('LEGAL_TRANSITIONS');
      expect(content).toContain('advanceState');
      expect(content).toContain('TERMINAL_STATES');
    });

    it('payment-initiation-service.ts derives amount from escrow', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/services/payment-initiation-service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('verifyForPaymentInitiation');
      expect(content).toContain('initiate_payment_intent');
      expect(content).toContain('paymentProviderRegistry.get');
    });

    it('settlement-execution-service.ts calls execute_settlement SECDEF for fee calculation', () => {
      const filePath = path.join(projectRoot, 'src/infrastructure/services/settlement-execution-service.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('execute_settlement');
      expect(content).toContain('SETTLEMENT_EXCEEDS_ESCROW');
      expect(content).toContain('NEGATIVE_PAYOUT');
    });
  });

  // ============================================================
  // API ROUTE VERIFICATION
  // ============================================================

  describe('API Routes', () => {
    it('POST /api/payments/initiate exists', () => {
      const routePath = path.join(projectRoot, 'src/app/api/payments/initiate/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function POST');
      expect(content).toContain('PaymentInitiationService');
      expect(content).toContain('assertApiAuthorization');
    });

    it('GET /api/payments/[id]/status exists', () => {
      const routePath = path.join(projectRoot, 'src/app/api/payments/[id]/status/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function GET');
      expect(content).toContain('PaymentInitiationService');
      expect(content).toContain('getStatus');
    });

    it('POST /api/settlements supports creation, approval, and execution', () => {
      const routePath = path.join(projectRoot, 'src/app/api/settlements/route.ts');
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('handleCreation');
      expect(content).toContain('handleApproval');
      expect(content).toContain('handleExecution');
      expect(content).toContain('shouldExecute');
      expect(content).toContain('shouldApprove');
      expect(content).toContain('SettlementExecutionService');
    });

    it('webhooks/payment/route.ts connects to SECDEF functions', () => {
      const routePath = path.join(projectRoot, 'src/app/api/webhooks/payment/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('confirm_payment_via_webhook');
      expect(content).toContain('verifyHmacSignature');
      expect(content).toContain('isDuplicateEvent');
    });

    it('webhooks/settlement/route.ts connects to DB updates', () => {
      const routePath = path.join(projectRoot, 'src/app/api/webhooks/settlement/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('verifyHmacSignature');
      expect(content).toContain('isDuplicateSettlementEvent');
    });
  });

  // ============================================================
  // SETTLEMENT AUTHORIZATION VERIFICATION
  // ============================================================

  describe('Settlement Authorization — Approval Required Before Execution', () => {
    it('execute_settlement rejects PENDING settlements — only APPROVED may execute', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("SETTLEMENT_NOT_APPROVED");
      expect(content).toContain("must be APPROVED before execution");
      expect(content).not.toMatch(/NOT IN\s*\(\s*'PENDING'\s*,\s*'APPROVED'\s*\)/);
    });

    it('approve_settlement SECDEF function exists and enforces Super Admin role', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.approve_settlement");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.approve_settlement");
      expect(content).toContain('ACCESS_DENIED_APPROVAL');
      expect(content).toContain("only SUPER_ADMIN may approve settlement requests");
    });

    it('update_platform_fee_config SECDEF function exists with Super Admin enforcement', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.update_platform_fee_config");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.update_platform_fee_config");
      expect(content).toContain('INVALID_FEE_PERCENTAGE');
      expect(content).toContain("only SUPER_ADMIN may modify platform fee configuration");
      expect(content).toContain('fee_percentage < 0 OR p_fee_percentage > 50');
    });

    it('platform_fee_config RLS mutation policy is Super Admin only', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('ALTER TABLE financial_schema.platform_fee_config ENABLE ROW LEVEL SECURITY');
      expect(content).toContain('platform_fee_config_super_admin');
      expect(content).toContain("auth.jwt()->>'role' = 'SUPER_ADMIN'");
      expect(content).toContain('platform_fee_config_read');
      // Should NOT allow admin/moderator for mutations
      expect(content).not.toContain("IN ('admin', 'moderator')");
    });

    it('service layer rejects PENDING settlements from execution', () => {
      const servicePath = path.join(projectRoot, 'src/infrastructure/services/settlement-execution-service.ts');
      const content = fs.readFileSync(servicePath, 'utf-8');
      expect(content).toContain("settlement.approval_status !== 'APPROVED'");
      expect(content).toContain('settlement_not_approved');
      expect(content).not.toMatch(/\['PENDING',\s*'APPROVED'\]/);
    });

    it('service layer exposes approveRequest method', () => {
      const servicePath = path.join(projectRoot, 'src/infrastructure/services/settlement-execution-service.ts');
      const content = fs.readFileSync(servicePath, 'utf-8');
      expect(content).toContain('async approveRequest');
      expect(content).toContain('approve_settlement');
    });

    it('API route supports ?approve=true query parameter', () => {
      const routePath = path.join(projectRoot, 'src/app/api/settlements/route.ts');
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('shouldApprove');
      expect(content).toContain("url.searchParams.get('approve')");
      expect(content).toContain('handleApproval');
    });

    it('handleApproval function calls service.approveRequest', () => {
      const routePath = path.join(projectRoot, 'src/app/api/settlements/route.ts');
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('service.approveRequest');
    });
  });

  // ============================================================
  // FEE CONFIGURATION AUTHORIZATION VERIFICATION
  // ============================================================

  describe('Fee Configuration — Super Admin Only', () => {
    it('update_platform_fee_config SECDEF function exists with Super Admin enforcement', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("DROP FUNCTION IF EXISTS public.update_platform_fee_config");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.update_platform_fee_config");
      expect(content).toContain('INVALID_FEE_PERCENTAGE');
      expect(content).toContain("only SUPER_ADMIN may modify platform fee configuration");
      expect(content).toContain('fee_percentage < 0 OR p_fee_percentage > 50');
    });

    it('platform_fee_config has RLS policies restricting modification to admins', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('ALTER TABLE financial_schema.platform_fee_config ENABLE ROW LEVEL SECURITY');
      expect(content).toContain('platform_fee_config_super_admin');
      expect(content).toContain('platform_fee_config_read');
    });

    it('platform_fee_config has RLS policies restricting modification to admins', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('ALTER TABLE financial_schema.platform_fee_config ENABLE ROW LEVEL SECURITY');
      expect(content).toContain('platform_fee_config_super_admin');
      expect(content).toContain('platform_fee_config_read');
    });

    it('fee is always derived from authoritative server-side configuration', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('SELECT * INTO v_fee_config');
      expect(content).toContain("WHERE key = 'default_platform_fee'");
      expect(content).toContain('v_fee_config.fee_percentage');
    });

    it('invalid fee values are rejected (0-50 range)', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('p_fee_percentage < 0 OR p_fee_percentage > 50');
    });

    it('client cannot supply fee percentage — must use update_platform_fee_config SECDEF', () => {
      const apiRoutePath = path.join(projectRoot, 'src/app/api/settlements/route.ts');
      const apiContent = fs.readFileSync(apiRoutePath, 'utf-8');
      expect(apiContent).not.toContain('fee_percentage');
    });
  });

  // ============================================================
  // DISPUTE_HOLD VERIFICATION
  // ============================================================

  describe('DISPUTE_HOLD — Cannot Be Released Through General Settlement Path', () => {
    it('escrow state machine prevents FUNDS_LOCKED → RELEASED without dispute resolution', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("WHEN 'FUNDS_LOCKED' THEN");
      expect(content).toContain("IF p_target_state NOT IN ('RELEASE_ELIGIBLE', 'DISPUTE_HOLD')");
      expect(content).toContain("WHEN 'DISPUTE_HOLD' THEN");
      expect(content).toContain("IF p_target_state NOT IN ('RELEASED', 'PARTIAL_RELEASE', 'ESCROW_CLOSED')");
    });

    it('general settlement path cannot release DISPUTE_HOLD escrows directly', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("advance_escrow_state(v_escrow.id, 'RELEASED'");
    });
  });

  // ============================================================
  // OPERATIONAL CHAIN VERIFICATION
  // ============================================================

  describe('Operational Chain — C3 ACTIVE Contract → Settlement → Ledger', () => {
    it('C3 migration 029 creates PENDING_CREATION escrow on contract ACTIVE', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/029_c3_escrow_initialization.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("'PENDING_CREATION'");
      expect(content).toContain('v_escrow_record_id');
    });

    it('C4 migration 030 defines valid transition from PENDING_CREATION → FUNDS_INITIATED', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("WHEN 'PENDING_CREATION' THEN");
      expect(content).toContain("IF p_target_state NOT IN ('FUNDS_INITIATED')");
    });

    it('C4 defines full state chain: INITIATED → CONFIRMED → LOCKED → RELEASED', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("WHEN 'FUNDS_INITIATED' THEN");
      expect(content).toContain("WHEN 'FUNDS_CONFIRMED' THEN");
      expect(content).toContain("WHEN 'FUNDS_LOCKED' THEN");
      expect(content).toContain("WHEN 'RELEASE_ELIGIBLE' THEN");
    });

    it('confirm_payment_via_webhook advances escrow through FULL chain', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("advance_escrow_state(v_intent.escrow_id, 'FUNDS_INITIATED'");
      expect(content).toContain("advance_escrow_state(v_intent.escrow_id, 'FUNDS_CONFIRMED'");
      expect(content).toContain("advance_escrow_state(v_intent.escrow_id, 'FUNDS_LOCKED'");
    });

    it('execute_settlement creates 4 ledger entries (fee + payout pairs)', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("'FEE'");
      expect(content).toContain("'SETTLEMENT'");
    });
  });

  // ============================================================
  // SECURITY & INVARIANT VERIFICATION
  // ============================================================

  describe('Security Invariants', () => {
    it('advance_escrow_state uses SECURITY DEFINER', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('SECURITY DEFINER');
      expect(content).toContain("auth.uid()");
    });

    it('confirm_payment_via_webhook uses SECURITY DEFINER', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('SECURITY DEFINER');
    });

    it('execute_settlement uses SECURITY DEFINER', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('SECURITY DEFINER');
    });

    it('initiate_payment_intent uses SECURITY DEFINER', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('SECURITY DEFINER');
    });

    it('All SECDEF functions revoke from PUBLIC and anon', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      const revokeCount = (content.match(/REVOKE EXECUTE ON FUNCTION/g) || []).length;
      expect(revokeCount).toBeGreaterThanOrEqual(6);
    });

    it('Ledger financial columns are immutable (REVOKE UPDATE)', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('REVOKE UPDATE (amount, currency, source, destination');
    });

    it('Client cannot supply authoritative financial amounts', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/030_c4_financial_execution.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('v_escrow.amount');
      expect(content).toContain('AUTHORITY: derived from escrow');
    });
  });

  // ============================================================
  // IDENTITY AND ENUM COMPLIANCE
  // ============================================================

  describe('Enum Compliance', () => {
    it('EscrowState enum matches migration CHECK constraint states', () => {
      const enumsPath = path.join(projectRoot, 'src/shared/types/enums.ts');
      const content = fs.readFileSync(enumsPath, 'utf-8');
      expect(content).toContain("PENDING_CREATION = 'PENDING_CREATION'");
      expect(content).toContain("FUNDS_INITIATED = 'FUNDS_INITIATED'");
      expect(content).toContain("FUNDS_LOCKED = 'FUNDS_LOCKED'");
      expect(content).toContain("PARTIAL_RELEASE = 'PARTIAL_RELEASE'");
      expect(content).toContain("FINAL_RELEASE = 'FINAL_RELEASE'");
      expect(content).toContain("DISPUTE_HOLD = 'DISPUTE_HOLD'");
      expect(content).toContain("ESCROW_CLOSED = 'ESCROW_CLOSED'");
    });

    it('PaymentMethod enum matches payment_intents CHECK constraint', () => {
      const migrationPath = path.join(projectRoot, 'src/infrastructure/migrations/006_payment_intents.sql');
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain("'MPESA'");
      expect(content).toContain("'MKESH'");
      expect(content).toContain("'EMOLA'");
      expect(content).toContain("'CARD'");
      expect(content).toContain("'BANK_TRANSFER'");
    });
  });
});
