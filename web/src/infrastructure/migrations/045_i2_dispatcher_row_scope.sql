-- NexCargo Migration 045 — I-2 Dispatcher Row-Scope Enforcement in RLS (F-I2-14)
-- Authorized by QODER EXECUTION DIRECTIVE "NEXCARGO — I-2 ARCHITECTURAL ADJUDICATION AND EXECUTION
-- DIRECTIVE" (Lead Architect, 6 Nov 2026), PART A ("enforce delegated scope through backend authorization
-- AND RLS") and PART C item 3 (dispatcher authorization and transporter row-scope enforcement).
-- Depends on: 043 (app.operational_delegations, transporterscope() redefinition, has_operational_scope()),
--             042 (atomic_tracking_status_update search_path pin and anon revocation),
--             017/024 (the policy set and the RPC rewritten here), 011/012/013/020/021 (the policy
--             statements that were never superseded by name and are therefore still live).
--
-- FINDING THIS CLOSES — F-I2-14 (HIGH):
--   Not one dispatcher predicate in the live set compared a ROW to the delegating Transporter. Every one
--   tested only that the caller IS a mapped dispatcher and then admitted the whole table, which contradicts
--   PROMPT 0 v1.3:953-954 ("delegation ... bounded"), MOD-010:987 ("no role may inherit undefined
--   cross-domain privileges") and PART A. The single correct counter-example in the repository is
--   024:62-70, inside atomic_tracking_status_update.
--
--   The surface is larger than 017 alone. RLS permissive policies OR together, so a whole-table policy that
--   survived alongside a corrected one defeats it. The census found FIVE such survivors, three of them
--   because 017 dropped a policy name that 013 had never used:
--     011:220 "Platform inserts document versions"     (INSERT, DISPATCHER in the role list) — never dropped
--     011:339 "Platform creates document linkages"     (INSERT, DISPATCHER) — never dropped
--     013:110 "Dispatcher/Moderator reads all support tickets" — 017:220 dropped "Platform team reads all
--                                                       support tickets", a name 013 never created
--     013:310 "Platform team reads all incidents"      — 017:250 dropped "...all shipment incidents"
--     013:479 "Platform team reads all exceptions"     — 017:230 dropped "...all operational exceptions"
--   plus 013:382 "Platform team reads all escalations" (017 never touched escalations at all) and the four
--   021 parent-record policies whose dispatcher leg is an UNCORRELATED EXISTS inside a subquery, i.e. a
--   constant per user that admits every row once true.
--   A sixth precautionary drop is included: "Authorized roles insert tracking events" (XXX_c7_001_tracking_
--   phase1.sql:148, a parked file that 020:85 drops by name). Live policy names cannot be read, and
--   DROP POLICY IF EXISTS costs nothing, so every repository name for an affected table is dropped.
--
-- WHY THIS MATTERS NOW AND NOT LATER: 043 made granting a delegation possible. Without this file, the first
--   grant would immediately hand that dispatcher every Transporter's fleets, vehicles, drivers, assignments,
--   documents, tickets, disputes and tracking. This file is therefore a precondition for using 043 at all.
--
-- PRE-CHANGE STATE (measured, not assumed) — security advisor 2026-11-06T12:39:41.124Z + repository census:
--   * function_search_path_mutable = 9; atomic_tracking_status_update is NOT among them, which is admissible
--     evidence that 042's pin is live and must be restated by any CREATE OR REPLACE here (the 023->024 bug:
--     CREATE OR REPLACE silently drops a SET clause that is not repeated).
--   * authenticated_security_definer_function_executable = 8 (the three financial RPCs,
--     atomic_tracking_status_update, the two I-1 resolvers, effective_operational_delegation,
--     has_operational_scope). anon list = 0.
--   * Live policy TEXT is INACCESSIBLE without owner-class access, which PART D forbids, so every statement
--     below is written against the repository DDL and each drop is DROP POLICY IF EXISTS on every name the
--     census found for that table, from every file. Attribution column names were verified against the
--     CREATE TABLE bodies in 003, 005, 011, 012, 013 and 021, not assumed.
--
-- ATTRIBUTION BASIS PER TABLE (the row's owning Transporter, from columns that already exist — no new
--   business rule is invented; each is the ESS-006:217 ownership shape evaluated one level up, against the
--   delegating principal rather than the caller):
--     fleets                              ownerid                                   -> delegated_fleet(id)
--     vehicles                            fleet.ownerid                             -> delegated_vehicle(id)
--     drivers                             fleet.ownerid                             -> delegated_driver(id)
--     asset_assignments                   vehicle.fleet.ownerid                     -> delegated_vehicle(vehicle_id)
--     cross_border_compliance_records     vehicle.fleet.ownerid                     -> delegated_vehicle(vehicle_id)
--     backhaul_opportunities              fleet.ownerid                             -> delegated_fleet(fleet_id)
--     documents                           linked_entity_type/linked_entity_id chain -> delegated_document(document_id)
--     digital_signatures, ocr_results, document_approvals, document_expiry_records,
--     document_linkages, document_versions  their document                          -> delegated_document(document_id)
--     shipment_tracking_records           booking.transporter_id                    -> delegated_shipment(id)
--     tracking_events, proof_of_delivery, gps_location_updates,
--     driver_identity_verifications       parent tracking -> booking.transporter_id  -> delegated_shipment(tracking_id)
--     shipment_incidents, operational_exceptions  shipment -> booking.transporter_id -> delegated_shipment(shipment_id)
--     support_tickets                     requester_id                              -> = delegated_principal()
--     dispute_cases                       initiator_id OR respondent_id             -> = delegated_principal()
--     escalations                         created_by                                -> = delegated_principal()
--   asset_assignments.vehicle_id and shipment_tracking_records.contract_id are nullable (012:xx): an
--   assignment with no vehicle has no fleet and is therefore NOT visible to any delegation. That is fail
--   closed, and it is recorded here rather than papered over with a second leg.
--
-- SCOPE REQUIRED PER CAPABILITY (values are the 043 CHECK allowlist; nothing new is invented):
--   SELECT of any of the above            -> operational_read
--   asset_assignments FOR ALL (manage)    -> assignment_manage
--   shipment_tracking_records UPDATE,
--   tracking_events INSERT, RPC           -> tracking_update
--   There is NO delegated write to documents, tickets, disputes, escalations or anything financial: 011's two
--   INSERT policies listed DISPATCHER beside the governance tiers with no attribution whatsoever, so the
--   dispatcher token is removed from them outright rather than scoped. Financial objects carry no dispatcher
--   policy anywhere in the census, which is what makes PART A's prohibition true by construction here too.
--
-- DELIBERATELY NOT CHANGED HERE:
--   - The DRIVER legs (017 Section B, 020:89/021:42 role lists, 021 driver-policy shapes). DRIVER
--     provisioning and the Driver-without-a-Transporter invariant are outside I-2 by PART A (F-I2-06).
--   - The governance legs. Each rewritten policy re-issues its MODERATOR/ADMIN/SUPER_ADMIN test byte-for-byte
--     in the 017 convention (direct EXISTS on app.platform_roles). Converting them to the resolvers is Item 1
--     work with its own rollback; and 020's UPDATE policy never had a governance leg, so none is added here
--     either — that would be a privilege widening dressed as a fix.
--   - Marketplace owner legs (shipper_id/transporter_id = auth.uid(), fleets ownerid = auth.uid(), the
--     transporterscope-free policies in 011-013) — untouched, they are correct.
--   - app.platform_roles rows, effective_user_role(), effective_marketplace_role(), assigned_transporter_id
--     (the column stays; it stops being an authority, which 043 already did).
--   - atomic_tracking_status_update's ADMIN/SUPER_ADMIN, MODERATOR and TRANSPORTER branches. NOTE for Item 1:
--     that function resolves v_role from app.platform_roles only (024:50-53), so its ELSIF v_role='TRANSPORTER'
--     leg is unreachable — platform_roles has never held TRANSPORTER (010:38 CHECK). Real, recorded, and
--     deliberately left for the role-resolution reconciliation rather than folded into a scope fix.
--
-- ROLLBACK (drop the I-2 objects, then re-issue the pre-change statements verbatim, in reverse section order):
--   DROP POLICY IF EXISTS "I2 ..." for each of the 28 policies created below, then
--   DROP FUNCTION IF EXISTS logistics_schema.delegated_principal(), delegated_fleet(UUID),
--     delegated_vehicle(UUID), delegated_driver(UUID), delegated_shipment(UUID),
--     delegated_document(VARCHAR).
--   The pre-change statements need no separate file: every one of them is reproduced verbatim at the
--   line ranges cited in the header and in each section comment — 011:139-147,220-238,274-282,329-347,
--   386-394,439-447,503-511 (documents family), 012:79-86,134-142,215-223,299-307,401-427,507-515,578-586
--   (fleet/asset family), 013:110-117,212-220,310-318,382-390,479-487 (support/dispute family),
--   017:77-96,101-266 (the 017-era dispatcher policies), 020:48-61,89-97 and 021:30-47,77-87,125-135,
--   167-177 (tracking family), 024:1-127 + 042's pin (the RPC). Section F of this file is byte-identical to
--   024's body except for the DISPATCHER branch, so reverting Section F alone restores the RPC.
--   Rollback therefore restores the F-I2-14 defect exactly as found; it is a revert, not an alternative state.

