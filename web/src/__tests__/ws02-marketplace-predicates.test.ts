// NexCargo PRE-I-6 WS-02 — LIM-001 inherited findings (D-WS02-1 / D-WS02-2).
//
// STATIC INSPECTION of the two database-level migration ARTIFACTS read from disk:
//   067_prei6_ws02_handoff_booking_id.sql  (D-WS02-2, marketplace_book_handoff)
//   068_prei6_ws02_dead_marketplace_predicates.sql (D-WS02-1, three RLS policies)
//
// This is NOT live verification. The live catalog re-measure, the real-session HTTP
// before/after documents probe, the rolled-back owner-class RLS simulation for the two
// tracking policies, and the LIVE-confirmed matches privilege blocker (end-to-end STOPPED
// and referred to the LA per directive Sec.4) are recorded separately in the WS-02 evidence
// row. Nothing here proves RLS enforcement or runtime behavior; it asserts the migration
// text carries the authorized minimal change and preserves every guard it must not move.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const M067 = readFileSync(
  resolve(process.cwd(), 'src/infrastructure/migrations/067_prei6_ws02_handoff_booking_id.sql'),
  'utf8',
);
const M068 = readFileSync(
  resolve(process.cwd(), 'src/infrastructure/migrations/068_prei6_ws02_dead_marketplace_predicates.sql'),
  'utf8',
);

// Active (uncommented) lines only — the verbatim rollback sections are '-- ' prefixed.
const activeLines = (sql: string) => sql.split('\n').filter((l) => !l.trimStart().startsWith('--'));
const active067 = activeLines(M067).join('\n');
const active068 = activeLines(M068).join('\n');

// The single active handoff body (first $function$ ... $function$; pair).
const FN_START = active067.indexOf('CREATE OR REPLACE FUNCTION public.marketplace_book_handoff');
const FN_END = '$function$;';
const handoffBody = active067.slice(FN_START, active067.indexOf(FN_END, FN_START) + FN_END.length);

// The single active DO block of 068 (the whole change is atomic; header rollback excluded).
const doBody = active068.slice(active068.indexOf('DO $ws02$'));

describe('WS-02 D-WS02-2 — migration 067 supplies booking_id with the smallest safe change', () => {
  it('targets exactly one function with one uncommented CREATE OR REPLACE', () => {
    const creates = activeLines(M067).filter((l) => l.startsWith('CREATE OR REPLACE FUNCTION'));
    expect(creates).toHaveLength(1);
    expect(creates[0]).toContain('public.marketplace_book_handoff(');
  });

  it('preserves the 6-argument signature, RETURNS jsonb, LANGUAGE plpgsql, pinned search_path and SECURITY INVOKER posture', () => {
    expect(handoffBody).toContain(
      'public.marketplace_book_handoff(p_match_id uuid, p_listing_id uuid, p_offer_id uuid, p_shipper_id uuid, p_transporter_id uuid, p_correlation_id uuid DEFAULT NULL::uuid)',
    );
    expect(handoffBody).toContain('RETURNS jsonb');
    expect(handoffBody).toContain('LANGUAGE plpgsql');
    expect(handoffBody).toContain("SET search_path TO 'pg_catalog', 'public'");
    // SECURITY INVOKER is intentional (004/048): no DEFINER keyword anywhere in the active body.
    expect(handoffBody).not.toContain('SECURITY DEFINER');
  });

  it('adds booking_id to the INSERT column list and gen_random_uuid()::text to VALUES', () => {
    expect(handoffBody).toContain('booking_id, listing_id, selected_offer_id');
    expect(handoffBody).toContain('gen_random_uuid()::text, p_listing_id');
    // uuid_generate_v4() is extensions-only and unreachable under the pinned search_path.
    expect(handoffBody).not.toContain('uuid_generate_v4()');
  });

  it('keeps every triad / transporter-identity guard, lifecycle transition and the jsonb return contract', () => {
    expect(handoffBody).toContain("WHERE id = p_listing_id AND status = 'PUBLISHED'");
    expect(handoffBody).toContain("WHERE id = p_offer_id AND status = 'SUBMITTED'");
    expect(handoffBody).toContain("WHERE id = p_match_id AND status = 'PROPOSED'");
    expect(handoffBody).toContain('HANDOFF_ERROR: Triad mismatch');
    expect(handoffBody).toContain('HANDOFF_ERROR: Transporter mismatch');
    expect(handoffBody).toContain("'ALIGNMENT_CHECKED'");
    expect(handoffBody).toContain('RETURNING id INTO v_booking_id');
    expect(handoffBody).toContain("SET status = 'ACCEPTED'");
    expect(handoffBody).toContain("SET status = 'BOOKED'");
    expect(handoffBody).toContain("'booking_id', v_booking_id::text");
    expect(handoffBody).toContain("'success', true");
  });

  it('carries preconditions P1-P4, postconditions Q1-Q4 and a verbatim commented rollback that omits booking_id generation', () => {
    for (const p of ['P1', 'P2', 'P3', 'P4']) expect(M067).toContain(`PRECONDITION ${p} FAILED`);
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) expect(M067).toContain(`POSTCONDITION ${q} FAILED`);
    const rollback = M067.slice(M067.indexOf('-- ROLLBACK - verbatim'));
    expect(rollback).toContain('-- CREATE OR REPLACE FUNCTION public.marketplace_book_handoff');
    // The original vulnerable INSERT (no booking_id, no gen_random_uuid) is what rollback restores.
    expect(rollback).not.toContain('gen_random_uuid()');
    expect(rollback).toContain('--         listing_id, selected_offer_id, shipper_id, transporter_id,');
  });

  it('touches no policy, grant, schema, table or other function (no uncommented DDL beyond the replace + comment)', () => {
    expect(active067).not.toMatch(/^\s*(GRANT|REVOKE|CREATE POLICY|DROP POLICY|ALTER TABLE|CREATE TABLE|DROP FUNCTION)\b/im);
    // The only uncommented statements are the two guard DO blocks, the replace, and COMMENT ON FUNCTION.
    expect(active067).toContain('COMMENT ON FUNCTION public.marketplace_book_handoff');
  });
});

