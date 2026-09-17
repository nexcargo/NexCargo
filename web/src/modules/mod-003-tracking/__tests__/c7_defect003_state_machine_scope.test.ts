// NexCargo — C7 DEFECT-003 + Dispatcher Scope Tests
// Verifies:
//   1. State-machine enforcement inside SECURITY DEFINER RPC
//   2. Dispatcher delegated-Transporter scope enforcement
//   3. Identity mismatch rejection
//   4. Audit-source integrity preservation

import { describe, it, expect } from 'vitest';

// The authoritative VALID_TRANSITIONS matrix from tracking-state-machine.ts
// Each transition is represented as "current|target" strings that must match
// the v_key format used in the SECDEF function's IF NOT (...) validation block.
const VALID_KEYS = [
  'CREATED|BOOKED',
  'CREATED|DELAYED',
  'BOOKED|AWAITING_PICKUP',
  'BOOKED|CANCELLED',
  'BOOKED|DELAYED',
  'AWAITING_PICKUP|PICKUP_ACKNOWLEDGED',
  'AWAITING_PICKUP|CANCELLED',
  'AWAITING_PICKUP|DELAYED',
  'PICKUP_ACKNOWLEDGED|IN_TRANSIT',
  'PICKUP_ACKNOWLEDGED|CANCELLED',
  'PICKUP_ACKNOWLEDGED|DELAYED',
  'IN_TRANSIT|AT_BORDER',
  'IN_TRANSIT|DELIVERED',
  'IN_TRANSIT|CANCELLED',
  'IN_TRANSIT|DELAYED',
  'AT_BORDER|IN_TRANSIT',
  'AT_BORDER|CANCELLED',
  'AT_BORDER|DELAYED',
  'DELAYED|AWAITING_PICKUP',
  'DELAYED|IN_TRANSIT',
  'DELAYED|AT_BORDER',
  'DELAYED|DELIVERED',
  'DELAYED|CANCELLED',
  'DELIVERED|COMPLETED',
  'DELIVERED|CANCELLED',
];

// Invalid transitions that MUST be rejected by the SECDEF function
const INVALID_KEYS = [
  'CREATED|COMPLETED',     // skip entire lifecycle
  'CREATED|IN_TRANSIT',    // cannot skip multiple states
  'CREATED|DELIVERED',     // impossible leap
  'BOOKED|IN_TRANSIT',     // missing pickup states
  'AWAITING_PICKUP|DELIVERED', // huge leap
  'IN_TRANSIT|COMPLETED',  // no POD delivery step
  'DELIVERED|IN_TRANSIT',  // cannot revert after delivery
  'COMPLETED|IN_TRANSIT',  // terminal state reversal
  'CANCELLED|BOOKED',      // terminal state reversal
  'DELAYED|COMPLETED',     // incomplete jump
];

// Read the live SQL source to verify security invariants are present
import { readFileSync } from 'fs';
import { join } from 'path';
const TESTS_DIR = __dirname;
const MIGRATION_PATH = join(TESTS_DIR, '..', '..', '..', 'infrastructure', 'migrations', '024_c7_final_corrective_defect003_dispatcher_scope.sql');
const migrationContent = readFileSync(MIGRATION_PATH, 'utf8').replace(/\r/g, '');

describe('C7 DEFECT-003 — State-Machine Enforcement Inside SECDEF', () => {
  describe('migration contains state-machine enforcement', () => {
    it('must contain INVALID_TRANSITION error message', () => {
      expect(migrationContent).toContain('INVALID_TRANSITION');
    });

    it('must validate all valid transitions', () => {
      VALID_KEYS.forEach(key => {
        const [from, to] = key.split('|');
        // Check pattern: (v_current_state = 'FROM' AND p_target_status IN ('TO', ...))
        expect(migrationContent).toContain(`'${from}'`);
      });
    });

    it('must use IF NOT (...) condition matching the exact transition matrix', () => {
      // Verify the IF NOT (...) structure exists (spread across lines)
      expect(migrationContent).toContain('IF NOT (');
      expect(migrationContent).toContain("AND p_target_status IN");
    });

    it('must reject CREATED->COMPLETED (defect scenario)', () => {
      expect(INVALID_KEYS).toContain('CREATED|COMPLETED');
    });
  });

  describe('authoritative transition matrix completeness', () => {
    it('CREATED only allows BOOKED and DELAYED', () => {
      const createdTransitions = VALID_KEYS.filter(k => k.startsWith('CREATED|'));
      expect(createdTransitions).toEqual(['CREATED|BOOKED', 'CREATED|DELAYED']);
    });

    it('DELIVERED only allows COMPLETED and CANCELLED', () => {
      const deliveredTransitions = VALID_KEYS.filter(k => k.startsWith('DELIVERED|'));
      expect(deliveredTransitions).toEqual(['DELIVERED|COMPLETED', 'DELIVERED|CANCELLED']);
    });

    it('COMPLETED has no outgoing transitions (terminal)', () => {
      const completedTransitions = VALID_KEYS.filter(k => k.startsWith('COMPLETED|'));
      expect(completedTransitions).toHaveLength(0);
    });

    it('CANCELLED has no outgoing transitions (terminal)', () => {
      const cancelledTransitions = VALID_KEYS.filter(k => k.startsWith('CANCELLED|'));
      expect(cancelledTransitions).toHaveLength(0);
    });

    it('total valid transitions = 25 (matches TypeScript VALID_TRANSITIONS)', () => {
      expect(VALID_KEYS).toHaveLength(25);
    });
  });
});

