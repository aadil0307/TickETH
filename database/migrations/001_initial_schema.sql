-- ════════════════════════════════════════════════════════════════
--  TickETH Database Migration
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--  
--  Tables:
--   1. users
--   2. organizer_requests
--   3. events
--   4. ticket_tiers
--   5. tickets
--   6. checkin_logs
--   7. audit_logs
--
--  Includes: Enums, Indexes, RLS Policies, Functions, Triggers
-- ════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
--  0. Extensions
-- ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ──────────────────────────────────────────────────────────────
--  1. Custom Enums
-- ──────────────────────────────────────────────────────────────

-- User roles
CREATE TYPE user_role AS ENUM (
  'visitor',      -- browsing only, no wallet connected
  'attendee',     -- wallet connected, can mint tickets
  'organizer',    -- approved to create events
  'admin',        -- platform admin
  'volunteer'     -- mobile-only, scans tickets at events
);

-- Organizer request status
CREATE TYPE request_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- Event status
CREATE TYPE event_status AS ENUM (
  'draft',        -- organizer is setting up
  'published',    -- visible to public, sales may or may not be open
  'live',         -- event is currently happening
  'completed',    -- event is over
  'cancelled'     -- event was cancelled
);

-- Ticket status
CREATE TYPE ticket_status AS ENUM (
  'minted',       -- NFT minted, not yet used
  'transferred',  -- transferred to another wallet
  'checked_in',   -- used for entry
  'invalidated'   -- voided by organizer/admin
);

-- Checkin result
CREATE TYPE checkin_result AS ENUM (
  'success',
  'failed_invalid_ticket',
  'failed_already_checked_in',
  'failed_invalid_nonce',
  'failed_confirmation_timeout',
  'pending_confirmation'
);

-- Audit action type
CREATE TYPE audit_action AS ENUM (
  'user_created',
  'role_changed',
  'organizer_request_submitted',
  'organizer_request_approved',
  'organizer_request_rejected',
  'event_created',
  'event_published',
  'event_completed',
  'event_cancelled',
  'ticket_minted',
  'ticket_transferred',
  'ticket_checked_in',
  'ticket_invalidated',
  'admin_action'
);


-- ──────────────────────────────────────────────────────────────
--  2. Tables
-- ──────────────────────────────────────────────────────────────

-- ── 2.1 Users ─────────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address  TEXT NOT NULL UNIQUE,
  email           TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'attendee',
  consent_given   BOOLEAN NOT NULL DEFAULT false,       -- DPDP compliance
  consent_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce lowercase wallet addresses
ALTER TABLE users ADD CONSTRAINT users_wallet_lowercase
  CHECK (wallet_address = lower(wallet_address));

COMMENT ON TABLE users IS 'Platform users identified by wallet address';
COMMENT ON COLUMN users.consent_given IS 'DPDP Act: user has given consent for data processing';


-- ── 2.2 Organizer Requests ────────────────────────────────────

CREATE TABLE organizer_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address  TEXT NOT NULL,
  org_name        TEXT NOT NULL,
  bio             TEXT,
  website         TEXT,
  social_links    JSONB DEFAULT '{}',
  status          request_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES users(id)
);

COMMENT ON TABLE organizer_requests IS 'Organizer role applications reviewed by admins';


-- ── 2.3 Events ────────────────────────────────────────────────

CREATE TABLE events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title             TEXT NOT NULL,
  description       TEXT,
  banner_url        TEXT,
  venue             TEXT,
  venue_address     TEXT,
  city              TEXT,
  country           TEXT DEFAULT 'India',
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  contract_address  TEXT,                               -- deployed clone address
  chain_id          INTEGER NOT NULL DEFAULT 80002,     -- Polygon Amoy
  factory_address   TEXT,                               -- factory that deployed it
  status            event_status NOT NULL DEFAULT 'draft',
  max_capacity      INTEGER,
  metadata_locked   BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE events IS 'Events created by approved organizers';
COMMENT ON COLUMN events.chain_id IS '80002 = Polygon Amoy (testnet), 137 = Polygon Mainnet';


-- ── 2.4 Ticket Tiers ─────────────────────────────────────────

