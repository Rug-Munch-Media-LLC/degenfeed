# DegenFeed v2 — The Social Feed of Web3

**Status:** Pivoting from self-hosted ActivityPub (Akkoma/Soapbox) to a pure **read-write client** that aggregates the major open social protocols. No backend identity. No user database. Aggregator-only. Lean.

**TL;DR.** We are a feed-first client for the open social graph. Users sign in with any web3 key (Nostr / Farcaster / Lens / Ethereum). We pull the best content from across all four protocols, rank it, surface the interesting people, and let users **read and write to all of them from one composer.** We are a window onto the SocialFi universe, not yet another walled garden trying to bootstrap an audience.

**One composer. Four protocols. Zero switching apps.**

---

## 1. Why This Pivot Wins

### 1.1 The cold-start problem kills every "web3 social"

Every team in the last three years has tried to build a Twitter-killer on a new protocol and died from the same disease: empty rooms. Even Bluesky, with $20M and ATProto, took three years to hit 5M users. We don't have three years. We don't have $20M.

### 1.2 The graph already exists

| Protocol | Active accounts | Open graph | Free read API | Free write API |
|---|---|---|---|---|
| **Nostr** | ~250k pubkeys, ~50k daily posters | Yes (NIP-19, NIP-05) | Public relays, no auth | Sign locally, broadcast |
| **Farcaster** | ~700k verified users, ~100k daily posters | Yes (FID + custody contract) | Public Hubs, free | Sign with Warpcast key or self-hosted Hub |
| **Lens Protocol** | ~100k profiles, ~20k daily posters | Yes (profileId + handle) | Public API Gateway, free tier | Sign with wallet |
| **Bluesky / AT Protocol** | ~5M users | Yes (DID + handle) | Public AppView, free | Sign with signing key |

**Day-one audience: ~6 million accounts already active.** We don't have to grow the graph. We have to grow the *viewer count*. That's a marketing problem, not a protocol problem.

### 1.3 Our wedge: design + curation

No aggregator today offers:
- A clean, modern UI on par with the best Web2 clients.
- True cross-protocol identity (follow a Farcaster user, a Nostr user, and a Lens user from the same screen).
- Smart curation across protocols (the most interesting crypto/AI builders, regardless of where they post).
- A lean, opinionated client that respects users (no ads, no tracking, no algorithm jail).

That's the gap.

### 1.4 What we are not building

- ❌ Not a new social graph.
- ❌ Not a fediverse server.
- ❌ Not a Mastodon fork.
- ❌ Not a token launch.
- ❌ Not a moderation regime that decides who can speak.

We are a **client**. Think TweetDeck if TweetDeck could see across every network at once.

---

## 2. Product Definition

### 2.1 Core principle: tool-pull, not model-push

Same rule that governs the rest of the fleet. Deterministic fetch from the source protocol. LLM only summarizes what the user already has permission to see. No invented content, no fabricated citations, no "AI picks your feed" black box. **Ranking must be explainable.**

### 2.2 Target user

The crypto-native / AI-native / open-source builder who:
- Posts on multiple protocols and is tired of switching apps.
- Wants to discover interesting people without joining five networks.
- Values ownership of their identity and data.
- Has zero patience for ads, NFTs in their face, or tokens-as-engagement.

### 2.3 Day-one feature scope (v1)

**Must ship:**
1. **Multi-protocol sign-in.** Nostr (npub/nsec), Farcaster (FID + signer), Lens (profileId + signer), Ethereum (SIWE). Users connect any or all of them.
2. **Unified home timeline.** Aggregated, deduped, ranked.
3. **For You tab.** Personalized ranking from follows + curated sources.
4. **Following tab.** Pure chronological from followed identities across protocols.
5. **Discover tab.** Trending topics across protocols. Top accounts by niche (crypto, AI, open-source, security).
6. **Compose modal — the headline feature.** One text box, four publish buttons (Nostr / Farcaster / Lens / Bluesky). Toggle which protocols to cross-post to. Per-protocol character counters. Per-protocol success/failure indicators. **This is the entire reason people switch from their current client to ours.**
7. **Profile pages.** Unified view of any identity, showing their cross-protocol presence and posts.
8. **Reply / like / repost / quote — native to the source protocol.** When you reply to a Farcaster cast, it publishes as a Farcaster reply. When you like a Nostr note, it sends a Nostr reaction. When you repost a Lens publication, it's a Lens repost. The protocol the post lives on dictates the action primitive.
9. **Search.** Across Nostr (NIP-50), Farcaster (search casts), Lens (search publications), Bluesky.
10. **Cross-posting by default.** New users land with cross-post enabled to all connected protocols. One-click toggle to disable per protocol.

**v1.1 (post-launch, weeks 1–4):**
- Bookmarks / saved posts.
- Lists / custom feeds.
- Lightning / USDC / ETH tips per post.
- Threaded views with nested replies.
- DM inbox (Nostr NIP-04/NIP-17, Farcaster frames, Lens DMs).

