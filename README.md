# TickETH

TickETH is a complete Web3 ticketing platform for event discovery, NFT ticket minting, secondary resale, and secure event-day check-in.
It is built as a monorepo that combines a NestJS backend, a Next.js web app, an Expo mobile app, Solidity smart contracts, and Supabase/Postgres migrations.

The product is designed so a single wallet can move through the full lifecycle:
discover an event, authenticate with SIWE, mint or receive a ticket NFT, manage tickets in web or mobile, resell through the marketplace, and present a QR code for on-site verification.

## Product Overview

TickETH is organized around four connected layers:

- The frontend presents the public event experience, organizer dashboards, admin tools, and marketplace flows.
- The mobile app gives attendees and volunteers a wallet-connected companion app for tickets, scanning, and check-in.
- The backend coordinates authentication, role management, event data, ticket records, listings, support, audit logging, and background jobs.
- The contracts layer mints and transfers NFT tickets on-chain so ownership and resale are verifiable.

The platform is meant to be understandable from the UI down to the chain:

1. A user opens the web app or mobile app and signs in with a wallet.
2. The backend resolves their role and application state.
3. Events are listed from the database and contract-linked metadata.
4. Ticket minting happens through the blockchain with transaction tracking.
5. Tickets appear in the user wallet and in the app’s ticket views.
6. Eligible tickets can be listed on the marketplace.
7. Volunteers use the scanner flow to verify QR tickets during entry.
8. Admins manage users, organizer requests, events, and support tickets from the control panel.

## Core Capabilities

- Wallet authentication with SIWE and JWT-backed session handling
- Public event browsing with filters, sorting, and event detail pages
- Organizer dashboard for event creation, capacity tracking, and volunteer assignment
- NFT ticket minting on Polygon Amoy with transaction status tracking
- My Tickets views for owned tickets, transfers, and QR presentation
- Marketplace flows for creating and managing resale listings
- Mobile QR scanner for volunteer check-in workflows
- Admin dashboard for platform-wide moderation and support operations
- Audit logging, rate limiting, and request tracing in the backend
- Support ticket flows for user issues and compliance-related handling

## Screenshots

The screenshots below are included from the repository’s `Screenshots/` folder and show the major product flows end to end.

### Web Home And Discovery

![TickETH home hero](Screenshots/Screenshot%202026-06-06%20024600.png)

![Event browsing view](Screenshots/Screenshot%202026-06-06%20024630.png)

### Web Minting And Transaction Flow

![Ticket minting flow](Screenshots/Screenshot%202026-06-06%20024743.png)

### Organizer And Admin Operations

![Organizer dashboard](Screenshots/Screenshot%202026-06-06%20025314.png)

![Volunteer management](Screenshots/Screenshot%202026-06-06%20025428.png)

![Admin dashboard](Screenshots/Screenshot%202026-06-06%20025707.png)

### Mobile App

![Mobile sign in screen](Screenshots/WhatsApp%20Image%202026-06-06%20at%203.07.49%20AM.jpeg)

![Mobile onboarding screen](Screenshots/WhatsApp%20Image%202026-06-06%20at%203.07.49%20AM%20(1).jpeg)

![Mobile scanner screen](Screenshots/WhatsApp%20Image%202026-06-06%20at%203.07.48%20AM.jpeg)

## How The System Works

### 1. Discovery And Sign In

The public experience starts in the web app, where users can browse events, see pricing, and choose whether to buy tickets or request organizer access.
The web app is styled as a product landing and marketplace interface, with the core CTA leading into the event browsing and organizer paths.

On mobile, the app opens into a branded onboarding and sign-in experience powered by thirdweb, with wallet and account-based authentication paths.

### 2. Role Resolution

After authentication, the backend determines which product surfaces the user should see.

- Attendees see event discovery, tickets, marketplace, and profile flows.
- Volunteers get scanner access for check-in.
- Organizers see dashboard, event management, and volunteer management screens.
- Admins see platform control panels, user moderation, organizer requests, and support tools.

### 3. Event Creation And Publishing