-- ============================================================
-- SECTION A: attribution helpers
-- ============================================================
-- SECURITY DEFINER because a policy that reads other tables as the invoking role re-enters their RLS, which
-- is both a recursion risk and a second, unrelated denial path. The bypass is bounded to the narrowest
-- possible surface: each helper returns a single boolean about ONE linkage and no column of any row. They
-- live in logistics_schema, which the 043 probe showed PostgREST does not expose (PGRST202/PGRST205), so
-- they are not reachable by URL. EXECUTE is revoked from PUBLIC and anon and granted to authenticated only.

CREATE OR REPLACE FUNCTION logistics_schema.delegated_principal()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT logistics_schema.transporterscope(auth.uid());
$$;

COMMENT ON FUNCTION logistics_schema.delegated_principal() IS
  'I-2 PART A: the Transporter that delegated to the CALLING dispatcher, or NULL. Zero arguments; reads '
  'app.operational_delegations through 043 transporterscope(), never app.platform_roles and never user_metadata.';

CREATE OR REPLACE FUNCTION logistics_schema.delegated_fleet(p_fleet_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_fleet_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM logistics_schema.fleets f
     WHERE f.id = p_fleet_id
       AND f.ownerid = logistics_schema.delegated_principal()
  );
$$;

CREATE OR REPLACE FUNCTION logistics_schema.delegated_vehicle(p_vehicle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_vehicle_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM logistics_schema.vehicles v
      JOIN logistics_schema.fleets f ON f.id = v.fleet_id
     WHERE v.id = p_vehicle_id
       AND f.ownerid = logistics_schema.delegated_principal()
  );