**v1.2 (post-launch, weeks 5–12):**
- Browser extension to replace Twitter timeline.
- Mobile-responsive PWA (installable on iOS/Android).
- Public API for third-party developers.

### 2.4 Out of scope (do not build)

- Video hosting (link out to existing protocols: Farcaster Frames, Bluesky video, Lens).
- Server-side moderation.
- Token / points system.
- Wallet onboarding flows (users already have keys).
- E-mail sign-up (if you don't have keys, you have to go get some — that filters for the right audience).

---

## 3. Architecture

### 3.1 Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 14 App Router, React 19, Tailwind, Radix | Best-in-class DX, static export, RSC for SEO |
| **State** | Zustand (client), TanStack Query (server cache) | Matches existing fleet standards |
| **Charts/UI** | lightweight-charts, Radix Primitives, shadcn/ui | Fast, accessible, no opinion bloat |
| **Nostr** | `nostr-tools` v2, `applesauce` (rxjs feeds) | Best maintained, small, tree-shakeable |
| **Farcaster** | `@farcaster/hub-web`, `frames.js` | Official Hub client, free read |
| **Lens** | `@lens-protocol/client` v3 | Official, supports Lens Chain + v2 profiles |
| **Bluesky** | `@atproto/api` | Official |
| **Crypto** | viem (already in stack), ethers v5 fallback, @noble/secp256k1 | Matches fleet |
| **Hosting** | Cloudflare Pages + Workers | Free tier covers millions of requests |
| **Cache** | Cloudflare KV + Workers Cache API | Free, edge-fast |
| **Analytics** | Plausible (self-hosted on [HOST-1]) | Privacy-respecting, free |
| **Search** | MeiliSearch (self-hosted on [HOST-1]) | Free, fast, open source |

**Zero paid SaaS.** Zero per-user cost. This thing is free to operate at any reasonable scale.

### 3.2 Repo layout

```
degenfeed-web/                       # monorepo: pnpm workspaces
├── apps/
│   └── web/                         # Next.js 14 app
│       ├── app/                     # routes
│       ├── components/              # ui components
│       ├── lib/                     # clients (nostr, farcaster, lens, bluesky)
│       └── styles/
├── packages/
│   ├── feed-core/                   # cross-protocol event normalization
│   ├── ranking/                     # ranking algorithms, pure functions
│   ├── identity/                    # cross-protocol identity resolution
│   ├── nostr-sdk/                   # typed wrappers around nostr-tools
│   ├── farcaster-sdk/               # Hub client + signer
│   ├── lens-sdk/                    # Lens client
│   └── ui/                          # shared design system
├── workers/
│   ├── api/                         # Cloudflare Worker proxy
│   └── cron/                        # scheduled curation jobs
└── infra/
    ├── cloudflare/                  # wrangler.toml, pages config
    └── scripts/                     # deploy scripts
```

**Why a monorepo.** Shared types across clients (a Farcaster cast and a Nostr note both normalize to a `UnifiedPost`). Shared ranking. Shared UI. One repo to reason about.

### 3.3 The UnifiedPost model

Every post from any protocol normalizes to:

```ts
interface UnifiedPost {
  id: string;                    // canonical: protocol:id
  protocol: 'nostr' | 'farcaster' | 'lens' | 'bluesky';
  author: UnifiedIdentity;
  text: string;                  // plain text, links extracted
  html?: string;                 // protocol-specific rich content
  embeds: Embed[];
  parentId?: string;             // for replies/threads
  rootId?: string;
  createdAt: number;             // unix ms
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views?: number;
  };
  engagement: EngagementVector;  // raw signals for ranking
  raw: unknown;                  // protocol-native object for round-trips
}
```

Same shape for `UnifiedIdentity`, `Embed`, `EngagementVector`. **One renderer for everything.**

### 3.4 The Identity model

```ts
interface UnifiedIdentity {
  primary: { protocol: Protocol; id: string };     // chosen canonical
  handles: Record<Protocol, string | null>;        // npub, fname, lens/handle, bsky
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  verified: { protocol: Protocol; badge: string }[];
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  nostrPubkey?: string;       // hex
  fid?: number;               // Farcaster
  lensProfileId?: string;     // Lens
  did?: string;               // Bluesky / atproto
  evmAddress?: string;        // optional link
  solanaAddress?: string;     // optional link
}
```

A user with keys on multiple protocols maps to one identity. We resolve cross-links via:
- **NIP-05** (Nostr → DNS-verified name, often mirrors Farcaster/Lens handles).
- **Farcaster profile metadata** (verifications include Ethereum addresses, sometimes Sol addresses).
- **Lens profile** (links to X, Farcaster, site, etc.).
- **Bluesky DID document**.

A background job resolves any identity's cross-protocol handles when they're followed or viewed, caches the result in KV for 24h.

### 3.5 Feed pipeline

```
┌─────────────┐
│ Client UI   │
│ (Next.js)   │
└──────┬──────┘
       │ 1. Request feed
       ▼
┌─────────────────┐
│ CF Worker API   │  ← handles relay selection, rate limiting, auth
└──────┬──────────┘
       │ 2. Parallel fetch
       ▼
┌──────────────────────────────────────────────┐
│ Nostr Relays    Farcaster Hubs   Lens API     │
│ (wss://...)     (hub.pinata...)  (api.lens...)│
└──────┬──────────┬─────────────┬───────────────┘
       │          │             │
       ▼          ▼             ▼
┌──────────────────────────────────────────────┐
│ Normalizer (workers/api/normalize.ts)        │
│ Nostr event → UnifiedPost                    │
│ Farcaster cast → UnifiedPost                 │
│ Lens pub → UnifiedPost                       │
│ Bluesky post → UnifiedPost                   │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Deduper + Ranker (packages/ranking)         │
│ by id, by author+content hash                │
│ score = f(engagement, recency, follow, niche)│
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Cache (Workers KV + browser IndexedDB)       │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│ Client UI   │
└─────────────┘
```

**Key insight:** the worker does *not* store posts. It only normalizes and ranks on the fly. Posts live on the source protocols forever. We are pure pass-through.

### 3.6 Relay selection strategy

For each protocol, we maintain a curated list of high-quality nodes. Health-checked every 5 minutes via cron worker. Bad relays auto-failover.

**Nostr relays (start with these 8):**
- `wss://relay.damus.io` — large, iOS client feeds it
- `wss://nos.lol` — general purpose
- `wss://relay.nostr.band` — search (NIP-50)
- `wss://nostr.wine` — paid, high quality
- `wss://relay.snort.social` — DMs
- `wss://purplepag.es` — NIP-05 verification
- `wss://eden.nostr.land` — long-form
- `wss://bitcoiner.social` — Bitcoin community

We always fetch from at least 3 in parallel, dedupe by event id. If primary fails, we drop and replace from the pool. Worker rotates the primary every 24h.

**Farcaster Hubs:**
- `hub.pinata.cloud` (free public)
- Self-host `farcaster/hub-monorepo` on [HOST-1] (free, gives us a private read path).

**Lens API:**
- `https://api.lens.xyz/graphql` (public, free tier)
- Self-host Lens API indexer on [HOST-1] for faster queries.

**Bluesky:**
- `https://public.api.bsky.app` (public, free)

### 3.7 Ranking algorithm (v1)

Transparent. Explainable. No "AI". Users can see exactly why something was ranked.

```ts
score(post, viewer) =
  w1 * log(1 + post.metrics.likes)
  + w2 * log(1 + post.metrics.reposts)
  + w3 * log(1 + post.metrics.replies)
  + w4 * (post.metrics.likes / max(1, post.metrics.views))   // engagement rate
  + w5 * decay(post.createdAt, halfLife=12h)
  + w6 * follow_boost(post.author, viewer)
  + w7 * niche_match(post, viewer.interests)
  + w8 * source_quality(post.author)
  - w9 * reply_count_to_author_ratio_penalty
  + diversity_penalty(post.author, recent_feed)
```

All weights are constants in `packages/ranking/weights.ts`. Versioned. Documented. **Users can override their own weights** in v1.1 (advanced settings).

### 3.8 Sign-in flow

No backend session. Identity = private key in browser. We use IndexedDB-backed encrypted storage via `nip-44` or Web Crypto. Optional extension: NIP-46 remote signer (Nostr Connect), Frame signer (Farcaster), WalletConnect (Lens).

**Sign-in choices (v1):**

| Method | Flow | Storage |
|---|---|---|
| **Nostr** | Paste nsec, or scan QR via Amber/nostr-connect, or use browser extension (Alby, nos2x) | IndexedDB, encrypted with user passphrase |
| **Farcaster** | Sign in with Warpcast custody, or self-hosted signer, or Farcaster Frame | Local signer or remote signer |
| **Lens** | WalletConnect / injected wallet (Rainbow, MetaMask) sign Lens Profile authentication | Wallet signs, we get profileId |
| **Ethereum (read-only)** | SIWE for cross-protocol linking only | Profile link, not sign-in |

Users can sign in with multiple protocols simultaneously. The "primary" identity is user-chosen. Posts are signed with the native key of the destination protocol.

### 3.9 Composing — the headline feature

This is the feature that justifies the product. Users today juggle Damus, Warpcast, Lens, Bluesky, Twitter. We collapse that to one composer.

**Wireframe:**

```
┌────────────────────────────────────────────────────────────┐
│  Compose                                            [×]    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────┐                                                    │
│  │ av │  What's happening across the open social graph?    │
│  └────┘                                                    │
│         │                                                  │
│         │  [textarea, autofocus, auto-grow, 500 char max]  │
│         │                                                  │
│         │                                                  │
│         │                                                  │
│         │                                                  │
│         │                                                  │
│         │  /  slash commands: poll, image, link, code      │
│         │                                                  │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│  Publish to:                                               │
│   [✓] Nostr     421/500   ✓ signed, sending to 8 relays   │
│   [✓] Farcaster 380/320   ⚠ truncating                     │
│   [✓] Lens      421/5000  ✓ signing with wallet...        │
│   [ ] Bluesky   (not connected — connect)                  │
│                                                            │
│  [ Save Draft ]    [ Schedule ]    [ Post (4) → ]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Interaction model:**

- **Targets.** Four checkboxes, one per protocol. Checked by default if the user has signed in. Per-protocol state: connected (sign in), disconnected (sign in CTA), rate-limited (countdown), error (retry).
- **Character limits enforced live.** Different protocols have different limits:
  - Nostr: no hard limit, soft-warn at 5000
  - Farcaster: 320 cast, 1024 long cast
  - Lens: 5000 chars
  - Bluesky: 300 graphemes (we count graphemes, not chars)
- **Slash commands:**
  - `/poll` — creates a poll per protocol that supports it (Farcaster, Lens, Bluesky; Nostr via NIP-88).
  - `/image` — uploads to protocol-native storage (Bluesky CDN, Lens storage node, Farcaster Hub) or our R2 bucket and includes link.
  - `/link` — expands to rich preview card.
  - `/code` — markdown code fence rendering.
  - `/thread` — multi-post thread composer.
- **Rich text.** Plain text by default. URL detection auto-embeds. Mentions auto-resolve across protocols (`@vitalik` on Farcaster, `npub...` on Nostr, `lens/vitalik` on Lens, `@vitalik.bsky.social` on Bluesky).
- **Per-protocol status.** Real-time indicator as each publish completes. Failures show error + retry.
- **Retry queue.** Failed publishes are queued in IndexedDB. Background job retries with exponential backoff. User sees queued count in compose modal.
- **Draft autosave.** Every keystroke saved locally. Recover on reopen.
- **Scheduling.** Optional. Post at a future time, we queue and publish at the right moment per protocol.

**Implementation:**

```ts
async function publish(post: NewPost, targets: Protocol[]) {
  const results = await Promise.allSettled([
    targets.includes('nostr')     && publishNostr(post),
    targets.includes('farcaster') && publishFarcaster(post),
    targets.includes('lens')      && publishLens(post),
    targets.includes('bluesky')   && publishBluesky(post),
  ]);
  return results;  // partial success UI handles each independently
}

async function publishNostr(post: NewPost) {
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: buildNostrTags(post),
    content: post.text,
  }, nostrSecretKey);
  const relays = await getHealthyRelays();
  return Promise.any(relays.map(r => r.publish(event)));
  // store event id locally, surface to UI
}

