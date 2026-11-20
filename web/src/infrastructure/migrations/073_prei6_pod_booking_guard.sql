CREATE OR REPLACE FUNCTION public.booking_is_not_deleted(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fc073fn$
  SELECT EXISTS (
    SELECT 1
    FROM logistics_schema.bookings b
    WHERE b.id = p_booking_id
      AND b.is_deleted = false
  );
$fc073fn$;

REVOKE ALL ON FUNCTION public.booking_is_not_deleted(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_is_not_deleted(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.booking_is_not_deleted(UUID) TO authenticated;

DO $fc073$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.booking_is_not_deleted(uuid)'::regprocedure
      AND prosecdef
  ) THEN
    RAISE EXCEPTION 'FC073 PRE: booking_is_not_deleted is absent or not SECURITY DEFINER';
  END IF;

  EXECUTE $sql$DROP POLICY IF EXISTS "Transporter submits POD for own booking" ON logistics_schema.proof_of_delivery$sql$;
  EXECUTE $sql$CREATE POLICY "Transporter submits POD for own booking"
    ON logistics_schema.proof_of_delivery FOR INSERT
    WITH CHECK (
      (
        public.effective_marketplace_role() = 'TRANSPORTER'
        AND EXISTS (
          SELECT 1
          FROM logistics_schema.shipment_tracking_records tr
          JOIN logistics_schema.bookings b ON b.id = tr.booking_id
          WHERE tr.id = proof_of_delivery.tracking_id
            AND b.id = proof_of_delivery.booking_id
            AND b.transporter_id = auth.uid()
            AND b.is_deleted = false
            AND tr.is_deleted = false
        )
      )
      OR (
        public.effective_marketplace_role() IS NULL
        AND public.effective_user_role() IS NULL
        AND EXISTS (
          SELECT 1
          FROM logistics_schema.asset_assignments aa
          JOIN logistics_schema.drivers d ON d.id = aa.driver_id
          JOIN logistics_schema.shipment_tracking_records tr ON tr.id = aa.shipment_tracking_id
          WHERE d.platform_user_id = auth.uid()
            AND aa.shipment_tracking_id = proof_of_delivery.tracking_id
            AND tr.booking_id = proof_of_delivery.booking_id
            AND aa.status IN ('PLANNED', 'ACTIVE')
            AND tr.is_deleted = false
        )
        AND public.booking_is_not_deleted(proof_of_delivery.booking_id)
      )
    )$sql$;

  EXECUTE $sql$DROP POLICY IF EXISTS "Driver reads own POD" ON logistics_schema.proof_of_delivery$sql$;
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
        WHERE d.platform_user_id = auth.uid()
          AND aa.shipment_tracking_id = proof_of_delivery.tracking_id
          AND tr.booking_id = proof_of_delivery.booking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
          AND tr.is_deleted = false
      )
      AND public.booking_is_not_deleted(proof_of_delivery.booking_id)
    )$sql$;

  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass) <> 4 THEN
    RAISE EXCEPTION 'FC073 POST: POD policy count changed unexpectedly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass
      AND polname = 'Transporter submits POD for own booking'
      AND strpos(pg_get_expr(polwithcheck, polrelid), 'booking_is_not_deleted') > 0
  ) THEN
    RAISE EXCEPTION 'FC073 POST: POD INSERT driver branch is missing the booking guard helper';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass
      AND polname = 'Driver reads own POD'
      AND strpos(pg_get_expr(polqual, polrelid), 'booking_is_not_deleted') > 0
  ) THEN
    RAISE EXCEPTION 'FC073 POST: POD SELECT driver branch is missing the booking guard helper';
  END IF;
END
$fc073$;
