# Help & Support System — Design Document

## Overview

The Help & Support system provides three user-facing screens (FAQ, Help & Support, Terms of Service) and a database layer for managing FAQ content and user support tickets. Currently the mobile frontend is fully implemented; the backend API endpoints are stubbed with a TODO for future connection.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Mobile App                  │
│                                              │
│  settings.tsx ──► faq.tsx                    │
│       │ ──────► help-support.tsx             │
│       │ ──────► terms.tsx                    │
│                                              │
│  help-support.tsx ──► faq.tsx                │
│         │ ────────► terms.tsx                │
└────────────────────┬────────────────────────┘
                     │ (TODO: POST /api/v1/support)
                     ▼
┌─────────────────────────────────────────────┐
│              Backend (NestJS)                │
│  (endpoints not yet implemented)             │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│            Supabase (PostgreSQL)             │
│                                              │
│  faq_items         (admin-managed content)   │
│  support_tickets   (user-submitted requests) │
│  support_replies   (threaded replies)        │
└─────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `mobile/app/faq.tsx` | Accordion FAQ screen with category filtering |
| `mobile/app/help-support.tsx` | Support request form + quick links |
| `mobile/app/terms.tsx` | Static Terms of Service / DPDP page |
| `mobile/app/settings.tsx` | Entry point — links to FAQ, Help, and Terms |
| `mobile/app/_layout.tsx` | Route registration for all 4 new screens |
| `database/migrations/003_support_system.sql` | Tables, indexes, RLS, triggers, seed data |

---

## Database (Migration 003)

### Tables

#### `faq_items`

Stores FAQ entries managed by admins (via service_role key, bypassing RLS).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `category` | TEXT | e.g. "General", "Tickets", "Wallet" |
| `question` | TEXT | The question |
| `answer` | TEXT | The answer body |
| `sort_order` | INTEGER | Controls display order |
| `is_active` | BOOLEAN | Soft-delete flag (RLS only shows `TRUE`) |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**Indexes:**
- `idx_faq_items_category` — partial index on `category` WHERE `is_active = TRUE`
- `idx_faq_items_sort` — on `sort_order`

**RLS:** Anyone can `SELECT` active items. Insert/update/delete restricted to service_role.

#### `support_tickets`

User-submitted help requests.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | Submitting user |
| `category` | TEXT | "Ticket Purchase", "Check-in Problem", etc. |
| `subject` | TEXT | Brief summary (max 120 chars enforced client-side) |
| `message` | TEXT | Full description (max 2000 chars enforced client-side) |
| `status` | ENUM | `open` → `in_progress` → `resolved` → `closed` |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**Indexes:**
- `idx_support_tickets_user` — on `user_id`
- `idx_support_tickets_status` — on `status`

**RLS:**
- `SELECT`: Users can only see their own tickets (`user_id = auth.uid()`)
- `INSERT`: Users can only create tickets for themselves

#### `support_replies`

Threaded replies on support tickets (from users or admins).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `ticket_id` | UUID (FK → support_tickets) | Parent ticket |
| `user_id` | UUID (FK → users, nullable) | Reply author |
| `is_admin` | BOOLEAN | Whether this reply is from an admin |
| `message` | TEXT | Reply content |
| `created_at` | TIMESTAMPTZ | Auto-set |

**Indexes:**
- `idx_support_replies_ticket` — on `ticket_id`

**RLS:**
- `SELECT`: Users can read replies for their own tickets
- `INSERT`: Users can add non-admin replies to their own tickets only

### Enum

```sql
CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
```

### Audit Actions Added

- `support_ticket_created`
- `support_ticket_updated`
- `support_reply_added`

### Triggers

Both `faq_items` and `support_tickets` use the existing `update_updated_at_column()` function (defined in migration 001) to auto-set `updated_at` on every `UPDATE`.

### Seed Data

8 default FAQ items are inserted covering the categories: General, Tickets, Check-in, Marketplace, Wallet.

---

## Mobile Screens

### 1. FAQ (`mobile/app/faq.tsx`)

**Entry points:** Settings → FAQ, Help & Support → Quick Links → FAQ