async function publishFarcaster(post: NewPost) {
  const cast = await farcasterClient.submitCast({
    text: post.text,
    embeds: post.embeds.filter(e => e.protocol === 'farcaster'),
    parentCastId: post.parentCastId,  // for replies
  });
  return { hash: cast.hash, fid: cast.fid };
}

async function publishLens(post: NewPost) {
  const { id } = await lensClient.publication.post({
    content: post.text,
    profileId: activeLensProfileId,
    // ...
  });
  return { txHash: id };
}

async function publishBluesky(post: NewPost) {
  const res = await bskyAgent.post({
    text: post.text,
    embed: post.embeds.find(e => e.protocol === 'bluesky'),
    // facets for mentions/links
  });
  return { uri: res.uri, cid: res.cid };
}
```

**Cross-protocol reply model:**

When you click reply on a post, we detect the protocol from the `UnifiedPost.protocol` field and publish via that protocol's SDK only. Cross-protocol reply is v1.1 (NIP-25 quote posts with farcaster/lens references is messy and not standardized; better to ship clean per-protocol replies in v1 and add true cross-protocol threading in v1.1 once the standards settle).

The compose modal makes this clear: "Replying to a Farcaster cast → this will publish to Farcaster only."

**Engagement parity:**

Every engagement action is also cross-protocol-aware in the UI but protocol-native in execution:

| Action | Nostr | Farcaster | Lens | Bluesky |
|---|---|---|---|---|
| Like | kind 7 reaction | recast removed, like via reactions API | reaction publication | like record |
| Repost | kind 6 repost | recast | repost publication | repost record |
| Quote | kind 1 with q tag | quote-cast | quote publication | quote post |
| Reply | kind 1 with e/p tags | reply cast | comment publication | reply record |
| Bookmark | kind 30000 (client-only) | n/a (use likes) | n/a | n/a (use likes) |

The UI shows a single set of buttons. The action handler dispatches to the right SDK based on the post's protocol.

### 3.10 Engagement actions

Like / repost / reply all use the protocol-native primitive. We never proxy them. We never store them.

For replies, we look up the parent's `raw` and post via the parent's protocol. Cross-protocol replies are not in v1 (NIP-25 doesn't fully work; Farcaster/Lens quote-posts don't round-trip across networks). We show a "Reply on Nostr" button that opens the right client.

---

## 4. UI / UX

### 4.1 Design principles

1. **Density without clutter.** TweetDeck feel, single column default.
2. **Real-time without chaos.** New posts animate in at top. Threaded replies collapse.
3. **Identity first.** Every post shows clearly which network it's from. Verified badges per protocol.
4. **Keyboard first.** `j/k` to navigate, `r` to reply, `l` to like, `b` to bookmark, `c` to compose.
5. **Dark mode default.** Matches the aesthetic of crypto-native users. Light mode available.
6. **No infinite scroll fatigue.** Auto-pause at 100 posts, show "Keep reading" button.

### 4.2 Color palette

Reuse the established DegenFeed identity:
- Background: `#000000`
- Surface: `#0d0d0d`
- Surface raised: `#1f1f1f`
- Border: `#262626`
- Text primary: `#e8e8e8`
- Text secondary: `#a1a1aa`
- Accent (DegenFeed green): `#00ff41`
- Per-protocol accents:
  - Nostr: `#8e30eb` (purple)
  - Farcaster: `#8a63d2` (purple/violet)
  - Lens: `#abfe2c` (lime)
  - Bluesky: `#1185fe` (blue)