$$;

CREATE OR REPLACE FUNCTION logistics_schema.delegated_driver(p_driver_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_driver_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM logistics_schema.drivers d
      JOIN logistics_schema.fleets f ON f.id = d.fleet_id
     WHERE d.id = p_driver_id
       AND f.ownerid = logistics_schema.delegated_principal()
  );
$$;

CREATE OR REPLACE FUNCTION logistics_schema.delegated_shipment(p_tracking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_tracking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
     WHERE tr.id = p_tracking_id
       AND b.transporter_id = logistics_schema.delegated_principal()
  );
$$;

-- documents carries no transporter column: its ownership is the polymorphic linked_entity_type/
-- linked_entity_id pair (011:xx CHECK allows shipment|booking|contract|user|vehicle|driver). Every one of the
-- six variants resolves to a Transporter through a column that already exists, so the attribution is exact
-- rather than approximate. 'user' is the literal case: the linked entity IS the account.
CREATE OR REPLACE FUNCTION logistics_schema.delegated_document(p_document_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_document_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM logistics_schema.documents doc
      LEFT JOIN logistics_schema.shipment_tracking_records str
             ON doc.linked_entity_type = 'shipment' AND str.id = doc.linked_entity_id
      LEFT JOIN logistics_schema.bookings bk_ship
             ON bk_ship.id = str.booking_id
      LEFT JOIN logistics_schema.bookings bk_direct
             ON doc.linked_entity_type = 'booking' AND bk_direct.id = doc.linked_entity_id
      LEFT JOIN logistics_schema.contracts ct
             ON doc.linked_entity_type = 'contract' AND ct.id = doc.linked_entity_id
      LEFT JOIN logistics_schema.bookings bk_ct
             ON bk_ct.id = ct.booking_id
      LEFT JOIN logistics_schema.vehicles vh
             ON doc.linked_entity_type = 'vehicle' AND vh.id = doc.linked_entity_id
      LEFT JOIN logistics_schema.fleets fl_v ON fl_v.id = vh.fleet_id
      LEFT JOIN logistics_schema.drivers dr
             ON doc.linked_entity_type = 'driver' AND dr.id = doc.linked_entity_id
      LEFT JOIN logistics_schema.fleets fl_d ON fl_d.id = dr.fleet_id
     WHERE doc.document_id = p_document_id
       AND (
            (doc.linked_entity_type = 'user'
            AND doc.linked_entity_id = logistics_schema.delegated_principal())
         OR (doc.linked_entity_type = 'booking'
            AND bk_direct.transporter_id = logistics_schema.delegated_principal())
         OR (doc.linked_entity_type = 'shipment'
            AND bk_ship.transporter_id = logistics_schema.delegated_principal())
         OR (doc.linked_entity_type = 'contract'
            AND bk_ct.transporter_id = logistics_schema.delegated_principal())
         OR (doc.linked_entity_type = 'vehicle'
            AND fl_v.ownerid = logistics_schema.delegated_principal())
         OR (doc.linked_entity_type = 'driver'
            AND fl_d.ownerid = logistics_schema.delegated_principal())
       )
  );