CREATE TABLE ticket_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_index      INTEGER NOT NULL,                     -- matches on-chain tierId
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(20, 8) NOT NULL DEFAULT 0,    -- price in MATIC (supports decimals)
  price_wei       TEXT NOT NULL DEFAULT '0',             -- exact wei string for on-chain
  currency        TEXT NOT NULL DEFAULT 'MATIC',
  max_supply      INTEGER NOT NULL,
  minted          INTEGER NOT NULL DEFAULT 0,
  resale_allowed  BOOLEAN NOT NULL DEFAULT true,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  max_per_wallet  INTEGER NOT NULL DEFAULT 0,            -- 0 = unlimited
  merkle_root     TEXT,                                  -- whitelist root (null = public)
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_tier_per_event UNIQUE (event_id, tier_index)
);

COMMENT ON TABLE ticket_tiers IS 'Ticket pricing tiers per event (mirrors on-chain tiers)';
COMMENT ON COLUMN ticket_tiers.tier_index IS 'Matches the on-chain tierId in the smart contract';
COMMENT ON COLUMN ticket_tiers.price_wei IS 'Exact price in wei as string to avoid JS number precision issues';


-- ── 2.5 Tickets ───────────────────────────────────────────────

CREATE TABLE tickets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id          INTEGER NOT NULL,                   -- on-chain ERC-721 token ID
  contract_address  TEXT NOT NULL,                      -- event contract address
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  tier_id           UUID NOT NULL REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  owner_wallet      TEXT NOT NULL,                      -- current owner wallet
  original_wallet   TEXT NOT NULL,                      -- who originally minted
  status            ticket_status NOT NULL DEFAULT 'minted',
  tx_hash           TEXT,                               -- mint transaction hash
  minted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferred_at    TIMESTAMPTZ,
  checked_in_at     TIMESTAMPTZ,
  metadata_uri      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_token_per_contract UNIQUE (contract_address, token_id)
);

COMMENT ON TABLE tickets IS 'Off-chain mirror of minted NFT tickets';
COMMENT ON COLUMN tickets.token_id IS 'ERC-721 tokenId from the on-chain contract';


-- ── 2.6 Checkin Logs ──────────────────────────────────────────

CREATE TABLE checkin_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  volunteer_id    UUID REFERENCES users(id),            -- who scanned
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  nonce           TEXT NOT NULL,                        -- QR nonce used
  confirmed_at    TIMESTAMPTZ,                          -- when attendee confirmed
  result          checkin_result NOT NULL DEFAULT 'pending_confirmation',
  device_info     JSONB DEFAULT '{}',                   -- scanner device metadata
  ip_address      INET,
  offline_sync    BOOLEAN NOT NULL DEFAULT false,       -- was this scanned offline?
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE checkin_logs IS 'Every scan attempt is logged, including failures';
COMMENT ON COLUMN checkin_logs.nonce IS 'Single-use nonce from the dynamic QR code';
COMMENT ON COLUMN checkin_logs.offline_sync IS 'True if scanned offline and synced later';


-- ── 2.7 Audit Logs ───────────────────────────────────────────

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID REFERENCES users(id),            -- who performed the action
  actor_wallet    TEXT,                                  -- wallet of the actor
  action          audit_action NOT NULL,
  entity_type     TEXT NOT NULL,                        -- 'user', 'event', 'ticket', etc.
  entity_id       UUID,                                 -- ID of the affected entity
  details         JSONB DEFAULT '{}',                   -- arbitrary context data
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs are append-only (immutable)
COMMENT ON TABLE audit_logs IS 'Immutable audit trail — insert only, no updates or deletes';


-- ──────────────────────────────────────────────────────────────
--  3. Indexes
-- ──────────────────────────────────────────────────────────────

-- Users
CREATE INDEX idx_users_wallet ON users (wallet_address);
CREATE INDEX idx_users_role ON users (role);

-- Organizer Requests
CREATE INDEX idx_org_requests_user ON organizer_requests (user_id);
CREATE INDEX idx_org_requests_status ON organizer_requests (status);
CREATE INDEX idx_org_requests_wallet ON organizer_requests (wallet_address);

