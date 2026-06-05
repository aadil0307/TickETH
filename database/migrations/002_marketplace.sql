-- ──────────────────────────────────────────────────────────────
--  TickETH — Migration 002: Marketplace & Resale Feature
-- ──────────────────────────────────────────────────────────────
--  Run this AFTER 001_initial_schema.sql in Supabase SQL Editor.
--
--  Changes:
--   1. Add 'listed' value to ticket_status enum
--   2. Add resale audit actions to audit_action enum
--   3. Add max_resales, max_price_deviation_bps to ticket_tiers
--   4. Add transfer_count, original_price_wei to tickets
--   5. Create marketplace_listings table
--   6. Create resale_history table
--   7. New indexes, RLS policies, triggers, views
--   8. Enable realtime for new tables
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────
--  1. Enum Extensions
-- ──────────────────────────────────────────────────────────────

-- Add 'listed' to ticket_status
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'listed' AFTER 'minted';

-- Add resale-related audit actions
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ticket_listed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ticket_delisted';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ticket_resold';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'listing_cancelled';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'event_deleted';


-- ──────────────────────────────────────────────────────────────
--  2. Alter ticket_tiers — Add Resale Config
-- ──────────────────────────────────────────────────────────────

-- Max number of resales allowed per ticket in this tier (0 = unlimited)
ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS max_resales INTEGER NOT NULL DEFAULT 0;

-- Max allowed price deviation from original mint price in basis points
-- e.g., 1000 = ±10%, 2000 = ±20%, 0 = no cap
ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS max_price_deviation_bps INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN ticket_tiers.max_resales
  IS 'Max resales per ticket in this tier (0 = unlimited)';
COMMENT ON COLUMN ticket_tiers.max_price_deviation_bps
  IS 'Max ± deviation from original price in bps (1000 = 10%, 0 = no cap)';


-- ──────────────────────────────────────────────────────────────
--  3. Alter tickets — Add Resale Tracking
-- ──────────────────────────────────────────────────────────────

-- Number of completed resales for this ticket
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS transfer_count INTEGER NOT NULL DEFAULT 0;

-- Original mint price snapshot in wei string (for price deviation checks)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS original_price_wei TEXT NOT NULL DEFAULT '0';

COMMENT ON COLUMN tickets.transfer_count
  IS 'Number of completed resales (incremented each time ticket is sold on marketplace)';
COMMENT ON COLUMN tickets.original_price_wei
  IS 'Original mint price in wei — used as baseline for resale price deviation enforcement';


-- ──────────────────────────────────────────────────────────────
--  4. Marketplace Listings Table
-- ──────────────────────────────────────────────────────────────

CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled');

CREATE TABLE marketplace_listings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  tier_id           UUID NOT NULL REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  seller_wallet     TEXT NOT NULL,
  contract_address  TEXT NOT NULL,
  token_id          INTEGER NOT NULL,
  asking_price      NUMERIC(20, 8) NOT NULL,       -- in MATIC
  asking_price_wei  TEXT NOT NULL,                  -- exact wei string
  original_price    NUMERIC(20, 8) NOT NULL,       -- original mint price
  original_price_wei TEXT NOT NULL,                 -- original mint price in wei
  status            listing_status NOT NULL DEFAULT 'active',
  listed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  buyer_wallet      TEXT,                          -- populated on sale
  sale_tx_hash      TEXT,                          -- on-chain sale tx
  platform_fee_wei  TEXT,                          -- platform fee deducted
  seller_proceeds_wei TEXT,                        -- seller received
  listing_tx_hash   TEXT,                          -- listing tx (escrow transfer)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketplace_listings IS 'Resale listings for NFT tickets on the TickETH marketplace';
COMMENT ON COLUMN marketplace_listings.asking_price_wei IS 'Exact asking price in wei as string for precision';


-- ──────────────────────────────────────────────────────────────
--  5. Resale History Table (Immutable Log)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE resale_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id        UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  token_id          INTEGER NOT NULL,
  contract_address  TEXT NOT NULL,
  seller_wallet     TEXT NOT NULL,
  buyer_wallet      TEXT NOT NULL,
  sale_price_wei    TEXT NOT NULL,
  original_price_wei TEXT NOT NULL,
  platform_fee_wei  TEXT NOT NULL DEFAULT '0',
  seller_proceeds_wei TEXT NOT NULL DEFAULT '0',
  resale_number     INTEGER NOT NULL,              -- which resale was this (1st, 2nd, etc.)
  tx_hash           TEXT,
  sold_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE resale_history IS 'Immutable record of every completed resale transaction';
COMMENT ON COLUMN resale_history.resale_number IS 'Sequential resale number for this ticket (1 = first resale, etc.)';


-- ──────────────────────────────────────────────────────────────
--  6. Indexes
-- ──────────────────────────────────────────────────────────────

