# DegenFeed Developer Guide

Guide for developers working on the DegenFeed platform. Includes monorepo structure, how to add protocols and features, testing, deployment, and environment setup.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Environment Setup](#environment-setup)
4. [Development Workflow](#development-workflow)
5. [How to Add a New Protocol](#how-to-add-a-new-protocol)
6. [How to Add a New Feature](#how-to-add-a-new-feature)
7. [Package Guidelines](#package-guidelines)
8. [Testing Guidelines](#testing-guidelines)
9. [Deployment Process](#deployment-process)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Smart Contracts](#smart-contracts)
12. [KV Namespace Reference](#kv-namespace-reference)
13. [Coding Standards](#coding-standards)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    app.degenfeed.xyz                             │
│               Next.js 16 (Cloudflare Pages)                      │
├─────────────────────────────────────────────────────────────────┤
│                    workers/api (degenfeed-api)                    │
│              Hono API Server (Cloudflare Worker)                 │
├────────────────┬──────────┬──────────┬─────────────────────────┤
│  Protocol SDKs │  Core    │  Smart   │  Infra                   │
│  (10 packages) │ Packages │ Contracts│  (Docker, monitoring)    │
└────────────────┴──────────┴──────────┴─────────────────────────┘
```

**Key architectural decisions:**

- **Edge-first** — The API runs on Cloudflare Workers for global low latency
- **KV-backed** — 19 KV namespaces for cache, state, identity, content, coins
- **Protocol-agnostic core** — `feed-core`, `ranking`, `identity` work with any protocol
- **Local-first signing** — Nostr and Farcaster posts are signed client-side
- **No backend database** — Protocol-native storage + edge KV only

---

## Monorepo Structure

```
degenfeed-web/
├── apps/
│   └── web/                          # Next.js 16 client (app.degenfeed.xyz)
│       ├── src/
│       │   ├── app/                  # App Router pages (~60 route groups)
│       │   ├── components/           # React components (16+ directories)
│       │   ├── lib/                  # Client utilities
│       │   └── middleware.ts         # Rate limiting + auth middleware
│       ├── public/                   # Static assets
│       └── functions/               # Cloudflare Functions
├── workers/
│   └── api/                          # Cloudflare Worker edge API
│       └── src/
│           ├── routes/               # ~100 route modules
│           ├── feed/                 # Feed pipeline (scorer, curator, fetcher)
│           ├── lib/                  # Shared libraries
│           ├── __tests__/            # Test suite
│           └── index.ts              # Entry point
├── packages/
│   ├── types/                        # Protocol types & shared interfaces
│   ├── feed-core/                    # Feed normalization & deduplication
│   ├── ranking/                      # Feed scoring algorithms
│   ├── ui/                           # Shared React components
│   ├── identity/                     # Cross-protocol identity resolution
│   ├── identity-hub/                 # Wallet→protocol mapping
│   ├── auth/                         # Wallet sign-in & sessions
│   ├── web3/                         # Web3 utilities
│   ├── storage/                      # Client & edge storage helpers
│   ├── realtime/                     # WebSocket + SSE real-time sync
│   ├── reputation/                   # Reputation scoring system
│   ├── nostr-sdk/                    # Nostr protocol adapter
│   ├── farcaster-sdk/                # Farcaster protocol adapter
│   ├── lens-sdk/                     # Lens Protocol adapter
│   ├── bluesky-sdk/                  # Bluesky/AT Protocol adapter
│   ├── mastodon-sdk/                 # Mastodon/ActivityPub adapter
│   ├── threads-sdk/                  # Threads protocol adapter
│   ├── rss-sdk/                      # RSS/Atom feed adapter
│   ├── peertube-provider/            # PeerTube video & stream adapter
│   ├── telegram-sdk/                 # Telegram Bot API client
│   ├── zora-sdk/                     # Creator token SDK
│   ├── shorts-provider/              # Short-form video provider
│   ├── video/                        # Video hub utilities
│   ├── tip-contract/                 # Solidity smart contracts
│   ├── spaces-audio/                 # Audio Spaces engine
│   ├── protocols/                    # Protocol registration & routing
│   ├── token-gate/                   # Token-gated content
│   ├── crossplatform-register/       # Multi-protocol account registration
│   └── solana-programs/             # Solana on-chain programs
├── infra/
│   ├── cloudflare/                   # Wrangler configs
│   ├── monitoring/                   # GlitchTip, Grafana
│   └── deploy-templates/            # Docker Compose templates
├── mobile/                           # Capacitor mobile shell
├── docs/                             # VitePress documentation site
└── scripts/                          # Deploy & migration scripts
```

---

## Environment Setup

### Prerequisites

- **Node.js** 22+ (see `.node-version`)
- **pnpm** 9+
- **Foundry** (for Solidity development)
- **Anchor** + **Rust** (for Solana development)

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp apps/web/.env.example apps/web/.env.local
cp workers/api/.dev.vars.example workers/api/.dev.vars

# 3. Start development servers
pnpm dev

# This starts:
#   - Next.js dev server on :3000
#   - Worker dev server on :8787
#   - TypeScript watch mode
```

### Environment Variables

Key variables needed in `apps/web/.env.local`:

```bash
# Worker API URL (set to local dev server)
WORKER_URL=http://localhost:8787
NEXT_PUBLIC_WORKER_URL=http://localhost:8787

# Auth secret (HMAC-SHA256 key for sessions)
AUTH_SECRET=your-64-char-hex-string

# Admin wallets (comma-separated)
ADMIN_WALLETS=0x...

# Plausible analytics
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=app.degenfeed.xyz
NEXT_PUBLIC_PLAUSIBLE_HOST=https://plausible.rugmunch.io

# Cloudflare KV namespace IDs (for production)
WORKER_CACHE_KV_ID=...
WORKER_SUBSCRIPTIONS_KV_ID=...
```

Full list at `apps/web/.env.example`.

### Docker (Full Stack)

```bash
docker compose -f docker-compose.yml up -d
```

This starts: GoToSocial, PeerTube, AT Protocol PDS, Redlib, RSS-Bridge, Prosody XMPP.

---

## Development Workflow

### Branch Strategy

```
main          — Production, auto-deploys to app.degenfeed.xyz
develop       — Pre-production integration
feature/*     — Feature branches
fix/*         — Bug fix branches
```

### Making Changes

1. Create a feature branch: `feature/my-feature`
2. Make changes following the package structure
3. Run tests: `pnpm test`
4. Run lint: `pnpm lint`
5. Commit using Conventional Commits
6. Push and create a PR

### Commands

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages + apps
pnpm lint             # Biome lint + check
pnpm format           # Biome format
pnpm typecheck        # TypeScript type checking
pnpm test             # Run Vitest tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm clean            # Clean all build artifacts
```

---

## How to Add a New Protocol

Adding a new protocol involves creating an SDK package, worker routes, and frontend components.

### Step 1: Create the SDK Package

Create a new package in `packages/`:

```
packages/myprotocol-sdk/
├── src/
│   ├── index.ts          # Public API
│   ├── client.ts          # API client
│   ├── types.ts           # Protocol-specific types
│   └── utils.ts           # Helpers
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Required exports:**

```typescript
// packages/myprotocol-sdk/src/index.ts
export class MyProtocolClient {
  constructor(config: { apiUrl: string; apiKey?: string }) {}

  // Feed
  async getFeed(params: FeedParams): Promise<Post[]> {}

  // Identity
  async getProfile(handle: string): Promise<Profile> {}

  // Posting (optional)
  async publishPost(text: string, auth: AuthTokens): Promise<PostResult> {}

  // Tipping (optional)
  async resolveTipAddress(userId: string): Promise<string> {}
}
```

### Step 2: Register the Protocol

Add your protocol to the system in `packages/protocols/src/index.ts`:

```typescript
export const PROTOCOLS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
  'rss',
  'peertube',
  'myprotocol',          // Add your protocol
] as const;
```

### Step 3: Create Worker Routes

Create route handlers in `workers/api/src/routes/`:

```
workers/api/src/routes/myprotocol-feed.ts    # Feed fetching
workers/api/src/routes/myprotocol-post.ts    # Posting
workers/api/src/routes/myprotocol-tip.ts     # Tipping (optional)
```

Register them in `workers/api/src/app.ts`:

```typescript
import { myprotocolFeed } from './routes/myprotocol-feed';

app.get('/v1/feed/:protocol', async (c) => {
  if (c.req.param('protocol') === 'myprotocol') {
    return myprotocolFeed(c);
  }
  // ...
});
```

### Step 4: Add Frontend Support

1. **Protocol page** — Create `apps/web/src/app/myprotocol/page.tsx`
2. **Trending page** — Create `apps/web/src/app/myprotocol/trending/page.tsx`
3. **Composer target** — Add to the publish targets in `apps/web/src/app/api/publish/route.ts`
4. **UI components** — Add protocol-specific styling in the feed components

### Step 5: Add to Unified Feed

Update `workers/api/src/feed/unified-fetchers.ts` to fetch from your new protocol.

### Step 6: Document

Update [INTEGRATIONS.md](INTEGRATIONS.md) with your protocol's details.

---

## How to Add a New Feature

### Feature Checklist

1. **Design** — Review in `design/` or create new mockups
2. **Types** — Define types in `packages/types/`
3. **Backend (Worker)** — Add routes in `workers/api/src/routes/`
4. **Frontend** — Add pages in `apps/web/src/app/`
5. **Components** — Add UI components in `apps/web/src/components/`
6. **Tests** — Add Vitest and/or Playwright tests
7. **Documentation** — Update relevant docs

### Example: Adding a New Frontend Page

```bash
# 1. Create the route group
mkdir -p apps/web/src/app/my-feature

# 2. Create the page
touch apps/web/src/app/my-feature/page.tsx
```

```typescript
// apps/web/src/app/my-feature/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Feature — DegenFeed',
  description: 'Description for SEO',
};

export default function MyFeaturePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1>My Feature</h1>
    </div>
  );
}
```

### Adding an API Route

```typescript
// apps/web/src/app/api/my-feature/route.ts
import { NextResponse } from 'next/server';
import { proxyGet } from '../_proxy';

export async function GET(request: Request) {
  return proxyGet('/api/my-feature', request);
}

export async function POST(request: Request) {
  // Parse body, validate, proxy to worker
}
```

---

## Package Guidelines

### Creating a New Package

```bash
mkdir -p packages/my-package/src
```

**package.json:**
```json
{
  "name": "@degenfeed/my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

### Package Conventions

- **All packages** are in `packages/`
- **Package names** follow `@degenfeed/<name>` convention
- **Protocol SDKs** end with `-sdk` (e.g., `nostr-sdk`)
- **Providers** end with `-provider` (e.g., `peertube-provider`)
- **Core packages** are plain English (e.g., `feed-core`, `ranking`)
- Each package has its own `vitest.config.ts`
- All packages compile with TypeScript strict mode
- Maximum 500 lines per source file

### Dependency Rules

- Packages can depend on `@degenfeed/types` and `@degenfeed/utils`
- Protocol SDKs should be independent of each other
- Core packages should not depend on protocol SDKs
- `apps/web` can depend on any package
- `workers/api` can depend on `@degenfeed/types` and protocol SDKs

---

## Testing Guidelines

### Unit Tests (Vitest)

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @degenfeed/zora-sdk test

# Run worker tests
pnpm --filter degenfeed-api test

# Run with coverage
pnpm test -- --coverage
```

### Test Files

- Co-located with source: `__tests__/` or `.test.ts`
- Naming: `feature.test.ts` or `feature.spec.ts`
- Worker tests use `test-setup.ts` for mock bindings

### E2E Tests (Playwright)

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e -- --ui

# Update snapshots
pnpm test:e2e -- --update-snapshots
```

E2E test files are in `apps/web/e2e/`.

### Testing Philosophy

- **Integration over isolation** — Test real protocol interactions where possible
- **Mock external APIs** — Use MSW or Vitest mocking for protocol calls
- **Test data flows** — Feed → Normalize → Score → Render
- **Test error states** — API failures, rate limits, auth errors

### Coverage Requirements

| Area | Minimum Coverage |
|------|-----------------|
| Core packages (feed-core, ranking) | 90% |
| Protocol SDKs | 80% |
| Worker routes | 75% |
| UI components | 70% |

---

## Deployment Process

### Cloudflare Pages (Frontend)

```bash
# Deploy to production
pnpm run deploy:web

# Deploy to preview
pnpm run deploy:web:preview
```

The frontend at `apps/web` deploys to Cloudflare Pages at `app.degenfeed.xyz`.

### Cloudflare Worker (API)

```bash
# Deploy API worker
pnpm run deploy:worker

# Deploy with secrets
echo "MY_SECRET" | wrangler secret put MY_SECRET
```

The worker at `workers/api` deploys as `degenfeed-api` worker.

### Smart Contracts

```bash
# Deploy DegenFeedTips contract
tsx scripts/deploy-tip-contract.ts --chain base

# Deploy to all chains
tsx scripts/deploy-tip-contract.ts --all
```

### Docker (Infrastructure)

```bash
# Deploy full stack
docker compose -f docker-compose.yml up -d

# Update specific service
docker compose up -d peertube
```

---

## CI/CD Pipeline

CI is configured in `.github/workflows/ci.yml`:

| Stage | What It Does |
|-------|-------------|
| **Lint** | Biome check on all files |
| **Typecheck** | TypeScript `--noEmit` on all packages |
| **Unit Tests** | Vitest across all packages |
| **E2E Tests** | Playwright against preview deployment |
| **Build** | Build all packages + apps |
| **Deploy** | Deploy to Cloudflare (main branch only) |

### Pre-commit Hooks

Configured via Lefthook:

- Biome lint + format
- TypeScript type checking (staged files)
- Vitest (changed packages)
- No secrets check (gitleaks)

---

## Smart Contracts

### Solidity (Base)

| Contract | File | Description |
|----------|------|-------------|
| `DegenFeedCoin` | `packages/zora-sdk/src/contracts/DegenFeedCoin.sol` | ERC-20 creator token |
| `DegenFeedFactory` | `packages/zora-sdk/src/contracts/DegenFeedFactory.sol` | Coin deployment factory |
| `CrossChainRegistry` | `packages/zora-sdk/src/contracts/CrossChainRegistry.sol` | Cross-chain mapping |
| `DegenFeedTips` | `packages/tip-contract/src/DegenFeedTips.sol` | 0% fee tipping contract |

**Development:**

```bash
# Build contracts
forge build --contracts packages/tip-contract/src/DegenFeedTips.sol

# Test contracts
forge test --contracts packages/tip-contract

# Deploy
tsx scripts/deploy-tip-contract.ts --chain base
```

### Solana (Anchor)

| Program | Location | Description |
|---------|----------|-------------|
| `degenfeed-creator-token` | `packages/solana-programs/` | SPL token with bonding curve |

**Development:**

```bash
cd packages/solana-programs
anchor build
anchor test
```

---

## KV Namespace Reference

| Namespace | Purpose | TTL |
|-----------|---------|-----|
| `CACHE` | General cache, rate limiter, feed cache, sessions, user prefs | Varies (5s–90d) |
| `SUBSCRIPTIONS` | Premium subscriptions, newsletter subscribers | Permanent |
| `IDENTITIES` | Cross-protocol identity links | Permanent |
| `API_KEYS` | Scoped API key storage | Permanent |
| `CONTENT_STORE` | Token community content, livestreams, chat | Varies |
| `FARCASTER_COINS` | Farcaster creator coin records | Permanent |
| `LENS_COINS` | Lens Protocol creator coin records | Permanent |
| `XCHAIN_REGISTRY` | Cross-chain token registration | Permanent |
| `PLATFORM_ACCOUNTS` | Platform account records | Permanent |
| `BLUESKY_INVITE_POOL` | Bluesky invite code pool | Permanent |
| `COMMUNITIES` | Cross-protocol community records | Permanent |
| `SPACES` | Audio Spaces data | Varies |
| `REPUTATION` | Reputation scores and leaderboard | Permanent |
| `BOOKMARKS` | User bookmark storage | Permanent |
| `DEPLOYMENTS` | Deployment request tracking | Varies |
| `PERMANENCE` | Content permanence proofs | Permanent |
| `GOVERNANCE` | DAO governance (proposals, votes) | Permanent |
| `REPORTS` | Reports and moderation state | Permanent |
| `CUSTOM_FEEDS` | Custom feed configurations | Permanent |

### KV Key Patterns

```
feed:unified:{wallet}         — Cached unified feed
identity:{wallet}              — Wallet identity mapping
farcaster:coin:{fid}          — Farcaster creator coin
lens:coin:{profileId}         — Lens creator coin
xchain:token:{address}        — Cross-chain token mapping
peertube:stream:{addr}:active  — Active livestream
session:{sessionId}           — User session
```

---

## Coding Standards

### TypeScript

- **Strict mode** — `strict: true` in all tsconfigs
- **No `any`** — Use `unknown` with type narrowing
- **Naming conventions**:
  - `camelCase` for variables, functions, methods
  - `PascalCase` for classes, types, interfaces, React components
  - `UPPER_CASE` for constants
  - `kebab-case` for files and directories
- **Exports** — Named exports preferred over default exports
- **Async** — Use `async/await`, avoid raw promises

### React / Next.js

- **App Router** — All pages use the app router (`app/` directory)
- **Server Components** — Default to server components, use `'use client'` only when needed
- **Custom hooks** — Place in `apps/web/src/hooks/`
- **Components** — Place in `apps/web/src/components/<feature>/`
- **Metadata** — Every page exports `metadata` for SEO

### Security

- **No secrets in code** — Environment variables only
- **Input sanitization** — All user input sanitized via `sanitize.ts`
- **CSRF protection** — Double-submit cookie pattern
- **CORS** — Strict origin validation
- **Rate limiting** — 6 tiers of KV-backed rate limiting
- **Session tokens** — HMAC-SHA256 signed cookies

### Smart Contract Security

- **ReentrancyGuard** — OpenZeppelin's protection
- **No `selfdestruct`** or `delegatecall`
- **State reads before calls** — Prevents reentrancy
- **Fee validation** — Max total fee enforced at factory level
- **Anti-exploit** — 3-phase limits, bundle detection, cooldowns

---

## Documentation

- **VitePress** site at `docs/` — hosted at docs.degenfeed.xyz
- **API docs** — Auto-generated from route definitions
- **README** — Main project overview
- **ARCHITECTURE.md** — Deep architecture reference
- **CHANGELOG.md** — Release history (auto-generated)

### Building Docs

```bash
cd docs
pnpm install
pnpm dev    # Local dev server
pnpm build  # Production build
```

---

## Troubleshooting

### Common Issues

**"Module not found" for a package**
- Run `pnpm install` from root
- Check the package is listed in `pnpm-workspace.yaml`
- Verify the import path matches the package name

**Worker won't start locally**
- Check `workers/api/.dev.vars` has required variables
- Ensure wrangler is installed: `pnpm add -g wrangler`
- Run `pnpm dev` from the worker directory directly

**TypeScript errors**
- Run `pnpm typecheck` for full type checking
- Check tsconfig paths match package names
- Clear `.tsbuildinfo` files and rebuild

**Tests failing**
- Check for mock bindings in worker tests
- Ensure test setup runs before tests
- Verify environment variables are set

---

*See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture reference.*
*See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.*
