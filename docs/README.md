# DegenFeed Documentation

> **The Web3 Social Universe — 25 protocols, one app, your data, never sold.**

Welcome to the DegenFeed documentation hub. This index links every document in the project — from user guides to architecture deep dives to the press kit.

**Live app:** [app.degenfeed.xyz](https://app.degenfeed.xyz)  
**Docs site:** [docs.degenfeed.xyz](https://docs.degenfeed.xyz)  
**Source:** [git.rugmunch.io/RugMunchMedia/degenfeed](https://git.rugmunch.io/RugMunchMedia/degenfeed)  
**License:** AGPL-3.0

---

## Quick Links

| If you are... | Start here |
|---------------|------------|
| A new user | [User Guide](USER_GUIDE.md) |
| A creator looking to monetize | [Creator Guide](CREATOR_GUIDE.md) |
| A developer contributing | [Developer Guide](DEVELOPER_GUIDE.md) |
| Building an integration | [API Reference](API_REFERENCE.md) |
| Curious about our mission | [About Page](BLOG.md) |
| Looking for the story | [Blog: Introducing DegenFeed](BLOG.md) |
| Media / press | [Press Kit](PRESS.md) |

---

## User Documentation

| Document | Description |
|----------|-------------|
| [User Guide](USER_GUIDE.md) | Step-by-step: account creation, posting, tipping, spaces, communities, search, notifications, settings |
| [Creator Guide](CREATOR_GUIDE.md) | Creator coins, tips, livestreaming, revenue sharing, growth strategies |
| [Registration & Auth Guide](REGISTRATION.md) | Wallet sign-in, protocol linking, identity resolution |
| [DegenFeed Mesh FAQ](MESH-FAQ.md) | How the multi-network mesh works — one account on 8+ networks |
| [social.degenfeed.xyz Guide](SOCIAL_DEGENFEED_README.md) | Welcome to the DegenFeed Mesh entry point |
| [Self-Host Guide](SELF_HOST_GUIDE.md) | Running your own DegenFeed instance |
| [Guide Index](guide/index.md) | Quick-start guide for getting started |
| [Guide: Protocols](guide/protocols.md) | How to connect and use each protocol |
| [Guide: Auth](guide/auth.md) | Authentication and wallet connection details |
| [Guide: Self-Host](guide/self-host.md) | Self-hosted community setup |

## Developer Documentation

| Document | Description |
|----------|-------------|
| [Developer Guide](DEVELOPER_GUIDE.md) | Monorepo structure, adding protocols, testing, deployment workflow |
| [API Reference](API_REFERENCE.md) | Complete v1 REST API (feed, auth, publish, engage, notifications, tips, preferences) |
| [API: Feed](api/feed.md) | Feed endpoint details |
| [API: Auth](api/auth.md) | Authentication endpoints |
| [API: Publish](api/publish.md) | Cross-protocol publishing |
| [API: Engage](api/engage.md) | Likes, replies, reposts |
| [API: Notifications](api/notifications.md) | Notification delivery |
| [API: Preferences](api/preferences.md) | User preferences |
| [API: Tips](api/tips.md) | Tipping endpoints |
| [API: Features](api/features.md) | Feature flags and tiers |
| [Code Standards](CODE_STANDARDS.md) | TypeScript, React, CSS conventions |
| [Frontend Tools](FRONTEND-TOOLS.md) | Frontend workflow and tooling |
| [Contributing Guide](CONTRIBUTING.md) | How to contribute code, docs, bugs |

## Architecture & Design

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Full architecture: monorepo, edge layer, packages, protocol SDKs, data flow |
| [Architecture: Overview](architecture/index.md) | High-level system design |
| [Architecture: Frontend](architecture/frontend.md) | Next.js 16 client architecture |
| [Architecture: Worker API](architecture/worker.md) | Cloudflare Worker edge API |
| [Architecture: Protocol SDKs](architecture/sdks.md) | SDK abstraction layer design |
| [Architecture: Feed Pipeline](architecture/feed-pipeline.md) | Feed normalization, dedup, ranking |
| [Architecture: Ranking](architecture/ranking.md) | Transparent feed scoring algorithm |
| [Architecture: Deployment](architecture/deployment.md) | Edge + self-hosted deployment |
| [Design System](DESIGN_SYSTEM.md) | UI components, tokens, patterns |
| [Design Vision](DESIGN-VISION.md) | Brand identity, visual principles, copy standards |
| [Design Doc](design.md) | Design decisions and rationale |
| [Structure](STRUCTURE.md) | Directory structure reference |

## Protocol Integrations

| Document | Description |
|----------|-------------|
| [Integrations](INTEGRATIONS.md) | Per-protocol details for all 44+ protocols and services |
| [Protocol Universe](PLATFORM_UNIVERSE.md) | Full protocol landscape map |
| [Protocol Status](PROTOCOL_STATUS.md) | Which protocols support read, post, tip, stream |
| [Protocol Audit](PROTOCOL_AUDIT.md) | Protocol integration audit and quality assessment |
| [Cross-Protocol Frameworks](CROSS_PROTOCOL_FRAMEWORKS.md) | Comparison of integration approaches |
| [Missed Platforms](MISSED_PLATFORMS.md) | Protocols not yet integrated |
| [Lightweight Alternatives](LIGHTWEIGHT_ALTERNATIVES.md) | Lightweight protocol integration options |
| [Headless AP Alternatives](HEADLESS_AP_ALTERNATIVES.md) | Headless ActivityPub alternatives |
| [Bridge Architecture](BRIDGE_ARCHITECTURE.md) | Cross-protocol bridge design |
| [Bridgy Fed Integration](BRIDGY-FED-INTEGRATION.md) | Bridgy Fed bridge integration |
| [Integration Tests](INTEGRATION-TESTS.md) | Protocol integration test coverage |
| [Integration Verification](INTEGRATION_VERIFICATION.md) | Protocol verification checklists |

## Features & Functionality

| Document | Description |
|----------|-------------|
| [Creator Coins](CREATOR_COINS.md) | Token economics, bonding curves, vesting, anti-exploit |
| [Tipping Architecture](TIPPING-ARCHITECTURE.md) | Cross-chain tipping system design |
| [Longform Publishing](LONGFORM_PUBLISHING.md) | Long-form content across protocols |
| [Audio Spaces & Streaming](https://app.degenfeed.xyz) | Livestreaming architecture (see app) |
| [Mobile](MOBILE.md) | PWA and native mobile plans |
| [Monetization](MONETIZATION.md) | Revenue model and pricing |
| [Network Ownership](NETWORK_OWNERSHIP.md) | Self-sovereign identity and network ownership |
| [Ownership Verification](OWNERSHIP_VERIFICATION.md) | Verifying data ownership across protocols |
| [Postiz Integration](postiz-integration.md) | Postiz social media scheduler integration |
| [Reddit OAuth](REDDIT-OAUTH.md) | Reddit OAuth integration details |
| [Zora Compatibility](ZORA_COMPATIBILITY.md) | Zora protocol compatibility |
| [SEO Checklist](SEO-CHECKLIST.md) | SEO optimization checklist |

## Product & Strategy

| Document | Description |
|----------|-------------|
| [Product Charter](PRODUCT.md) | Product scope, success criteria, current reality |
| [Architecture](ARCHITECTURE.md) | System architecture (canonical) |
| [Roadmap 2026](ROADMAP_2026.md) | Q3–Q4 2026 feature roadmap |
| [Launch Checklist](LAUNCH-CHECKLIST.md) | Pre-launch verification checklist |
| [Production Checklist](PRODUCTION_CHECKLIST.md) | Production readiness checklist |
| [Deployment Guide](DEPLOYMENT.md) | Cloudflare Pages + Workers deployment |
| [Cloudflare Setup](CLOUDFLARE_SETUP.md) | Cloudflare configuration and KV setup |
| [Admin Access](ADMIN_ACCESS.md) | Administrative access and management |
| [Progress](PROGRESS.md) | Implementation progress tracking |
| [Testing Plan](TESTING_PLAN.md) | Testing strategy and coverage plan |

## Operations & Security

| Document | Description |
|----------|-------------|
| [Deployment](DEPLOYMENT.md) | Production deployment guide |
| [Cloudflare Setup](CLOUDFLARE_SETUP.md) | Cloudflare Pages, Workers, KV configuration |
| [DegenFeed Restore Procedure](DEGENFEED_RESTORE_PROCEDURE.md) | Disaster recovery and data restore |
| [Admin Access](ADMIN_ACCESS.md) | Administrative access controls |
| [Production Checklist](PRODUCTION_CHECKLIST.md) | Production readiness verification |

## Story & Press

| Document | Description |
|----------|-------------|
| [Blog: Introducing DegenFeed](BLOG.md) | Why we built it, what it does, technical deep dive, roadmap |
| [Press Kit](PRESS.md) | Logos, screenshots, metrics, founder info, contact |
| [About Page](BLOG.md) | Company story, mission, beliefs, technology |
| [FAQ](guide/index.md) | Frequently asked questions |

---

## How This Doc Is Organized

```
docs/
├── README.md              ← YOU ARE HERE
├── index.md               ← VitePress home page
├── USER_GUIDE.md          ← End-user guide
├── SOCIAL_DEGENFEED_README.md ← social.degenfeed.xyz welcome guide
├── MESH-FAQ.md            ← DegenFeed Mesh FAQ (one account on 8+ networks)
├── CREATOR_GUIDE.md       ← Creator monetization guide
├── DEVELOPER_GUIDE.md     ← Developer contribution guide
├── API_REFERENCE.md       ← Complete API reference
├── ARCHITECTURE.md        ← System architecture
├── BLOG.md                ← Launch announcement blog post
├── PRESS.md               ← Press kit
├── PRODUCT.md             ← Product charter
├── CONTRIBUTING.md        ← Contribution guidelines
├── CODE_STANDARDS.md      ← Code style standards
├── DESIGN_SYSTEM.md       ← UI component design system
├── DESIGN-VISION.md       ← Brand identity and design vision
├── DEPLOYMENT.md          ← Deployment guide
├── CLOUDFLARE_SETUP.md    ← Cloudflare configuration
├── SECURITY.md            ← Security policy
├── TESTING.md             ← Testing strategy
├── CHANGELOG.md           ← Release history
├── ROADMAP.md / ROADMAP_2026.md ← Roadmaps
│
├── guide/                 ← Getting started guides
│   ├── index.md
│   ├── protocols.md
│   ├── auth.md
│   └── self-host.md
│
├── architecture/          ← Architecture deep dives
│   ├── index.md
│   ├── frontend.md
│   ├── worker.md
│   ├── sdks.md
│   ├── feed-pipeline.md
│   ├── ranking.md
│   └── deployment.md
│
├── api/                   ← API endpoint docs
│   ├── index.md
│   ├── feed.md
│   ├── auth.md
│   ├── publish.md
│   ├── engage.md
│   ├── notifications.md
│   ├── preferences.md
│   ├── tips.md
│   └── features.md
│
├── plans/                 ← Implementation plans
├── superpowers/           ← Superpower specs
└── [other markdown docs]  ← Feature-specific docs
```

---

> *"DegenFeed exists to unify the fragmented decentralized social web. We don't own your content — we give you the tools to own it yourself."*
>
> — DegenFeed Mission Statement