-- Marketplace Listings
CREATE INDEX idx_listings_ticket ON marketplace_listings (ticket_id);
CREATE INDEX idx_listings_event ON marketplace_listings (event_id);
CREATE INDEX idx_listings_seller ON marketplace_listings (seller_wallet);
CREATE INDEX idx_listings_status ON marketplace_listings (status);
CREATE INDEX idx_listings_contract ON marketplace_listings (contract_address);
CREATE INDEX idx_listings_contract_token ON marketplace_listings (contract_address, token_id);
CREATE INDEX idx_listings_listed_at ON marketplace_listings (listed_at);

-- Active listings only (partial index for fast queries)
CREATE INDEX idx_listings_active ON marketplace_listings (event_id, status)
  WHERE status = 'active';

-- Resale History
CREATE INDEX idx_resale_history_ticket ON resale_history (ticket_id);
CREATE INDEX idx_resale_history_event ON resale_history (event_id);
CREATE INDEX idx_resale_history_seller ON resale_history (seller_wallet);
CREATE INDEX idx_resale_history_buyer ON resale_history (buyer_wallet);
CREATE INDEX idx_resale_history_listing ON resale_history (listing_id);
CREATE INDEX idx_resale_history_contract_token ON resale_history (contract_address, token_id);


-- ──────────────────────────────────────────────────────────────
--  7. Triggers
-- ──────────────────────────────────────────────────────────────

-- updated_at trigger for marketplace_listings
CREATE TRIGGER set_updated_at_listings
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Prevent updates on resale_history (immutable)
CREATE TRIGGER no_update_resale_history
  BEFORE UPDATE ON resale_history
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_update();


-- ──────────────────────────────────────────────────────────────
--  8. Row Level Security (RLS)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resale_history ENABLE ROW LEVEL SECURITY;


-- ── 8.1 Marketplace Listings Policies ────────────────────────

-- Active listings are public (anyone can browse the marketplace)
CREATE POLICY listings_select_all ON marketplace_listings
  FOR SELECT USING (true);

-- Only service role (backend) can insert listings
CREATE POLICY listings_insert_service ON marketplace_listings
  FOR INSERT WITH CHECK (
    auth_role() = 'service_role' OR is_admin()
  );

-- Only service role (backend) can update listings (mark sold/cancelled)
CREATE POLICY listings_update_service ON marketplace_listings
  FOR UPDATE USING (
    auth_role() = 'service_role' OR is_admin()
  );

-- No deletes on listings
CREATE POLICY listings_no_delete ON marketplace_listings
  FOR DELETE USING (false);


-- ── 8.2 Resale History Policies ──────────────────────────────

-- Users can see resale history for their own tickets; organizers see their events; admin sees all
CREATE POLICY resale_history_select ON resale_history
  FOR SELECT USING (
    seller_wallet = auth_wallet()
    OR buyer_wallet = auth_wallet()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = resale_history.event_id
      AND e.organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
    )
    OR is_admin()
  );

-- Only service role can insert
CREATE POLICY resale_history_insert_service ON resale_history
  FOR INSERT WITH CHECK (
    auth_role() = 'service_role' OR is_admin()
  );

-- No updates or deletes (immutable)
CREATE POLICY resale_history_no_update ON resale_history
  FOR UPDATE USING (false);

CREATE POLICY resale_history_no_delete ON resale_history
  FOR DELETE USING (false);


-- ──────────────────────────────────────────────────────────────
--  9. Views
-- ──────────────────────────────────────────────────────────────

-- Active marketplace listings (for browsing)
CREATE OR REPLACE VIEW active_listings AS
SELECT
  ml.id AS listing_id,
  ml.event_id,
  ml.ticket_id,
  ml.seller_wallet,
  ml.token_id,
  ml.asking_price,
  ml.asking_price_wei,
  ml.original_price,
  ml.original_price_wei,
  ml.listed_at,
  e.title AS event_title,
  e.start_time AS event_start_time,
  e.venue AS event_venue,
  tt.name AS tier_name,
  tt.max_resales,
  tt.max_price_deviation_bps,
  t.transfer_count
FROM marketplace_listings ml
JOIN events e ON e.id = ml.event_id
JOIN ticket_tiers tt ON tt.id = ml.tier_id
JOIN tickets t ON t.id = ml.ticket_id
WHERE ml.status = 'active';

-- Marketplace stats (for organizer/admin dashboard)
CREATE OR REPLACE VIEW marketplace_stats AS
SELECT
  e.id AS event_id,
  e.title,
  COUNT(DISTINCT CASE WHEN ml.status = 'active' THEN ml.id END) AS active_listings,
  COUNT(DISTINCT CASE WHEN ml.status = 'sold' THEN ml.id END) AS total_sold,
  COUNT(DISTINCT CASE WHEN ml.status = 'cancelled' THEN ml.id END) AS total_cancelled,
  COALESCE(SUM(CASE WHEN ml.status = 'sold' THEN ml.asking_price ELSE 0 END), 0) AS total_resale_volume
FROM events e
LEFT JOIN marketplace_listings ml ON ml.event_id = e.id
GROUP BY e.id, e.title;


-- ──────────────────────────────────────────────────────────────
--  10. Realtime Subscriptions
-- ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_listings;


-- ──────────────────────────────────────────────────────────────
--  Done! Migration 002 complete.
-- ──────────────────────────────────────────────────────────────
