# TickETH

TickETH is an end-to-end Web3 ticketing platform built for event organizers and attendees.
It combines smart-contract based NFT tickets, a secure backend API, a Next.js web client, and an Expo mobile app with QR check-in support.

## What Is Included

- `backend/`: NestJS API for auth, events, ticketing, marketplace, check-in, audit logs, and background jobs
- `frontend/`: Next.js web app for discovery, wallet auth, minting, and marketplace interactions
- `mobile/`: Expo React Native app for mobile-first ticket management and on-site check-in flows
- `contracts/`: Hardhat Solidity contracts for factory, ticket NFTs, and marketplace
- `database/`: SQL migrations and seed scripts for Supabase/Postgres

## Tech Stack

- Backend: NestJS 11, TypeScript, Supabase, BullMQ, Redis, ethers v6
- Frontend: Next.js 16, React 19, Tailwind CSS 4, thirdweb, framer-motion, Zustand
- Mobile: Expo SDK 54, React Native 0.81, expo-router, reanimated v4, Zustand
- Smart Contracts: Solidity 0.8.24, Hardhat, OpenZeppelin
- Auth: SIWE (Sign-In With Ethereum) + JWT

## Monorepo Structure

```text
TickETH-main/
  backend/
  contracts/
  database/
  frontend/
  mobile/
  redis-binaries/
  README.md
```

## Prerequisites

- Node.js 20+
- npm 10+
- Redis server (local or hosted)
- Supabase project (or compatible Postgres + Supabase API setup)
- Wallet and RPC access for Polygon Amoy/mainnet contract flows
- Expo CLI (for mobile development)

## Quick Start

1. Clone the repository.
2. Install dependencies for each app:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../contracts && npm install
cd ../mobile && npm install
```

3. Copy env templates and configure values:

```bash
cd backend && copy .env.example .env
cd ../contracts && copy .env.example .env
```

4. Run each service in separate terminals.

## Run The Apps

### Backend API

```bash
cd backend
npm run start:dev
```

- API base path: `/api/v1`
- Swagger docs: `/docs`

### Frontend Web App

```bash
cd frontend
npm run dev
```

### Mobile App

```bash
cd mobile
npm run start
```

Then use Expo Go (or emulator/device) to open the project.

### Smart Contracts

```bash
cd contracts
npm run compile
npm run test
```

Deploy examples:

```bash
npm run deploy:local
npm run deploy:amoy
```

## Environment Setup

At minimum, configure these areas before running full flows:

- Backend (`backend/.env`):
  - JWT secrets and expirations
  - Supabase URL, anon key, service role key
  - Redis URL/host/port
  - Chain RPC URL and contract addresses
  - SIWE domain/nonce/session settings
- Frontend (`frontend`):
  - `NEXT_PUBLIC_*` values for API URL, chain IDs, contract addresses, thirdweb client ID
- Mobile (`mobile/.env` and app config extra):
  - API base URL
  - public chain + contract config
  - thirdweb public client configuration
- Contracts (`contracts/.env`):
  - deployer private key
  - RPC URLs
  - explorer API keys for verification

Do not commit secrets.

## Database

SQL scripts are under `database/`:

- `database/migrations/001_initial_schema.sql`
- `database/migrations/002_marketplace.sql`
- `database/migrations/003_support_system.sql`
- `database/seeds/dev_seed.sql`

Apply migrations in order, then optional seed data for local development.

## Testing And Quality

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

- SIWE nonces should be short-lived and stored in Redis.
- Keep JWT secrets and private keys in environment variables only.
- Never expose service-role credentials to frontend/mobile clients.
- Contract addresses are public, but signer keys are not.

## Deployment Notes

- Backend: deploy NestJS with environment config and Redis connectivity.
- Frontend: deploy Next.js with all required `NEXT_PUBLIC_*` variables.
- Mobile: build with EAS or run via Expo for test environments.
- Contracts: deploy per-network and keep verified addresses documented.

## Helpful Docs In This Repo

- `build_plan.txt`
- `HELP_SUPPORT_SYSTEM.md`
- `claude.md`

## License

Set your preferred license in this repository (currently not explicitly defined at root).