### 4.3 Layout (desktop)

```
┌──────────────────────────────────────────────────────────────┐
│  Logo  Search                                       Compose │
├──────┬──────────────────────────────────────────────┬────────┤
│      │                                              │        │
│ Nav  │              Timeline                         │ Trending│
│      │                                              │        │
│ Home │  ┌────────────────────────────────────────┐  │ #BTC   │
│ For  │  │ Avatar · @handle · Protocol · 2h       │  │ #AI    │
│ Disc │  │                                        │  │ #ETH   │
│ Book │  │ Post content...                        │  │        │
│ List │  │ [embed]                                │  │ Top    │
│      │  │                                        │  │ ppl    │
│ ──── │  │ ♡ 12  ↺ 3  💬 4                        │  │        │
│ Self │  └────────────────────────────────────────┘  │        │
│      │  ...                                          │        │
│ Set  │                                              │        │
└──────┴──────────────────────────────────────────────┴────────┘
```

Three-column responsive. Collapses to single column < 1024px. Nav rail collapses to bottom tab bar < 768px.

### 4.4 Key screens

1. **Sign-in** — Four big buttons: Nostr / Farcaster / Lens / Bluesky. Each explains in one sentence how it works. Below: "Don't have a key? Get one at [link]."
2. **Home (For You)** — Personalized ranked feed.
3. **Following** — Pure chronological from followed identities.
4. **Discover** — Trending topics (cross-protocol via tag normalization), curated accounts, niche directories.
5. **Profile** — Unified identity, all cross-protocol posts.
6. **Post detail** — Threaded view, quote-posts, related.
7. **Compose** — Modal, protocol selector, character counter per protocol, draft autosave.
8. **Settings** — Identity management, sign-in methods, ranking weights (advanced), theme, data export.

