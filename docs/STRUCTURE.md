# DegenFeed — Structural Organization

> **Last updated:** 2026-07-24
> **Version:** 0.1.0
> **Repository:** `git.rugmunch.io:RugMunchMedia/degenfeed`

---

## 1. Project Map

```
degenfeed/
├── apps/
│   └── web/                          # Next.js 16 frontend application
│       ├── src/
│       │   ├── app/                  # App Router pages & API routes (~310 files)
│       │   │   ├── page.tsx          # Landing page
│       │   │   ├── layout.tsx        # Root layout (providers, theme)
│       │   │   ├── globals.css       # Global CSS + design tokens
│       │   │   ├── feed/             # Main feed (for-you, trending, news)
│       │   │   ├── home/             # Home/dashboard sections
│       │   │   ├── profile/          # User profiles, analytics, settings
│       │   │   ├── discover/         # Content discovery
│       │   │   ├── search/           # Cross-protocol search
│       │   │   ├── post/             # Single post view
│       │   │   ├── video/            # Video hub
│       │   │   ├── shorts/           # Short-form video
│       │   │   ├── live/             # Live streaming
│       │   │   ├── spaces/           # Audio spaces
│       │   │   ├── launch/           # Token launch platform
│       │   │   ├── c/                # Communities
│       │   │   ├── premium/          # Premium subscription
│       │   │   ├── admin/            # Admin panel
│       │   │   ├── creator/          # Creator dashboard
│       │   │   ├── docs/             # Documentation pages
│       │   │   ├── newsletters/      # Newsletter management
│       │   │   ├── messages/         # Cross-protocol DMs
│       │   │   ├── api/              # API routes (~60 route handlers)
│       │   │   ├── bluesky/          # Bluesky protocol page
│       │   │   ├── farcaster/        # Farcaster protocol page
│       │   │   ├── lens/             # Lens protocol page
│       │   │   ├── mastodon/         # Mastodon protocol page
│       │   │   ├── nostr/            # Nostr protocol page
│       │   │   ├── youtube/          # YouTube integration page
│       │   │   ├── about/            # About/info pages
│       │   │   └── [...]             # 20+ additional route groups
│       │   ├── components/           # React components (~160 files)
│       │   │   ├── ui/               # Base UI primitives
│       │   │   ├── feed/             # Feed components (FilterBar, TabBar, etc.)
│       │   │   ├── auth/             # Auth (passkeys, TOTP, HW wallet, etc.)
│       │   │   ├── creator/          # Creator tools (publisher, videos)
│       │   │   ├── launch/           # Token launch components
│       │   │   ├── shorts/           # Short-form video components
│       │   │   ├── video/            # Video hub components
│       │   │   ├── stream/           # Stream components
│       │   │   ├── spaces/           # Audio spaces components
│       │   │   ├── live-shorts/      # Live short video components
│       │   │   ├── feddy/            # Feddy (federated communities)
│       │   │   ├── join/             # Guest join flows
│       │   │   ├── landing/          # Landing page sections
│       │   │   ├── recommendations/  # Recommendation rows
│       │   │   ├── register/         # Registration wizard
│       │   │   ├── settings/         # Settings panels
│       │   │   ├── analytics/        # Analytics dashboards
│       │   │   ├── visual-feed/      # Visual/Zora feed
│       │   │   ├── youtube/          # YouTube search/render
│       │   │   └── ShortVideoCard/   # TikTok-style shorts player
│       │   ├── hooks/                # React hooks (~40 files)
│       │   ├── services/             # API client services
│       │   ├── lib/                  # Utility libraries
│       │   ├── styles/               # Layout CSS modules
│       │   ├── types/                # TypeScript type definitions
│       │   └── utils/                # Helper utilities
│       ├── tailwind.config.ts        # Tailwind configuration
│       ├── vitest.config.ts          # Vitest config
│       ├── playwright.config.ts      # E2E test config
│       ├── Dockerfile                # Container build
│       └── wrangler.toml             # Cloudflare Pages config
│
├── bridge/                           # Local HTTP bridge server (port 8787)
│   ├── src/
│   │   ├── server.ts                 # HTTP server — all provider routes
│   │   ├── crossposter.ts            # Cross-platform posting (GTS → Nostr)
│   │   └── providers/               # Protocol-specific data fetchers
│   │       ├── bluesky.ts            # Bluesky AT Protocol (PDS + public)
│   │       ├── farcaster.ts          # Farcaster (Hubble self-hosted)
│   │       ├── gotosocial.ts         # GoToSocial / Mastodon API
│   │       ├── lemmy.ts              # Lemmy (ActivityPub)
│   │       ├── lens.ts               # Lens v2 GraphQL
│   │       ├── nostr.ts              # Nostr (WebSocket relays)
│   │       ├── peertube.ts           # PeerTube (ActivityPub)
│   │       ├── pixelfed.ts           # Pixelfed (RSS + API)
│   │       ├── redlib.ts             # Reddit via Redlib proxy
│   │       ├── rssbridge.ts          # RSS-Bridge feed aggregator
│   │       ├── stubs.ts              # [DEPRECATED] Stub implementations
│   │       └── zora.ts               # Zora NFT (GraphQL)
│   └── package.json
│
├── packages/                         # Monorepo workspaces (43+ packages)
│   ├── auth/                         # Authentication primitives
│   ├── bluesky-sdk/                  # Bluesky AT Protocol client SDK
│   ├── farcaster-sdk/                # Farcaster Hub client SDK
│   ├── lens-sdk/                     # Lens Protocol v2 client SDK
│   ├── nostr-sdk/                    # Nostr relay client SDK
│   ├── mastodon-sdk/                 # Mastodon API client SDK
│   ├── lemmy-sdk/                    # Lemmy API client SDK
│   ├── threads-sdk/                  # Threads API client
│   ├── rss-sdk/                      # RSS/Atom feed parser
│   ├── discord-sdk/                  # Discord bot SDK
│   ├── matrix-sdk/                   # Matrix protocol SDK
│   ├── github-sdk/                   # GitHub integration SDK
│   ├── telegram-sdk/                 # Telegram bot SDK (DegenFeed bot)
│   ├── feed-core/                    # Core feed engine (ranking, moderation)
│   ├── feed-providers/               # Feed data provider adapters
│   ├── ranking/                      # Ranking & scoring algorithms
│   ├── identity/                     # Identity resolution
│   ├── identity-hub/                 # Cross-protocol identity linking
│   ├── storage/                      # Local-first storage layer
│   ├── types/                        # Shared TypeScript types
│   ├── ui/                           # Shared UI component library
│   ├── utils/                        # Shared utility functions
│   ├── web3/                         # Web3 wallet integration
│   ├── token-gate/                   # Token-gated content
│   ├── video/                        # Video processing utilities
│   ├── realtime/                     # WebSocket/real-time infrastructure
│   ├── atproto-shorts-provider/      # AT Protocol short video bridge
│   ├── shorts-provider/              # Short-form video processing
│   ├── peertube-provider/            # PeerTube data provider
│   ├── youtube-provider/             # YouTube data provider
│   ├── livepeer-provider/            # Livepeer streaming
│   ├── spaces-audio/                 # LiveKit-based audio spaces
│   ├── reputation/                   # Reputation scoring
│   ├── source-discovery/             # Content source discovery
│   ├── crossplatform-register/       # Cross-platform registration
│   ├── ghost-bridge/                 # Ghost CMS publisher bridge
│   ├── mirror-bridge/                # Mirror.xyz publisher bridge
│   ├── paragraph-bridge/             # Paragraph.xyz publisher bridge
│   ├── newsletter-bridge-sdk/        # Newsletter bridge SDK
│   ├── protocols/                    # Protocol abstraction layer
│   ├── tip-contract/                 # Solidity tipping contracts
│   ├── zora-sdk/                     # Zora Protocol SDK
│   └── solana-programs/              # Solana on-chain programs (Rust)
│
├── workers/
│   └── api/                          # Cloudflare Worker API (~286 source files)
│       ├── src/
│       │   ├── index.ts              # Worker entry point
│       │   ├── app.ts                # Hono app setup
│       │   ├── serve.ts              # HTTP server setup
│       │   ├── cors.ts               # CORS middleware
│       │   ├── session.ts            # Session management
│       │   ├── sanitize.ts           # Input sanitization
│       │   ├── premium.ts            # Premium tier logic
│       │   ├── api-key.ts            # API key management
│       │   ├── admin.ts              # Admin utilities
│       │   ├── error-logger.ts       # Structured error logging
│       │   ├── response-helpers.ts   # Response formatting
│       │   ├── ws-broadcast.ts       # WebSocket broadcast
│       │   ├── ws-channels.ts        # WebSocket channel routing
│       │   ├── kv-helpers.ts         # Cloudflare KV helpers
│       │   ├── kv-key-patterns.ts    # KV key naming conventions
│       │   ├── test-setup.ts         # Test infrastructure
│       │   ├── global.d.ts           # Global type declarations
│       │   ├── feed/                 # Feed pipeline engine
│       │   │   ├── index.ts
│       │   │   ├── content-dedup.ts          # De-duplication
│       │   │   ├── content-pipeline.ts       # Content pipeline
│       │   │   ├── engagement-predictor.ts   # Engagement ML
│       │   │   ├── engagement-predictor-v2.ts# V2 ML model
│       │   │   ├── feed-cache-layer.ts       # Caching layer
│       │   │   ├── feed-cache.ts             # Cache implementation
│       │   │   ├── feed-categories.ts        # Category system
│       │   │   ├── feed-category-coverage.ts # Category coverage
│       │   │   ├── feed-curation-rules.ts    # Manual curation
│       │   │   ├── feed-curator.ts           # Curator engine
│       │   │   ├── feed-dwell-time.ts        # Dwell time tracking
│       │   │   ├── feed-enricher.ts          # Content enrichment
│       │   │   ├── feed-feedback.ts          # User feedback
│       │   │   ├── feed-fetcher.ts           # Fetch orchestration
│       │   │   ├── feed-freshness.ts         # Freshness scoring
│       │   │   ├── feed-interstitials.ts     # In-feed ads/promos
│       │   │   ├── feed-quality-gates.ts     # Quality filters
│       │   │   ├── feed-scorer.ts            # Unified scoring
│       │   │   ├── feed-per-category-trending.ts
│       │   │   ├── shorts-aggregator.ts      # Shorts pipeline
│       │   │   ├── shorts-unified.ts         # Unified shorts
│       │   │   ├── smart-refresh.ts          # Smart polling
│       │   │   ├── unified-feed.ts           # Feed unification
│       │   │   ├── unified-fetchers.ts       # Unified fetch
│       │   │   ├── video-aggregator.ts       # Video aggregation
│       │   │   ├── visual-aggregator.ts      # Visual media agg.
│       │   │   ├── youtube-fetcher.ts        # YouTube fetcher
│       │   │   └── video-bridges/            # External video sources
│       │   │       ├── index.ts
│       │   │       ├── bitchute.ts
│       │   │       ├── dailymotion.ts
│       │   │       ├── dtube.ts
│       │   │       ├── odysee.ts
│       │   │       ├── peertube.ts
│       │   │       ├── rumble.ts
│       │   │       ├── twitch.ts
│       │   │       └── vimeo.ts
│       │   ├── ranking/                      # Ranking system
│       │   │   └── ranking-weights.ts
│       │   ├── lib/                          # Shared libraries (~40 files)
│       │   │   ├── account-sovereignty.ts    # Account portability
│       │   │   ├── activitypub-stream-bridge.ts # AP→Bridge
│       │   │   ├── admin-guard.ts            # Admin authorization
│       │   │   ├── alerts.ts                 # Alert system
│       │   │   ├── bluesky-stream-bridge.ts  # Bluesky→Bridge
│       │   │   ├── bridge-reliability.ts     # Bridge health
│       │   │   ├── community-store.ts        # Community data
│       │   │   ├── creator-resolver.ts       # Creator lookup
│       │   │   ├── cross-post-store.ts       # Cross-post storage
│       │   │   ├── cross-protocol-bridge-engine.ts
│       │   │   ├── cross-protocol-chat-bridge.ts
│       │   │   ├── cross-search.ts           # Cross-protocol search
│       │   │   ├── crypto-seal.ts            # Cryptographic sealing
│       │   │   ├── email-engine.ts           # Email delivery
│       │   │   ├── error-recovery.ts         # Error recovery
│       │   │   ├── farcaster-channel.ts      # Farcaster channels
│       │   │   ├── farcaster-live.ts         # Farcaster live
│       │   │   ├── farcaster-manifest.ts     # Manifest creation
│       │   │   ├── feddy-store.ts            # Feddy store
│       │   │   ├── format-translator.ts      # Format translation
│       │   │   ├── health-integrations.ts    # Health checks
│       │   │   ├── live-shorts/              # Live short content
│       │   │   │   ├── live-strategy.ts
│       │   │   │   ├── protocol-strategies.ts
│       │   │   │   └── strategies/           # Per-protocol live
│       │   │   │       ├── index.ts
│       │   │   │       ├── atproto-live.ts
│       │   │   │       ├── degenfeed-live.ts
│       │   │   │       ├── farcaster-live.ts
│       │   │   │       ├── lens-live.ts
│       │   │   │       ├── nostr-live.ts
│       │   │   │       ├── peertube-live.ts
│       │   │   │       └── zora-live.ts
│       │   │   ├── newsletter-engine.ts      # Newsletter creation
│       │   │   ├── nostr-live-bridge.ts      # Nostr live bridge
│       │   │   ├── offline-queue.ts          # Offline support
│       │   │   ├── platform-fees.ts          # Fee calculations
│       │   │   ├── publish-orchestrator.ts   # Cross-publish orchestration
│       │   │   ├── realtime-sync.ts          # Real-time sync
│       │   │   ├── recommendation-engine.ts  # ML recommendations
│       │   │   ├── recovery-codes.ts         # Account recovery
│       │   │   ├── register-service.ts       # Registration
│       │   │   ├── security-log.ts           # Security audit log
│       │   │   ├── signature-verify.ts       # Signature verification
│       │   │   ├── stream-announcer.ts       # Stream announcements
│       │   │   ├── stream-store.ts           # Stream metadata
│       │   │   ├── sync-queue.ts             # Sync queue
│       │   │   ├── threads-stream-bridge.ts  # Threads→Bridge
│       │   │   ├── tier-gate.ts              # Tier gating
│       │   │   ├── totp.ts                   # TOTP 2FA
│       │   │   ├── transaction-monitor.ts    # On-chain monitoring
│       │   │   ├── unified-shorts.ts         # Unified shorts
│       │   │   ├── video-categories.ts       # Video categorization
│       │   │   ├── zora-video.ts             # Zora video minting
│       │   │   └── zora-wrapper.ts           # Zora API wrapper
│       │   ├── routes/                       # API route handlers (~90 routes)
│       │   │   ├── auth.ts                   # Authentication
│       │   │   ├── feed.ts                   # Main feed
│       │   │   ├── feed-unified.ts           # Unified feed
│       │   │   ├── for-you.ts                # For You feed
│       │   │   ├── trending.ts              # Trending
│       │   │   ├── search.ts                # Search
│       │   │   ├── post.ts                  # Single post
│       │   │   ├── profile.ts              # Profile data
│       │   │   ├── identity.ts             # Identity resolution
│       │   │   ├── tip.ts                  # Tipping
│       │   │   ├── bookmarks.ts            # Bookmarks
│       │   │   ├── notifications.ts        # Notifications
│       │   │   ├── preferences.ts          # User preferences
│       │   │   ├── communities.ts          # Community management
│       │   │   ├── spaces.ts              # Audio spaces
│       │   │   ├── admin.ts              # Admin panel routes
│       │   │   └── [...] # 50+ more route modules
│       │   ├── templates/                # Email templates
│       │   └── __tests__/                # Worker tests (~35 test files)
│       ├── wrangler.toml                 # Cloudflare Worker config
│       └── vitest.config.ts              # Test config
│
├── design/                               # Design token system
│   ├── tokens/                           # Raw design tokens (JSON)
│   │   ├── colors.json
│   │   ├── typography.json
│   │   ├── spacing.json
│   │   └── shadows.json
│   ├── output/                           # Generated token artifacts
│   │   ├── css/variables.css
│   │   ├── ts/tokens.ts
│   │   └── tailwind-tokens.json
│   └── config.json                       # Style Dictionary config
│
├── docs/                                 # VitePress documentation site
│   ├── index.md                          # Homepage
│   ├── ARCHITECTURE.md                   # System architecture
│   ├── DEPLOYMENT.md                     # Deployment guide
│   ├── DESIGN_SYSTEM.md                  # Design system reference
│   ├── DEVELOPER_GUIDE.md                # Developer onboarding
│   ├── TESTING_PLAN.md                   # Testing strategy
│   ├── PROTOCOL_AUDIT.md                 # Protocol audit results
│   ├── PROTOCOL_STATUS.md                # Live protocol health
│   ├── PLATFORM_UNIVERSE.md              # All platforms catalog
│   ├── INTEGRATIONS.md                   # Third-party integrations
│   ├── API_REFERENCE.md                  # API documentation
│   ├── CREATOR_GUIDE.md                  # Creator documentation
│   ├── SELF_HOST_GUIDE.md                # Self-hosting guide
│   ├── TIPPING-ARCHITECTURE.md           # Tip system design
│   ├── LAUNCH-CHECKLIST.md               # Launch readiness
│   ├── CONTRIBUTING.md                   # Contribution guide
│   ├── CODE_STANDARDS.md                 # Coding conventions
│   ├── LONGFORM_PUBLISHING.md            # Article publishing
│   ├── ZORA_COMPATIBILITY.md             # Zora protocol compat
│   ├── USER_GUIDE.md                     # User documentation
│   ├── BRIDGE_ARCHITECTURE.md            # Bridge system design
│   ├── STRUCTURE.md                      # ← THIS FILE
│   ├── ROADMAP_2026.md                   # ← PLANNING DOCUMENT
│   ├── api/                              # API docs
│   ├── architecture/                     # Architecture docs
│   ├── guide/                            # User guides
│   └── plans/                            # Planning docs
│
├── scripts/                              # Automation scripts
│   ├── push-all.sh                       # Push to all remotes
│   ├── deploy/                           # Deployment scripts
│   │   ├── deploy-tip-contract.ts
│   │   ├── rollback.sh
│   │   └── setup-cloudflare.sh
│   ├── self-host/                        # Self-hosting assets
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── Caddyfile
│   │   └── install.sh
│   ├── infra/                            # Infrastructure scripts
│   │   ├── deploy-all.sh
│   │   └── docker-compose.full.yml
│   ├── git/                              # Git scripts
│   │   ├── push-mirrors.sh
│   │   └── radicle-setup.sh
│   ├── perf/                             # Performance scripts
│   │   └── load-test.mjs
│   ├── metrics/                          # Metrics scripts
│   │   └── dora-track.sh
│   ├── seed-data/                        # Seed data (JSON)
│   ├── lighthouse.sh                     # Lighthouse audit
│   ├── start-bridge.sh                   # Bridge server launcher
│   ├── validate-env.sh                   # Env validation
│   ├── enterprise-firewall.py            # Firewall config
│   └── proprietary-firewall.py           # Proprietary firewall
│
├── tests/                                # Integration & E2E tests
│   ├── api/                              # API integration tests
│   ├── bridge/                           # Bridge protocol tests
│   ├── components/                       # Component E2E tests
│   └── hooks/                            # Hook integration tests
│
├── infra/                                # Infrastructure configs
│   └── monitoring/                       # Observability stack
│       └── docker-compose.yml
│
├── docker-compose.yml                    # Root Compose (local dev)
├── pnpm-workspace.yaml                   # Workspace definition
├── turbo.json                            # Turbo build config
├── vitest.config.ts                      # Root test config
├── tsconfig.base.json                    # Shared TS config
├── playwright.config.ts                  # E2E test config
├── sonar-project.properties              # SonarQube config
└── release-please-config.json            # Release automation
```