describe('WS-02 D-WS02-1 — migration 068 replaces three dead marketplace predicates, nothing else', () => {
  it('is one atomic DO block with exactly three DROP POLICY + three CREATE POLICY replacements', () => {
    expect(doBody.startsWith('DO $ws02$')).toBe(true);
    const drops = doBody.match(/DROP POLICY IF EXISTS/g) ?? [];
    const creates = doBody.match(/CREATE POLICY/g) ?? [];
    expect(drops).toHaveLength(3);
    expect(creates).toHaveLength(3);
    expect(doBody).toContain('"Shipper transporter upload documents" ON logistics_schema.documents');
    expect(doBody).toContain('"Transporter updates own booking tracking" ON logistics_schema.shipment_tracking_records');
    expect(doBody).toContain('"I2 tracking mutations insert events" ON logistics_schema.tracking_events');
  });

  it('documents INSERT uses the authoritative marketplace resolver and preserves both ownership branches verbatim', () => {
    const docCreate = doBody.slice(
      doBody.indexOf('CREATE POLICY "Shipper transporter upload documents"'),
      doBody.indexOf('EXECUTE $sql$DROP POLICY IF EXISTS "Transporter updates own booking tracking"'),
    );
    expect(docCreate).toContain("public.effective_marketplace_role() = ANY (ARRAY['SHIPPER'::text, 'TRANSPORTER'::text])");
    expect(docCreate).toContain('b.shipper_id = auth.uid() AND b.is_deleted = false');
    expect(docCreate).toContain("((linked_entity_type)::text = 'user'::text) AND linked_entity_id = auth.uid()");
    // The dead platform-table token is gone from the documents replacement.
    expect(docCreate).not.toContain('platform_roles');
    expect(docCreate).not.toContain('user_metadata');
  });

  it('tracking UPDATE conjoins the resolver with booking ownership in BOTH USING and WITH CHECK', () => {
    const trkCreate = doBody.slice(
      doBody.indexOf('CREATE POLICY "Transporter updates own booking tracking"'),
      doBody.indexOf('EXECUTE $sql$DROP POLICY IF EXISTS "I2 tracking mutations insert events"'),
    );
    expect(trkCreate).toContain('FOR UPDATE');
    expect(trkCreate).toContain('USING (');
    expect(trkCreate).toContain('WITH CHECK (');
    const ownership = 'b.id = shipment_tracking_records.booking_id AND b.transporter_id = auth.uid()';
    expect(trkCreate.split(ownership).length - 1).toBe(2); // once in USING, once in WITH CHECK
    expect(trkCreate.split("public.effective_marketplace_role() = 'TRANSPORTER'").length - 1).toBe(2);
    expect(trkCreate).not.toContain('platform_roles');
  });

  it('tracking_events INSERT drops the dead DRIVER token, keeps genuine platform tokens, adds the Transporter-party branch and preserves delegation', () => {
    const evStart = doBody.indexOf('CREATE POLICY "I2 tracking mutations insert events"');
    const evCreate = doBody.slice(evStart, doBody.indexOf('$sql$;', evStart));
    expect(evCreate).toContain('FOR INSERT TO authenticated');
    expect(evCreate).toContain("pr.role = ANY (ARRAY['MODERATOR'::text, 'ADMIN'::text, 'SUPER_ADMIN'::text])");
    expect(evCreate).toContain('app.platform_roles pr'); // genuine platform branch retained
    expect(evCreate).not.toContain('DRIVER'); // dead token removed
    expect(evCreate).toContain("public.effective_marketplace_role() = 'TRANSPORTER'");
    expect(evCreate).toContain('JOIN logistics_schema.bookings b ON b.id = tr.booking_id');
    expect(evCreate).toContain('WHERE b.transporter_id = auth.uid()');
    expect(evCreate).toContain("has_operational_scope('tracking_update'::text) AND logistics_schema.delegated_shipment(tracking_id)");
    expect(evCreate).not.toContain('user_metadata');
  });

  it('captures the two deferred DRIVER-only policies and asserts byte-equality afterwards (provably untouched)', () => {
    expect(doBody).toContain('v_div_before');
    expect(doBody).toContain('v_gps_before');
    expect(doBody).toContain("'Driver inserts verifications'");
    expect(doBody).toContain("'Driver inserts GPS updates'");
    expect(doBody).toContain('IS DISTINCT FROM v_div_before');
    expect(doBody).toContain('IS DISTINCT FROM v_gps_before');
    // No DROP/CREATE targets a deferred table.
    expect(doBody).not.toContain('DROP POLICY IF EXISTS "Driver inserts verifications"');
    expect(doBody).not.toContain('DROP POLICY IF EXISTS "Driver inserts GPS updates"');
  });

  it('guards the resolver properties, membership CHECK, policy counts, recursion census, privileges and RLS flags before and after', () => {
    expect(doBody).toContain("p.proname = 'effective_marketplace_role'");
    expect(doBody).toContain('p.prosecdef AND p.provolatile');
    expect(doBody).toContain("p.proconfig @> ARRAY['search_path=pg_catalog, public']");
    expect(doBody).toContain("pg_get_constraintdef(c.oid) LIKE '%SHIPPER%TRANSPORTER%'");
    for (const n of [8, 7, 2, 3, 2]) expect(doBody).toContain(`<> ${n}`);
    expect(doBody).toContain('WS02 PRE: a self-referencing policy already exists');
    expect(doBody).toContain('WS02 POST: a self-referencing policy exists');
    expect(doBody).toContain('WS02 POST: the privilege set moved');
    expect(doBody).toContain('WS02 POST: an RLS flag moved');
    expect(doBody).toContain('WS02 POST: a policy count moved');
  });

  it('grants, revokes, creates no function and alters no table — only the three predicate replacements', () => {
    expect(active068).not.toMatch(/^\s*(GRANT|REVOKE|CREATE OR REPLACE FUNCTION|ALTER TABLE|CREATE TABLE|CREATE FUNCTION)\b/im);
  });

  it('carries a verbatim commented rollback restoring the three dead-token predicates', () => {
    const rbStart = M068.indexOf('-- ROLLBACK (exact inverse');
    const rollback = M068.slice(rbStart, M068.indexOf('-- APPLICATION PROCEDURE', rbStart));
    expect(rollback).toContain('DROP POLICY IF EXISTS "Shipper transporter upload documents"');
    expect(rollback).toContain('CREATE POLICY "Shipper transporter upload documents"');
    // The restored documents predicate tests the platform table for marketplace tokens (the defect).
    expect(rollback).toContain("pr.role = ANY (ARRAY['SHIPPER'::text,'TRANSPORTER'::text])");
    expect(rollback).toContain("pr.role = 'TRANSPORTER'::text");
    expect(rollback).toContain("ARRAY['DRIVER'::text,'MODERATOR'::text,'ADMIN'::text,'SUPER_ADMIN'::text]");
    // The rollback restores dead tokens, so it must not introduce the resolver.
    expect(rollback).not.toContain('effective_marketplace_role()');
  });
});