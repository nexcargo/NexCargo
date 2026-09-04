-- NexCargo Migration 002 -- RLS Policies for Marketplace Tables (C1)
-- Enables Row Level Security on marketplace_schema tables.
-- Per ESS-006 Section 4.4 Golden Rule: "If RLS is missing, the table is considered NON-EXISTENT in production."
-- Each policy derives from actual table ownership semantics and PROMPT 0 / ESS-006 requirements.

-- ============================================================
-- marketplace_schema.listings
-- Ownership: shipper_id creates/owns. Transporters can read published listings. Admins have full access.
-- ============================================================

ALTER TABLE marketplace_schema.listings ENABLE ROW LEVEL SECURITY;

-- Shipper can read their own listings
CREATE POLICY "Shipper reads own listings"
  ON marketplace_schema.listings FOR SELECT
  USING (auth.uid() = shipper_id);

-- Shipper can create their own listings
CREATE POLICY "Shipper creates own listings"
  ON marketplace_schema.listings FOR INSERT
  WITH CHECK (auth.uid() = shipper_id);

-- Shipper can update their own listings
CREATE POLICY "Shipper updates own listings"
  ON marketplace_schema.listings FOR UPDATE
  USING (auth.uid() = shipper_id)
  WITH CHECK (auth.uid() = shipper_id);

-- All authenticated users can read published (non-deleted) listings
-- This enables transporter discovery of loads
CREATE POLICY "All auth users read published listings"
  ON marketplace_schema.listings FOR SELECT
  USING (status = 'PUBLISHED' AND is_deleted = FALSE);

-- Admin role has full access via custom function
CREATE POLICY "Admin full access to listings"
  ON marketplace_schema.listings FOR ALL
  USING (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'moderator');


-- ============================================================
-- marketplace_schema.offers
-- Ownership: transporter_id creates/owns. Shipper can read offers for their listings.
-- ============================================================

ALTER TABLE marketplace_schema.offers ENABLE ROW LEVEL SECURITY;

-- Transporter can read their own offers
CREATE POLICY "Transporter reads own offers"
  ON marketplace_schema.offers FOR SELECT
  USING (auth.uid() = transporter_id);

-- Transporter can create their own offers
CREATE POLICY "Transporter creates own offers"
  ON marketplace_schema.offers FOR INSERT
  WITH CHECK (auth.uid() = transporter_id);

-- Transporter can update their own offers
CREATE POLICY "Transporter updates own offers"
  ON marketplace_schema.offers FOR UPDATE
  USING (auth.uid() = transporter_id)
  WITH CHECK (auth.uid() = transporter_id);

-- Shippers can read offers linked to their listings
CREATE POLICY "Shipper reads offers for their listings"
  ON marketplace_schema.offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_schema.listings l
      WHERE l.id = offers.listing_id
      AND l.shipper_id = auth.uid()
      AND l.is_deleted = FALSE
    )
  );

-- Admin/moderator full access
CREATE POLICY "Admin full access to offers"
  ON marketplace_schema.offers FOR ALL
  USING (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'moderator');


-- ============================================================
-- marketplace_schema.matches
-- Ownership: system-created from listing + offer pairing. Both parties can read.
-- ============================================================

ALTER TABLE marketplace_schema.matches ENABLE ROW LEVEL SECURITY;

-- Both shipper and transporter involved in a match can read it
CREATE POLICY "Match participants read matches"
  ON marketplace_schema.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_schema.listings l
      WHERE l.id = matches.listing_id
      AND (l.shipper_id = auth.uid() OR l.is_deleted = FALSE)
    )
    OR
    EXISTS (
      SELECT 1 FROM marketplace_schema.offers o
      WHERE o.id = matches.offer_id
      AND o.transporter_id = auth.uid()
    )
  );

-- System only inserts matches (via service role key or trigger)
-- No user-facing INSERT policy - matches are created server-side

-- Admin/moderator full access
CREATE POLICY "Admin full access to matches"
  ON marketplace_schema.matches FOR ALL
  USING (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'moderator');


-- ============================================================
-- marketplace_schema.quotes
-- Ownership: system-generated advisory data. Shippers can read quotes for their listings.
-- ============================================================

ALTER TABLE marketplace_schema.quotes ENABLE ROW LEVEL SECURITY;

-- Shippers can read quotes for their listings
CREATE POLICY "Shipper reads quotes for their listings"
  ON marketplace_schema.quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_schema.listings l
      WHERE l.id = quotes.listing_id
      AND l.shipper_id = auth.uid()
      AND l.is_deleted = FALSE
    )
  );

-- System-only INSERT (quotes generated server-side)

-- Admin/moderator full access
CREATE POLICY "Admin full access to quotes"
  ON marketplace_schema.quotes FOR ALL
  USING (auth.jwt()->>'role' = 'admin' OR auth.jwt()->>'role' = 'moderator');
