-- ──────────────────────────────────────────────────────────────
--  TickETH — Migration 003: FAQ & Support System
-- ──────────────────────────────────────────────────────────────
--  Run this AFTER 002_marketplace.sql in Supabase SQL Editor.
--
--  Changes:
--   1. Add support-related audit actions
--   2. Create faq_items table
--   3. Create support_tickets table
--   4. Create support_replies table
--   5. Indexes, RLS policies, triggers
--   6. Seed default FAQ items
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────
--  1. Enum Extensions
-- ──────────────────────────────────────────────────────────────

CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'support_ticket_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'support_ticket_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'support_reply_added';


-- ──────────────────────────────────────────────────────────────
--  2. FAQ Items
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS faq_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL DEFAULT 'General',
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE faq_items IS 'Frequently asked questions managed by admins';

CREATE INDEX idx_faq_items_category ON faq_items (category) WHERE is_active = TRUE;
CREATE INDEX idx_faq_items_sort ON faq_items (sort_order);


-- ──────────────────────────────────────────────────────────────
--  3. Support Tickets
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'Other',
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        support_ticket_status NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE support_tickets IS 'User-submitted help & support requests';

CREATE INDEX idx_support_tickets_user ON support_tickets (user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets (status);


-- ──────────────────────────────────────────────────────────────
--  4. Support Replies
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_replies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE support_replies IS 'Replies on support tickets from users or admins';

CREATE INDEX idx_support_replies_ticket ON support_replies (ticket_id);


-- ──────────────────────────────────────────────────────────────
--  5. Updated-at Triggers
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER trg_faq_items_updated_at
  BEFORE UPDATE ON faq_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ──────────────────────────────────────────────────────────────
--  6. RLS Policies
-- ──────────────────────────────────────────────────────────────

ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

-- FAQ: anyone can read active items
CREATE POLICY faq_items_select ON faq_items
  FOR SELECT USING (is_active = TRUE);

-- FAQ: only admins can insert/update/delete (via service role key)

-- Support tickets: users can see only their own
CREATE POLICY support_tickets_select ON support_tickets
  FOR SELECT USING (user_id = auth.uid());

-- Support tickets: users can create their own
CREATE POLICY support_tickets_insert ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Replies: users can see replies for their own tickets
CREATE POLICY support_replies_select ON support_replies
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  );

-- Replies: users can add replies to their own tickets
CREATE POLICY support_replies_insert ON support_replies
  FOR INSERT WITH CHECK (
    is_admin = FALSE
    AND user_id = auth.uid()
    AND ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  );


-- ──────────────────────────────────────────────────────────────
--  7. Seed Default FAQ Items
-- ──────────────────────────────────────────────────────────────

INSERT INTO faq_items (category, question, answer, sort_order) VALUES
  ('General', 'What is TickETH?', 'TickETH is a blockchain-based event ticketing platform built on Polygon. Each ticket is a verifiable NFT, ensuring authenticity and preventing fraud.', 1),
  ('General', 'How do I create an account?', 'Connect your wallet (MetaMask, Coinbase Wallet, or use our in-app wallet with email/Google/Apple) on the sign-in screen. Your wallet address becomes your identity.', 2),
  ('Tickets', 'How do I buy a ticket?', 'Browse events on the Discover tab, select an event, choose a ticket tier, and tap "Mint NFT Ticket." The ticket is minted as an ERC-721 NFT on Polygon.', 3),
  ('Tickets', 'Can I transfer my ticket?', 'Yes! Open your ticket details and tap "Transfer Ticket." Enter the recipient''s wallet address. The NFT will be transferred on-chain.', 4),
  ('Check-in', 'How does check-in work?', 'Open your ticket to see your dynamic QR code. A volunteer scans it, then you confirm the check-in by signing with your wallet.', 5),
  ('Marketplace', 'How do I resell a ticket?', 'Go to the Marketplace tab, tap "+", select a ticket to list, set your price (subject to the organizer''s price cap), and confirm.', 6),
  ('Wallet', 'Is my wallet secure?', 'TickETH uses thirdweb''s secure wallet infrastructure. Your private keys are never stored on our servers.', 7),
  ('Wallet', 'Which blockchain does TickETH use?', 'TickETH operates on the Polygon network (Amoy testnet during beta). Polygon offers fast and low-cost transactions.', 8);
