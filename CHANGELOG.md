# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] — 2026-07-20 — Creator Coins + Cross-Chain Registry

### Added

#### Creator Coin System
- **Customizable Vesting** — `VestingConfig` struct (initialUnlockBps, cliffDuration, vestingDuration) in Solidity + Anchor Rust
- **4 Vesting Presets** — Trustless (0%/30d/90d), Balanced (5%/7d/60d), Community (10%/0d/30d), Fast (20%/0d/7d)
- **Reputation-Gated** — Presets unlocked by creator reputation score, enforced at smart contract level
- **VestingConfigPanel** — Visual timeline bar with token breakdown schedule
- **On-Chain Transparency** — Parameters immutable and visible, no hidden bundles

#### Farcaster Creator Coins
- `POST /api/farcaster/coin/deploy` — Deploy creator coin on Base via factory
- `GET /api/farcaster/coin/:fid` — Get coin info by FID
- `POST /api/farcaster/coin/:fid/tip` — Tip via Farcaster creator coin
- Auto-wraps for Zora visibility, announces on Farcaster via frame

#### Lens Protocol Creator Coins
- `POST /api/lens/coin/deploy` — Deploy creator coin on Polygon
- `GET /api/lens/coin/:profileId` — Get coin info by profile ID
- `POST /api/lens/coin/:profileId/tip` — Tip via Lens creator coin
- Auto-wraps for Zora visibility, announces on Lens

#### Cross-Chain Registry
- `CrossChainRegistry.sol` — On-chain mapping of protocol → chain → token
- `CrossChainRegistry.ts` — KV-backed registry with bidirectional lookups
- `getUnifiedProfile()` — All creator tokens across Base, Solana, Farcaster, Lens
- `resolveToken()` — Find equivalent coin on any chain

#### Creator Config Routes
- `GET/PUT /api/token/:address/config` — General creator configuration
- `GET/PUT /api/token/:address/config/vesting` — Vesting config management
- `GET/PUT /api/token/:address/config/fees` — Fee configuration
- `GET/PUT /api/token/:address/config/cross-chain` — Cross-chain settings
- `GET /api/token/:id/tokens` — All tokens across all chains
- `POST /api/token/:address/coin/farcaster` — Protocol-specific coin deploy
- `POST /api/token/:address/coin/lens` — Protocol-specific coin deploy

#### Cross-Chain Tipping
- `POST /api/tip/cross-chain` — Tip from any chain to any creator coin
- Wormhole bridge simulation for SOL → ETH routing
- Unified tip ledger records cross-chain tips
- `'farcaster'` and `'lens'` added to `TipPlatform` type

#### KV Namespaces
- `CONTENT_STORE` — Token community content, livestreams, chat
- `FARCASTER_COINS` — Farcaster creator coin records
- `LENS_COINS` — Lens Protocol creator coin records
- `XCHAIN_REGISTRY` — Cross-chain token registrations
- `PLATFORM_ACCOUNTS` — Platform account records for registration
- `BLUESKY_INVITE_POOL` — Bluesky invite code pool

#### Environment Variables
- `ZORA_WRAPPER_FACTORY`, `WORMHOLE_BRIDGE`, `BASE_RPC_URL`, `POLYGON_RPC_URL`
- `PEERTUBE_INSTANCE_URL`, `PEERTUBE_CLIENT_ID`, `PEERTUBE_CLIENT_SECRET`
- `SOLANA_PROGRAM_ID`, `SOLANA_RPC_URL`
- `PREMIUM_WALLET_KEY`, `PINATA_API_KEY`, `PINATA_SECRET_KEY`
- `TELEGRAM_BOT_NAME`, `TELEGRAM_BOT_TOKEN`