$$;

REVOKE EXECUTE ON FUNCTION
  logistics_schema.delegated_principal(), logistics_schema.delegated_fleet(UUID),
  logistics_schema.delegated_vehicle(UUID), logistics_schema.delegated_driver(UUID),
  logistics_schema.delegated_shipment(UUID), logistics_schema.delegated_document(VARCHAR)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  logistics_schema.delegated_principal(), logistics_schema.delegated_fleet(UUID),
  logistics_schema.delegated_vehicle(UUID), logistics_schema.delegated_driver(UUID),
  logistics_schema.delegated_shipment(UUID), logistics_schema.delegated_document(VARCHAR)
TO authenticated;

-- ============================================================
-- SECTION B: fleet and asset families — read under operational_read, manage under assignment_manage
-- ============================================================
-- Every drop below covers each name the census recorded for that table in any file, because a survivor under
-- a different name would keep admitting the whole table alongside the corrected policy.

DROP POLICY IF EXISTS "Platform team reads all fleets" ON logistics_schema.fleets;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads fleets" ON logistics_schema.fleets;
CREATE POLICY "I2 delegated reads fleets"
  ON logistics_schema.fleets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_fleet(fleets.id))
  );

DROP POLICY IF EXISTS "Platform team reads all vehicles" ON logistics_schema.vehicles;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads vehicles" ON logistics_schema.vehicles;
CREATE POLICY "I2 delegated reads vehicles"
  ON logistics_schema.vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_vehicle(vehicles.id))
  );

DROP POLICY IF EXISTS "Platform team reads all drivers" ON logistics_schema.drivers;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads drivers" ON logistics_schema.drivers;
CREATE POLICY "I2 delegated reads drivers"
  ON logistics_schema.drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_driver(drivers.id))
  );

DROP POLICY IF EXISTS "Platform team reads all assignments" ON logistics_schema.asset_assignments;
DROP POLICY IF EXISTS "Dispatcher admin manage assignments" ON logistics_schema.asset_assignments;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads assignments" ON logistics_schema.asset_assignments;
CREATE POLICY "I2 delegated reads assignments"
  ON logistics_schema.asset_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_vehicle(asset_assignments.vehicle_id))
  );

