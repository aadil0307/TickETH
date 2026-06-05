# Claude Engineering Memory File

> Senior engineering practices, coding standards, lessons learned, and maintenance procedures for the TickETH codebase.

---

## Table of Contents

1. [Architecture & Project Structure](#architecture--project-structure)
2. [Coding Principles](#coding-principles)
3. [Security Practices](#security-practices)
4. [Performance Optimization](#performance-optimization)
5. [Error Handling & Resilience](#error-handling--resilience)
6. [DRY Patterns & Refactoring](#dry-patterns--refactoring)
7. [Database & Data Integrity](#database--data-integrity)
8. [Frontend Standards](#frontend-standards)
9. [Mobile (React Native / Expo) Standards](#mobile-react-native--expo-standards)
10. [Dependency Management & Cleanup](#dependency-management--cleanup)
11. [TypeScript Best Practices](#typescript-best-practices)
12. [Testing & Verification](#testing--verification)
13. [Common Bugs & How They Were Fixed](#common-bugs--how-they-were-fixed)
14. [Maintenance Checklist](#maintenance-checklist)

---

## Architecture & Project Structure

### Tech Stack
- **Backend**: NestJS 11, TypeScript, Supabase (PostgreSQL + RLS), BullMQ, Redis, ethers 6
- **Frontend**: Next.js 16 (Turbopack default, webpack for dev), Tailwind CSS 4, thirdweb React SDK, framer-motion, Zustand, sonner toasts, Three.js
- **Mobile**: Expo SDK 53, React Native, react-native-reanimated v4, expo-router, Zustand, expo-secure-store
- **Blockchain**: Solidity 0.8.24, Hardhat, OpenZeppelin, Polygon Amoy (chainId 80002)
- **Auth**: SIWE (Sign-In With Ethereum) + JWT (access 7d, refresh 30d)

### Folder Layout
```
backend/src/
  ├── auth/          # SIWE + JWT auth flow
  ├── blockchain/    # Chain listener, contract interaction
  ├── events/        # Event CRUD
  ├── tickets/       # Ticket minting, transfers
  ├── marketplace/   # Resale marketplace
  ├── checkin/       # QR-based check-in (WebSocket)
  ├── common/        # Guards, pipes, middleware, decorators, enums
  ├── queues/        # BullMQ processors (notifications)
  └── ...

frontend/src/
  ├── app/           # Next.js App Router pages
  ├── components/    # Reusable UI components
  └── lib/           # Utilities, hooks, API client, constants

mobile/
  ├── app/           # Expo Router screens
  └── src/           # API, components, hooks, stores, services, utils
```

### Key Conventions
- Backend API prefix: `/api/v1` (set in `main.ts`)
- Swagger docs at `/docs`
- All environment variables read via `ConfigService` (backend) or `Constants.expoConfig?.extra` (mobile) or `process.env.NEXT_PUBLIC_*` (frontend)
- Contract addresses are **public** on-chain data — NOT secrets
- Thirdweb Client ID is a **public** client identifier — safe for client-side code

---

## Coding Principles

### SOLID
- **Single Responsibility**: Each service handles one domain (events, tickets, marketplace). Don't mix concerns.
- **Open/Closed**: Use decorators and guards for cross-cutting concerns, not if-chains.
- **Liskov Substitution**: DTOs validated with class-validator; always accept the declared type.
- **Interface Segregation**: Import only what you need from modules. Don't re-export everything.
- **Dependency Inversion**: Inject services via NestJS DI. Don't instantiate dependencies directly.

### DRY (Don't Repeat Yourself)
- Extract shared patterns into reusable components/hooks/helpers.
- If the same 10+ lines appear in 3+ places, extract it.
- Use field-map loops for repetitive if-check update patterns.
- Create shared hooks for shared state patterns (e.g., `useTransaction` for tx state management).

### KISS (Keep It Simple)
- Don't over-abstract. If a helper is used once, inline it.
- Don't add error handling for impossible scenarios.
- Prefer flat code over deeply nested callbacks.

### YAGNI (You Ain't Gonna Need It)
- Don't add API functions that no screen calls.
- Don't install packages "just in case."
- Don't write abstractions for hypothetical future features.
- Remove dead code immediately — don't keep it "for later."

### Clean Architecture
- Separate concerns: controllers handle HTTP, services handle business logic, guards handle auth.
- Never put business logic in controllers.
- Keep DTOs as pure data structures with validation decorators.

---

## Security Practices

### Authentication & Authorization
- **Nonces must be server-side with TTL**: Store SIWE nonces in Redis with 5-minute TTL. Never use in-memory Maps in production (they don't survive restarts and can't scale horizontally).
- **Always null-check after user lookup**: After `findById()` in guards, throw `ForbiddenException` if user is null. Never silently proceed.
- **Use `@nestjs/throttler`** for rate limiting, NOT `express-rate-limit`. The NestJS module integrates properly with the framework.

### Input Sanitization
- Use `sanitize-html` (NOT regex) for HTML stripping. Config: `allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'recursiveEscape'`.
- Never use `xss` package alongside `sanitize-html` — pick one.
- Validate file uploads with `path.extname()` and an allowlist Set, not string manipulation.

### Data Integrity
- **Optimistic locking**: When updating records where status matters (marketplace listings, organizer requests), always add `.eq('status', ExpectedStatus)` to the update query. Check the returned count — if 0, someone else already modified it.
- **Upserts over check-then-insert**: Use `onConflict` + `ignoreDuplicates` to prevent race conditions in mint recording.

### Secrets & Config
- **Backend**: All secrets via `ConfigService` (reads from `.env`). Never hardcode.
- **Frontend**: Use `NEXT_PUBLIC_*` env vars with dev fallbacks:
  ```ts
  export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? '0x...dev-default';
  ```
- **Mobile**: Use `Constants.expoConfig?.extra?.VARIABLE` with dev fallbacks.
- **Never log sensitive data**: Security logger should skip health check paths and include Cloudflare IP headers (`cf-connecting-ip`).

### Token Storage
- Mobile: `expo-secure-store` for JWT tokens (hardware-backed encryption).
- Frontend: httpOnly cookies or in-memory (thirdweb handles this).

---

## Performance Optimization

### Backend
- **Adaptive polling**: Replace `setInterval` with `setTimeout`-based loops. Use exponential backoff on errors (double delay per consecutive error, cap at 2 minutes). Reset to base interval on success.
- **Parallel I/O**: Use `Promise.all()` when fetching multiple independent resources (e.g., tier + event data).
- **Audit logging with retry**: Wrap audit inserts in retry logic (3 attempts, exponential delay: `100ms * 2^attempt`). Audit failures must never crash the main flow.

### Frontend
- **React Query vs manual fetching**: If `@tanstack/react-query` is installed but no hooks (`useQuery`, `useMutation`) are used, either adopt it or remove it. Don't pay the bundle cost for unused dependencies.
- **framer-motion types**: Cubic bezier ease arrays need `as const` to satisfy Variants type:
  ```ts
  ease: [0.22, 1, 0.36, 1] as const
  ```

### Mobile (React Native)
- **FlatList optimization** — always add these props for large lists:
  ```tsx
  maxToRenderPerBatch={10}
  windowSize={5}
  removeClippedSubviews
  ```
- **React.memo on list item components**: Wrap `EventCard`, `TicketCard`, and any component rendered inside a FlatList in `React.memo` to prevent unnecessary re-renders during scroll.
- **Offline store pruning**: On hydrate, iterate stored snapshots and remove expired entries to prevent unbounded memory growth.
- **API retry interceptor**: Add axios response interceptor that retries on network errors (no response) and 5xx status codes. Use linear/exponential backoff. Track retry count on the config object.

### General
- Don't over-optimize. Fixed 3-second polling with a hard timeout is fine for interactive flows like check-in confirmation where the user is actively waiting.
- Profile before optimizing — 500 particles with per-frame mutations is acceptable for a decorative background.

---

## Error Handling & Resilience

### Error Boundary Pattern
- **Frontend**: Wrap app in a React ErrorBoundary component at the provider level.
- **Mobile**: Create a class component `ErrorBoundary` with `getDerivedStateFromError` and `componentDidCatch`. Place it inside `GestureHandlerRootView` wrapping all providers.
- Always provide a "Try Again" button that resets the error state.

### API Resilience
- **Retry with backoff**: For critical operations (IPFS upload, audit logging, chain polling), implement retry with exponential backoff.
- **Pattern**:
  ```ts
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      await new Promise(r => setTimeout(r, DELAY * Math.pow(2, attempt)));
    }
  }
  ```
- **Timeouts**: Always set timeouts for external HTTP calls (30s is a good default for IPFS).
- **Silent retry in polls**: For background polling loops, catch errors and continue. Only give up after consecutive error threshold.

### Transaction State Management (Frontend Hook)
- Use a shared `useTransaction` hook that manages `step`, `hash`, `error`, and provides `execute(fn)` and `reset()`.
- The hook wraps any async transaction flow in try-catch with standardized error parsing and toast notifications.
- This eliminates 20-30 lines of duplicated boilerplate per page.

---

## DRY Patterns & Refactoring

### Field-Map Update Pattern
Instead of:
```ts
if (dto.name) record.name = dto.name;
if (dto.description) record.description = dto.description;
// ... 10 more
```
Use:
```ts
const fieldMap = { name: 'name', description: 'description', ... } as const;
for (const [dtoKey, dbCol] of Object.entries(fieldMap)) {
  if (dto[dtoKey] !== undefined) updates[dbCol] = dto[dtoKey];
}
```

### Reusable Page Header Component
Extract repeated header markup (category badge + title + gradient highlight + description) into a `PageHeader` component:
```tsx
<PageHeader
  category="Events"
  title="Upcoming "
  highlight="Events"
  description="Browse and discover..."
/>
```
- Support `highlightFirst` boolean for pages where gradient text comes before the title word.
- Support `right` slot for action buttons.

### Extract Helper Methods
When a service method exceeds ~50 lines and has clear sub-operations:
1. Extract validation into a `verify*()` helper
2. Extract data mapping into a `mapDtoToRow()` helper
3. Keep the main method as an orchestrator

---

## Database & Data Integrity

### Supabase Patterns
- Use **service_role** client for admin operations (bypasses RLS).
- Always check `.error` on Supabase responses:
  ```ts
  const { data, error } = await supabase.from('table').select();
  if (error) throw new InternalServerErrorException(error.message);
  ```
- Use `.single()` for queries expected to return exactly one row.
- Use `onConflict` + `ignoreDuplicates` for idempotent inserts.

### Race Condition Prevention
- **Check-then-act is never safe**: Always use atomic operations.
- **Optimistic locking**: Filter on expected status in UPDATE queries.
- **Upserts**: Use database-level constraints (`UNIQUE` on `contract_address, token_id`) and `onConflict: 'col1,col2'`.

---

## Frontend Standards

### Next.js App Router
- Use `'use client'` only on pages/components that need browser APIs.
- Keep server components where possible (default).
- Toasts: Use `sonner` with dark theme styling matching the app.

### Component Architecture
- Shared components in `src/components/` with `ui/` subfolder for primitives.
- Page-specific components can live in the page file if small (<50 lines).
- Always `export function` (named exports) — no default exports.

### State Management
- **Zustand** for global client state (auth, wallet).
- **Local useState** for form state.
- **URL params** for shareable state (filters, pagination).

### Tailwind
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes.
- Keep class strings on one line if reasonable; break at logical boundaries if long.

---

## Mobile (React Native / Expo) Standards

### Navigation
- Use **expo-router** (file-based routing).
- Tab layout in `app/(tabs)/`, modal routes in `app/` root.

### Animations
- Use `react-native-reanimated` v4 for all animations.
- Prefer `useAnimatedStyle` + shared values over `Animated.Value`.
- Use `entering`/`exiting` layout animations for list items.

### Stores
- **Zustand** with persist middleware for offline-capable stores.
- **expo-secure-store** adapter for auth tokens.
- Prune expired data on hydrate to prevent memory leaks.

### Component Patterns
- Wrap FlatList item components in `React.memo`.
- Use `expo-image` (not `Image` from RN) for optimized image loading.
- Always add FlatList performance props for lists > 20 items.

### Config & Environment
- Read config from `Constants.expoConfig?.extra` (set in `app.config.js` or `app.json`).
- Provide dev fallbacks for local development.
- `crypto-shim.js` is required and configured via `metro.config.js` — don't remove it.

---

## Dependency Management & Cleanup

### Audit Process
1. **List all dependencies** from `package.json`.
2. **Search for imports** of each package across the entire `src/` directory.
3. **Verify implicit usage**: Some packages are used implicitly (e.g., `class-transformer` by NestJS's `ValidationPipe`, `reflect-metadata` by decorators).
4. **Check for dual packages**: If two packages serve the same purpose (e.g., `xss` + `sanitize-html`), remove the unused one.
5. **Verify type packages**: `@types/*` packages belong in `devDependencies`, not `dependencies`.

### What to Remove
- Packages with **zero imports** AND no implicit usage.
- Dead API functions that no component calls.
- Dead UI components that no page imports (but **always verify with grep before removing** — audit tools can report false positives).
- Commented-out code blocks (not explanatory comments).

### What to Keep
- Peer dependencies required by other packages even if not directly imported (e.g., `react-native-worklets` for `reanimated`).
- Polyfills loaded at app entry (e.g., `react-native-get-random-values` in `index.js`).
- `react-dom` and `react-native-web` if web platform is targeted.

### Red Flags
- Two packages doing the same job (e.g., `express-rate-limit` + `@nestjs/throttler`).
- `@tanstack/react-query` installed but only `QueryClientProvider` used (no `useQuery`/`useMutation`).
- Dependencies in `dependencies` that should be in `devDependencies` (type packages, test tools).

### Cleanup Results (This Project)
**Backend removed**: `xss`, `express-rate-limit` (2 packages, 5 sub-deps)
**Frontend removed**: `@tanstack/react-query`; moved `@types/three` to devDependencies; removed dead `GradientRevealText` component
**Mobile removed**: 5 unused API functions (`getTicketHistory`, `getMarketplaceStats`, `getEventStats`, `getMyEvents`, `getTierAvailability`)
- **Note**: `react-native-passkey`, `@coinbase/wallet-mobile-sdk`, and `@mobile-wallet-protocol/client` were previously removed but are all required by `thirdweb/react-native` internally. Re-added. Never remove thirdweb's implicit native dependencies without verifying the bundler doesn't need them.

---

## TypeScript Best Practices

### Strict Mode
- Always compile with `--noEmit` to catch type errors without generating files.
- Fix type errors immediately — don't use `// @ts-ignore` unless absolutely necessary.

### Type Safety Patterns
- Use `as const` for literal tuples:
  ```ts
  ease: [0.22, 1, 0.36, 1] as const  // satisfies readonly number[]
  ```
- Use discriminated unions for state machines (tx steps, statuses).
- Prefer `interface` for object shapes, `type` for unions/intersections.

### Common Errors & Fixes
| Error | Fix |
|-------|-----|
| `Property 'semiBold' does not exist` | Check exact casing in theme constants (it's `semibold`, not `semiBold`) |
| `ease: number[]` doesn't satisfy Variants | Add `as const` to cubic bezier arrays |
| Module has no exported member | Verify the component/function actually exists before importing |
| Implicit `any` on catch | Use `catch (err)` without type annotation or `catch (err: unknown)` |

---

## Testing & Verification

### Verification Workflow
After every batch of changes:
1. Run `npx tsc --noEmit` in each modified codebase.
2. Check for zero errors before moving to the next codebase.
3. If errors appear, fix them immediately — don't accumulate.

### Test Commands
```bash
# Backend
cd backend && npx tsc --noEmit
cd backend && npm test

# Frontend
cd frontend && npx tsc --noEmit
cd frontend && npm run build

# Mobile
cd mobile && npx tsc --noEmit

# Contracts
cd contracts && npx hardhat compile
cd contracts && npx hardhat test
```

---

## Common Bugs & How They Were Fixed

### 1. Auth Nonce Replay Attack
**Bug**: Nonces stored in in-memory Map. Lost on server restart. No TTL.
**Fix**: Migrated to Redis with 5-minute TTL. Added `OnModuleInit` for Redis connection with lazy connect and in-memory fallback.

### 2. Ticket Mint Race Condition
**Bug**: Check-then-insert pattern allowed duplicate mint records.
**Fix**: Upsert with `onConflict: 'contract_address,token_id', ignoreDuplicates: true`.

### 3. Marketplace Double-Sale
**Bug**: Two buyers could purchase the same listing simultaneously.
**Fix**: Optimistic lock with `.eq('status', ListingStatus.ACTIVE)` on the UPDATE. If 0 rows returned, the listing was already sold.

### 4. Chain Listener Crash Loop
**Bug**: `setInterval` kept firing even when RPC errors piled up, hammering a failing node.
**Fix**: `setTimeout`-based adaptive polling with exponential backoff. Consecutive error counter, backoff cap at 2 minutes.

### 5. IPFS Upload Hanging Forever
**Bug**: No timeout on IPFS HTTP calls. Gateway outage blocked the entire mint flow.
**Fix**: 30-second AbortController timeout + 3-attempt retry with exponential backoff.

### 6. Organizer Request Approval Race
**Bug**: Two admins could approve the same request simultaneously (2-query: read then update).
**Fix**: Single atomic UPDATE with `.eq('status', RequestStatus.PENDING)`. Check affected row count.

### 7. Framer Motion Type Error
**Bug**: `ease: [0.22, 1, 0.36, 1]` inferred as `number[]`, didn't satisfy `Variants` type.
**Fix**: `ease: [0.22, 1, 0.36, 1] as const`.

### 8. ErrorBoundary Theme Typo
**Bug**: `Typography.weights.semiBold` — TypeScript error, property doesn't exist.
**Fix**: `Typography.weights.semibold` (lowercase 'b'). Always check theme constant casing.

### 9. Turbopack Rust Panic (Next.js 16)
**Bug**: `thread 'tokio-runtime-worker' panicked at aggregation_update.rs` — Turbopack's internal task graph crashes when resolving complex dependency trees (thirdweb + three.js + ethers have massive transitive ESM deps). This is a Turbopack bug, not a code issue.
**Fix**: Use `--webpack` for dev mode (`"dev": "next dev --webpack"` in package.json). Turbopack works fine for production builds. Keep `turbopack: { root: __dirname }` in next.config.ts for when Turbopack is used.

### 10. Stale Root package-lock.json Breaking Module Resolution
**Bug**: A stale `package-lock.json` at the monorepo root (with no corresponding `package.json`) caused Next.js 16/Turbopack to infer the workspace root as the parent directory. CSS `@import "tailwindcss"` then resolved from the root where no `node_modules` existed.
**Fix**: Deleted the stale root `package-lock.json`. Added `turbopack: { root: __dirname }` to `next.config.ts` so Turbopack resolves from `frontend/`.

### 11. Webpack resolve.modules Hoisting Wrong Package Version
**Bug**: Adding `path.resolve(__dirname, 'node_modules')` to the TOP of webpack's `config.resolve.modules` forced all module resolution through the top-level `node_modules` first, bypassing nested versions. `viem@2.39.0` needs `ox@0.9.6` (with `./erc8010` export), but `thirdweb` pins `ox@0.7.0` at top level (no `./erc8010`). Webpack picked the wrong one.
**Fix**: Removed the `config.resolve.modules` override entirely. Webpack's default resolution walks up from the importing file's directory, correctly finding `node_modules/viem/node_modules/ox@0.9.6` before the top-level `ox@0.7.0`.

### 12. @noble/hashes Version Conflict
**Bug**: `ethers@6` hoists `@noble/hashes@1.3.2` to top level, but `@scure/bip32@1.7.0` (via thirdweb → ox) needs `@noble/hashes@1.8.0+` which exports `./legacy`.
**Fix**: Added npm `overrides` in package.json: `"@noble/hashes": "^1.8.0"` and `"viem": { "ox": "0.9.6" }` to ensure correct transitive versions.

---

## Maintenance Checklist

### Before Every PR
- [ ] `npx tsc --noEmit` passes in all modified codebases
- [ ] No unused imports
- [ ] No `console.log` left (except in ErrorBoundary's `componentDidCatch`)
- [ ] Secrets in `.env`, not hardcoded
- [ ] New dependencies actually used
- [ ] Race conditions considered for concurrent operations

### Monthly Cleanup
- [ ] Audit dependencies: `npm ls --depth=0` in each workspace
- [ ] Search for unused imports/exports
- [ ] Check for TODO/FIXME items that should be resolved
- [ ] Review `.gitignore` — ensure build outputs aren't committed
- [ ] Update packages with `npm outdated` and test after upgrades
- [ ] Prune unused API functions and components
- [ ] Verify error boundaries still work (test by throwing in a child)

### Before Production Deployment
- [ ] All env vars set in deployment platform
- [ ] Redis connection configured for auth nonces
- [ ] Supabase RLS policies reviewed
- [ ] Rate limiting configured (ThrottlerModule)
- [ ] CORS origins restricted
- [ ] Helmet middleware enabled
- [ ] Swagger disabled or auth-gated in production
- [ ] Source maps NOT exposed to clients
- [ ] `dist/` folder NOT committed to git

---

## Lessons Learned

1. **Always verify audit findings with grep before removing code.** Automated audits can report false positives (e.g., `MagneticButton` reported as unused but was imported in the landing page).

2. **In-memory state doesn't survive restarts.** Anything that needs persistence (nonces, sessions, rate limits) must go to Redis or a database.

3. **Check-then-act is never safe under concurrency.** Always use atomic DB operations (upserts, optimistic locks, conditional updates).

4. **Two packages for the same job is one too many.** When you switch libraries (e.g., `xss` → `sanitize-html`), immediately remove the old one.

5. **Type packages (`@types/*`) belong in devDependencies.** They're only needed at compile time, not at runtime.

6. **Theme constants have specific casing.** Always verify property names with TypeScript before using them — `semibold` ≠ `semiBold`.

7. **Bundle size matters.** Every unused dependency is bandwidth cost. Regular dependency audits keep the app lean.

8. **Background polling needs backoff.** Fixed-interval polling that hammers a failing endpoint will make outages worse. Use exponential backoff with caps.

9. **Parallel I/O saves latency.** If two await calls don't depend on each other, wrap them in `Promise.all()`.

10. **FlatList performance is not optional.** Without `maxToRenderPerBatch`, `windowSize`, and `removeClippedSubviews`, large lists cause janky scrolling on lower-end devices.

11. **Never prepend absolute paths to webpack's `resolve.modules`.** Doing so bypasses nested `node_modules` resolution. Webpack's default relative `'node_modules'` resolution walks from the importing file upward, correctly finding nested versions first. Only append absolute paths as fallbacks.

12. **Monorepo root lockfiles cause Turbopack confusion.** Next.js 16 uses lockfile location to infer workspace root. A stale `package-lock.json` at the root (with no `package.json`) breaks module resolution. Always clean up orphaned lockfiles.

13. **thirdweb SDK has complex transitive dependency conflicts.** `thirdweb` → `viem` → `ox` creates version conflicts because `ox` is pre-1.0 (breaking on minor bumps). Use npm `overrides` to pin compatible versions when webpack hoisting picks the wrong one.

14. **Use `--webpack` for Next.js 16 dev when Turbopack panics.** Turbopack is still unstable with large dependency trees (thirdweb, three.js, ethers). Webpack is slower but reliable. Turbopack usually works fine for production builds.

15. **Expo Go bundles specific native module versions.** When using Expo Go (not a dev build), the JS versions of native modules (`react-native-worklets`, `react-native-reanimated`) must match what Expo SDK bundles. Check `node_modules/expo/bundledNativeModules.json` for the expected versions. Pin accordingly — e.g., Expo SDK 54 expects `react-native-worklets@0.5.1` and `react-native-reanimated@~4.1.1`.