Organizers create events through the dashboard and define their ticket tiers, capacities, and publication state.
The dashboard surfaces event counts, published status, minted ticket totals, and capacity metrics so organizers can understand the operational state of their portfolio at a glance.

### 4. Ticket Minting

When a user buys a ticket, the frontend initiates a blockchain transaction and the backend records the resulting mint data.
The minting flow is tracked in the UI so users can see the stages of the transaction lifecycle, from preparation and signature request to broadcasting and confirmation.
This helps make on-chain interactions understandable instead of opaque.

### 5. Ticket Ownership And Management

Once minted, tickets appear in the user’s ticket views on web and mobile.
From there, the user can review ticket details, transfer eligible tickets, and access a QR-based representation for event entry.
The mobile app is organized specifically around this day-of-event experience, with tabs for Discover, Tickets, Market, Scan, and Profile.

### 6. Marketplace And Resale

Users can list tickets on the marketplace for controlled resale.
This keeps ticket circulation inside the product rather than forcing users into external trading flows.
The marketplace is intended to preserve transparent ownership while still supporting a resale lifecycle.

### 7. Check-In And Validation

At the venue, volunteers use the mobile scanner to read attendee QR codes and confirm ticket validity.
The scanner screen is built for quick, low-friction check-in, with the volunteer role determining whether the scanner tab is available.
This makes event-day entry a first-class operational workflow instead of a separate manual process.

### 8. Admin And Support

Admins oversee the platform from a dedicated dashboard.
They can review users, inspect organizer requests, manage events, and work support tickets.
This gives the platform a controlled operations layer for moderation and issue resolution.

## Repository Structure

```text
TickETH-main/
  backend/        NestJS API, auth, events, tickets, marketplace, check-in, support, audit
  contracts/      Solidity contracts, deployment scripts, and tests
  database/       Postgres migrations and seed data
  frontend/       Next.js web app for discovery, organizers, admins, and marketplace
  mobile/         Expo React Native app for tickets, scanner, and profile flows
  Screenshots/    Product screenshots used in this README
  redis-binaries/ Redis-compatible local binaries for development support
```

## Tech Stack

- Backend: NestJS 11, TypeScript, Supabase, BullMQ, Redis, ethers v6
- Frontend: Next.js 16, React 19, Tailwind CSS 4, thirdweb, framer-motion, Zustand, sonner
- Mobile: Expo SDK 54, React Native 0.81, expo-router, react-native-reanimated v4, thirdweb React Native
- Contracts: Solidity 0.8.24, Hardhat, OpenZeppelin
- Authentication: SIWE with JWT sessions

## Backend Architecture

The backend is the central coordination layer. It is responsible for API concerns, security, persistence, queueing, and cross-domain orchestration.

Top-level modules include:

- Auth for SIWE login and JWT issuance
- Users for profile and role state
- Organizer requests for promoting attendees into organizers
- Events for CRUD and publication workflows
- Ticket tiers for pricing and capacity rules
- Tickets for mint tracking and ownership records
- Check-in for QR validation and event-day workflows
- Marketplace for resale listings and completed sales
- IPFS for metadata pinning and uploads
- Admin for platform control operations
- Audit for traceability
- Support for ticket-based help workflows
- Blockchain for chain interaction and contract access
- Queues for background job processing
- DPDP for compliance-related handling

The application uses global config loading, rate limiting, request IDs, and security logging so that operational behavior is observable and safer by default.

## Frontend Architecture

The web app is the main public interface and operational console.

It includes:

- A landing page that introduces the product and routes users toward browsing or organizer onboarding
- Event discovery pages for browsing and filtering events
- Event detail pages for purchase and ticketing flows
- Tickets and transfer flows for existing holders
- Marketplace pages for resale browsing and listing management
- Organizer pages for event creation, dashboard metrics, and volunteer operations
- Admin pages for user management, organizer requests, support, and event oversight
- Shared UI primitives and animated components for a consistent dark visual system

The web app is configured as a dark-themed product experience with expressive typography and an intentional visual direction, rather than a generic dashboard shell.

## Mobile Architecture

The mobile app is the event-day companion experience.

It uses Expo Router with a tab structure centered on the attendee and volunteer journey:

- Discover for browsing events
- Tickets for owned ticket access
- Market for resale browsing and management
- Scan for volunteer QR scanning
- Profile for account and settings flows

The mobile app wraps the entire experience in providers for auth, wallet, check-in state, toast notifications, and error boundaries.
It also uses a gated scanner tab so only the relevant roles can access the check-in workflow.

## Smart Contract Layer

The contracts package contains the on-chain pieces of the system:

- TickETHFactory for deployment or creation flows
- TickETHTicket for the ticket NFT representation
- TickETHMarketplace for resale interactions

The contracts are tested with Hardhat and are intended to be deployed to Polygon-based networks, with Polygon Amoy used for development and demo flows.

## Database Layer

Database migrations and seed data live in `database/`.

- `database/migrations/001_initial_schema.sql`
- `database/migrations/002_marketplace.sql`
- `database/migrations/003_support_system.sql`
- `database/seeds/dev_seed.sql`

These scripts define the persistent model behind events, tickets, marketplace data, and support workflows.

## Prerequisites

- Node.js 20+
- npm 10+
- Redis for queues and session-related workflows
- Supabase or compatible Postgres setup
- Polygon RPC access for contract interactions
- A wallet for SIWE and transaction signing
- Expo tooling for mobile development

## Local Setup

1. Install dependencies in each workspace.

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../contracts && npm install
cd ../mobile && npm install
```

2. Copy example environment files and configure your local secrets.

```bash
cd backend && copy .env.example .env
cd ../contracts && copy .env.example .env
```

3. Apply database migrations and any seed data you need for local testing.
4. Start Redis if your local workflow uses queue processing.
5. Run backend, frontend, mobile, and contract commands in separate terminals as needed.

## Running The Project

### Backend

```bash
cd backend
npm run start:dev
```

Backend API details:

- Base path: `/api/v1`
- Swagger: `/docs`

### Frontend

```bash
cd frontend
npm run dev
```

### Mobile

```bash
cd mobile
npm run start
```

### Contracts

```bash
cd contracts
npm run compile
npm run test
```

Deployment helpers:

```bash
npm run deploy:local
npm run deploy:amoy
```

## Typical End-To-End Flow

1. A visitor opens the web app and browses events.
2. They sign in with a wallet using SIWE.
3. The backend resolves their user record and role.
4. They purchase or receive an NFT ticket through the contract flow.
5. The backend records mint data and ties it to the user experience.
6. The ticket appears in the web and mobile ticket views.
7. If needed, the user lists the ticket on the marketplace.
8. On event day, a volunteer scans the QR code in the mobile scanner.
9. The backend and event data determine whether the ticket is valid for check-in.
10. Admins can review logs, requests, events, and support activity from the control panel.

## Environment Variables

Configure these before full end-to-end testing:

- Backend: JWT secrets, Supabase values, Redis settings, RPC URLs, contract addresses, SIWE domain and nonce/session values
- Frontend: `NEXT_PUBLIC_*` API, chain, and contract variables, plus the thirdweb client ID
- Mobile: API base URL, public chain values, contract addresses, and thirdweb public client config
- Contracts: deployer private key, RPC URLs, and verification keys

Do not commit secret values.

## Testing And Validation

### Backend

```bash
cd backend
npm run lint
npm test
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Contracts

```bash
cd contracts
npm run test
```

### Mobile

```bash
cd mobile
npx tsc --noEmit
```

## Security Notes

- SIWE nonces should be short-lived and stored server-side.
- JWT secrets, deployer keys, and service-role credentials must remain in environment variables.
- Contract addresses are public chain data, but private keys are not.
- Rate limiting, request IDs, and security logging are enabled in the backend architecture.

## Deployment Notes

- Backend: deploy with environment configuration, Redis access, and Supabase connectivity.
- Frontend: deploy with all required public environment variables.
- Mobile: run through Expo or build with EAS for test and release workflows.
- Contracts: deploy and verify per target network, then copy addresses into the app configs.

## Supporting Docs

- `build_plan.txt`
- `HELP_SUPPORT_SYSTEM.md`
- `claude.md`

## License

No explicit license is set at the repository root yet.