---

## 2. Data Flow Architecture

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                   SOURCE LAYER                             │
                    │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
                    │  │ Nostr   │  │ Farcaster│  │  Lens    │  │  Zora     │  │
                    │  │ (6 WS)  │  │ (Hubble) │  │ (GQL v2) │  │ (GraphQL) │  │
                    │  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
                    │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
                    │  │Bluesky  │  │ GoToSocial│  │  Lemmy   │  │ PeerTube  │  │
                    │  │ (AT Prot)│  │(Mastodon)│  │(ActivityPub)│(ActivityPub)│ │
                    │  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
                    │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
                    │  │Pixelfed │  │  Reddit  │  │RSS-Bridge│  │  YouTube  │  │
                    │  │(RSS+API)│  │(Redlib)  │  │(1526 bf) │  │(API+Scrape)│ │
                    │  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
                    └───────┼────────────┼─────────────┼────────────────┼───────┘
                            │            │             │                │
                    ┌───────▼────────────▼─────────────▼────────────────▼───────┐
                    │               BRIDGE LAYER (port 8787)                    │
                    │                                                           │
                    │  ┌─────────────────────────────────────────────────────┐   │
                    │  │              server.ts (HTTP Router)                │   │
                    │  │  - UnifiedPost type normalization                    │   │
                    │  │  - Per-provider fetch + error isolation             │   │
                    │  │  - Cross-poster relay (GTS → Nostr)                 │   │
                    │  │  - Health check endpoint                            │   │
                    │  └─────────────────────────┬───────────────────────────┘   │
                    │                            │                               │
                    │  ┌─────────────────────────▼───────────────────────────┐   │
                    │  │              crossposter.ts                         │   │
                    │  │  - Publish from GoToSocial to Nostr relay           │   │
                    │  │  - Protocol translation layer                        │   │
                    │  └─────────────────────────────────────────────────────┘   │
                    └──────────────────────────┬─────────────────────────────────┘
                                               │
                    ┌──────────────────────────▼─────────────────────────────────┐
                    │              WORKER LAYER (Cloudflare)                     │
                    │                                                           │
                    │  ┌─────────────────────────────────────────────────────┐   │
                    │  │              app.ts (Hono Framework)                │   │
                    │  │  - Auth middleware (JWTs, sessions, OAuth)          │   │
                    │  │  - CORS, rate limiting, error handling              │   │
                    │  └──────────┬──────────────────────────────────────────┘   │
                    │             │                                              │
                    │  ┌──────────▼──────────────────────────────────────────┐   │
                    │  │                 FEED PIPELINE                       │   │
                    │  │  ┌────────────┐ ┌───────────┐ ┌────────────────┐   │   │
                    │  │  │ Fetcher    │→│ Scorer    │→│ Cache Layer    │   │   │
                    │  │  │ (providers)│ │ (ranking) │ │ (KV + memory)  │   │   │
                    │  │  └────────────┘ └───────────┘ └────────────────┘   │   │
                    │  │  ┌────────────┐ ┌───────────┐ ┌────────────────┐   │   │
                    │  │  │ Enricher   │→│ Curator   │→│ Quality Gates  │   │   │
                    │  │  │ (metadata) │ │ (rules)   │ │ (spam filter)  │   │   │
                    │  │  └────────────┘ └───────────┘ └────────────────┘   │   │
                    │  └─────────────────────────────────────────────────────┘   │
                    │             │                                              │
                    │  ┌──────────▼──────────────────────────────────────────┐   │
                    │  │              ROUTE HANDLERS (90 routes)             │   │
                    │  │  feed, for-you, trending, search, post, profile,    │   │
                    │  │  tip, auth, identity, notifications, communities,   │   │
                    │  │  spaces, admin, preferences, bookmarks, ...         │   │
                    │  └─────────────────────────────────────────────────────┘   │
                    └──────────────────────────┬─────────────────────────────────┘
                                               │
                    ┌──────────────────────────▼─────────────────────────────────┐
                    │              FRONTEND LAYER (Next.js 16)                   │
                    │                                                           │
                    │  ┌─────────────────────────────────────────────────────┐   │
                    │  │  App Router (Pages + Layouts)                       │   │
                    │  │  /feed        - Protocol feeds (bluesky, lens...)   │   │
                    │  │  /home        - Dashboard (for-you, trending)       │   │
                    │  │  /discover    - Content discovery                   │   │
                    │  │  /video       - Video hub (PeerTube+YouTube+etc)   │   │
                    │  │  /shorts      - Short-form video                    │   │
                    │  │  /launch      - Token launch platform               │   │
                    │  │  /spaces      - Audio spaces                        │   │
                    │  │  /c           - Communities (Feddy)                 │   │
                    │  │  /post/[id]   - Single post view                    │   │
                    │  │  /profile     - User profiles + analytics           │   │
                    │  │  /messages    - Cross-protocol DMs                  │   │
                    │  │  /premium     - Subscription management             │   │
                    │  └─────────────────────────────────────────────────────┘   │
                    │                                                           │
                    │  ┌─────────────────────────────────────────────────────┐   │
                    │  │  React Components (160)                             │   │
                    │  │  - Composition: LayoutShell → FeedSidebar → PostCard│   │
                    │  │  - State: hooks → services → worker API             │   │
                    │  │  - Rendering: RSC + client boundaries as needed     │   │
                    │  │  - Realtime: WebSocket (ws-channels)                │   │
                    │  └─────────────────────────────────────────────────────┘   │
                    └───────────────────────────────────────────────────────────┘
