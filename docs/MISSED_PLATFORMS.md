# Missed Platforms Research & Integration

> **Audit of decentralized/web3 platforms NOT yet integrated into DegenFeed**
> **Date:** 2026-07-24
> **Owner:** crmuncher
> **Status:** Research complete — top integrations in progress

---

## Table of Contents

1. [Evaluation Summary](#1-evaluation-summary)
2. [Platform Deep Dives](#2-platform-deep-dives)
   - [Paragraph](#21-paragraph)
   - [Mirror](#22-mirror)
   - [Highlight](#23-highlight)
   - [Tako](#24-tako)
   - [Orbis](#25-orbis)
   - [CyberConnect / Cyber](#26-cyberconnect--cyber)
   - [XMTP](#27-xmtp)
   - [Push Protocol](#28-push-protocol)
   - [Lit Protocol](#29-lit-protocol)
   - [Tableland](#210-tableland)
   - [Ceramic Network](#211-ceramic-network)
   - [Arweave / Irys](#212-arweave--irys)
   - [Huddle01](#213-huddle01)
   - [Audius / Open Audio Protocol](#214-audius--open-audio-protocol)
   - [Sound.xyz](#215-soundxyz)
   - [Mintbase](#216-mintbase)
   - [Rarible Protocol](#217-rarible-protocol)
   - [OpenSea SDK](#218-opensea-sdk)
3. [Priority Roadmap](#3-priority-roadmap)
4. [Integration Actions](#4-integration-actions)
5. [How to Add a New Protocol](#5-how-to-add-a-new-protocol)

---

## 1. Evaluation Summary

| # | Platform | Category | Open Source | Self-Host | API/SDK | Value to DegenFeed | Priority |
|---|----------|----------|-------------|-----------|---------|-------------------|----------|
| 1 | **Audius** | Music/Audio | ✅ Apache-2.0 | ✅ Docker node | ✅ JS SDK + REST + gRPC | Music NFTs, trending tracks, artist feed content | 🔴 HIGH |
| 2 | **Rarible Protocol** | NFT Marketplace | ✅ MIT | ✅ Docker | ✅ TS SDK + REST + MCP | Cross-chain NFT activity, sales data, market feed | 🔴 HIGH |
| 3 | **Paragraph** | Web3 Publishing | ❌ Platform | ❌ Cloud-only | ✅ REST API + TS SDK + MCP | Web3 blog posts, writer coins, newsletter content | 🟡 MEDIUM |
| 4 | **XMTP** | Messaging | ✅ MIT | ⚠️ Permissioned | ✅ JS/RN/iOS/Android SDK | Decentralized messaging, DM integration | 🟡 MEDIUM |
| 5 | **Push Protocol** | Notifications | ✅ MIT | ✅ Delivery node | ✅ TS SDK + REST API + Socket | Web3 push notifications for feed events | 🟡 MEDIUM |
| 6 | **CyberConnect** | Social Graph | ✅ GPL-3.0 | ❌ Network-based | ✅ GraphQL API + TS SDK | Social graph data, identity resolution | 🟡 MEDIUM |
| 7 | **OpenSea SDK** | NFT Marketplace | ✅ MIT (SDK) | ❌ Cloud API | ✅ TS SDK + WS Stream + CLI | Largest NFT marketplace data, trending mints | 🟡 MEDIUM |
| 8 | **Orbis** | Social Protocol | ✅ OSS | ✅ Self-host Ceramic | ✅ TS SDK | Decentralized social on Ceramic, encrypted content | 🟡 MEDIUM |
| 9 | **Ceramic Network** | Data Network | ✅ MIT/Apache-2.0 | ✅ ceramic-one Rust | ✅ HTTP API + TS SDK | Decentralized data layer, event streams | 🟡 MEDIUM |
| 10 | **Tableland** | Database | ✅ MIT/Apache-2.0 | ✅ Docker validator | ✅ TS SDK + CLI + REST API | Decentralized SQL database for app data | 🟡 MEDIUM |
| 11 | **Lit Protocol** | Access Control | ✅ OSS | ✅ TEE self-host | ✅ JS SDK + REST API | Token-gated content, decentralized keys | 🟡 MEDIUM |
| 12 | **Arweave/Irys** | Storage | ✅ MIT | ✅ Self-host | ✅ JS SDK + CLI | Permanent storage, already partially used | 🟡 MEDIUM |
| 13 | **XMTP** | Messaging | ✅ MIT | ⚠️ Permissioned | ✅ JS/RN/iOS/Android SDK | Decentralized messaging, DM notifications | 🟡 MEDIUM |
| 14 | **Mintbase** | NFT Marketplace | ✅ MIT/GPL-3.0 | ❌ NEAR-based | ✅ JS SDK + GraphQL API | NEAR NFT ecosystem | 🟢 LOW |
| 15 | **Tako** | Social Protocol | 🟡 Partial | ❌ API-only | ✅ REST API (rate limited) | Social recommendation layer | 🟢 LOW |
| 16 | **Highlight** | Creative Platform | 🟡 Partial (contracts) | ❌ Cloud-only | ✅ TS SDK | NFT creation platform | 🟢 LOW |
| 17 | **Huddle01** | Video Calls | 🟡 SDK only | ❌ Network-based | ✅ JS/RN SDK | Decentralized video calls in feed | 🟢 LOW |
| 18 | **Mirror** | Web3 Publishing | 🟡 Community OSS | 🟡 Via Arweave | ✅ Arweave GraphQL | Web3 blog content (via Arweave) | 🟢 LOW |
| 19 | **LooksRare** | NFT Marketplace | ❌ Closed | ❌ | ✅ REST API | NFT sales data | 🟢 LOW |
| 20 | **Sound.xyz** | Music NFTs | ✅ MIT (archived) | ❌ | ❌ **Platform shut down Jan 2026** | Dead — skip entirely | 🔴 DEAD |
| 21 | **Glass Protocol** | Video | ❌ Closed | ❌ | ❌ | Minimal data available | 🔴 DEAD |
| 22 | **Catalog** | Music NFTs | ❌ Closed | ❌ | ❌ | Minimal adoption | 🔴 DEAD |

---

## 2. Platform Deep Dives

### 2.1 Paragraph

| Field | Value |
|-------|--------|
| **Website** | https://paragraph.xyz |
| **Category** | Web3 publishing & newsletters |
| **License** | Proprietary (not self-hostable) |
| **API** | ✅ REST API (`public.api.paragraph.com/api`), TS SDK (`@paragraph-com/sdk`), MCP server (`mcp.paragraph.com`), CLI |
| **Self-Host** | ❌ Cloud-only platform |
| **Auth** | API key for writes, public for reads |
| **GitHub** | https://github.com/paragraph-xyz (17 repos, SDK, CLI, MCP, docs) |

**Key APIs:**
- Fetch posts from any publication
- Read/write writer coins and post coins (market data, prices, holders)
- Search posts/discover
- Manage subscribers
- AI agent support (MCP, CLI with `--json`)

**Content Types:** Blog posts, newsletters, writer coins, post coins

**Integration Value:** Paragraph is the leading web3 publishing platform (acquired Mirror). Their content — blog posts about crypto/web3 — is highly relevant to DegenFeed's audience. Their API exposes writer coins (social tokens) which aligns with our creator coin functionality.

**Verdict:** 🟡 MEDIUM — Integrate via API. Cannot self-host but API provides rich content.

---

### 2.2 Mirror

| Field | Value |
|-------|--------|
| **Website** | https://mirror.xyz |
| **Category** | Web3 publishing |
| **License** | ❌ Acquired by Paragraph (May 2024). Content on Arweave |
| **API** | 🟡 Community-built APIs read from Arweave (graphql.arweave.network) |
| **Self-Host** | 🟡 Via community tools like `mirror-next` (MIT) — self-hosted reader |
| **GitHub** | https://github.com/m1guelpf/mirror-next (MIT — self-hosted Mirror blog reader) |

**Key Insight:** Mirror content is stored on Arweave. All posts are accessible via Arweave GraphQL using tags `App-Name: MirrorXYZ`. Paragraph now owns Mirror and will merge both platforms.

**Integration Value:** Mirror has existing RSS support in DegenFeed's RSS provider. The community `mirror-api` provides REST endpoints for Mirror content. No additional integration needed beyond what RSS already covers.

**Verdict:** 🟢 LOW — Already partially covered by RSS. Arweave-native data means we can pull it anytime.

---

### 2.3 Highlight

| Field | Value |
|-------|--------|
| **Website** | https://highlight.xyz |
| **Category** | Web3 creative platform / NFT minting |
| **License** | 🟡 Smart contracts MIT (open source). Platform closed. |
| **API** | ✅ TS SDK (`@highlightxyz/sdk`), REST API (OpenAPI spec) |
| **Self-Host** | ❌ Cloud-only |
| **GitHub** | https://github.com/highlightxyz (6 repos: generative-art, contracts, tools) |

**Key APIs:** NFT collection creation, metadata management, sales configuration, generative art tooling

**Integration Value:** Highlight is a competitor to Zora (already integrated). Their API provides generative art and NFT creation tools. Useful but overlapping with existing Zora integration.

**Verdict:** 🟢 LOW — Overlaps with Zora integration. Monitor for unique differentiation.

---

### 2.4 Tako

| Field | Value |
|-------|--------|
| **Website** | https://tako.so |
| **Category** | Modular social protocol / recommendation layer |
| **License** | 🟡 Some repos open. Core platform proprietary. |
| **API** | ✅ REST API (`api.tako.so`), TS SDK. Rate limit: 60 req/min/IP |
| **Self-Host** | ❌ Network-based |
| **GitHub** | https://github.com/takoprotocol (9 repos — hub-contracts, client-tako) |

**Key APIs:**
- Social graph search (Lens + Farcaster profiles)
- Open curation / recommendation
- Profile-as-an-asset (key holders)
- Peer-to-peer curation

**Integration Value:** Tako is a social recommendation layer built on top of Lens and Farcaster. Since we already integrate both, Tako could provide algorithmic curation and discovery. However, it requires Farcaster/Lens accounts.

**Verdict:** 🟢 LOW — Niche recommendation layer dependent on existing integrations.

---

### 2.5 Orbis

| Field | Value |
|-------|--------|
| **Website** | https://useorbis.com |
| **Category** | Decentralized social protocol on Ceramic |
| **License** | ✅ Open source. TS SDK available. |
| **API** | ✅ TS SDK (`@orbisclub/sdk`), REST API (via Orbis Nodes), Ceramic primitives |
| **Self-Host** | ✅ Ceramic node (self-hosted) + Orbis SDK |
| **GitHub** | https://github.com/OrbisWeb3 (SDK, SDK v2, templates) |

**Key Features:**
- Decentralized social feed
- Encrypted messaging
- Token-gated content
- Ceramic-based data layer (no tx fees)
- OrbisDB (new relational DB on Ceramic)

**Integration Value:** Orbis provides a complete decentralized social stack on Ceramic. If DegenFeed wants to offer its own decentralized social layer, Orbis is the best foundation. Currently in maintenance mode — new focus is OrbisDB.

**Verdict:** 🟡 MEDIUM — Good foundation if we want Ceramic-based social features. OrbisDB direction is promising.

---

### 2.6 CyberConnect / Cyber

| Field | Value |
|-------|--------|
| **Website** | https://cyber.co |
| **Category** | Decentralized social graph (evolved to L2) |
| **License** | ✅ GPL-3.0 (smart contracts), MIT (SDK) |
| **API** | ✅ GraphQL API (`api.cyberconnect.dev`), TS SDK (`@cyberlab/cyberconnect-v2`, `@cyberlab/cyber-account`) |
| **Self-Host** | ❌ Network-based L2 |
| **GitHub** | https://github.com/cyberconnecthq (cybercontracts, cyber-account, social-verifier) |

**Core Components:**
- **CyberAccount** — ERC-4337 smart accounts
- **CyberGraph** — Censorship-resistant social graph
- **CyberNetwork** — L2 for social (rebranded to Cyber)
- **Link3** — Web3 professional networking (spun out independently)

**Key APIs:** Profile resolution, follow/unfollow, content graph, identity verification (Twitter/GitHub)

**Integration Value:** CyberConnect's social graph data could enrich DegenFeed's cross-protocol identity resolution. Their GraphQL API provides follower graphs, content graphs, and identity verification.

**Verdict:** 🟡 MEDIUM — Social graph API that complements existing identity resolution.

---

### 2.7 XMTP

| Field | Value |
|-------|--------|
| **Website** | https://xmtp.org |
| **Category** | Decentralized messaging protocol |
| **License** | ✅ MIT (node client), open protocol |
| **API** | ✅ JS SDK (`@xmtp/xmtp-js`), RN SDK, iOS/Android SDK, Agent SDK |
| **Self-Host** | ⚠️ Permissioned network (7 nodes, Phase 1). Local dev node possible. |
| **GitHub** | https://github.com/xmtp (xmtpd, libxmtp, proto, XIPs) |

**Key Stats:** 2.2M+ verified identities, 150M+ messages processed, transitioning to decentralized mainnet March 2026

**Key Features:**
- End-to-end encrypted messaging (MLS protocol)
- Signal-grade security
- App interoperability (messages accessible from any app)
- DM, group chat, agent messaging
- Spam protection system
- Wallet-based identity

**Integration Value:** XMTP is the dominant decentralized messaging protocol. Integrates natively with wallets (Coinbase Wallet, Lens, ENS). Could power DegenFeed's DM features and notification delivery.

**Verdict:** 🟡 MEDIUM — Excellent decentralized messaging layer. Best integrated when DegenFeed adds chat/DM features.

---

### 2.8 Push Protocol

| Field | Value |
|-------|--------|
| **Website** | https://push.org |
| **Category** | Decentralized notifications & communication |
| **License** | ✅ MIT (SDK, smart contracts) |
| **API** | ✅ TS SDK (`@pushprotocol/restapi`, `@pushprotocol/socket`, `@pushprotocol/uiweb`) |
| **Self-Host** | ✅ Delivery node (self-hosted, Docker + MySQL + Redis) |
| **GitHub** | https://github.com/push-protocol (push-sdk, push-smart-contracts, push-delivery-node) |

**Key Features:**
- Cross-chain notifications
- Push Chat (decentralized messaging)
- Push Video (video calls)
- Smart contract/web3 notifications
- Delivery node for mobile push

**Integration Value:** Push Protocol could deliver DegenFeed notifications (new posts, tips, creator coin events) directly to users' wallets. Their delivery node can self-host and bridge to mobile push.

**Verdict:** 🟡 MEDIUM — Best path for decentralized notifications. Self-hosted delivery node gives us control.

---

### 2.9 Lit Protocol

| Field | Value |
|-------|--------|
| **Website** | https://litprotocol.com |
| **Category** | Decentralized key management & access control |
| **License** | ✅ Open source (Chipotle stack) |
| **API** | ✅ JS SDK (`@lit-protocol/lit-node-client`), REST API (OpenAPI), Lit Actions (IPFS JS) |
| **Self-Host** | ✅ TEE self-hosting (Docker Compose via dstack). Multiple TEE providers. |
| **GitHub** | https://github.com/lit-protocol (Chipotle, JS SDK, contracts) |

**Key Features:**
- Programmable Key Pairs (PKPs) — decentralized wallets
- Lit Actions — immutable JS on IPFS, executed in TEE
- Access control (token-gating encryption)
- Serverless signing
- Chain abstraction (any chain, any API)

**Integration Value:** Lit Protocol could power DegenFeed's token-gated content, decentralized identity, and cross-chain signing. Most relevant for premium/creator coin-gated features.

**Verdict:** 🟡 MEDIUM — Infrastructure protocol. Best for access control and decentralized signing features.

---

### 2.10 Tableland

| Field | Value |
|-------|--------|
| **Website** | https://tableland.xyz |
| **Category** | Decentralized SQL database |
| **License** | ✅ MIT/Apache-2.0 |
| **API** | ✅ TS SDK (`@tableland/sdk`), CLI, REST API |
| **Self-Host** | ✅ Go validator node (Docker Compose) |
| **GitHub** | https://github.com/tablelandnetwork (go-tableland, js SDK) |

**Key Features:**
- SQLite-compatible decentralized database
- ACID-compliant
- Row-level access control
- Multi-chain (Ethereum, Optimism, Arbitrum, Polygon)
- ERC721 table ownership
- Local development with Hardhat integration

**Integration Value:** Tableland could be used as DegenFeed's data layer for decentralized storage of feed metadata, user preferences, and content indexing.

**Verdict:** 🟡 MEDIUM — Infrastructure protocol. Useful if DegenFeed moves toward fully decentralized data storage.

---

### 2.11 Ceramic Network

| Field | Value |
|-------|--------|
| **Website** | https://ceramic.network |
| **Category** | Decentralized data network (event streaming) |
| **License** | ✅ MIT/Apache-2.0 |
| **API** | ✅ HTTP REST API, TS SDK (`@ceramicnetwork/http-client`), ceramic-one (Rust) |
| **Self-Host** | ✅ ceramic-one Rust daemon + Postgres. ~$106-967/mo |
| **GitHub** | https://github.com/ceramicnetwork (js-ceramic, ceramic-one) |

**Key Stats:** 400+ apps, 10M+ streams, 350M+ events, 250 TPS

**Key Features:**
- Decentralized event streaming protocol
- Composable data models
- DID-based identity
- Ethereum anchoring
- Ceramic One (Rust) — high performance
- ComposeDB — graph database layer

**Integration Value:** Ceramic is the foundation for Orbis and many other dApps. Could serve as DegenFeed's decentralized data backend. Now merged with Textile (Tableland).

**Verdict:** 🟡 MEDIUM — Infrastructure. Best for composable data storage and event streaming.

---

### 2.12 Arweave / Irys

| Field | Value |
|-------|--------|
| **Website** | https://arweave.org / https://irys.xyz |
| **Category** | Permanent decentralized storage / L1 programmable datachain |
| **License** | ✅ MIT (SDKs), open protocol |
| **API** | ✅ JS SDK (`@irys/sdk`, `@irys/arweave`), Rust SDK, CLI |
| **Self-Host** | ✅ Arweave node (docker), Irys bundler node |
| **GitHub** | https://github.com/irys-xyz (irys, js-sdk, rust-sdk, arweave) |

**Key Features:**
- Permanent data storage (one-time fee)
- Irys: L1 programmable datachain
- 14 supported tokens for payment
- Volumetric scaling (50K+ TPS)
- Provenance tracking
- Bundled transactions for low cost

**Integration Value:** Arweave already powers Mirror & Paragraph content. Irys provides cheaper, faster uploads with guaranteed finality. Natural fit for DegenFeed's decentralized media storage and content permanence.

**Verdict:** 🟡 MEDIUM — Already partially leveraged via Mirror. Irys integration for media uploads would add value.

---

### 2.13 Huddle01

| Field | Value |
|-------|--------|
| **Website** | https://huddle01.com |
| **Category** | Decentralized video conferencing (dRTC) |
| **License** | 🟡 SDKs open source. Network proprietary. |
| **API** | ✅ JS SDK (`@huddle01/web-core`), React SDK (`@huddle01/react`), RN SDK, Server SDK |
| **Self-Host** | ❌ Network-based (DePIN) |
| **GitHub** | https://github.com/Huddle01 (SDKs, docs) |

**Key Features:** Audio/video calls, token-gated rooms, recording, livestreaming, collaborative whiteboard, <20ms latency

**Integration Value:** Huddle01 could power DegenFeed's creator audio/video spaces. Token-gated rooms align with creator coin features.

**Verdict:** 🟢 LOW — Interesting but not feed content. Best for creator space features (future roadmap).

---

### 2.14 Audius / Open Audio Protocol

| Field | Value |
|-------|--------|
| **Website** | https://audius.co / https://openaudio.org |
| **Category** | Decentralized music streaming |
| **License** | ✅ Apache-2.0 (SDK, apps, protocol) |
| **API** | ✅ JS SDK (`@audius/sdk`), REST API (`api.audius.co/v1`), gRPC |
| **Self-Host** | ✅ Docker validator node (`go-openaudio`) — 16GB RAM, 8 core, 200GB disk |
| **GitHub** | https://github.com/AudiusProject (apps, audius-docker-compose, protocol) |

**Key Stats:** ~400M streams, 500K free API req/month, 349 SDK versions

**Key Features:**
- Open Audio Protocol v1.0 — decentralized music backend
- Trending tracks, playlists, user feeds
- Token-gated content
- Artist coins (Solana)
- OAuth login
- Free tier: 10 req/s, 500K req/month

**Integration Value:** 🟢 HUGE. Audius is the world's largest open music catalog with a well-documented API and SDK. Trending tracks, artist updates, and music NFTs would be unique feed content. Self-hostable validator node.

**Verdict:** 🔴 HIGH — **Top priority music integration.** Rich API, large catalog, self-hostable.

**API Examples:**
```typescript
import { sdk } from '@audius/sdk';
const audiusSdk = sdk({ apiKey: 'YOUR_API_KEY' });

// Get trending tracks
const trending = await audiusSdk.tracks.getTrendingTracks();

// Get track with streaming URL
const track = await audiusSdk.tracks.getTrack({ trackId: 'D7KyD' });
```

---

### 2.15 Sound.xyz

⚠️ **PLATFORM SHUT DOWN — January 16, 2026**

Sound.xyz is now offline. The protocol smart contracts are archived on GitHub (MIT license). The team has moved to Vault.fm.

**Verdict:** 🔴 DEAD — Skip entirely. On-chain music data remains on Arweave but no active platform.

---

### 2.16 Mintbase

| Field | Value |
|-------|--------|
| **Website** | https://mintbase.xyz |
| **Category** | NFT marketplace & launchpad on NEAR |
| **License** | ✅ MIT / GPL-3.0 (SDK, smart contracts, templates) |
| **API** | ✅ JS SDK (`@mintbase-js/sdk`, `@mintbase-js/data`), GraphQL indexer |
| **Self-Host** | ❌ NEAR-based (cannot self-host platform) |
| **GitHub** | https://github.com/mintbase (mintbase-js, mb-contracts, templates) |

**Key Features:**
- NEAR NFT ecosystem (1,400+ deployed contracts)
- GraphQL indexer for real-time NFT data
- USDC/USDT stable price listings
- Marketplace templates
- AI Chat, AI Minter templates

**Integration Value:** Mintbase provides access to the NEAR NFT ecosystem. If DegenFeed wants NEAR chain coverage, this is the best path.

**Verdict:** 🟢 LOW — NEAR-only. Limited overlap with existing EVM/Solana focus.

---

### 2.17 Rarible Protocol

| Field | Value |
|-------|--------|
| **Website** | https://rarible.org |
| **Category** | Multi-chain NFT marketplace protocol |
| **License** | ✅ MIT (SDK, smart contracts, protocol) |
| **API** | ✅ TS SDK (`@rarible/sdk`, `@rarible/protocol-mcp`), REST API, OpenAPI |
| **Self-Host** | ✅ Self-hostable MCP server, self-hostable API |
| **GitHub** | https://github.com/rarible (sdk, protocol-contracts) |

**Key Stats:** 5,000+ NFT marketplaces powered, 99.99% uptime, billions of NFTs indexed

**Key Features:**
- Multi-chain (Ethereum, Polygon, ImmutableX, Flow, Arbitrum, Tezos)
- Aggregated orderbook from OpenSea + Rarible
- Full NFT lifecycle: mint, sell, buy, bid, transfer
- Royalty enforcement
- MCP server for AI agent integration
- Whitelabel marketplace creation

**Integration Value:** 🔴 HIGH. Rarible provides the most comprehensive multi-chain NFT API available. Aggregated orderbook data means we get OpenSea listings plus other marketplaces. Self-hostable MCP server. Excellent for NFT feed content.

**Verdict:** 🔴 HIGH — **Top priority NFT data protocol.** Rich API, multi-chain, aggregated data.

**API Examples:**
```typescript
import { createRaribleSdk } from '@rarible/sdk';
const sdk = createRaribleSdk(undefined, 'prod', { apiKey: 'XXXXX' });

// Get NFT info
const nft = await sdk.apis.item.getItemById({ 
  itemId: 'ETHEREUM:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d:1' 
});

// Get collection info
const collection = await sdk.apis.collection.getCollectionById({ 
  collection: 'ETHEREUM:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' 
});
```

---

### 2.18 OpenSea SDK

| Field | Value |
|-------|--------|
| **Website** | https://opensea.io |
| **Category** | NFT marketplace (data + trading) |
| **License** | ✅ MIT (SDK — `@opensea/sdk`) |
| **API** | ✅ TS SDK (`@opensea/sdk`), Stream API (`@opensea/stream-js`), CLI (`@opensea/cli`) |
| **Self-Host** | ❌ Cloud API (free tier available) |
| **GitHub** | https://github.com/ProjectOpenSea/opensea-js (2K ⭐) |

**Key Features:**
- Largest NFT marketplace data
- Real-time events via WebSocket Stream API
- Seaport protocol integration
- Free tier: instant API key (30-day), production keys available
- Collection offers, trait offers
- Cross-chain drop minting

**Integration Value:** OpenSea data is already partially accessible via Rarible's aggregated orderbook. The Stream API provides real-time NFT events (listings, sales, offers).

**Verdict:** 🟡 MEDIUM — Valuable data but partially covered by Rarible. Stream API is unique for real-time events.

---

## 3. Priority Roadmap

### Tier 1: Integrate Now (This Week)

| # | Platform | Action | Effort | Value | Status |
|---|----------|--------|--------|-------|--------|
| 1 | **Audius** | Add bridge provider + feed-protocols.ts entry | 2-3 days | Music NFT & trending content | 🔴 IN PROGRESS |
| 2 | **Rarible Protocol** | Add bridge provider + NFT feed data | 2-3 days | Cross-chain NFT activity | 🔴 IN PROGRESS |

### Tier 2: Integrate Next (Next 2 Weeks)

| # | Platform | Action | Effort | Value |
|---|----------|--------|--------|-------|
| 3 | **Paragraph** | Add bridge provider for web3 blogs | 1-2 days | Web3 publishing content |
| 4 | **OpenSea SDK** | Add Stream API for real-time NFT events | 2-3 days | Real-time NFT feed data |
| 5 | **Push Protocol** | Add notification bridge | 3-4 days | Decentralized notifications |
| 6 | **XMTP** | Add messaging SDK | 3-4 days | Decentralized DMs |
| 7 | **CyberConnect** | Add GraphQL resolver for social graph | 1-2 days | Identity resolution |

### Tier 3: Monitor / Future Roadmap

| # | Platform | When | Notes |
|---|----------|------|-------|
| 8 | **Orbis** | Post-Ceramic stabilization | OrbisDB migration in progress |
| 9 | **Mintbase** | If NEAR coverage needed | NEAR-only ecosystem |
| 10 | **Ceramic** | Infrastructure evolution | Foundation for Orbis, Tableland |
| 11 | **Tableland** | If decentralized DB needed | SQLite-compatible |
| 12 | **Lit Protocol** | If access control needed | Token-gating infrastructure |
| 13 | **Arweave/Irys** | Ongoing media storage | Upgrade to Irys for cheaper uploads |
| 14 | **Huddle01** | Creator spaces feature | Video/audio rooms |
| 15 | **Tako** | Monitor for adoption | Lens/Farcaster dependent |

---

## 4. Integration Actions

### 4.1 Audius Integration

**Provider:** `bridge/src/providers/audius.ts`

```typescript
import { sdk } from '@audius/sdk';

export class AudiusProvider implements ProtocolProvider {
  id = 'audius';
  private client: ReturnType<typeof sdk>;

  constructor() {
    this.client = sdk({ apiKey: process.env.AUDIUS_API_KEY });
  }

  async fetch(options: FetchOptions): Promise<RawPost[]> {
    const trending = await this.client.tracks.getTrendingTracks();
    return trending.data.map(track => ({
      id: `audius:${track.id}`,
      type: 'track',
      title: track.title,
      artist: track.user.name,
      duration: track.duration,
      genre: track.genre,
      plays: track.play_count,
      streamUrl: track.audio_upload_id 
        ? `https://audius.co/tracks/${track.id}/stream` 
        : null,
    }));
  }
}
```

**feed-protocols.ts entry:**
```typescript
audius: {
  id: 'audius',
  label: 'Audius',
  color: '#cc0fe0',
  icon: '🎵',
  description: 'Decentralized music streaming — trending tracks & artist updates',
  endpoint: '/api/feed/audius',
  route: '/feed/music',
  postNoun: 'track',
  stats: [
    { label: 'catalog', value: '400M+ streams' },
    { label: 'free tier', value: '500K req/mo' },
  ],
},
```

### 4.2 Rarible Protocol Integration

**Provider:** `bridge/src/providers/rarible.ts`

```typescript
import { createRaribleSdk } from '@rarible/sdk';

export class RaribleProvider implements ProtocolProvider {
  id = 'rarible';
  private sdk: ReturnType<typeof createRaribleSdk>;

  constructor() {
    this.sdk = createRaribleSdk(undefined, 'prod', { 
      apiKey: process.env.RARIBLE_API_KEY 
    });
  }

  async fetch(options: FetchOptions): Promise<RawPost[]> {
    // Fetch recent activities across chains
    const activities = await this.sdk.apis.activity.getActivities({
      type: ['SELL', 'LIST', 'MINT'],
      limit: options.limit || 20,
    });
    return activities.data;
  }
}
```

**feed-protocols.ts entry:**
```typescript
rarible: {
  id: 'rarible',
  label: 'NFT Markets',
  color: '#feda02',
  icon: '🖼️',
  description: 'Cross-chain NFT sales, mints & trending collections',
  endpoint: '/api/feed/rarible',
  route: '/feed/nft-market',
  postNoun: 'sale',
  stats: [
    { label: 'chains', value: '7+' },
    { label: 'marketplaces', value: 'aggregated' },
  ],
},
```

### 4.3 Protocol Registration

Add entries to the existing `PROTOCOLS` record in `feed-protocols.ts` and update `SIDEBAR_ORDER`:

```typescript
export const SIDEBAR_ORDER = [
  'mastodon',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'audius',       // NEW
  'rarible',      // NEW
  'peertube',
  'lemmy',
  'pixelfed',
  'zora',
  'rss',
  'reddit',
] as const;
```

### 4.4 API Keys Required

| Service | Key Type | Where to Get | Free Tier |
|---------|----------|-------------|-----------|
| Audius | API Key + Bearer Token | https://api.audius.co/plans | 10 req/s, 500K req/month |
| Rarible | API Key | https://rarible.org/pricing | Free tier available |
| Paragraph | API Key | paragraph.com/settings → Developer | Free with account |
| OpenSea | API Key | opensea.io/settings/developer | Instant free key (30-day) |
| Push Protocol | Channel + PK | app.epns.io | Free to create channel |

---

## 5. How to Add a New Protocol

Each new protocol requires these files:

```
bridge/src/providers/{protocol}.ts     — Provider implementation
apps/web/src/components/feed/feed-protocols.ts  — Add to PROTOCOLS + SIDEBAR_ORDER
apps/web/src/app/api/health/protocols/route.ts  — Add health check stats
```

**Provider Interface (from existing docs):**
```typescript
interface ProtocolProvider {
  id: string;
  fetch(options: FetchOptions): Promise<RawPost[]>;
  normalize(raw: RawPost): UnifiedPost;
  healthCheck(): Promise<number>;
  authenticate?(credentials: AuthCredentials): Promise<AuthResult>;
  publish?(post: PublishOptions): Promise<PublishResult>;
}
```

---

## Appendix: Decentralized Photo Platforms

This was already checked. Pixelfed is the leading decentralized photo platform (already deployed ✅).

**Additional platforms considered:**

| Platform | Verdict | Reason |
|----------|---------|--------|
| Pixelfed | ✅ Already integrated | Self-hosted instance, ActivityPub |
| **Pixls.us** | ❌ Not open source | Centralized, no API |
| **Darkroom** | ❌ Not decentralized | Mobile photo editor app |
| **FrameIt** | ❌ Not decentralized | Digital frame platform |
| **Photogram** | 🟢 Monitor | ActivityPub-based, very early stage |

The photo space in fediverse is dominated by Pixelfed. No other decentralized photo platform has meaningful adoption.

---

## References

- https://docs.audius.co — Audius API docs
- https://docs.rarible.org — Rarible Protocol docs
- https://paragraph.com/docs/development — Paragraph API docs
- https://docs.xmtp.org — XMTP docs
- https://comms.push.org — Push Protocol docs
- https://developer.litprotocol.com — Lit Protocol docs
- https://docs.tableland.xyz — Tableland docs
- https://developers.ceramic.network — Ceramic Network docs
- https://docs.irys.xyz — Irys docs
- https://docs.opensea.io — OpenSea API docs
- https://docs.sound.xyz — Sound.xyz docs (archived)