**How it works:**
1. FAQ data is currently **hardcoded** in a `FAQ_DATA` array (11 items, 5 categories). This mirrors the seed data and can later be fetched from the `faq_items` table via API.
2. Category pills (`General`, `Tickets`, `Check-in`, `Marketplace`, `Wallet`) filter the displayed items.
3. Tapping a question expands it using `LayoutAnimation` (Android support enabled via `UIManager.setLayoutAnimationEnabledExperimental`).
4. Only one item can be expanded at a time — tapping another collapses the previous one.

**Key functions:**
- `toggleExpanded(index)` — Triggers `LayoutAnimation.configureNext(easeInEaseOut)` then toggles the expanded index.
- `filtered` — Derived array: `FAQ_DATA.filter(f => f.category === selectedCategory)`.

**Future:** Replace `FAQ_DATA` with an API call to `GET /api/v1/faq` which reads from the `faq_items` table.

### 2. Help & Support (`mobile/app/help-support.tsx`)

**Entry point:** Settings → Help & Support

**How it works:**
1. **Quick Links** section at top with buttons to FAQ and Terms pages.
2. **Submit a Request** form with:
   - **Category** — Horizontal scrollable pill selector (5 options: Ticket Purchase, Check-in Problem, Marketplace, Wallet & Account, Other)
   - **Subject** — Single-line text input, max 120 characters
   - **Description** — Multi-line text area, max 2000 characters
3. Submit button is disabled until both subject and message have non-empty trimmed values.
4. On submit: haptic feedback → simulated 1.2s delay → success toast → `router.back()`.
5. **Contact fallback** — `support@ticketh.io` shown at the bottom.

**Key functions:**
- `handleSubmit()` — Validates inputs via `Alert.alert`, fires haptic, simulates API call (TODO: `POST /api/v1/support`), shows toast, navigates back on success.

**Current state:** The submission is **simulated** with `setTimeout`. The TODO marker indicates where to wire up the real backend call:
```ts
// TODO: POST to backend /api/v1/support when endpoint is ready
await new Promise((r) => setTimeout(r, 1200));
```

### 3. Terms of Service (`mobile/app/terms.tsx`)

**Entry point:** Settings → Terms of Service, Help & Support → Quick Links → Terms

**How it works:**
- Static page with 11 sections rendered via a `Section` component.
- Includes DPDP (Digital Personal Data Protection Act 2023) compliance section.
- No interactivity beyond scrolling and back navigation.

---

## Route Registration (`mobile/app/_layout.tsx`)

All four new screens are registered in the root Stack navigator:

```tsx
<Stack.Screen name="settings"     options={{ headerShown: false, animation: 'slide_from_right' }} />
<Stack.Screen name="faq"          options={{ headerShown: false, animation: 'slide_from_right' }} />
<Stack.Screen name="help-support" options={{ headerShown: false, animation: 'slide_from_right' }} />
<Stack.Screen name="terms"        options={{ headerShown: false, animation: 'slide_from_right' }} />
```

All use `slide_from_right` animation for a consistent forward-navigation feel.

---

## Navigation Flow

```
Profile tab
  └─► Settings (/settings)
        ├─► FAQ (/faq)
        ├─► Help & Support (/help-support)
        │     ├─► FAQ (/faq)          [quick link]
        │     └─► Terms (/terms)      [quick link]
        └─► Terms of Service (/terms)
```

---

## What's Implemented vs. TODO

| Component | Status |
|-----------|--------|
| FAQ screen (static data) | ✅ Done |
| Help & Support form UI | ✅ Done |
| Terms of Service page | ✅ Done |
| Route registration | ✅ Done |
| Settings navigation links | ✅ Done |
| DB migration (tables, RLS, seeds) | ✅ Done |
| Backend `GET /api/v1/faq` endpoint | ❌ TODO |
| Backend `POST /api/v1/support` endpoint | ❌ TODO |
| Backend `GET /api/v1/support/my-tickets` endpoint | ❌ TODO |
| Backend admin support ticket management | ❌ TODO |
| Mobile: fetch FAQ from API instead of hardcoded | ❌ TODO |
| Mobile: wire `handleSubmit` to real API | ❌ TODO |
| Mobile: show user's past support tickets | ❌ TODO |
| DPDP consent modal on first launch | ❌ TODO |