```

---

## 3. Dependency Graph

```
                     ┌──────────────┐
                     │    types     │  ← Shared types (used by ALL)
                     └──────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
     ┌───────┐        ┌─────────┐        ┌─────────┐
     │ utils  │        │  auth   │        │ storage │
     └───┬───┘        └────┬────┘        └────┬────┘
         │                 │                  │
         ▼                 ▼                  ▼
   ┌─────────┐      ┌──────────────┐    ┌──────────┐
   │  ui     │      │ identity-hub │    │ ranking  │
   └────┬────┘      └──────┬───────┘    └────┬─────┘
        │                  │                  │
        ▼                  ▼                  ▼
  ┌───────────┐    ┌──────────────┐    ┌──────────┐
  │  feed-core │───→│ feed-providers│   │ protocol  │
  └─────┬─────┘    └──────┬───────┘    └────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    ┌──────────────┐
                    │  apps/web    │  ← Consumes everything
                    │  + workers/  │
                    └──────────────┘

Protocol SDKs (each independent, feeds into feed-providers):
  bluesky-sdk  ─┐
  farcaster-sdk ─┤
  lens-sdk      ─┤
  nostr-sdk     ─┤
  mastodon-sdk  ─┼──→ feed-providers ─→ apps/web
  lemmy-sdk     ─┤
  threads-sdk   ─┤
  rss-sdk       ─┤
  discord-sdk   ─┘