DROP POLICY IF EXISTS "Dispatcher Transporter-scope manage assignments" ON logistics_schema.asset_assignments;
CREATE POLICY "I2 delegated manages assignments"
  ON logistics_schema.asset_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('assignment_manage') AND logistics_schema.delegated_vehicle(asset_assignments.vehicle_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('assignment_manage') AND logistics_schema.delegated_vehicle(asset_assignments.vehicle_id))
  );

DROP POLICY IF EXISTS "Platform team reads all compliance records" ON logistics_schema.cross_border_compliance_records;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads compliance" ON logistics_schema.cross_border_compliance_records;
CREATE POLICY "I2 delegated reads compliance"
  ON logistics_schema.cross_border_compliance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_vehicle(cross_border_compliance_records.vehicle_id))
  );

DROP POLICY IF EXISTS "Platform team reads all backhaul" ON logistics_schema.backhaul_opportunities;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads backhaul" ON logistics_schema.backhaul_opportunities;
CREATE POLICY "I2 delegated reads backhaul"
  ON logistics_schema.backhaul_opportunities FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_fleet(backhaul_opportunities.fleet_id))
  );

-- ============================================================
-- SECTION C: document family — read only; the two INSERT policies lose the DISPATCHER token outright
-- ============================================================

DROP POLICY IF EXISTS "Platform team reads all operational documents" ON logistics_schema.documents;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads documents" ON logistics_schema.documents;
CREATE POLICY "I2 delegated reads documents"
  ON logistics_schema.documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(documents.document_id))
  );

DROP POLICY IF EXISTS "Digital signature platform team read" ON logistics_schema.digital_signatures;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads signatures" ON logistics_schema.digital_signatures;
CREATE POLICY "I2 delegated reads signatures"
  ON logistics_schema.digital_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(digital_signatures.document_id))
  );

DROP POLICY IF EXISTS "OCR result platform team read" ON logistics_schema.ocr_results;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads OCR" ON logistics_schema.ocr_results;
CREATE POLICY "I2 delegated reads OCR"
  ON logistics_schema.ocr_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(ocr_results.document_id))
  );

DROP POLICY IF EXISTS "Document approval platform team read" ON logistics_schema.document_approvals;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads approvals" ON logistics_schema.document_approvals;
CREATE POLICY "I2 delegated reads approvals"
  ON logistics_schema.document_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(document_approvals.document_id))
  );

DROP POLICY IF EXISTS "Expiry record platform team read" ON logistics_schema.document_expiry_records;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads expiry" ON logistics_schema.document_expiry_records;
CREATE POLICY "I2 delegated reads expiry"
  ON logistics_schema.document_expiry_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(document_expiry_records.document_id))
  );

DROP POLICY IF EXISTS "Document linkage platform team read" ON logistics_schema.document_linkages;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads linkages" ON logistics_schema.document_linkages;
CREATE POLICY "I2 delegated reads linkages"
  ON logistics_schema.document_linkages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(document_linkages.document_id))
  );

DROP POLICY IF EXISTS "Document version platform team read" ON logistics_schema.document_versions;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads versions" ON logistics_schema.document_versions;
CREATE POLICY "I2 delegated reads versions"
  ON logistics_schema.document_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_document(document_versions.document_id))
  );

-- 011:220 and 011:339 gave DISPATCHER an unattributed whole-table INSERT. No 043 scope covers document
-- writes, so the token is removed and the governance tiers keep exactly the privilege they already had.
DROP POLICY IF EXISTS "Platform inserts document versions" ON logistics_schema.document_versions;
CREATE POLICY "I2 platform inserts document versions"
  ON logistics_schema.document_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
  );

DROP POLICY IF EXISTS "Platform creates document linkages" ON logistics_schema.document_linkages;
CREATE POLICY "I2 platform creates document linkages"
  ON logistics_schema.document_linkages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
  );