-- Events
CREATE INDEX idx_events_organizer ON events (organizer_id);
CREATE INDEX idx_events_status ON events (status);
CREATE INDEX idx_events_contract ON events (contract_address);
CREATE INDEX idx_events_start_time ON events (start_time);
CREATE INDEX idx_events_city ON events (city);

-- Ticket Tiers
CREATE INDEX idx_tiers_event ON ticket_tiers (event_id);

-- Tickets
CREATE INDEX idx_tickets_event ON tickets (event_id);
CREATE INDEX idx_tickets_owner ON tickets (owner_wallet);
CREATE INDEX idx_tickets_contract ON tickets (contract_address);
CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_tickets_contract_token ON tickets (contract_address, token_id);
CREATE INDEX idx_tickets_original_wallet ON tickets (original_wallet);

-- Checkin Logs
CREATE INDEX idx_checkin_ticket ON checkin_logs (ticket_id);
CREATE INDEX idx_checkin_event ON checkin_logs (event_id);
CREATE INDEX idx_checkin_volunteer ON checkin_logs (volunteer_id);
CREATE INDEX idx_checkin_result ON checkin_logs (result);
CREATE INDEX idx_checkin_nonce ON checkin_logs (nonce);

-- Audit Logs
CREATE INDEX idx_audit_actor ON audit_logs (actor_id);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at);


-- ──────────────────────────────────────────────────────────────
--  4. Updated_at Trigger Function
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_events
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_tiers
  BEFORE UPDATE ON ticket_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_tickets
  BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ──────────────────────────────────────────────────────────────
--  5. Audit Log Protection (Immutable)
-- ──────────────────────────────────────────────────────────────

-- Prevent updates on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable — updates not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit_logs
  BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_update();

-- NOTE: Delete prevention is handled via RLS policies below


-- ──────────────────────────────────────────────────────────────
--  6. Row Level Security (RLS)
-- ──────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;


-- ── Helper: Extract wallet from JWT ───────────────────────────
-- Our backend sets the JWT claim 'wallet_address' on auth
-- Supabase stores custom claims in auth.jwt() → raw_app_meta_data

CREATE OR REPLACE FUNCTION auth_wallet()
RETURNS TEXT AS $$
  SELECT lower(coalesce(
    current_setting('request.jwt.claims', true)::json->>'wallet_address',
    ''
  ));
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json->>'user_role',
    'visitor'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'admin';
$$ LANGUAGE sql STABLE;


-- ── 6.1 Users Policies ───────────────────────────────────────

-- Anyone can read basic user profiles (public profiles)
CREATE POLICY users_select_all ON users
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (wallet_address = auth_wallet());

-- Only backend service role can insert users
CREATE POLICY users_insert_service ON users
  FOR INSERT WITH CHECK (
    auth_role() = 'service_role' OR is_admin()
  );

-- Only admin can delete users (DPDP deletion requests)
CREATE POLICY users_delete_admin ON users
  FOR DELETE USING (is_admin());


-- ── 6.2 Organizer Requests Policies ──────────────────────────

-- Users can see their own requests, admins can see all
CREATE POLICY org_requests_select ON organizer_requests
  FOR SELECT USING (
    wallet_address = auth_wallet() OR is_admin()
  );

-- Users can submit their own request
CREATE POLICY org_requests_insert ON organizer_requests
  FOR INSERT WITH CHECK (wallet_address = auth_wallet());

-- Only admins can update requests (approve/reject)
CREATE POLICY org_requests_update ON organizer_requests
  FOR UPDATE USING (is_admin());


-- ── 6.3 Events Policies ─────────────────────────────────────

-- Published/live/completed events are public; drafts only visible to organizer/admin
CREATE POLICY events_select ON events
  FOR SELECT USING (
    status IN ('published', 'live', 'completed')
    OR organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
    OR is_admin()
  );

-- Organizers can create events
CREATE POLICY events_insert ON events
  FOR INSERT WITH CHECK (
    organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() AND role = 'organizer' LIMIT 1)
    OR is_admin()
  );

-- Organizers can update their own events; admins can update any
CREATE POLICY events_update ON events
  FOR UPDATE USING (
    organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
    OR is_admin()
  );


-- ── 6.4 Ticket Tiers Policies ────────────────────────────────