Infrastructure packages:
  web3         → apps/web (wallet, blockchain)
  token-gate   → apps/web (token-gated content)
  realtime     → apps/web + workers/api (WebSockets)
  video        → apps/web (processing)
  tip-contract → deploy (Solidity + Foundry)
  zora-sdk     → apps/web (NFTs)
  solana-programs → deploy (Rust + Anchor)
```

---

## 4. Build Pipeline

```
                    ┌─────────────────────────────┐
                    │       pnpm install           │
                    │  (workspace resolution)       │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │    turbo run build           │
                    │                              │
                    │  Step 1:  ^build dependencies│
                    │  ┌─────────────────────┐    │
                    │  │ types → utils → ... │    │
                    │  └─────────────────────┘    │
                    │                              │
                    │  Step 2:  Library builds     │
                    │  ┌─────────────────────┐    │
                    │  │ auth, identity,      │    │
                    │  │ storage, ranking,     │    │
                    │  │ feed-core, protocol  │    │
                    │  │ SDKs, etc. (tsc/vite)│    │
                    │  └─────────────────────┘    │
                    │                              │
                    │  Step 3:  Application builds │
                    │  ┌─────────────────────┐    │
                    │  │ apps/web (next build)│    │
                    │  │  → .next/ (SSG+SSR) │    │
                    │  │  → dist/ (exported) │    │
                    │  └─────────────────────┘    │
                    │  ┌─────────────────────┐    │
                    │  │ workers/api          │    │
                    │  │  (wrangler build)    │    │
                    │  │  → dist/worker.js   │    │
                    │  └─────────────────────┘    │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
   │   Docker     │    │ Cloudflare Pages  │    │ Cloudflare     │
   │   Image      │    │ (apps/web)        │    │ Workers        │
   │   (nginx)    │    │ CDN + SSR         │    │ (API backend)  │
   └──────┬───────┘    └──────────────────┘    └────────────────┘
          │
          ▼
   ┌──────────────┐
   │  [HOST-1] Host  │
   │  Docker      │
   │  Compose     │
   └──────────────┘