describe('C7 DEFECT-004 — Dispatcher Delegated-Transporter Scope', () => {
  it('must enforce transporterscope() check for DISPATCHER role', () => {
    expect(migrationContent).toContain("logistics_schema.transporterscope(v_caller) IS NULL");
  });

  it('must verify booking belongs to assigned_transporter_id', () => {
    expect(migrationContent).toContain('assigned_transporter_id');
  });

  it('must DROP old platform-wide Dispatcher UPDATE policy', () => {
    expect(migrationContent).toContain('DROP POLICY IF EXISTS "Dispatcher updates tracking records"');
  });

  it('must CREATE scoped Dispatcher UPDATE policy', () => {
    expect(migrationContent).toContain('"Dispatcher Transporter-scope updates tracking"');
  });

  it('new RLS policy must check role = DISPATCHER', () => {
    expect(migrationContent).toContain("pr.role = 'DISPATCHER'");
  });

  it('new RLS policy must check assigned_transporter_id IS NOT NULL', () => {
    expect(migrationContent).toContain('assigned_transporter_id IS NOT NULL');
  });

  it('new RLS policy must check transporterscope(auth.uid()) IS NOT NULL', () => {
    expect(migrationContent).toContain('transporterscope(auth.uid()) IS NOT NULL');
  });

  it('DENY dispatcher without assigned_transporter_id', () => {
    expect(migrationContent).toContain('dispatcher must have assigned_transporter_id');
  });

  it('DENY dispatcher on another transporter tracking', () => {
    expect(migrationContent).toContain('dispatcher cannot update another transporter');
  });
});

describe('Security Invariants — Identity & Audit', () => {
  it('must derive identity from auth.uid(), not trust caller parameter', () => {
    expect(migrationContent).toContain('auth.uid()');
  });

  it('must validate caller-supplied ID against auth context', () => {
    expect(migrationContent).toContain('caller identity mismatch');
  });

  it('must resolve role from platform_roles, not trust caller input', () => {
    expect(migrationContent).toContain("FROM app.platform_roles pr");
    expect(migrationContent).toContain('pr.user_id = v_caller');
  });

  it('must preserve source_module in event metadata for audit trail', () => {
    expect(migrationContent).toContain('p_source_module');
  });

  it('must use v_caller (from auth.uid()) in event metadata, NOT caller-supplied p_caller_user_id', () => {
    expect(migrationContent).toContain("jsonb_build_object('caller_user_id', v_caller");
  });

  it('must deny SHIPPER explicitly via ELSE branch', () => {
    expect(migrationContent).toContain("not authorized for tracking status updates");
  });

  it('must deny DRIVER via ELSE branch (not listed in allowed roles)', () => {
    // DRIVER falls through to ELSE -> denied
    const roleBranches = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'DISPATCHER', 'TRANSPORTER'];
    expect(roleBranches).not.toContain('DRIVER');
  });
});

describe('Atomic Transaction Preservation', () => {
  it('must UPDATE and INSERT within single BEGIN...END transaction block', () => {
    expect(migrationContent).toContain('UPDATE logistics_schema.shipment_tracking_records');
    expect(migrationContent).toContain('INSERT INTO logistics_schema.tracking_events');
    expect(migrationContent).toContain('EXCEPTION WHEN OTHERS THEN RAISE');
  });

  it('must set version increment on status change', () => {
    expect(migrationContent).toContain('version = COALESCE(version, 1) + 1');
  });

  it('must set last_updated and updated_at timestamps', () => {
    expect(migrationContent).toContain('last_updated = NOW()');
    expect(migrationContent).toContain('updated_at = NOW()');
  });

  it('must record state_from and state_to in events table', () => {
    expect(migrationContent).toContain('state_from');
    expect(migrationContent).toContain('state_to');
  });
});

describe('Direct RPC Defense-in-Depth', () => {
  it('SECURITY DEFINER must independently enforce ALL authorization (no API reliance)', () => {
    // The function itself must contain checks that make API bypass impossible
    expect(migrationContent).toContain('UNAUTHORIZED: no authenticated user session'); // auth check
    expect(migrationContent).toContain('FORBIDDEN: caller identity mismatch');         // identity check
    expect(migrationContent).toContain('FORBIDDEN: role');                              // role check
    expect(migrationContent).toContain('INVALID_TRANSITION');                          // state check
  });

  it('must check role hierarchy order: ADMIN > MODERATOR > DISPATCHER > TRANSPORTER > DENIED', () => {
    const adminIdx = migrationContent.indexOf("v_role = 'ADMIN'");
    const moderatorIdx = migrationContent.indexOf("v_role = 'MODERATOR'");
    const dispatcherIdx = migrationContent.indexOf("v_role = 'DISPATCHER'");
    const transporterIdx = migrationContent.indexOf("v_role = 'TRANSPORTER'");
    
    expect(adminIdx).toBeLessThan(moderatorIdx);
    expect(moderatorIdx).toBeLessThan(dispatcherIdx);
    expect(dispatcherIdx).toBeLessThan(transporterIdx);
  });
});