-- ============================================================
-- SECTION D: tracking family — read under operational_read, mutation under tracking_update
-- ============================================================

DROP POLICY IF EXISTS "Dispatcher reads all tracking records" ON logistics_schema.shipment_tracking_records;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads tracking" ON logistics_schema.shipment_tracking_records;
CREATE POLICY "I2 delegated reads tracking"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_shipment(shipment_tracking_records.id))
  );

DROP POLICY IF EXISTS "Dispatcher updates tracking records" ON logistics_schema.shipment_tracking_records;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope updates tracking" ON logistics_schema.shipment_tracking_records;
CREATE POLICY "I2 delegated updates tracking"
  ON logistics_schema.shipment_tracking_records FOR UPDATE
  TO authenticated
  USING (
    public.has_operational_scope('tracking_update')
    AND logistics_schema.delegated_shipment(shipment_tracking_records.id)
  )
  WITH CHECK (
    public.has_operational_scope('tracking_update')
    AND logistics_schema.delegated_shipment(shipment_tracking_records.id)
  );

DROP POLICY IF EXISTS "Read tracking events via parent record" ON logistics_schema.tracking_events;
CREATE POLICY "I2 read tracking events via parent record"
  ON logistics_schema.tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR (public.has_operational_scope('operational_read')
             AND b.transporter_id = logistics_schema.delegated_principal())
    )
  );

-- The 020/021 INSERT list mixed DRIVER with DISPATCHER and the governance tiers, with no attribution. The
-- DRIVER leg is preserved verbatim (PART A puts DRIVER outside I-2); DISPATCHER becomes a scoped, attributed
-- leg of its own.
DROP POLICY IF EXISTS "Authorized roles insert tracking events" ON logistics_schema.tracking_events;
DROP POLICY IF EXISTS "Tracking mutations insert events" ON logistics_schema.tracking_events;
CREATE POLICY "I2 tracking mutations insert events"
  ON logistics_schema.tracking_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('DRIVER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('tracking_update')
        AND logistics_schema.delegated_shipment(tracking_events.tracking_id))
  );

DROP POLICY IF EXISTS "Read POD via parent record" ON logistics_schema.proof_of_delivery;
CREATE POLICY "I2 read POD via parent record"
  ON logistics_schema.proof_of_delivery FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR (public.has_operational_scope('operational_read')
             AND b.transporter_id = logistics_schema.delegated_principal())
    )
  );

DROP POLICY IF EXISTS "Read GPS updates via parent record" ON logistics_schema.gps_location_updates;
CREATE POLICY "I2 read GPS updates via parent record"
  ON logistics_schema.gps_location_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR (public.has_operational_scope('operational_read')
             AND b.transporter_id = logistics_schema.delegated_principal())
    )
  );

DROP POLICY IF EXISTS "Read driver verifications via parent record" ON logistics_schema.driver_identity_verifications;
CREATE POLICY "I2 read driver verifications via parent record"
  ON logistics_schema.driver_identity_verifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR tracking_id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
         OR b.transporter_id = auth.uid()
         OR (public.has_operational_scope('operational_read')
             AND b.transporter_id = logistics_schema.delegated_principal())
    )
  );

-- ============================================================
-- SECTION E: exception, incident, support and dispute families — read only
-- ============================================================

DROP POLICY IF EXISTS "Platform team reads all shipment incidents" ON logistics_schema.shipment_incidents;
DROP POLICY IF EXISTS "Platform team reads all incidents" ON logistics_schema.shipment_incidents;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads incidents" ON logistics_schema.shipment_incidents;
CREATE POLICY "I2 delegated reads incidents"
  ON logistics_schema.shipment_incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_shipment(shipment_incidents.shipment_id))
  );

DROP POLICY IF EXISTS "Platform team reads all operational exceptions" ON logistics_schema.operational_exceptions;
DROP POLICY IF EXISTS "Platform team reads all exceptions" ON logistics_schema.operational_exceptions;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads exceptions" ON logistics_schema.operational_exceptions;
CREATE POLICY "I2 delegated reads exceptions"
  ON logistics_schema.operational_exceptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read') AND logistics_schema.delegated_shipment(operational_exceptions.shipment_id))
  );

