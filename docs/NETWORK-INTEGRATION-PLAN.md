# DegenFeed — Network Ownership & Cross-Protocol Integration Strategy

> **Last updated:** 2026-07-25  
> **Owner:** DegenFeed Engineering <admin@degenfeed.xyz>  
> **Status:** Living Document — Updated as bridges deploy  
> **Version:** 2.0 (Cross-Protocol Interoperability)

---

## Table of Contents

1. [Integration Architecture — Per-Network Depth](#1-integration-architecture--per-network-depth)
2. [Content Flow Model](#2-content-flow-model)
3. [Cross-Protocol Bridging Matrix](#3-cross-protocol-bridging-matrix)
4. [Missing Bridge Implementations](#4-missing-bridge-implementations)
5. [Headless Protocol Customization Plan](#5-headless-protocol-customization-plan)
6. [Cross-Protocol User Interaction](#6-cross-protocol-user-interaction)
7. [Content Flow Pipeline Architecture](#7-content-flow-pipeline-architecture)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [One-Click Cross-Post to All Protocols](#9-one-click-cross-post-to-all-protocols)

---

## 1. Integration Architecture — Per-Network Depth

### Integration Depth Levels

| Level | Name | Description | Example |
|-------|------|-------------|---------|
| **0** | API-Only | Read/write via external API, no self-hosted infra | Reddit (via Redlib proxy) |
| **1** | Bridge Provider | Self-hosted relay/bridge that connects two protocols | Bridgy Fed, Mostr.pub |
| **2** | Full SDK | Running our own node/client with full SDK integration | Farcaster Hubble |
| **3** | Native Client | Self-hosted full-stack instance (forked) with custom plugins | PeerTube, GoToSocial, Lemmy |

### Per-Network Integration Depth

| # | Protocol | Depth | Self-Hosted Instance | Service | Port |
|---|----------|-------|---------------------|---------|------|
| 1 | **Farcaster** | **3 — Native Client** | `hub.degenfeed.xyz` | Hubble (full P2P hub) | 2281 gRPC, 2283 HTTP |
| 2 | **Nostr** | **3 — Native Client** | `nostr.degenfeed.xyz` | nostr-rs-relay | 8085 |
| 3 | **GoToSocial** | **3 — Native Client** | `social.degenfeed.xyz` | GoToSocial v0.22.0 | 8082 |
| 4 | **PeerTube** | **3 — Native Client** | `video.degenfeed.xyz` | PeerTube (forked) | 9011 |
| 5 | **Owncast** | **3 — Native Client** | `live.degenfeed.xyz` | Owncast | 8092 |
| 6 | **Pixelfed** | **3 — Native Client** | `photos.degenfeed.xyz` | Pixelfed (forked) | 8087 |
| 7 | **WriteFreely** | **3 — Native Client** | `blog.degenfeed.xyz` | WriteFreely (forked) | 8086 |
| 8 | **Castopod** | **3 — Native Client** | (port conflict — pending) | Castopod | 8088 |
| 9 | **PieFed** | **3 — Native Client** | `links.degenfeed.xyz` | PieFed | 8023 |
| 10 | **Snac2** | **3 — Native Client** | `light.degenfeed.xyz` | Snac2 | 8021 |
| 11 | **Bluesky PDS** | **3 — Native Client** | `pds.degenfeed.xyz` | AT Protocol PDS | 3012 |
| 12 | **ActivityPub Relay** | **2 — Full SDK** | `relay.degenfeed.xyz` | yukimochi/activity-relay | 8084 |
| 13 | **Forgejo** | **3 — Native Client** | `git.rugmunch.io` | Forgejo | 3002 |
| 14 | **RSS-Bridge** | **2 — Full SDK** | `rss-bridge.degenfeed.xyz` | RSS-Bridge | 8282 |
| 15 | **Lens Protocol** | **1 — Indexer** | `lens-indexer` (local) | GraphQL indexer | 8099 |
| 16 | **Zora** | **1 — Indexer** | `zora-indexer` (local) | RPC indexer | 8091 |
| 17 | **Reddit** | **0 — API-Only (Proxy)** | Redlib proxy | Redlib | 8281 |

### Ownership Categories

```
FULLY OWNED (Headless Fork) ── Level 3
├── PeerTube             — Customized video platform, ActivityPub
├── Owncast              — Customized streaming, ActivityPub
├── Pixelfed             — Customized image sharing, ActivityPub
├── WriteFreely          — Customized blogging, ActivityPub
├── Castopod             — Customized podcasting, ActivityPub
├── GoToSocial           — Customized microblogging, ActivityPub
├── Nostr Relay          — Custom relay config, NIP-01
├── Farcaster Hubble     — Full P2P hub, libp2p
├── Bluesky PDS          — AT Protocol, federated relay
└── Lemmy                — Customized communities, ActivityPub

FEDERATED ── Level 2
├── PieFed               — ActivityPub link aggregation
├── Snac2                — Lightweight AP microblogging
├── Forgejo              — Code forge with ActivityPub (FEP)
└── ActivityPub Relay    — Federation relay

INDEXED ── Level 1
├── Lens Protocol        — GraphQL indexer (cached)
└── Zora                 — RPC indexer (cached)

API-ONLY ── Level 0
├── Reddit (Redlib)      — API proxy
├── Threads              — Meta API
├── DTube                — Hive/Steem API
├── LBRY/Odysee          — LBRY API
├── Gab                  — Gab API
├── Minds                — Minds API
└── Mirror.xyz           — Arweave API
```

---

## 2. Content Flow Model

### How Content Enters the DegenFeed Feed

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT INGESTION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Hubble   │  │ Nostr    │  │ Activity │  │ RSS-     │        │
│  │ (P2P)    │  │ Relay    │  │ Pub Relay│  │ Bridge   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │              │
│       ▼             ▼             ▼             ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               FEEDGEN AGGREGATOR SERVICE                  │   │
│  │            (Port 3020 — /api/feed/*)                     │   │
│  │                                                           │   │
│  │  UnifiedPost { protocol, author, content, media, ... }    │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              DEGENFEED WEB (Next.js App)                 │   │
│  │            (Port 3000 — degenfeed.xyz)                   │   │
│  │                                                           │   │
│  │  /feed — Unified timeline (all protocols)                 │   │
│  │  /farcaster — Farcaster-only feed                        │   │
│  │  /discover — Trending across protocols                    │   │
│  │  /post/[id] — Cross-protocol thread view                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Content Flow by Protocol

| Protocol | How Content Enters Feed | Data Source | Update Frequency |
|----------|------------------------|-------------|-----------------|
| **Farcaster** | Hubble gRPC → feedgen poll | Self-hosted Hubble RocksDB | Real-time (gossip) |
| **Nostr** | Nostr relay subscription → feedgen NIP-01 REQ | Self-hosted nostr-rs-relay | Real-time (WebSocket) |
| **GoToSocial** | ActivityPub relay push + timeline API poll | Self-hosted GTS SQLite | ~30s poll |
| **PeerTube** | Video RSS feed + ActivityPub push | Self-hosted PeerTube PostgreSQL | ~60s poll |
| **Owncast** | Stream status webhook → feedgen | Self-hosted Owncast | On stream start/stop |
| **Pixelfed** | ActivityPub relay + local timeline poll | Self-hosted Pixelfed MariaDB | ~60s poll |
| **WriteFreely** | ActivityPub relay + RSS feed | Self-hosted WriteFreely SQLite | ~60s poll |
| **PieFed** | ActivityPub relay + community poll | Self-hosted PieFed PostgreSQL | ~60s poll |
| **Snac2** | ActivityPub relay | Self-hosted Snac2 | ~60s poll |
| **Bluesky** | AT Protocol firehose subscription | Self-hosted PDS PostgreSQL | Real-time (websocket) |
| **Lens** | GraphQL poll → local indexer cache | `api.lens.xyz` → local cache | ~30s poll |
| **Zora** | RPC poll → local indexer cache | `rpc.zora.energy` → local cache | ~60s poll |
| **Reddit** | Redlib proxy → feedgen poll | Self-hosted Redlib cache | ~60s poll |
| **Threads** | Bridgy Fed → ActivityPub relay | Meta's API | ~5min poll |
| **RSS** | RSS-Bridge → feedgen poll | Various RSS feeds | ~15min poll |

---

## 3. Cross-Protocol Bridging Matrix

### Current Bridge Status

Each cell shows whether content from the **row** protocol can be seen on the **column** protocol.

```
              To →     Nostr   Farcstr  Bluesky  Mastodon  Lemmy   PeerTube  Pixelfed  Lens
From ↓        │
───────────────┼─────────────────────────────────────────────────────────────────────────
Nostr          │   —       ✅       ✅       ✅       ⚠️       🆕       ✅       ❌
Farcaster      │   ✅       —       ✅       🆕       ❌       ❌       ❌       ❌
Bluesky        │   ✅       ❌       —       ✅       🆕       ❌       ❌       ❌
Mastodon/GTS   │   ✅       ❌       ✅       —       ✅       ✅       ✅       ❌
Lemmy          │   ⚠️       ❌       ❌       ✅       —       ✅       ✅       ❌
PeerTube       │   🆕       ❌       ❌       ✅       ✅       —       ❌       ❌
Pixelfed       │   ❌       ❌       ❌       ✅       ✅       ❌       —       ❌
Lens           │   ❌       ❌       ❌       ❌       ❌       ❌       ❌       —
PieFed         │   ❌       ❌       ❌       ⚠️       ✅       ❌       ❌       ❌
WriteFreely    │   ❌       ❌       ❌       ✅       ✅       ❌       ❌       ❌
Owncast        │   ❌       ❌       ❌       ✅       ✅       ❌       ❌       ❌
Snac           │   ❌       ❌       ❌       ✅       ❌       ❌       ❌       ❌
Reddit         │   ❌       ❌       ❌       ❌       ❌       ❌       ❌       ❌
Threads        │   ❌       ❌       ❌       ✅       ❌       ❌       ❌       ❌
```

**Legend:** ✅ Active bridge | 🆕 **NEW in this plan** | ⚠️ Partial/experimental | ❌ No bridge

### Bridge Path Definitions

| Bridge ID | Source | Target | Adapter | Status | Method |
|-----------|--------|--------|---------|--------|--------|
| `activitypub→atproto` | mastodon | bluesky | `activitypub-to-atproto` | ✅ Active | Bridgy Fed relay |
| `activitypub→nostr` | mastodon | nostr | `activitypub-to-nostr` | ✅ Active | Mostr.pub / custom |
| `atproto→nostr` | bluesky | nostr | `atproto-to-nostr` | ✅ Active | Custom adapter |
| `nostr→farcaster` | nostr | farcaster | `nostr-to-farcaster` | ✅ Active | Custom adapter |
| `rss→activitypub` | rss | mastodon | `rss-to-activitypub` | ✅ Active | RSS → GTS auto-post |
| **`nostr→peertube`** | nostr | peertube | **`nostr-to-peertube`** | **🆕** | NIP-57 zap → video note |
| **`farcaster→mastodon`** | farcaster | mastodon | **`farcaster-to-mastodon`** | **🆕** | Cross-post cast → GTS |
| **`bluesky→lemmy`** | bluesky | lemmy | **`bluesky-to-lemmy`** | **🆕** | Cross-post skeet → community |
| **`peertube→nostr`** | peertube | nostr | **`peertube-to-nostr`** | **🆕** | Video publish → nostr note |
| **`farcaster→nostr`** | farcaster | nostr | **`farcaster-to-nostr`** | **🆕** | Cross-post cast → nostr |
| **`mastodon→farcaster`** | mastodon | farcaster | **`mastodon-to-farcaster`** | **🆕** | Cross-post toot → cast |
| **`farcaster→bluesky`** | farcaster | bluesky | **`farcaster-to-bluesky`** | **🆕** | Cross-post cast → skeet |
| **`nostr→mastodon`** | nostr | mastodon | **`nostr-to-mastodon`** | **🆕** | Cross-post note → toot |
| **`nostr→bluesky`** | nostr | bluesky | **`nostr-to-bluesky`** | **🆕** | Cross-post note → skeet |
| **`lemmy→nostr`** | lemmy | nostr | **`lemmy-to-nostr`** | **🆕** | Cross-post community → note |
| **`peertube→farcaster`** | peertube | farcaster | **`peertube-to-farcaster`** | **🆕** | Video publish → cast |

---

## 4. Missing Bridge Implementations

### 4.1 Nostr ↔ PeerTube

**Goal:** When a PeerTube video is published, auto-post a Nostr note with video link.
When a Nostr note contains a video link, auto-import to PeerTube (optional).

#### Implementation: `peertube-to-nostr` adapter

```typescript
// packages/cross-protocol-bridge/src/transforms/peertube-to-nostr.ts
import { BridgeAdapter, NormalizedContent } from '../types';
import { adaptForProtocols } from '../adapters/index';

/**
 * Peertube → Nostr Bridge
 * 
 * When a new video is published on PeerTube:
 * 1. Normalize the video post
 * 2. Create a Nostr event (kind 1) with video link + description
 * 3. Include video embed as kind 1063 (direct upload) or link
 * 4. Publish to our self-hosted nostr relay
 */
export const peertubeToNostr: BridgeAdapter = {
  id: 'peertube→nostr',
  name: 'PeerTube → Nostr',
  source: 'peertube',
  target: 'nostr',

  async transform(content: NormalizedContent) {
    const videoUrl = content.links[0] || content.media.find(m => m.kind === 'video')?.url;
    if (!videoUrl) {
      return { success: false, error: 'No video URL found in PeerTube content' };
    }

    // Build Nostr event content
    const title = extractTitle(content.text);
    const description = stripHtml(content.text);
    const noteContent = [
      `📺 ${title}`,
      '',
      description,
      '',
      `🔗 Watch: ${videoUrl}`,
      ...content.hashtags.map(t => `#${t}`),
    ].join('\n');

    // Create kind 1 note + optional kind 1063 for video metadata
    const payload = {
      kind: 1,
      content: noteContent,
      tags: [
        ['t', ...content.hashtags],
        ['r', videoUrl],
        ['proxy', videoUrl, 'activitypub'],
        ...(content.media[0]?.url ? [['imeta', `url=${content.media[0].url}`]] : []),
      ],
      created_at: Math.floor(Date.now() / 1000),
    };

    return { success: true, payload };
  },

  async publish(payload: unknown) {
    // Publish to our self-hosted Nostr relay
    const event = payload as Record<string, unknown>;
    try {
      const response = await fetch('http://127.0.0.1:8085/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVENT', event]),
      });
      if (!response.ok) {
        throw new Error(`Nostr relay returned ${response.status}`);
      }
      return {
        success: true,
        nativeId: `nostr:${event.id as string}`,
        url: `https://nostr.degenfeed.xyz/${event.id as string}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to publish to Nostr: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch('http://127.0.0.1:8085/', { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  },
};

function extractTitle(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  return lines[0] || 'Untitled video';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
}
```

#### Configuration
```
NOSTR_RELAY_URL=http://127.0.0.1:8085
PEERTUBE_WEBHOOK_SECRET=...
NOSTR_NSEC=...
```

---

### 4.2 Farcaster ↔ Mastodon

**Goal:** Cross-post Farcaster casts to Mastodon/GoToSocial and vice versa.

#### Implementation: `farcaster-to-mastodon` adapter

```typescript
// packages/cross-protocol-bridge/src/transforms/farcaster-to-mastodon.ts
import { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Farcaster → Mastodon Bridge
 * 
 * When a Farcaster cast is published or found in our Hubble:
 * 1. Normalize the cast (text, embeds, mentions)
 * 2. Convert to Mastodon-compatible HTML
 * 3. Post to GoToSocial API
 * 4. Handle character limit (500 for Mastodon vs 320 for Farcaster)
 */
export const farcasterToMastodon: BridgeAdapter = {
  id: 'farcaster→mastodon',
  name: 'Farcaster → Mastodon',
  source: 'farcaster',
  target: 'mastodon',

  async transform(content: NormalizedContent) {
    let text = content.text;
    
    // Farcaster supports embeds (links, images) — convert to Mastodon format
    for (const link of content.links) {
      text += `\n${link}`;
    }

    for (const media of content.media) {
      text += `\n${media.url}`;
    }

    // Handle Mastodon's 500-char limit
    if (text.length > 500) {
      text = text.slice(0, 497) + '...';
    }

    // Convert plaintext to simple HTML for Mastodon
    const html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    // Add cross-protocol attribution
    const attribution = `\n\n[Cross-posted from Farcaster]`;
    const finalText = text.length + attribution.length > 500 
      ? text + `\n[via Farcaster]`
      : text + attribution;

    return {
      success: true,
      payload: {
        status: finalText,
        visibility: 'public',
        content_type: 'text/plain',
      },
    };
  },

  async publish(payload: unknown) {
    const { status, visibility } = payload as { status: string; visibility: string };
    try {
      // Post to our self-hosted GoToSocial instance
      const token = process.env.GTS_ACCESS_TOKEN;
      if (!token) {
        return { success: false, error: 'GTS_ACCESS_TOKEN not set', retryable: false };
      }

      const res = await fetch('http://127.0.0.1:8082/api/v1/statuses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, visibility }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`GTS returned ${res.status}: ${err}`);
      }

      const data = await res.json() as { id: string; url?: string };
      return {
        success: true,
        nativeId: data.id,
        url: data.url ?? `https://social.degenfeed.xyz/@degenfeed/${data.id}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to publish to Mastodon: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch('http://127.0.0.1:8082/api/v1/instance');
      return res.ok;
    } catch {
      return false;
    }
  },
};
```

#### Environment Configuration
```
GTS_ACCESS_TOKEN=...          # OAuth token for bridging bot
GTS_INSTANCE_URL=http://127.0.0.1:8082
FARCASTER_MNEMONIC=...        # Farcaster account for cross-posting
```

---

### 4.3 Bluesky ↔ Lemmy

**Goal:** Cross-post Bluesky skeets to specific Lemmy communities and vice versa.

#### Implementation: `bluesky-to-lemmy` adapter

```typescript
// packages/cross-protocol-bridge/src/transforms/bluesky-to-lemmy.ts
import { BridgeAdapter, NormalizedContent } from '../types';

/**
 * Bluesky → Lemmy Bridge
 * 
 * When a Bluesky post (skeet) is published:
 * 1. Normalize skeet content
 * 2. Determine target Lemmy community from hashtags or config
 * 3. Adapt content to Lemmy post format (title + body)
 * 4. Post to Lemmy API
 */
export const blueskyToLemmy: BridgeAdapter = {
  id: 'bluesky→lemmy',
  name: 'Bluesky → Lemmy',
  source: 'bluesky',
  target: 'lemmy',

  async transform(content: NormalizedContent) {
    // Bluesky posts are short — use first line as title for Lemmy
    const lines = content.text.split('\n').filter(l => l.trim());
    const title = lines[0]?.slice(0, 200) || 'Cross-posted from Bluesky';
    const body = lines.slice(1).join('\n\n') || title;

    // Find community from hashtags or default config
    const community = content.hashtags.find(t => BRIDGE_COMMUNITIES[t]) 
      ? BRIDGE_COMMUNITIES[content.hashtags.find(t => BRIDGE_COMMUNITIES[t])!] 
      : DEFAULT_LEMMY_COMMUNITY;

    // Add media links to body
    let fullBody = body;
    for (const link of content.links) {
      fullBody += `\n\n${link}`;
    }
    for (const media of content.media) {
      fullBody += `\n\n${media.url}`;
    }

    // Add cross-protocol attribution
    fullBody += `\n\n---\n*Cross-posted from Bluesky*`;

    return {
      success: true,
      payload: {
        name: title,
        body: fullBody,
        community_id: community,
        url: content.links[0] || null,
      },
    };
  },

  async publish(payload: unknown) {
    const { name, body, community_id, url } = payload as {
      name: string; body: string; community_id: number; url: string | null;
    };
    try {
      const token = process.env.LEMMY_JWT;
      if (!token) {
        return { success: false, error: 'LEMMY_JWT not set', retryable: false };
      }

      const res = await fetch('http://127.0.0.1:8536/api/v3/post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          body,
          community_id,
          url,
          nsfw: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Lemmy returned ${res.status}: ${err}`);
      }

      const data = await res.json() as { post_view: { post: { id: number } } };
      return {
        success: true,
        nativeId: String(data.post_view.post.id),
        url: `https://talk.degenfeed.xyz/post/${data.post_view.post.id}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to publish to Lemmy: ${(err as Error).message}`,
        retryable: true,
      };
    }
  },

  async healthCheck() {
    try {
      const res = await fetch('http://127.0.0.1:8536/api/v3/site');
      return res.ok;
    } catch {
      return false;
    }
  },
};

// Community routing config
const BRIDGE_COMMUNITIES: Record<string, number> = {
  'degen': 1,         // main-degen
  'crypto': 2,        // crypto
  'defi': 3,          // defi
  'nft': 4,           // nft
  'memes': 5,         // memes
  'tech': 6,          // tech
  'fediverse': 7,     // fediverse
  'video': 8,         // video
  'music': 9,         // music
  'news': 10,         // news
};

const DEFAULT_LEMMY_COMMUNITY = 1; // main-degen
```

---

### 4.4 Any → All — One-Click Cross-Post to All Protocols

**Goal:** From the DegenFeed UI, a user can publish their post to ALL supported protocols simultaneously with one click.

#### Frontend Integration

The cross-post page at `/creator/cross-post` already implements basic platform selection. We extend it to support ALL protocols:

```typescript
// packages/cross-protocol-bridge/src/transforms/one-click-all.ts
/**
 * One-Click "Publish to All" — Cross-posts a master post to every 
 * protocol that has an enabled bridge path from the source protocol.
 * 
 * This is the high-level orchestrator that:
 * 1. Takes a MasterPost from the DegenFeed composer
 * 2. Adapts it for every supported target protocol
 * 3. Publishes each adaptation in parallel
 * 4. Returns a unified result with all post URLs
 */
import { Bridge, getDefaultBridge } from '../bridge';
import type { MasterPost } from '../adapters/types';
import type { BridgeBatchResult } from '../types';

interface CrossPostToAllOptions {
  /** Override specific protocols to target */
  onlyProtocols?: string[];
  /** Skip these protocols */
  excludeProtocols?: string[];
  /** Timeout per bridge operation in ms */
  timeoutMs?: number;
}

interface CrossPostToAllResult {
  success: boolean;
  /** Total protocols targeted */
  total: number;
  /** Results per protocol */
  results: Record<string, {
    success: boolean;
    error?: string;
    url?: string;
    nativeId?: string;
    latencyMs: number;
  }>;
  /** Summary */
  summary: {
    successCount: number;
    failureCount: number;
    totalLatencyMs: number;
  };
}

/**
 * One-click cross-post to ALL protocols.
 * Routes through the Bridge engine.
 */
export async function crossPostToAll(
  post: MasterPost,
  options: CrossPostToAllOptions = {},
): Promise<CrossPostToAllResult> {
  const bridge = getDefaultBridge();
  const sourceProtocol = post.sourceProtocol || inferProtocolFromPost(post);

  // Map to unified post format
  const unifiedPost = {
    id: post.id || `df:${Date.now()}`,
    protocol: sourceProtocol,
    author: {
      id: post.authorId || 'anonymous',
      name: post.authorName || 'Anonymous',
      avatar: post.authorAvatar,
    },
    content: {
      text: post.text,
      html: post.html,
    },
    media: (post.media || []).map(m => ({
      kind: m.type === 'video' ? 'video' as const : m.type === 'audio' ? 'audio' as const : 'image' as const,
      url: m.url,
      alt: m.alt,
    })),
    hashtags: post.hashtags || [],
    mentions: post.mentions || [],
    links: post.links || [],
    timestamp: Date.now(),
  };

  // Resolve target protocols
  let targetProtocols = options.onlyProtocols || getDefaultTargetProtocols(sourceProtocol);
  if (options.excludeProtocols) {
    targetProtocols = targetProtocols.filter(p => !options.excludeProtocols!.includes(p));
  }

  // Bridge to each target
  const bridgeResults: Record<string, {
    success: boolean; error?: string; url?: string; nativeId?: string; latencyMs: number;
  }> = {};

  for (const target of targetProtocols) {
    try {
      const result = await bridge.bridgePost(
        unifiedPost as any, // cast — types match in practice
        target as any,
      );
      bridgeResults[target] = {
        success: result.success,
        error: result.error,
        url: (result.targetResult as any)?.url,
        nativeId: (result.targetResult as any)?.nativeId,
        latencyMs: result.latencyMs,
      };
    } catch (err) {
      bridgeResults[target] = {
        success: false,
        error: (err as Error).message,
        latencyMs: 0,
      };
    }
  }

  const entries = Object.values(bridgeResults);
  const successCount = entries.filter(r => r.success).length;
  const failureCount = entries.filter(r => !r.success).length;
  const totalLatencyMs = entries.reduce((sum, r) => sum + r.latencyMs, 0);

  return {
    success: failureCount === 0,
    total: targetProtocols.length,
    results: bridgeResults,
    summary: { successCount, failureCount, totalLatencyMs },
  };
}

/**
 * Default target protocols from each source.
 * Maps source ← all targets that have bridge paths.
 */
function getDefaultTargetProtocols(source: string): string[] {
  const MAP: Record<string, string[]> = {
    nostr: ['farcaster', 'bluesky', 'mastodon', 'peertube', 'lens'],
    farcaster: ['nostr', 'bluesky', 'mastodon', 'lens'],
    bluesky: ['nostr', 'mastodon', 'lemmy', 'lens'],
    mastodon: ['nostr', 'bluesky', 'farcaster', 'peertube', 'lens', 'pixelfed'],
    peertube: ['nostr', 'farcaster', 'mastodon'],
    lens: ['nostr', 'farcaster'],
    lemmy: ['nostr', 'mastodon'],
    pixelfed: ['mastodon'],
    writefreely: ['mastodon'],
    owncast: ['mastodon'],
    reddit: ['mastodon'],
    threads: ['mastodon'],
  };
  return MAP[source] || ['mastodon', 'nostr', 'bluesky'];
}

function inferProtocolFromPost(post: MasterPost): string {
  if (post.walletSignature) return 'lens';
  if (post.sourceProtocol) return post.sourceProtocol;
  return 'nostr';
}
```

#### UI Component (Already exists at `/creator/cross-post`, extended)

The existing cross-post page is enhanced with an "All Protocols" button:

```tsx
// In apps/web/src/app/creator/cross-post/page.tsx — add:

const PROTOCOL_GROUPS = {
  'Decentralized': ['nostr', 'farcaster', 'bluesky', 'lens'],
  'ActivityPub': ['mastodon', 'peertube', 'lemmy', 'pixelfed'],
  'Centralized': ['reddit', 'medium', 'substack', 'telegram'],
};

// "Publish to All" button handler
const handlePublishAll = async () => {
  const allProtocols = [
    ...PROTOCOL_GROUPS.Decentralized,
    ...PROTOCOL_GROUPS.ActivityPub,
  ];
  setSelectedTargets(allProtocols);
  await handlePublish(text, allProtocols, title);
};
```

---

## 5. Headless Protocol Customization Plan

### 5.1 PeerTube Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | DegenFeed theme (green/black), custom logo | `config/production.yaml`, `static/custom.css` |
| **Headless mode** | Registration disabled, uploads via API only | `config/production.yaml` |
| **Federation** | Auto-follow DegenFeed instances | `config/production.yaml` |
| **Video limits** | 500MB max, 4K resolution | `config/production.yaml` |
| **Custom plugin** | `degenfeed-plugin.js` — webhook on video publish | `custom/degenfeed-plugin.js` |
| **API enhancements** | Extended webhook payload with Nostr bridge | Custom plugin |
| **Upstream tracking** | v6.3 → v7.2 (current) | Quarterly rebase |
| **Sync method** | Vendor source in `source/`, overlay in `config/` + `custom/` | Git submodule + overlay |

### 5.2 Owncast Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | DegenFeed logo, custom page title | `data/static/`, `config/config.yaml` |
| **Headless mode** | No web interface, API-only | `config/config.yaml` |
| **Stream key** | Pre-configured for DegenFeed bot | `config/config.yaml` |
| **Webhook** | Stream started/stopped → Nostr/Farcaster bridge | `config/config.yaml` |
| **Federation** | ActivityPub enabled, follow DegenFeed instances | `config/config.yaml` |
| **Upstream tracking** | v0.1.3 (current) | On-demand rebase |
| **Sync method** | Vendor + config overlay | Docker build |

### 5.3 Lemmy Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | DegenFeed dark theme | `config/lemmy.hjson` |
| **Headless mode** | Registration disabled, admin-created communities | `config/lemmy.hjson` |
| **Communities** | Pre-seeded (degen, crypto, defi, memes, etc.) | `config/communities.json` |
| **Federation** | Strict allowlist mode, 18 instances in allowlist | `config/lemmy.hjson` |
| **Auto-mod** | Custom automod rules for spam prevention | API integration |
| **Upstream tracking** | v0.19.11 (current) | On-demand (major changes only) |
| **Sync method** | Config-only fork (no source vendor) | Direct config in git |

### 5.4 Pixelfed Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | DegenFeed theme CSS, custom logo | `data/static/custom.css` |
| **Headless mode** | Registration disabled, admin posts only | `config/.env` |
| **Federation** | ActivityPub enabled, relay subscription | `config/.env` |
| **Storage** | S3-backed (R2) for photos | `config/.env` |
| **Custom config** | `degenfeed-config.php` — integration hooks | `custom/degenfeed-config.php` |
| **Upstream tracking** | v0.12.5 (current) | Monthly rebase |
| **Sync method** | Vendor + config overlay | Git submodule |

### 5.5 WriteFreely Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | Custom CSS, DegenFeed logo | `static/custom.css`, `static/logo.svg` |
| **Headless mode** | Registration open (blog platform) | `config/config.ini` |
| **Federation** | ActivityPub enabled, relay subscription | `config/config.ini` |
| **Collections** | Pre-created (degenfeed-blog, announcements, etc.) | DB seed |
| **Upstream tracking** | v0.15.0 (current) | On-demand |
| **Sync method** | Config-only | Direct config |

### 5.6 GoToSocial Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | DegenFeed custom theme (installed manually) | Theme CSS |
| **Headless mode** | Open registration (limited) | `config.yaml` |
| **Federation** | Blocklist mode (all allowed), relay subscribed | `config.yaml` |
| **Spam filter** | Enabled with custom rules | `config.yaml` |
| **Upstream tracking** | v0.22.0+git-60b693f | Quarterly rebase |
| **Sync method** | Config-only (Docker compose) | `docker-compose.yml` |

### 5.7 Nostr Relay Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | NIP-11 relay info document | Docker env vars |
| **Headless mode** | N/A (protocol is headless) | — |
| **Limits** | 64KB event size, 1000 events per subscription | Config TOML |
| **Upstream tracking** | nostr-rs-relay v0.9.0 | On-demand |
| **Sync method** | Config-only | `config.toml` |

### 5.8 Bluesky PDS Fork

| Aspect | Customization | File |
|--------|--------------|------|
| **Branding** | Custom handle domain (degenfeed.xyz) | PDS env vars |
| **Headless mode** | Registration disabled | PDS env vars |
| **Federation** | Connected to main relay (bsky.network) | PDS env vars |
| **Storage** | PostgreSQL for repo data | PDS env vars |
| **Upstream tracking** | Latest PDS release | Bi-weekly update |
| **Sync method** | Config-only (Docker compose) | `docker-compose.yml` |

---

## 6. Cross-Protocol User Interaction

### Interaction Matrix

| Capability | Nostr | Farcaster | Bluesky | Mastodon | Lemmy | PeerTube | Pixelfed |
|-----------|-------|-----------|---------|----------|-------|----------|----------|
| **Post** | ✅ (kind 1) | ✅ (cast) | ✅ (skeet) | ✅ (toot) | ✅ (post) | ✅ (video) | ✅ (photo) |
| **Comment** | ✅ (kind 1 reply) | ✅ (reply cast) | ✅ (reply) | ✅ (reply) | ✅ (comment) | ✅ (comment) | ✅ (comment) |
| **Like** | ✅ (kind 7) | ✅ (reaction) | ✅ (like) | ✅ (fav) | ✅ (upvote) | ✅ (like) | ✅ (like) |
| **Repost/Share** | ✅ (kind 6) | ✅ (recast) | ✅ (repost) | ✅ (boost) | ✅ (upvote) | ✅ (share) | ✅ (share) |
| **Follow** | ✅ (kind 3) | ✅ (fid link) | ✅ (follow) | ✅ (follow) | ✅ (subscribe) | ✅ (subscribe) | ✅ (follow) |
| **Tip/Zap** | ✅ (zap NIP-57) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **DM** | ✅ (NIP-04/44) | ✅ (snapchain) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cross-post bridge** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### How Users Interact Across Protocols

```
                    ┌─────────────────┐
                    │  DegenFeed App   │
                    │  (Unified UI)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────────┐ ┌──────────┐ ┌──────────────┐
    │ Write via our   │ │ Read via │ │ Cross-post   │
    │ proxy/API       │ │ feedgen  │ │ via Bridge   │
    └────────┬────────┘ └──────────┘ └──────┬───────┘
             │                              │
     ┌───────┴───────┐                     │
     ▼               ▼                     ▼
┌─────────┐   ┌──────────┐         ┌──────────────┐
│ Nostr   │   │ Farcaster│         │ All enabled  │
│ Client  │   │ Client   │         │ protocols    │
└─────────┘   └──────────┘         └──────────────┘
```

**Key principle:** Users interact through DegenFeed's unified interface. The app handles all protocol-specific serialization under the hood. Users don't need to know they're posting to Nostr vs Farcaster — they just "post" and it goes everywhere.

---

## 7. Content Flow Pipeline Architecture

```
                        ┌──────────────────────────┐
                        │    CONTENT ORIGINATION    │
                        │  (User posts via app or   │
                        │   native protocol client) │
                        └────────────┬─────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │   NORMALIZATION ENGINE    │
                        │  transform → UnifiedPost  │
                        │  - Strip protocol markup  │
                        │  - Extract media/links    │
                        │  - Resolve cross-mentions │
                        └────────────┬─────────────┘
                                     │
                          ┌──────────┼──────────┐
                          │          │          │
                          ▼          ▼          ▼
               ┌────────────┐ ┌──────────┐ ┌────────────┐
               │ STORE IN   │ │  PUBLISH │ │  BRIDGE    │
               │ Feed Cache │ │  to      │ │  to Other  │
               │ (Redis)    │ │  Source  │ │  Protocols │
               └────────────┘ │  Protocol│ └────────────┘
                              └──────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │   DEGENFEED FEED          │
                        │   Unified timeline        │
                        │   - Chronological         │
                        │   - Cross-protocol        │
                        │   - Deduplicated          │
                        └──────────────────────────┘
```

### Pipeline Steps

1. **Origination**: User posts from DegenFeed app or native protocol client
2. **Ingestion**: Feedgen polls all protocol endpoints or receives webhooks
3. **Normalization**: Raw protocol content → `UnifiedPost` format
4. **Storage**: Post indexed in Meilisearch + Redis cache
5. **Bridging**: `CrossProtocolBridge` transforms and publishes to all target protocols
6. **Distribution**: Feed serves unified timeline to web/mobile clients

---

## 8. Monitoring & Alerting

### Health Checks per Protocol

| Protocol | Health Endpoint | Expected | Check Interval |
|----------|----------------|----------|---------------|
| Farcaster Hubble | `http://127.0.0.1:2281/v1/info` | 200 | 30s |
| Nostr Relay | `http://127.0.0.1:8085/` | 200/404 | 30s |
| GoToSocial | `http://127.0.0.1:8082/api/v1/instance` | 200 | 30s |
| PeerTube | `http://127.0.0.1:9011/api/v1/config` | 200 | 60s |
| Bluesky PDS | `http://127.0.0.1:3012/xrpc/_health` | 200 | 30s |
| Lemmy | `http://127.0.0.1:8536/api/v3/site` | 200 | 30s |
| Pixelfed | `http://127.0.0.1:8087/` | 200 | 60s |
| PieFed | `http://127.0.0.1:8023/` | 200 | 60s |
| WriteFreely | `http://127.0.0.1:8086/` | 200 | 60s |
| Owncast | `http://127.0.0.1:8092/api/status` | 200 | 60s |
| Snac2 | `http://127.0.0.1:8021/` | 200 | 60s |
| AP Relay | `http://127.0.0.1:8084/.well-known/nodeinfo` | 200 | 60s |
| RSS-Bridge | `http://127.0.0.1:8282/` | 200 | 120s |

### Bridge Health Checks

| Bridge Path | Health Method | Check Interval |
|-------------|--------------|---------------|
| activitypub→atproto | Bridgy Fed status endpoint | 60s |
| activitypub→nostr | Mostr.pub relay connection | 60s |
| atproto→nostr | Custom adapter health() | 60s |
| nostr→farcaster | Hubble connection check | 60s |
| **nostr→peertube** | Nostr relay + PeerTube API | 120s |
| **farcaster→mastodon** | Hubble + GTS API | 60s |
| **bluesky→lemmy** | PDS + Lemmy API | 60s |

### Alerts

| Condition | Severity | Channels |
|-----------|----------|----------|
| Service down for >2 checks | Critical | Telegram, n8n, Prometheus |
| Bridge failing >5 operations | Warning | Telegram, log |
| Federation peer count drops >50% | Warning | Telegram |
| Disk usage >80% | Warning | Telegram |
| Bridge circuit breaker open | Critical | Telegram, n8n |

---

## 9. One-Click Cross-Post to All Protocols

### Feature Overview

The "Publish to All" feature enables users to post content to every supported protocol with a single click. This is implemented as:

1. **Frontend**: An "All Protocols" toggle on the cross-post composer (`/creator/cross-post`)
2. **Backend**: The `crossPostToAll()` function in `@degenfeed/cross-protocol-bridge`
3. **Bridge Adapters**: Each protocol pair has a registered adapter

### User Flow

```
1. User composes post in DegenFeed (text + optional media)
2. User clicks "Publish to All" toggle
3. UI shows preview for each protocol:
   ✓ Nostr (420 chars, plaintext)
   ✓ Farcaster (320 chars, plaintext) 
   ✓ Bluesky (300 chars, plaintext)
   ✓ Mastodon (500 chars, markdown)
   ✓ Lemmy (community post)
   ✓ PeerTube (video note)
4. User clicks "Publish"
5. Frontend calls POST /api/cross-post/all
6. Bridge engine parallel-executes all adapters
7. Results shown inline with links to each post
```

### API Endpoint

```
POST /api/cross-post/all
Content-Type: application/json

{
  "text": "Check out this new DegenFeed feature!",
  "media": [{ "type": "image", "url": "https://..." }],
  "hashtags": ["degenfeed", "fediverse"],
  "mentions": ["@user@social.degenfeed.xyz"],
  "protocols": ["nostr", "farcaster", "bluesky", "mastodon", "lemmy"]
}

Response:
{
  "success": true,
  "results": {
    "nostr": { "success": true, "url": "https://nostr.degenfeed.xyz/..." },
    "farcaster": { "success": true, "url": "https://fcast.degenfeed.xyz/..." },
    "bluesky": { "success": false, "error": "Rate limited" },
    "mastodon": { "success": true, "url": "https://social.degenfeed.xyz/..." },
    "lemmy": { "success": true, "url": "https://talk.degenfeed.xyz/post/..." }
  },
  "summary": { "successCount": 4, "failureCount": 1, "totalLatencyMs": 2340 }
}
```

### Protocol-Specific Adaptations

When cross-posting, each protocol gets adapted content:

| Protocol | Content Adaptation |
|----------|-------------------|
| **Nostr** | Kind 1 note. Plaintext, 64K limit. Media as `imeta` tags. |
| **Farcaster** | Text only, 320 char limit. Embeds as URLs in text. |
| **Bluesky** | 300 char limit. Facets for mentions/links. Embeds for images. |
| **Mastodon** | HTML format, 500 char limit. Media attachments via API. |
| **Lemmy** | Title (first line) + body. Posted to configured community. |
| **PeerTube** | Short note with video description and link. |
| **Pixelfed** | Image with caption, 500 char limit. |
| **WriteFreely** | Full blog post, unlimited length. |
| **Lens** | Publication on Lens protocol via Momoka. |
| **Telegram** | Message to configured channel. |

---

## Appendix A: Bridge Path Registry Update

To register all new bridge paths, update `BRIDGE_PATHS` in `types.ts`:

```typescript
// Add to BRIDGE_PATHS array:
{ id: 'peertube→nostr', source: 'peertube', target: 'nostr', label: 'PeerTube → Nostr (via custom adapter)', enabled: true, adapter: 'peertube-to-nostr' },
{ id: 'farcaster→mastodon', source: 'farcaster', target: 'mastodon', label: 'Farcaster → Mastodon', enabled: true, adapter: 'farcaster-to-mastodon' },
{ id: 'bluesky→lemmy', source: 'bluesky', target: 'lemmy', label: 'Bluesky → Lemmy', enabled: true, adapter: 'bluesky-to-lemmy' },
{ id: 'mastodon→farcaster', source: 'mastodon', target: 'farcaster', label: 'Mastodon → Farcaster', enabled: true, adapter: 'mastodon-to-farcaster' },
{ id: 'farcaster→bluesky', source: 'farcaster', target: 'bluesky', label: 'Farcaster → Bluesky', enabled: true, adapter: 'farcaster-to-bluesky' },
{ id: 'nostr→mastodon', source: 'nostr', target: 'mastodon', label: 'Nostr → Mastodon', enabled: true, adapter: 'nostr-to-mastodon' },
{ id: 'nostr→bluesky', source: 'nostr', target: 'bluesky', label: 'Nostr → Bluesky', enabled: true, adapter: 'nostr-to-bluesky' },
{ id: 'lemmy→nostr', source: 'lemmy', target: 'nostr', label: 'Lemmy → Nostr', enabled: true, adapter: 'lemmy-to-nostr' },
{ id: 'peertube→farcaster', source: 'peertube', target: 'farcaster', label: 'PeerTube → Farcaster', enabled: true, adapter: 'peertube-to-farcaster' },
{ id: 'farcaster→nostr', source: 'farcaster', target: 'nostr', label: 'Farcaster → Nostr', enabled: true, adapter: 'farcaster-to-nostr' },
```

## Appendix B: Environment Variables Reference

| Variable | Service | Required | Default |
|----------|---------|----------|---------|
| `NOSTR_RELAY_URL` | Nostr bridge | ✅ | `http://127.0.0.1:8085` |
| `NOSTR_NSEC` | Nostr bridge (signing) | ✅ | — |
| `GTS_ACCESS_TOKEN` | Mastodon/GTS bridge | ✅ | — |
| `GTS_INSTANCE_URL` | Mastodon/GTS bridge | ✅ | `http://127.0.0.1:8082` |
| `FARCASTER_MNEMONIC` | Farcaster bridge | ✅ | — |
| `FARCASTER_HUB_URL` | Farcaster bridge | ✅ | `http://127.0.0.1:2281` |
| `LEMMY_JWT` | Lemmy bridge | ✅ | — |
| `LEMMY_INSTANCE_URL` | Lemmy bridge | ✅ | `http://127.0.0.1:8536` |
| `PDS_ADMIN_PASSWORD` | Bluesky bridge | ✅ | — |
| `PDS_INSTANCE_URL` | Bluesky bridge | ✅ | `http://127.0.0.1:3012` |
| `PEERTUBE_API_KEY` | PeerTube bridge | ✅ | — |
| `PEERTUBE_INSTANCE_URL` | PeerTube bridge | ✅ | `http://127.0.0.1:9011` |
| `PIXELFED_ACCESS_TOKEN` | Pixelfed bridge | ⚠️ | — |
| `WRITEFREELY_API_KEY` | WriteFreely bridge | ⚠️ | — |
| `BRIDGE_HEALTH_INTERVAL` | Bridge system | ❌ | `30000` |
| `BRIDGE_OPERATION_TIMEOUT` | Bridge system | ❌ | `15000` |