-- Tiers of visible events are public
CREATE POLICY tiers_select ON ticket_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_tiers.event_id
      AND (
        e.status IN ('published', 'live', 'completed')
        OR e.organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
        OR is_admin()
      )
    )
  );

-- Event organizer or admin can manage tiers
CREATE POLICY tiers_insert ON ticket_tiers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_tiers.event_id
      AND (
        e.organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
        OR is_admin()
      )
    )
  );

CREATE POLICY tiers_update ON ticket_tiers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_tiers.event_id
      AND (
        e.organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
        OR is_admin()
      )
    )
  );


-- ── 6.5 Tickets Policies ────────────────────────────────────

-- Users can see their own tickets; organizers can see event tickets; admin sees all
CREATE POLICY tickets_select ON tickets
  FOR SELECT USING (
    owner_wallet = auth_wallet()
    OR original_wallet = auth_wallet()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = tickets.event_id
      AND e.organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
    )
    OR is_admin()
  );

-- Only service role (backend) can insert/update tickets
CREATE POLICY tickets_insert_service ON tickets
  FOR INSERT WITH CHECK (
    auth_role() = 'service_role' OR is_admin()
  );

CREATE POLICY tickets_update_service ON tickets
  FOR UPDATE USING (
    auth_role() = 'service_role' OR is_admin()
  );


-- ── 6.6 Checkin Logs Policies ────────────────────────────────

-- Volunteers can see checkins for events they're assigned to; organizers see their events; admin sees all
CREATE POLICY checkin_select ON checkin_logs
  FOR SELECT USING (
    volunteer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = checkin_logs.event_id
      AND e.organizer_id = (SELECT id FROM users WHERE wallet_address = auth_wallet() LIMIT 1)
    )
    OR is_admin()
  );

-- Only service role (backend) can insert checkin logs
CREATE POLICY checkin_insert_service ON checkin_logs
  FOR INSERT WITH CHECK (
    auth_role() = 'service_role' OR is_admin()
  );

-- Only service role can update (confirm check-in)
CREATE POLICY checkin_update_service ON checkin_logs
  FOR UPDATE USING (
    auth_role() = 'service_role' OR is_admin()
  );


-- ── 6.7 Audit Logs Policies ─────────────────────────────────

-- Only admins can read audit logs
CREATE POLICY audit_select_admin ON audit_logs
  FOR SELECT USING (is_admin());

-- Only service role can insert
CREATE POLICY audit_insert_service ON audit_logs
  FOR INSERT WITH CHECK (
    auth_role() = 'service_role' OR is_admin()
  );

-- No one can update (enforced by trigger above)
-- No one can delete
CREATE POLICY audit_no_delete ON audit_logs
  FOR DELETE USING (false);


-- ──────────────────────────────────────────────────────────────
--  7. Useful Views
-- ──────────────────────────────────────────────────────────────

-- Event dashboard stats (for organizer dashboard)
CREATE OR REPLACE VIEW event_stats AS
SELECT
  e.id AS event_id,
  e.title,
  e.status,
  e.start_time,
  COUNT(DISTINCT t.id) AS total_tickets_sold,
  COUNT(DISTINCT CASE WHEN t.status = 'checked_in' THEN t.id END) AS total_checked_in,
  COALESCE(SUM(tt.price), 0) AS total_revenue,
  COUNT(DISTINCT t.owner_wallet) AS unique_attendees
FROM events e
LEFT JOIN tickets t ON t.event_id = e.id
LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
GROUP BY e.id, e.title, e.status, e.start_time;

-- Tier availability (for public event pages)
CREATE OR REPLACE VIEW tier_availability AS
SELECT
  tt.id AS tier_id,
  tt.event_id,
  tt.name,
  tt.price,
  tt.max_supply,
  tt.minted,
  (tt.max_supply - tt.minted) AS available,
  tt.active,
  tt.start_time,
  tt.end_time,
  tt.max_per_wallet
FROM ticket_tiers tt;


-- ──────────────────────────────────────────────────────────────
--  8. Realtime Subscriptions
-- ──────────────────────────────────────────────────────────────

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE checkin_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE events;


-- ──────────────────────────────────────────────────────────────
--  Done!
-- ──────────────────────────────────────────────────────────────
-- Migration complete. See SUPABASE_SETUP.md for dashboard setup guide.