```

---

## 5. Deployment Architecture

```
                          ┌──────────────────────────┐
                          │      Cloudflare DNS       │
                          │  degenfeed.xyz            │
                          │  *.degenfeed.xyz          │
                          └───────────┬──────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
                    ▼                 ▼                  ▼
          ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
          │ Cloudflare Pages│ │  Cloudflare  │ │  Nginx Reverse   │
          │  (Frontend)     │ │  Workers     │ │  Proxy ([HOST-1])   │
          │  CDN + SSR      │ │  (API)       │ │  Port 443 →      │
          │  apps/web       │ │  workers/api │ │  Internal svcs   │
          └─────────────────┘ └──────┬───────┘ └──────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
          ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
          │  Bridge Server  │ │  Self-Hosted │ │  Docker Compose  │
          │  (Docker port   │ │  Services    │ │  (Full Stack)    │
          │   8787)         │ │              │ │                  │
          │  - 11 providers │ │ GoToSocial   │ │ apps/web         │
          │  - Crossposter  │ │ PeerTube     │ │ bridge           │
          │                 │ │ Lemmy        │ │ services         │
          └─────────────────┘ │ Bluesky PDS  │ │ monitoring       │
                              │ Nostr Relay  │ └──────────────────┘
                              │ RSS-Bridge   │
                              │ Redlib       │
                              │ Meilisearch  │
                              │ WriteFreely  │
                              │ ActivityPub  │
                              │ Relay        │
                              └──────────────┘

