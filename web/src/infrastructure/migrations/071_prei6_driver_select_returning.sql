DO $fc071$
DECLARE
  v_expr TEXT;
BEGIN
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass) <> 2
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass) <> 3 THEN
    RAISE EXCEPTION 'FC071 PRE: a target table policy count differs from the measured before-state';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policy
              WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass
                AND polname = 'Driver reads own GPS updates')
     OR EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass
                   AND polname = 'Driver reads own verifications')
     OR EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass
                   AND polname = 'Driver reads own POD') THEN
    RAISE EXCEPTION 'FC071 PRE: a driver SELECT policy already exists';
  END IF;

  EXECUTE $sql$CREATE POLICY "Driver reads own GPS updates"
    ON logistics_schema.gps_location_updates FOR SELECT TO authenticated
    USING (
      public.effective_marketplace_role() IS NULL
      AND public.effective_user_role() IS NULL
      AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        WHERE d.platform_user_id = auth.uid()
          AND aa.shipment_tracking_id = gps_location_updates.tracking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
      )
    )$sql$;

  EXECUTE $sql$CREATE POLICY "Driver reads own verifications"
    ON logistics_schema.driver_identity_verifications FOR SELECT TO authenticated
    USING (
      public.effective_marketplace_role() IS NULL
      AND public.effective_user_role() IS NULL
      AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        JOIN logistics_schema.shipment_tracking_records tr ON tr.id = aa.shipment_tracking_id
        WHERE d.platform_user_id = auth.uid()
          AND d.id = driver_identity_verifications.driver_id
          AND aa.shipment_tracking_id = driver_identity_verifications.tracking_id
          AND tr.booking_id = driver_identity_verifications.booking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
          AND tr.is_deleted = false
      )
    )$sql$;

  EXECUTE $sql$CREATE POLICY "Driver reads own POD"
    ON logistics_schema.proof_of_delivery FOR SELECT TO authenticated
    USING (
      public.effective_marketplace_role() IS NULL
      AND public.effective_user_role() IS NULL
      AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        JOIN logistics_schema.shipment_tracking_records tr ON tr.id = aa.shipment_tracking_id
        JOIN logistics_schema.bookings b ON b.id = tr.booking_id
        WHERE d.platform_user_id = auth.uid()
          AND aa.shipment_tracking_id = proof_of_delivery.tracking_id
          AND tr.booking_id = proof_of_delivery.booking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
          AND b.is_deleted = false
          AND tr.is_deleted = false
      )
    )$sql$;

  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass) <> 4
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass) <> 4 THEN
    RAISE EXCEPTION 'FC071 POST: a policy count did not advance by exactly one';
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.gps_location_updates'::regclass
     AND p.polname = 'Driver reads own GPS updates';
  IF v_expr IS NULL
     OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, 'aa.shipment_tracking_id = gps_location_updates.tracking_id') = 0
     OR strpos(v_expr, 'effective_marketplace_role() IS NULL') = 0
     OR strpos(v_expr, 'effective_user_role() IS NULL') = 0 THEN
    RAISE EXCEPTION 'FC071 POST: GPS driver SELECT policy is absent or out of scope';
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.driver_identity_verifications'::regclass
     AND p.polname = 'Driver reads own verifications';
  IF v_expr IS NULL
     OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, 'd.id = driver_identity_verifications.driver_id') = 0
     OR strpos(v_expr, 'tr.booking_id = driver_identity_verifications.booking_id') = 0
     OR strpos(v_expr, 'effective_marketplace_role() IS NULL') = 0
     OR strpos(v_expr, 'effective_user_role() IS NULL') = 0 THEN
    RAISE EXCEPTION 'FC071 POST: verification driver SELECT policy is absent or out of scope';
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
     AND p.polname = 'Driver reads own POD';
  IF v_expr IS NULL
     OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, 'aa.shipment_tracking_id = proof_of_delivery.tracking_id') = 0
     OR strpos(v_expr, 'tr.booking_id = proof_of_delivery.booking_id') = 0
     OR strpos(v_expr, 'effective_marketplace_role() IS NULL') = 0
     OR strpos(v_expr, 'effective_user_role() IS NULL') = 0 THEN
    RAISE EXCEPTION 'FC071 POST: POD driver SELECT policy is absent or out of scope';
  END IF;
END
$fc071$;
