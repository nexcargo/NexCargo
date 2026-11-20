DO $fc072$
BEGIN
  IF (SELECT count(*) FROM logistics_schema.driver_identity_verifications) <> 0 THEN
    RAISE EXCEPTION 'FC072 PRE: driver_identity_verifications is not empty';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'logistics_schema.driver_identity_verifications'::regclass
      AND conname = 'driver_identity_verifications_driver_id_fkey'
      AND confrelid = 'auth.users'::regclass
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'FC072 PRE: expected driver_id FK to auth.users is absent';
  END IF;

  ALTER TABLE logistics_schema.driver_identity_verifications
    DROP CONSTRAINT driver_identity_verifications_driver_id_fkey;

  ALTER TABLE logistics_schema.driver_identity_verifications
    ADD CONSTRAINT driver_identity_verifications_driver_id_fkey
    FOREIGN KEY (driver_id) REFERENCES logistics_schema.drivers(id);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'logistics_schema.driver_identity_verifications'::regclass
      AND conname = 'driver_identity_verifications_driver_id_fkey'
      AND confrelid = 'logistics_schema.drivers'::regclass
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'FC072 POST: driver_id FK was not aligned to drivers(id)';
  END IF;
END
$fc072$;
