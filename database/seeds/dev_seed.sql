-- ════════════════════════════════════════════════════════════════
--  TickETH Development Seed Data
--  Run AFTER 001_initial_schema.sql
--  
--  Creates:
--   • 4 test users (admin, organizer, attendee, volunteer)
--   • 1 organizer request (approved)
--   • 2 sample events with tiers
--   • Sample tickets and checkin logs
--
--  All wallet addresses use Hardhat's default test accounts.
-- ════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
--  1. Test Users
-- ──────────────────────────────────────────────────────────────

INSERT INTO users (id, wallet_address, email, display_name, role, consent_given, consent_at) VALUES
  -- Hardhat Account #0 → Admin
  (
    'a0000000-0000-0000-0000-000000000001',
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    'admin@ticketh.dev',
    'Platform Admin',
    'admin',
    true,
    now()
  ),
  -- Hardhat Account #1 → Organizer
  (
    'a0000000-0000-0000-0000-000000000002',
    '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    'organizer@ticketh.dev',
    'Crypto Events Co.',
    'organizer',
    true,
    now()
  ),
  -- Hardhat Account #2 → Attendee
  (
    'a0000000-0000-0000-0000-000000000003',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    'attendee@ticketh.dev',
    'Test Attendee',
    'attendee',
    true,
    now()
  ),
  -- Hardhat Account #3 → Volunteer
  (
    'a0000000-0000-0000-0000-000000000004',
    '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
    null,
    'Gate Volunteer',
    'volunteer',
    true,
    now()
  )
ON CONFLICT (wallet_address) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  2. Organizer Request (Approved)
-- ──────────────────────────────────────────────────────────────

INSERT INTO organizer_requests (
  id, user_id, wallet_address, org_name, bio, website, status, reviewed_at, reviewed_by
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  'Crypto Events Co.',
  'We organize the best Web3 events in India.',
  'https://cryptoevents.example.com',
  'approved',
  now(),
  'a0000000-0000-0000-0000-000000000001'  -- approved by admin
)
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  3. Sample Events
-- ──────────────────────────────────────────────────────────────

-- Event 1: Upcoming hackathon
INSERT INTO events (
  id, organizer_id, title, description, venue, venue_address, city, country,
  start_time, end_time, chain_id, status, max_capacity
) VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'ETH India Hackathon 2025',
  'The largest Ethereum hackathon in India. 3 days of building, learning, and vibes.',
  'KTPO Convention Center',
  'Whitefield, ITPL Main Rd',
  'Bangalore',
  'India',
  now() + INTERVAL '30 days',
  now() + INTERVAL '33 days',
  80002,       -- Polygon Amoy testnet
  'published',
  500
)
ON CONFLICT DO NOTHING;

-- Event 2: Past/completed concert
INSERT INTO events (
  id, organizer_id, title, description, venue, city, country,
  start_time, end_time, chain_id, status, max_capacity
) VALUES (
  'c0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'Web3 Music Night',
  'Live electronic music meets NFTs. Ticket holders get exclusive digital collectibles.',
  'Ziro Valley',
  'Delhi',
  'India',
  now() - INTERVAL '7 days',
  now() - INTERVAL '7 days' + INTERVAL '6 hours',
  80002,
  'completed',
  200
)
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  4. Ticket Tiers
-- ──────────────────────────────────────────────────────────────

-- ETH India: 3 tiers
INSERT INTO ticket_tiers (id, event_id, tier_index, name, description, price, price_wei, max_supply, max_per_wallet, start_time, end_time) VALUES
  (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    0,
    'General Admission',
    'Access to all talks and workshops',
    0.5,
    '500000000000000000',
    300,
    2,
    now(),
    now() + INTERVAL '29 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    1,
    'VIP Pass',
    'Front row seats, backstage access, exclusive NFT artwork',
    2.0,
    '2000000000000000000',
    50,
    1,
    now(),
    now() + INTERVAL '25 days'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    2,
    'Hacker Pass',
    'Full hackathon participation with meals and swag',
    0.0,
    '0',
    150,
    1,
    now() + INTERVAL '5 days',
    now() + INTERVAL '20 days'
  )
ON CONFLICT DO NOTHING;

-- Web3 Music Night: 2 tiers
INSERT INTO ticket_tiers (id, event_id, tier_index, name, description, price, price_wei, max_supply, minted, max_per_wallet) VALUES
  (
    'd0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000002',
    0,
    'Standard',
    'General entry',
    0.25,
    '250000000000000000',
    150,
    142,
    3
  ),
  (
    'd0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000002',
    1,
    'Collector Edition',
    'Limited edition ticket with exclusive on-chain art',
    1.5,
    '1500000000000000000',
    50,
    50,
    1
  )
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  5. Sample Tickets (for completed event)
-- ──────────────────────────────────────────────────────────────

INSERT INTO tickets (
  id, token_id, contract_address, event_id, tier_id,
  owner_wallet, original_wallet, status, tx_hash, minted_at, checked_in_at
) VALUES
  (
    'e0000000-0000-0000-0000-000000000001',
    1,
    '0x0000000000000000000000000000000000000001',  -- placeholder
    'c0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000004',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    'checked_in',
    '0xabc123def456789000000000000000000000000000000000000000000000001',
    now() - INTERVAL '8 days',
    now() - INTERVAL '7 days'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    2,
    '0x0000000000000000000000000000000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000005',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    'minted',
    '0xabc123def456789000000000000000000000000000000000000000000000002',
    now() - INTERVAL '8 days',
    NULL
  )
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  6. Sample Checkin Log
-- ──────────────────────────────────────────────────────────────

INSERT INTO checkin_logs (
  id, ticket_id, event_id, volunteer_id, nonce, confirmed_at, result
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000004',
  'nonce_abc123_single_use',
  now() - INTERVAL '7 days',
  'success'
)
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────
--  7. Sample Audit Logs
-- ──────────────────────────────────────────────────────────────

INSERT INTO audit_logs (actor_id, actor_wallet, action, entity_type, entity_id, details) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    'organizer_request_approved',
    'organizer_request',
    'b0000000-0000-0000-0000-000000000001',
    '{"org_name": "Crypto Events Co."}'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    'event_created',
    'event',
    'c0000000-0000-0000-0000-000000000001',
    '{"title": "ETH India Hackathon 2025"}'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    'event_published',
    'event',
    'c0000000-0000-0000-0000-000000000001',
    '{"title": "ETH India Hackathon 2025"}'::jsonb
  );


-- ──────────────────────────────────────────────────────────────
--  Done! Dev seed data loaded.
-- ──────────────────────────────────────────────────────────────