### 4.5 Accessibility

- WCAG 2.1 AA minimum.
- Full keyboard nav.
- Screen reader labels on all interactive elements.
- Reduce motion preference honored.
- High contrast theme option.

---

## 5. Data, Privacy, and Costs

### 5.1 What we store

| What | Where | Why | Retention |
|---|---|---|---|
| User's encrypted private keys (Nostr) | Browser IndexedDB | Sign events | Until user logs out |
| User preferences | Cloudflare KV (per-pubkey hash) | Cross-device sync | Until user clears |
| Curated source lists | Static in repo | Same for everyone | Forever |
| Feed cache | Workers KV + browser | Performance | 5 min for hot, 24h for cold |
| User-followed identities | Browser IndexedDB + KV (hashed) | Cross-device sync | Forever (user-controlled) |
| DMs | **Not stored.** Direct P2P per protocol. | Privacy | Never |

### 5.2 What we never store

- ❌ Plaintext private keys (only encrypted blobs).
- ❌ Posts (live on source protocols).
- ❌ DMs (P2P).
- ❌ IP addresses beyond edge logs (Cloudflare's standard 30-day retention).
- ❌ Analytics with cross-site tracking.

### 5.3 Operating cost

| Service | Free tier | Expected usage at 100k MAU |
|---|---|---|
| Cloudflare Pages | Unlimited static requests | Same |
| Cloudflare Workers | 100k requests/day free, then $0.50/million | ~50M requests/mo → ~$25/mo |
| Cloudflare KV | 100k reads/day free, then $0.50/million | Within free tier mostly |
| Plausible self-hosted | Free (uses [HOST-1] resources) | Negligible |
| MeiliSearch self-hosted | Free | ~$0 (existing [HOST-1] box) |
| **Total** | **$0** at launch | **~$25/mo** at 100k MAU |

We can run this for ten years on the cost of one dinner.

---

## 6. The Nuke Plan: What We Tear Down

### 6.1 Inventory of the current mess

| Component | Location | Action |
|---|---|---|
| Akkoma server | `/path/to/degenfeed-akkoma/` | **Stop, archive, delete.** |
| Akkoma DB | `degenfeed-akkoma-db` volume | **Backup then drop.** |
| Soapbox frontend | `degenfeed-soapbox-frontend` | **Stop, delete.** |
| Web3 bridge backend | `degenfeed-web3-bridge` container + repo `/path/to/degenfeed-web3-bridge/` | **Stop, archive, keep code for reference, do not deploy.** |
| Web3 bridge frontend | `degenfeed-web3-frontend` | **Stop, delete.** |
| Mastodon legacy data | `/path/to/degenfeed-akkoma/migration-archive/mastodon-deprecated/` | **Keep tarball cold storage.** |
| `degenfeed.xyz` DNS | Cloudflare | **Keep domain.** Point to new Pages site. |
| Cloudflare Tunnel | Active for degenfeed.xyz | **Repoint to Pages.** |
| Nginx vhost | `/etc/nginx/sites-available/degenfeed.xyz` | **Remove.** |
| Mastodon theme assets | `/path/to/degenfeed-akkoma/migration-archive/mastodon-theme/` | **Keep.** Can mine for inspiration. |
| Backup scripts | `/path/to/scripts/degenfeed-backup.sh` | **Replace** with new site backup. |
| gopass entries | All `degenfeed-akkoma-*` entries | **Keep** (audit trail), add new entries for v2. |
| Email forwarding / SMTP | Gmail SMTP setup | **Keep** for `@degenfeed.xyz` if needed. |
| ActivityPub followers | Any external followers we had | **They'll be stranded.** We'll post a farewell on the new site explaining. |

### 6.2 The nuke script

```bash
# /path/to/scripts/nuke-degenfeed-v1.sh
#!/usr/bin/env bash
set -euo pipefail

echo "=== DegenFeed v1 decommission ==="
echo "Final backup..."
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p /path/to/backups/degenfeed-v1-final

# Postgres final dump
docker exec degenfeed-akkoma-db pg_dump -U akkoma akkoma \
  | gzip > /path/to/backups/degenfeed-v1-final/akkoma-pg-$TS.sql.gz

# Local uploads
tar czf /path/to/backups/degenfeed-v1-final/uploads-$TS.tar.gz \
  /path/to/degenfeed-akkoma/uploads

# Configs
tar czf /path/to/backups/degenfeed-v1-final/config-$TS.tar.gz \
  /path/to/degenfeed-akkoma/config /path/to/degenfeed-akkoma/soapbox-instance

echo "Stopping services..."
cd /path/to/degenfeed-akkoma
docker compose down --volumes

echo "Removing containers, networks, volumes..."
docker system prune -af --filter "label=com.docker.compose.project=degenfeed-akkoma"
docker volume rm degenfeed-akkoma_postgres_data degenfeed-akkoma_redis_data

echo "Archiving for cold storage..."
mv /path/to/degenfeed-akkoma /path/to/backups/degenfeed-v1-final/akkoma-deploy
mv /path/to/degenfeed-web3-bridge /path/to/backups/degenfeed-v1-final/web3-bridge-source

echo "Removing nginx vhost..."
rm -f /etc/nginx/sites-enabled/degenfeed.xyz
rm -f /etc/nginx/sites-available/degenfeed.xyz
nginx -t && systemctl reload nginx

echo "Cleaning DNS / tunnel..."
# tunnel will be repointed in v2 setup

echo "Removing gopass entries (keeping audit log)..."
gopass rm -f LOCAL_SERVICES_PATH/akkoma-admin-password
gopass rm -f LOCAL_SERVICES_PATH/akkoma-admin-token
gopass rm -f LOCAL_SERVICES_PATH/akkoma-oauth-client-id
gopass rm -f LOCAL_SERVICES_PATH/akkoma-oauth-client-secret
gopass rm -f LOCAL_SERVICES_PATH/akkoma-postgres-password
gopass rm -f LOCAL_SERVICES_PATH/web3-bridge-secret

echo "Done. Total cold-storage footprint:"
du -sh /path/to/backups/degenfeed-v1-final
echo "v1 is dead. Long live v2."
```

**Pre-nuke safety:**
- Verify last backup is restorable (test restore to temp DB).
- Post a 7-day advance notice on the existing Akkoma instance ("We're rebuilding from scratch at [new URL] on [date]").
- Update DNS TTL to 60s at least 48h before to make the cutover fast.

### 6.3 Communications

1. **7 days before:** Post notice on existing instance. Pin it. "DegenFeed is rebuilding. New version launches [date]. Follow us at the same handle on Nostr/Farcaster for updates."
2. **24 hours before:** Final reminder.
3. **At cutover:** Publish a "v2 is live" post to the new site from `degenfeed.eth` / `npub...` / `lens/...` / `fc-handle`. Pin it.
4. **Post-cutover:** Keep the old Akkoma DB backup for 90 days. Then cold archive to R2.

---

## 7. Build Plan: From Zero to v1 in 4 Weeks

### 7.1 Week 1 — Foundation + multi-protocol read

**Goals:**
- Repo skeleton, monorepo, CI.
- Nostr read pipeline end-to-end.
- Farcaster read pipeline.
- Lens read pipeline.
- Bluesky read pipeline.
- Unified timeline UI showing mixed feed.

**Tasks:**
1. `pnpm init` + workspace config.
2. Set up Turborepo for builds.
3. Create `apps/web` Next.js 14 app with Tailwind, Radix.
4. Create design system in `packages/ui` (button, card, avatar, badge).
5. Implement `packages/feed-core` UnifiedPost type + normalizers.
6. Implement Nostr client (relay pool, dedupe, NIP-19 parsing).
7. Implement Farcaster Hub client.
8. Implement Lens client.
9. Implement Bluesky client.
10. Worker API endpoint `/api/feed/home` returning mixed feed.
11. Home timeline UI with protocol badges.
12. CI: lint, type, test, build, deploy preview.

**Definition of done:** Visit the site, see a mixed feed of posts from Nostr, Farcaster, Lens, Bluesky, all looking the same.

### 7.2 Week 2 — Identity + sign-in + profile pages

**Goals:**
- Sign in with any of the 4 protocols.
- Persist identity locally.
- View your own profile and any other profile (unified).
- Follow / unfollow.

**Tasks:**
1. Sign-in modal with 4 protocol options.
2. Nostr nsec paste + extension (Alby) + NIP-46.
3. Farcaster custody auth via Quick Auth or self-hosted signer.
4. Lens Lens Profile authentication via WalletConnect.
5. Bluesky app password.
6. Identity store in IndexedDB, encrypted.
7. Cross-protocol handle resolution (background job).
8. Profile page route `/[protocol]/[handle]`.
9. Follow / unfollow with local + cross-protocol (NIP-02, Farcaster link, Lens follow, Bluesky follow).

**Definition of done:** Sign in with each of the 4 protocols, view your unified profile, follow someone, see their posts on your following feed.

### 7.3 Week 3 — Compose, engagement, search, discover

**Goals:**
- Compose modal that posts to selected protocols.
- Like / repost / reply with protocol-native actions.
- Search across protocols.
- Discover page with trending and niches.

**Tasks:**
1. Compose modal UI.
2. Per-protocol publish functions.
3. Partial success UI (one fails, others succeed).
4. Draft autosave in IndexedDB.
5. Engagement action handlers per protocol.
6. Reply modal that detects protocol from parent post.
7. Search bar with NIP-50, Farcaster search, Lens search, Bluesky search.
8. Trending topics aggregator (tag normalization across protocols).
9. Niche directories (Crypto, AI, OSS, Security, Art, Music).
10. Curation list seed (50 must-follow accounts across protocols).

**Definition of done:** Sign in, compose a post that goes live on three protocols at once, like and reply natively, search "bitcoin", see results from all networks.

### 7.4 Week 4 — Polish, perf, deploy, launch

**Goals:**
- Performance budget met (LCP < 1.5s, TTI < 3s).
- Accessibility audit passed.
- Documentation site live.
- Production deploy to degenfeed.xyz.
- Announcement blast across protocols.

**Tasks:**
1. Lighthouse perf pass.
2. Bundle size audit (target < 200KB JS for first load).
3. Service worker for offline read of cached feed.
4. PWA manifest + install banner.
5. Accessibility audit (axe, manual keyboard test).
6. Error boundaries everywhere.
7. Documentation site at `/docs` (Next.js route).
8. DNS cutover from v1.
9. Launch post to all connected identities.
10. Submit to Nostr client directory, Farcaster client directory, Lens app directory, Bluesky app directory.
11. Set up status page (status.degenfeed.xyz using uptime-kuma on [HOST-1]).

**Definition of done:** Public site live at degenfeed.xyz, accepting sign-ins, serving mixed feed. Published launch announcement.

### 7.5 Post-launch (weeks 5–8) — Quick wins

1. Bookmarks.
2. Custom lists / feeds.
3. Tip integration (Lightning via WebLN, USDC via Farcaster, ETH via Lens).
4. Browser extension (replace Twitter timeline).
5. Mobile PWA polish.
6. Public API + docs for third-party devs.

---

## 8. Repo Setup

### 8.1 Initialize

```bash
ssh [INTERNAL]
mkdir -p /path/to/degenfeed-web
cd /path/to/degenfeed-web
git init
pnpm init
# set up workspace
cat > pnpm-workspace.yaml <<EOF
packages:
  - 'apps/*'
  - 'packages/*'
EOF
# install turbo
pnpm add -Dw turbo
git remote add origin https://git.rugmunch.io/RugMunchMedia/degenfeed-web.git
git push -u origin main
```

### 8.2 Standard scaffolding from `fleet-template`

Use the existing `fleet-template` to scaffold `apps/web` with all the standard pre-commit, CI, Makefile, lint config, etc. Don't reinvent.

### 8.3 Secrets management

- Cloudflare API token in gopass: `CLOUDFLARE_API_TOKEN_PATH`.
- Cloudflare account ID: `[CLOUDFLARE_ACCOUNT_ID]` (already in notes).
- Tunnel ID: `9f428b88-5a57-4b28-a7dc-1368f4f32811` (re-use or recreate).
- DegenFeed signing keys (Nostr, Farcaster, Lens, Bluesky) generated during deploy, encrypted with passphrase, stored in gopass.

---

## 9. Risk Register

| Risk | Mitigation |
|---|---|
| A protocol deprecates or breaks (e.g., Lens v3 transition) | Pin SDK versions, abstract behind `UnifiedPost`, write contract tests |
| Relay / Hub goes down | Worker health-checks every 5 min, auto-failover to pool |
| Rate limiting by Hubs | Self-host Hub on [HOST-1] for the long term |
| Spam | Client-side filtering via mute lists (NIP-51), per-user blocklists; no central moderation |
| Legal (DMCA, GDPR) | We host zero user content; relays and source protocols own content; we are a client |
| Discovery / cold-start on the *viewer* side | Heavy cross-posting from our launch accounts; submit to all protocol app directories; launch with a curated "50 must-follow" list |
| Browser extension blockers / CORS | Worker proxy handles CORS; service worker for caching |
| Key loss / phishing | Clear UX: never paste nsec into unverified sites; recommend extensions; recovery via NIP-46 remote signer |
| Lens v3 migration | Track Lens v3 timeline; our abstraction layer means we swap impls without UI changes |

---

## 10. Success Metrics (90 days post-launch)

| Metric | Target |
|---|---|
| Daily active users | 5,000 |
| Posts composed via degenfeed.xyz | 50,000 |
| Unique identities followed | 100,000 |
| Sign-in methods used | All 4 protocols live and active |
| Operating cost | < $50/mo |
| Lighthouse score | > 95 all categories |
| Time-to-first-post from sign-in | < 60 seconds |
| Uptime | 99.9% |

---

## 11. Open Questions (decide in week 1)

1. **Domain.** Keep `degenfeed.xyz` or move to something cleaner like `degenfeed.app`?
2. **Browser extension.** Chrome/Firefox store launch in week 4 or week 8?
3. **Tips.** Wire in week 4–8 or v1.1?
4. **iOS app.** PWA only for v1, or wrap with Capacitor for App Store? (Recommend PWA only for v1.)
5. **Name.** Is "DegenFeed" still right, or does it now feel too narrow? Consider "SocialFi" or new brand. Recommend keeping DegenFeed for brand continuity but expanding scope.
6. **Federation with Bluesky / ATProto.** Worth being a full ATProto PDS or just read from public AppView? Recommend read-only for v1.

---

## 12. Why I'm confident this works

1. **The graph already exists.** 6M+ accounts. We don't have to grow it.
2. **The clients today are bad.** Damus, Amethyst, Farcaster clients, Lens clients — all have the design quality of 2014 Twitter. There's room.
3. **Zero marginal cost.** Static site + edge workers. We can't lose money on this.
4. **The team already has the infra.** [HOST-1] for backups, Plausible, MeiliSearch, Cloudflare account, Tailscale, gopass, fleet-template. Nothing new to buy.
5. **The aggregator idea is validated by every successful aggregator in history.** TweetDeck → Tweetbot. Feedly. Reeder. Algorithmic feeds. People want a better window, not a new network.
6. **We can pivot further.** If a new protocol emerges, we add a client. If the landscape consolidates, we don't care — we read whatever exists.

The moat is not the technology. The moat is the **design quality**, the **curation**, and the **brand**. None of those require us to own the data.

**The pitch in one sentence:** Stop juggling Damus, Warpcast, Orb, Bluesky, and Twitter. Sign in once, read everything, write everywhere, in one window.

---

## 13. Immediate next action (today)

1. **Approve the pivot.** (You just did.)
2. **Pick the domain question.** `degenfeed.xyz` vs new.
3. **Set the nuke date.** Aim for 7 days from today. Gives time for the announcement to propagate.
4. **Post the announcement on the existing instance** with the new direction.
5. **I scaffold `degenfeed-web`** on [HOST-1] and start Week 1.

Let's go.