### Security (10 Categories)
- **Token leaks** — Bot token masked, file URLs proxied
- **Rate limiting** — Publish 30/min, stream 5/hr, identity 10/hr, comments 5/min
- **Input sanitization** — Coin names 32 chars, symbols 10 chars, comment HTML stripped
- **CSRF** — All mutation endpoints protected (token-community, identity-extensions, publish)
- **Credential encryption** — AES-256-GCM `sealForWallet`/`unsealForWallet` for KV storage
- **WebSocket security** — Origin validation, IP rate limiting, 5 max conns, 5 min idle timeout
- **Contract security** — ReentrancyGuard, `MIN_BUY_AMOUNT` dust check, max total fee validation
- **Frontend security** — iframe sandbox, referrer policy, input length limits
- **XSS patterns** — Expanded detection (onerror, svg onload, eval, data URIs)
- **Suspicious payload** — CSS expression, vbscript, protocol handlers

### PeerTube Livestreaming (9 files)
- `PeerTubeLiveStream` class — create, update, end, recording, chat, federation
- OAuth2 with token caching, RTMP key generation, channel auto-creation
- Cross-announce to ActivityPub, Nostr (kind 30311), Bluesky, Farcaster, Telegram
- `LiveStreamPlayer` — Dual PeerTube + legacy, OBS setup card, copyable RTMP key
- `PeerTubeChatFeed` — Real-time via Prosody XMPP, token-holder badges, auto-scroll
- `PeerTubeStreamHistory` — Past streams with thumbnails and duration
- `usePeerTubeStream` hook — SWR-based with 10s viewer polling
- KV schema for streams, creator index, chat cache, recording archive

### Type Fixes
- `notifications.ts` — `fid` null-check
- `for-you.ts` — `qualityScore` → `quality`
- `token-community.ts` — CSRF cookie `undefined` → `null`
- Solana program — `freeze_authority` removed (Anchor default)
- Zora SDK — Duplicate exports consolidated, web3.js v2 → v1.98.0, unused imports removed

### Documentation
- `ARCHITECTURE.md` — Full rewrite with protocol map, data flows, identity system, security model
- `DEPLOYMENT.md` — Complete production deployment guide with infrastructure setup
- `README.md` — Updated with 12 protocols, creator coin system, architecture diagram, self-hosted infra
- `CHANGELOG.md` — Created (this file)
- `.env.example` — Comprehensive with all new env vars documented

---

## [0.3.0] — 2026-07-19 — Universal Cross-Platform Integration

### Added
- **3 new packages**: `telegram-sdk` (1,878 lines), `zora-sdk` (creator coins, bonding curve), `identity-hub`
- **Extended packages**: `bluesky-sdk` (PdsClient), `types` (Protocol union), `utils` (cross-protocol identity)
- **8 new worker routes**: content publish/schedule, identity extensions (AT Protocol, Zora, Telegram, DID resolution)
- **20 new frontend files**: Launch page, creator coin wizard, bonding curve chart, buy/sell interface
- **AT Protocol PDS** deployed at pds.degenfeed.xyz

### Changed
- `paninis` → `degenfeed` branding across all packages
- 195/195 tests passing, zero type errors

---

## [0.2.0] — 2026-07-18 — Security Sprint + UI Overhaul

### Added
- **87 SSR pages** — Feed, profiles, threads, discover, settings, admin
- **500+ API routes** — Feeds, auth, tipping, moderation, search, notifications, billing
- **25+ packages** — Protocol SDKs, feed pipeline, ranking, identity, web3, storage
- **Auth middleware** — Next.js middleware.ts protects ALL `/api/*` POST/PUT/DELETE
- **Rate limiting** — 6-tier token bucket with KV-backed fixed-window
- **Admin panel** — Wallet whitelist + `requireAdmin()` guard on 15 admin routes
- **CSRF** — Origin/Referer + X-CSRF-Token validation, auto-attach in `csrfFetch()`
- **Worker auth** — HMAC-SHA256 sessions, CSRF token gen in KV, CORS headers

### Changed
- Security score: 2.0 → 8.5

---

## [0.1.0] — 2026-07-01 — Initial Release

### Added
- Initial monorepo scaffold with Turborepo + pnpm
- Next.js 15 app router frontend
- Hono API server on Cloudflare Workers
- Protocol adapters: Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS
- Feed normalization, deduplication, and ranking
- Cross-protocol identity resolution
- Wallet sign-in (Solana + EVM)
- News aggregation
- Cloudflare KV caching
- CI/CD via GitHub Actions
- Docker Compose for local development