Storage:
  ┌────────────────────────────────────────────────────────────┐
  │  Cloudflare KV (session data, cache, preferences)          │
  │  SQLite (local bridge cache)                               │
  │  IPFS (content-addressed storage, Zora NFTs)               │
  └────────────────────────────────────────────────────────────┘

Monitoring:
  ┌────────────────────────────────────────────────────────────┐
  │  Prometheus + Grafana (infra/monitoring/docker-compose.yml) │
  │  Health endpoints: /health, /api/health/protocols          │
  │  Bridge health: /bridge/status                             │
  └────────────────────────────────────────────────────────────┘
```

---

## 6. Key Metrics

| Metric | Value |
|--------|-------|
| Total source files | 1,419 |
| Total lines of TypeScript | 350,127 |
| Test files | ~60 |
| Test lines | 16,646 |
| Monorepo packages | 43+ |
| Bridge providers (standardized) | 11 |
| Total protocols accessible | 44+ |
| Workers API routes | ~90 |
| Frontend pages | ~60 route groups |
| React components | ~160 |
| Custom hooks | ~52 |
| Smart contracts | 5 (Solidity) |
| Solana programs | 1 (Rust) |
| Dockerfiles | 2 |
| Docker Compose files | 3 |
| Total commits | 273 |
| Repository size (source) | ~253 MB |
