-- NexCargo Migration 026 — Bookings Table Privilege Correction
-- HAO Booking Authorization Remediation Phase 2
-- Grants minimum table privileges for 'authenticated' role required by direct-table Booking operations.
-- All Booking endpoints execute via BookingsRepository → createClient() → @supabase/ssr → JWT-injected PostgREST → 'authenticated' DB role.
-- NO service_role path exists for bookings. confirm_booking_with_contract() is SECURITY DEFINER but never invoked from TypeScript.
-- NO DELETE grant: Booking repository uses only insert/select/update; soft-delete via is_deleted flag, not DELETE command.

GRANT INSERT ON TABLE logistics_schema.bookings TO authenticated;
GRANT SELECT ON TABLE logistics_schema.bookings TO authenticated;
GRANT UPDATE ON TABLE logistics_schema.bookings TO authenticated;