DROP POLICY IF EXISTS "Dispatcher/Moderator reads all support tickets" ON logistics_schema.support_tickets;
DROP POLICY IF EXISTS "Platform team reads all support tickets" ON logistics_schema.support_tickets;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads tickets" ON logistics_schema.support_tickets;
CREATE POLICY "I2 delegated reads tickets"
  ON logistics_schema.support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read')
        AND support_tickets.requester_id = logistics_schema.delegated_principal())
  );

DROP POLICY IF EXISTS "Platform team reads all disputes" ON logistics_schema.dispute_cases;
DROP POLICY IF EXISTS "Dispatcher Transporter-scope reads disputes" ON logistics_schema.dispute_cases;
CREATE POLICY "I2 delegated reads disputes"
  ON logistics_schema.dispute_cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read')
        AND (dispute_cases.initiator_id = logistics_schema.delegated_principal()
          OR dispute_cases.respondent_id = logistics_schema.delegated_principal()))
  );

DROP POLICY IF EXISTS "Platform team reads all escalations" ON logistics_schema.escalations;
CREATE POLICY "I2 delegated reads escalations"
  ON logistics_schema.escalations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR (public.has_operational_scope('operational_read')
        AND escalations.created_by = logistics_schema.delegated_principal())
  );

-- ============================================================
-- SECTION F: atomic_tracking_status_update — dispatcher branch re-pointed at the delegation
-- ============================================================
-- The 024 body is re-issued verbatim except for the DISPATCHER branch, which no longer consults
-- app.platform_roles or assigned_transporter_id, and for the SET search_path clause, which CREATE OR REPLACE
-- would otherwise silently drop (042 pinned it; the 023->024 precedent is exactly this bug). The ADMIN,
-- SUPER_ADMIN, MODERATOR and TRANSPORTER branches are untouched, including the unreachable TRANSPORTER leg
-- noted above for Item 1.

CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update(
    p_tracking_id UUID,
    p_target_status VARCHAR(20),
    p_source_module VARCHAR(20) DEFAULT 'MOD-003',
    p_caller_user_id UUID DEFAULT NULL::uuid
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller            UUID;
    v_record            logistics_schema.shipment_tracking_records%ROWTYPE;
    v_current_state     VARCHAR(20);
    v_role              TEXT;
    v_key               TEXT;
BEGIN
    -- Derive identity from auth context
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user session';
    END IF;

    -- Validate caller-supplied ID matches auth context
    IF p_caller_user_id IS NOT NULL AND p_caller_user_id <> v_caller THEN
        RAISE EXCEPTION 'FORBIDDEN: caller identity mismatch';
    END IF;

    -- Pre-enforcement guard: target must be known status string
    IF p_target_status NOT IN ('CREATED','BOOKED','AWAITING_PICKUP','PICKUP_ACKNOWLEDGED',
                                'IN_TRANSIT','AT_BORDER','DELIVERED','COMPLETED','CANCELLED','DELAYED') THEN
        RAISE EXCEPTION 'INVALID_STATUS: % is not a valid tracking status', p_target_status;
    END IF;

    -- Read current tracking record
    SELECT * INTO v_record
    FROM logistics_schema.shipment_tracking_records
    WHERE id = p_tracking_id AND is_deleted = FALSE;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;
    v_current_state := v_record.status;

    -- Resolve caller role from platform_roles
    SELECT pr.role INTO v_role
    FROM app.platform_roles pr
    WHERE pr.user_id = v_caller
    LIMIT 1;

    -- Validate role + scope based on role hierarchy
    IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN
        NULL;
    ELSIF v_role = 'MODERATOR' THEN
        NULL;
    ELSIF v_role = 'DISPATCHER' OR logistics_schema.delegated_principal() IS NOT NULL THEN
        -- I-2 PART A: authority is the ACTIVE DELEGATION, not a platform_roles row. A legacy DISPATCHER row
        -- with no delegation reaches the inner test and is refused; a delegate with no platform_roles row at
        -- all is admitted on scope and row attribution alone.
        IF NOT (public.has_operational_scope('tracking_update')
                AND logistics_schema.delegated_shipment(p_tracking_id)) THEN
            RAISE EXCEPTION 'FORBIDDEN: tracking % is outside the caller''s delegated Transporter scope, or tracking_update was not delegated', p_tracking_id;
        END IF;
    ELSIF v_role = 'TRANSPORTER' THEN
        IF NOT EXISTS (
            SELECT 1 FROM logistics_schema.bookings b
            JOIN logistics_schema.shipment_tracking_records tr ON tr.booking_id = b.id
            WHERE tr.id = p_tracking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: transporter cannot update another entity''s tracking';
        END IF;
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');
    END IF;

    -- STATE MACHINE ENFORCEMENT (DEFECT-003 fix)
    -- Reproduces authoritative VALID_TRANSITIONS from tracking-state-machine.ts
    -- Defense-in-depth: prevents direct RPC abuse bypassing API applyTrackingTransition()
    v_key := v_current_state || '|' || p_target_status;
    IF NOT (
        (v_current_state = 'CREATED' AND p_target_status IN ('BOOKED','DELAYED'))
        OR (v_current_state = 'BOOKED' AND p_target_status IN ('AWAITING_PICKUP','CANCELLED','DELAYED'))
        OR (v_current_state = 'AWAITING_PICKUP' AND p_target_status IN ('PICKUP_ACKNOWLEDGED','CANCELLED','DELAYED'))
        OR (v_current_state = 'PICKUP_ACKNOWLEDGED' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
        OR (v_current_state = 'IN_TRANSIT' AND p_target_status IN ('AT_BORDER','DELIVERED','CANCELLED','DELAYED'))
        OR (v_current_state = 'AT_BORDER' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
        OR (v_current_state = 'DELAYED' AND p_target_status IN ('AWAITING_PICKUP','IN_TRANSIT','AT_BORDER','DELIVERED','CANCELLED'))
        OR (v_current_state = 'DELIVERED' AND p_target_status IN ('COMPLETED','CANCELLED'))
        OR (v_current_state IN ('COMPLETED','CANCELLED') AND p_target_status = v_current_state)
    ) THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % -> % is not permitted per MOD-003', v_current_state, p_target_status;
    END IF;

    -- Terminal state guard (redundant safety)
    IF v_current_state IN ('COMPLETED', 'CANCELLED') AND v_current_state <> p_target_status THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % is terminal, no outgoing transitions', v_current_state;
    END IF;

    -- Atomic UPDATE + INSERT within single DB transaction
    BEGIN
        UPDATE logistics_schema.shipment_tracking_records
        SET status = p_target_status, last_updated = NOW(), updated_at = NOW(), version = COALESCE(version, 1) + 1
        WHERE id = p_tracking_id AND is_deleted = FALSE;

        INSERT INTO logistics_schema.tracking_events (tracking_id, event_type, event_timestamp, source, state_from, state_to, metadata)
        VALUES (p_tracking_id, 'SHIPMENT_' || UPPER(p_target_status), NOW(), p_source_module, v_current_state, p_target_status, jsonb_build_object('caller_user_id', v_caller, 'previous_status', v_current_state));

    EXCEPTION WHEN OTHERS THEN RAISE;
    END;
END;
$$;

COMMENT ON FUNCTION public.atomic_tracking_status_update(UUID, VARCHAR, VARCHAR, UUID) IS
  'I-2: the dispatcher branch is authorized by app.operational_delegations (scope tracking_update) plus the '
  'shipment''s booking transporter, not by app.platform_roles or assigned_transporter_id. Governance and '
  'transporter branches unchanged from 024. search_path pinned (042) and restated here.';

-- 042's privilege posture is preserved explicitly rather than assumed to survive the reissue.
REVOKE EXECUTE ON FUNCTION public.atomic_tracking_status_update(UUID, VARCHAR, VARCHAR, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atomic_tracking_status_update(UUID, VARCHAR, VARCHAR, UUID) TO authenticated;
