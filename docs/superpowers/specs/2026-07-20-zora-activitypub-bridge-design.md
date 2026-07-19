# Zora ↔ ActivityPub Cross-Protocol Bridge

**Status:** Draft  
**Last updated:** 2026-07-20  
**Owner:** Architecture  
**Code paths:** `packages/zora-sdk/`, `packages/activitypub-bridge/`, `packages/identity/` (extend), `workers/zora-bridge/`, `workers/api/` (extend)  

---

## 1. Overview

This bridge connects **Zora's creator economy** (coins, NFTs, posts on Base/Zora Network) to the **Fediverse** (ActivityPub via GoToSocial at `social.degenfeed.xyz`). Content flows both ways:

- **Zora → ActivityPub (outbound):** On-chain events become ActivityPub activities visible on Mastodon, Pixelfed, Lemmy, etc.
- **ActivityPub → Zora (inbound):** Fediverse interactions (likes, boosts, replies, tips) become on-chain Zora actions.

The bridge extends DegenFeed's existing cross-protocol identity system and tipping infrastructure.

### 1.1 Existing Infrastructure (reused)

| Component | Existing | Role in Bridge |
|-----------|----------|----------------|
| **GoToSocial** | `social.degenfeed.xyz` | ActivityPub server for DegenFeed's Fediverse identity |
| **GtSClient** | `packages/mastodon-sdk/` | Mastodon API client for posting/reading from GtS |
| **Identity Hub** | `packages/identity/` | Cross-protocol identity resolution (extend with `zora`) |
| **CrossProtocolIdentity** | `packages/types/` + `packages/utils/` | Maps wallets to linked protocol accounts |
| **Tip Contract** | `packages/tip-contract/` | On-chain tipping on Base (reuse for Zora coin buys) |
| **Unified Ledger** | `workers/api/src/routes/unified-tip.ts` | Cross-platform tip accounting (extend with `zora`) |
| **Cloudflare Workers** | `workers/api/` | API routes, KV storage |
| **Bridgy Fed** | `bridgy.degenfeed.xyz` | Write-bridge from ActivityPub → Bluesky/Nostr/Farcaster (reuse for cross-posting) |
| **Cross-platform register** | `packages/crossplatform-register/` | Platform account creation pattern (reuse for shadow wallets) |

### 1.2 New Components Needed

| Component | Type | Purpose |
|-----------|------|---------|
| `packages/zora-sdk/` | Package | Zora API client: events, creators, coins, NFTs, posts |
| `packages/activitypub-bridge/` | Package | Bridge logic: event formatting, AP object builder, webhook handler |
| `packages/ap-types/` | Package | ActivityPub type definitions (Activity, Note, Image, etc.) |
| `workers/zora-bridge/` | CF Worker | Poll Zora API, format events, post to GtS. Cron-triggered. |
| Extend `workers/api/` | CF Worker | Webhook endpoints for GtS callbacks + identity routes |
| N/A (frontend widget) | Component | Tip widget embedded in bridged posts |

---

## 2. Architecture Overview

```
                            ZORA NETWORK (Base L2)
                         ┌────────────────────────────┐
                         │  Creator Coins  │  NFTs     │
                         │  Posts          │  Bids     │
                         │      ▲               │      │
                         └──────┼───────────────┼──────┘
                                │               │
                    on-chain    │          Zora API
                    events      │          polling
                                │               │
                         ┌──────┴───────────────▼──────┐
                         │      BRIDGE WORKER          │
                         │   workers/zora-bridge/      │
                         │                             │
                         │  Event Detector → Formatter │
                         │        → GtS Poster         │
                         │                             │
                         │  Webhook Receiver → Identity│
                         │    Resolver → Action Exec   │
                         └──────┬─────────────────┬────┘
                                │                 │
                   Mastodon API│                 │Webhook
                    (GtSClient) │                 │callbacks
                                ▼                 │
                         ┌──────────────┐         │
                         │  GoToSocial  │◄────────┘
                         │ social.df.xyz│
                         └──────┬───────┘
                                │ federates to
                                ▼
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                   ▼
         Mastodon           Pixelfed            Lemmy
          (social)           (images)         (communities)
```

### 2.1 Outbound Flow (Zora → ActivityPub)

```
1. Zora event occurs (mint, trade, coin deploy, post)
2. Bridge Worker polls Zora API or watches contract events
3. Event type is classified → mapped to AP activity type
4. ContentFormatter builds the AP object (Note, Create, Announce)
5. IdentityResolver looks up the creator's Fediverse account
6. GtSClient posts to GoToSocial via Mastodon API
7. GoToSocial federates to the Fediverse
```

### 2.2 Inbound Flow (ActivityPub → Zora)

```
1. Fediverse user likes/boosts/replies to bridged post
2. GoToSocial fires webhook (or bridge polls notifications)
3. WebhookHandler receives interaction
4. IdentityResolver maps Fediverse actor → wallet (or shadow wallet)
5. ActionMapper determines Zora action type
6. ActionExecutor records interaction on Zora
7. Cross-protocol interaction is recorded in unified ledger
```

### 2.3 Tipping Flow (ActivityPub → Zora Coin Buy)

```
1. Mastodon user sees tip widget embedded in bridged post
2. User clicks tip → DegenFeed tip modal
3. Resolve: Mastodon user → linked wallet (or create shadow wallet)
4. Resolve: recipient → Zora creator coin address
5. Tip → buy recipient's Zora coin via coins-sdk
6. Record: both in Zora API AND unified ledger
7. Bridged post updated with tip notification
```

---

## 3. System Components

### 3.1 `packages/zora-sdk/` — Zora API Client

New package providing a typed client for Zora's APIs:

```
packages/zora-sdk/
  src/
    index.ts          # Public API + ZoraClient class
    types.ts          # Zora-specific types
    events.ts         # Event polling/fetching
    coins.ts          # Creator coin operations
    nfts.ts           # NFT/mint operations
    posts.ts          # Zora post operations
    trades.ts         # Trade/swap operations
```

**Key interfaces:**

```typescript
// ZoraClient — main API client
class ZoraClient {
  constructor(config: { apiKey?: string; network: 'base' | 'zora' });

  // Event polling
  getEvents(opts: { since: number; limit?: number }): Promise<ZoraEvent[]>;
  getCreatorCoins(opts: { creator: string }): Promise<CreatorCoin[]>;
  getNFTs(opts: { creator: string }): Promise<ZoraNFT[]>;
  getPosts(opts: { creator: string }): Promise<ZoraPost[]>;

  // Creator coin operations (for tipping)
  getCoinPrice(coinAddress: string): Promise<{ priceUsd: string }>;
  getBuyQuote(coinAddress: string, amountUsd: string): Promise<{ baseToken: string; quote: string }>;

  // Event types
  onEvent: EventEmitter<ZoraEvent>;
}

// Core types
type ZoraEvent =
  | { type: 'coin_deployed'; coinAddress: string; creatorAddress: string; creatorHandle: string; symbol: string; timestamp: number }
  | { type: 'coin_trade'; coinAddress: string; trader: string; volumeUsd: string; side: 'buy' | 'sell'; timestamp: number }
  | { type: 'nft_minted'; contractAddress: string; tokenId: string; creator: string; mediaUrl: string; mediaType: 'image' | 'video'; timestamp: number }
  | { type: 'nft_bid'; contractAddress: string; tokenId: string; bidder: string; amount: string; timestamp: number }
  | { type: 'collection_created'; contractAddress: string; creator: string; name: string; timestamp: number }
  | { type: 'post_created'; postId: string; author: string; text: string; timestamp: number };
```

**API endpoints consumed:**
- Zora GraphQL API (events, coins, NFTs)
- Zora coins-sdk (buy/sell quotes, execution)
- Zora contract events on Base (via eth_getLogs as fallback)

### 3.2 `packages/ap-types/` — ActivityPub Type Definitions

TypeScript types for ActivityPub object model:

```typescript
// Core ActivityPub types
interface APObject {
  '@context': string | string[];
  id: string;
  type: string;
  attributedTo?: string | APLink;
  published?: string;
  to?: string | string[];
  cc?: string | string[];
}

interface APNote extends APObject {
  type: 'Note';
  content: string;
  mediaType?: 'text/html';
  attachment?: APAttachment[];
  tag?: APTag[];
  source?: { content: string; mediaType: string };
}

interface APImage extends APObject {
  type: 'Image';
  url: string;
  name?: string;
  width?: number;
  height?: number;
}

interface APVideo extends APObject {
  type: 'Video';
  url: string;
  name?: string;
  width?: number;
  height?: number;
}

interface APAttachment {
  type: 'Image' | 'Video' | 'Document';
  mediaType: string;
  url: string;
  name?: string;
  blurhash?: string;
  width?: number;
  height?: number;
}

interface APCreate extends APObject {
  type: 'Create';
  actor: string;
  object: APNote;
}

interface APLike extends APObject {
  type: 'Like';
  actor: string;
  object: string;  // URI of liked object
}

interface APAnnounce extends APObject {
  type: 'Announce';
  actor: string;
  object: string;  // URI of boosted object
}

// Custom DegenFeed extension types
interface DegenFeedTipMetadata extends APObject {
  type: 'Note';
  content: string;
  tag: Array<{
    type: 'degenfeed:tip';
    name: string;       // "$5 tip from @user"
    value: string;      // Amount in USD
    href: string;       // Link to DegenFeed tip page
  }>;
  attachment?: APAttachment[];
}
```

### 3.3 `packages/activitypub-bridge/` — Bridge Logic

Core bridge engine, protocol-agnostic:

```
packages/activitypub-bridge/
  src/
    index.ts              # Public API
    formatter.ts          # ZoraEvent → AP object builder
    webhook.ts            # GoToSocial webhook handler
    identity-resolver.ts  # Fediverse actor ↔ wallet resolution
    action-mapper.ts      # AP interaction type → Zora action
    action-executor.ts    # Execute mapped actions
    shadow-wallet.ts      # Deterministic wallet for Fediverse-only users
```

**Key interfaces:**

```typescript
// Content Formatter — ZoraEvent → AP Activity
class EventFormatter {
  format(event: ZoraEvent, context: BridgeContext): APActivity | null;
  
  private formatCoinDeployed(event: ZoraCoinDeployed, ctx: BridgeContext): APCreate;
  private formatCoinTrade(event: ZoraCoinTrade, ctx: BridgeContext): APAnnounce;
  private formatNFTMint(event: ZoraNFTMinted, ctx: BridgeContext): APCreate;
  private formatNFTBid(event: ZoraNFTBid, ctx: BridgeContext): APLike;
  private formatCollectionCreated(event: ZoraCollectionCreated, ctx: BridgeContext): APCreate;
  private formatPostCreated(event: ZoraPostCreated, ctx: BridgeContext): APCreate;
}

// Identity Resolver — maps actors between protocols
class BridgeIdentityResolver {
  // Fediverse actor → wallet
  async resolveFediverseToWallet(
    actorURI: string,   // e.g. https://mastodon.social/users/alice
  ): Promise<{ walletAddress: string; isShadow: boolean } | null>;

  // Wallet → Fediverse actor
  async resolveWalletToFediverse(
    walletAddress: string,
  ): Promise<{ actorURI: string; handle: string; instance: string } | null>;

  // Get or create shadow wallet for Fediverse-only user
  async getOrCreateShadowWallet(
    actorURI: string,
  ): Promise<{ walletAddress: string; isNew: boolean }>;
}

// Action Mapper — AP interaction → Zora action
class ActionMapper {
  mapToZoraAction(
    interaction: APActivity,
    context: BridgeContext,
  ): Promise<ZoraAction | null>;

  // Fediverse Like → Zora engagement
  private mapLike(like: APLike, ctx: BridgeContext): ZoraEngagement;

  // Fediverse Announce (boost) → Zora share
  private mapAnnounce(announce: APAnnounce, ctx: BridgeContext): ZoraEngagement;

  // Fediverse Create (reply) → Zora engagement
  private mapReply(create: APCreate, ctx: BridgeContext): ZoraEngagement;
}

// Action Executor — execute Zora actions (read/write to Zora API)
class ActionExecutor {
  async recordEngagement(action: ZoraEngagement): Promise<void>;
  async executeBuy(coinAddress: string, buyerWallet: string, amountUsd: string): Promise<string>;
}
```

### 3.4 `workers/zora-bridge/` — Bridge Cloudflare Worker

New Cloudflare Worker with Cron Triggers for outbound polling + inbound webhook handling:

```
workers/zora-bridge/
  wrangler.toml
  src/
    index.ts                  # Entry point + router
    outbound/poller.ts        # Cron-triggered Zora event poller  
    outbound/poster.ts        # Format + post to GoToSocial
    outbound/state.ts         # Last-seen event tracking (KV)
    inbound/webhook.ts        # GtS webhook receiver
    inbound/processor.ts      # Process inbound interactions
    config.ts                 # Environment configuration
```

**Wrangler configuration:**

```toml
name = "zora-bridge"
main = "src/index.ts"
compatibility_date = "2025-01-01"

# Cron: poll Zora events every 5 minutes
[triggers]
crons = ["*/5 * * * *"]

[[kv_namespaces]]
binding = "BRIDGE_STATE"
id = "..."  # Tracks last-seen events, dedup state

[[kv_namespaces]]
binding = "IDENTITIES"
id = "..."  # Shared identity KV with api worker

[[kv_namespaces]]
binding = "TIP_LEDGER"
id = "..."  # Shared tip ledger KV

[env.production]
vars = { ZORA_API_URL = "https://api.zora.co/graphql", GTS_INSTANCE = "social.degenfeed.xyz" }
```

**Entry point router:**

```typescript
// GET /health — bridge health
// POST /webhook/gts — GoToSocial webhook receiver
// GET /state — current bridge state (last poll, counts)
// GET /events/recent — recent bridged events (debug)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return handleHealth(env);
    if (url.pathname === '/webhook/gts') return handleGtSWebhook(request, env);
    if (url.pathname === '/state') return handleState(env);
    if (url.pathname === '/events/recent') return handleRecentEvents(env);
    return new Response('Not Found', { status: 404 });
  },

  // Cron trigger: poll Zora events, format, post to GtS
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const poller = new ZoraEventPoller(env);
    const poster = new ActivityPubPoster(env);
    const events = await poller.poll();
    for (const event of events) {
      await poster.post(event);
    }
  },
};
```

### 3.5 Extend `workers/api/` — Existing API Worker

New/modified routes in the existing API worker:

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `POST /api/zora-bridge/tip` | POST | `workers/api/src/routes/zora-bridge-tip.ts` | Execute Zora coin buy from tip |
| `GET /api/zora-bridge/quote` | GET | `workers/api/src/routes/zora-bridge-tip.ts` | Get buy quote for tipping |
| `POST /api/zora-bridge/link` | POST | `workers/api/src/routes/zora-bridge.ts` | Link Zora account to wallet |
| `GET /api/zora-bridge/status` | GET | `workers/api/src/routes/zora-bridge.ts` | Bridge connection status |

**Tip execution flow:**

```
POST /api/zora-bridge/tip
Body: { fediverseActor: string, recipientWallet: string, amountUsd: string }
→ Resolve fediverseActor → wallet address (or shadow wallet)
→ Get quote for recipient's Zora coin
→ Return quote to client for wallet signing
→ Client signs + submits
→ recordUnifiedZoraTip() writes to unified ledger + Zora API
```

---

## 4. Identity Mapping

### 4.1 Extend Existing Identity Hub

Add `zora` protocol to `CrossProtocolIdentity`:

```typescript
// In packages/utils/src/crossProtocolIdentity.ts
export interface CrossProtocolIdentity {
  walletAddress: string;
  // ... existing protocols ...
  /** Zora protocol identity */
  zora?: {
    address: string;         // Zora network address (on Base)
    username?: string;        // Zora display name
    creatorCoin?: string;     // Address of their creator coin
    verified: boolean;
    manualLinking?: boolean;
  };
}

// In PROTOCOL_ID_REGISTRY
const REGISTRY = {
  // ... existing ...
  zora: {
    displayName: 'Zora',
    icon: '⚡',
    color: '#6f42c1',
    resolveEndpoint: '/api/identity/resolve?protocol=zora',
  },
};
```

### 4.2 Identity Resolution Matrix

```
GoToSocial Actor (@alice@social.degenfeed.xyz)
    │
    ├── Linked wallet (via Identity Hub)
    │   └── Wallet → Zora identity (creator coin, NFTs)
    │   └── Wallet → other protocols (Nostr, Farcaster, etc.)
    │
    └── Unlinked (Fediverse-only user)
        └── Shadow wallet (deterministic from actor URI)
```

**Verification methods:**

| From | To | Method | Flow |
|------|----|--------|------|
| GtS account | Wallet | OAuth + SIWE | User signs in to GtS, then signs SIWE message linking wallet |
| Wallet | Zora identity | Zora API | Wallet address IS the Zora identity on Base |
| Wallet | GtS account | User link | DegenFeed identity linking (existing pattern) |
| Fediverse actor | Shadow wallet | Deterministic | `address = keccak256("degenfeed:shadow:" + actorURI)` |

### 4.3 Shadow Wallet Creation

For Fediverse users who don't have a linked wallet, the bridge creates a **shadow wallet**:

```typescript
// Deterministic shadow wallet from ActivityPub actor URI
function deriveShadowWallet(actorURI: string): { address: string; privateKey?: string } {
  // Option A: Deterministic address (no signing capability)
  // Uses ethers.js keccak256 or @noble/hashes/sha3
  const hash = ethers.keccak256(textEncoder.encode(`degenfeed:shadow:${actorURI}`));
  const address = `0x${hash.slice(-40)}`;

  // Option B: Full key derivation (requires master seed)
  // Only used if user needs to sign transactions
  // const seed = MASTER_SEED + actorURI;
  // const wallet = Wallet.fromMnemonic(seed);

  return { address };
}
```

**Usage:** Shadow wallets can receive tips (ETH on Base) but cannot sign transactions. For tipping OUT, the user must link a real wallet. Shadow wallets are tracked in the identity KV with a `isShadow: true` flag.

---

## 5. Content Format Mapping

### 5.1 Zora → ActivityPub Object Mapping

| Zora Event | AP Activity Type | AP Object | Attachments | Tags |
|-----------|-----------------|-----------|-------------|------|
| NFT mint (image) | `Create` | `Note` | `[Image(url)]` | `#nft #zora #creatorname` |
| NFT mint (video) | `Create` | `Note` | `[Video(url)]` | `#nft #zora #creatorname` |
| Creator coin deployed | `Create` | `Note` | — | `#zora #coin #$SYMBOL` |
| Creator coin trade (buy) | `Announce` | `Note` | — | `#zora #coin #$SYMBOL` |
| Collection created | `Create` | `Note` | Collection image | `#nft #collection #zora` |
| Bid placed | `Like` | — | — | — |
| Zora post (text) | `Create` | `Note` | Any embedded media | As in original post |
| Tip received | `Announce` | `Note` | — | `#zora #tip` |

### 5.2 ActivityPub → Zora Action Mapping

| AP Activity | Zora Action | Notes |
|------------|-------------|-------|
| `Like` | Engagement (like/favorite) | Recorded via Zora API |
| `Announce` (boost) | Share/repost | Recorded via Zora API |
| `Create` (reply) | Comment | If content maps to a Zora post/object |
| DegenFeed tip via widget | Zora coin buy | Execute via coins-sdk |

### 5.3 Content Format Examples

**NFT Mint → ActivityPub Note:**

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams"],
  "type": "Create",
  "actor": "https://social.degenfeed.xyz/users/degenfeed-bot",
  "object": {
    "type": "Note",
    "content": "<p>New mint by @alice on Zora 🎨</p><p>\"Cosmic Dreams #42\" — Edition of 100</p><p>Mint on Zora: <a href=\"https://zora.co/collect/base/0xabc\">zora.co/collect/base/0xabc</a></p>",
    "attachment": [{
      "type": "Image",
      "mediaType": "image/png",
      "url": "https://ipfs.io/ipfs/QmXYZ...",
      "name": "Cosmic Dreams #42 by @alice"
    }],
    "tag": [
      { "type": "Hashtag", "name": "nft" },
      { "type": "Hashtag", "name": "zora" },
      { "type": "Mention", "href": "https://social.degenfeed.xyz/users/alice", "name": "@alice" }
    ],
    "to": "https://www.w3.org/ns/activitystreams#Public",
    "cc": ["https://social.degenfeed.xyz/users/alice/followers"]
  }
}
```

**Creator Coin Trade → ActivityPub Note:**

```json
{
  "type": "Announce",
  "actor": "https://social.degenfeed.xyz/users/degenfeed-bot",
  "object": {
    "type": "Note",
    "content": "<p>🚀 @bob just bought $1,234 of <strong>$ALICE</strong> on Zora</p><p>$ALICE is the creator coin for @alice</p><p>Trade on DegenFeed: <a href=\"https://degenfeed.xyz/coins/base/0xcoin\">degenfeed.xyz/coins/base/0xcoin</a></p>",
    "tag": [
      { "type": "Hashtag", "name": "zora" },
      { "type": "Hashtag", "name": "ALICE" },
      { "type": "Mention", "href": "https://social.degenfeed.xyz/users/bob", "name": "@bob" },
      { "type": "Mention", "href": "https://social.degenfeed.xyz/users/alice", "name": "@alice" }
    ]
  }
}
```

---

## 6. Route Design

### 6.1 New Worker: `workers/zora-bridge/`

```
METHOD  PATH                    HANDLER             PURPOSE
──────  ────                    ───────             ───────
GET     /health                 handleHealth         Health check
POST    /webhook/gts            handleGtSWebhook     GtS interaction webhook
GET     /state                  handleState          Bridge state + stats
GET     /events/recent          handleRecentEvents   Recent bridged events
```

### 6.2 Extended: `workers/api/`

```
METHOD  PATH                    HANDLER              FILE
──────  ────                    ───────              ────
POST    /api/zora-bridge/tip    handleZoraBridgeTip   zora-bridge-tip.ts
GET     /api/zora-bridge/quote  handleZoraBridgeQuote zora-bridge-tip.ts
POST    /api/zora-bridge/link   handleZoraLink        zora-bridge.ts
POST    /api/zora-bridge/confirm handleZoraBridgeConfirm zora-bridge-tip.ts  # Confirm signed tx
GET     /api/zora-bridge/status handleZoraBridgeStatus zora-bridge.ts
```

### 6.3 Tip Execution Route

**`POST /api/zora-bridge/tip`:**

```
Request:
{
  fediverseActor: string,    // e.g. "@alice@mastodon.social"
  recipientWallet: string,   // Creator's wallet on Base
  amountUsd: string,         // "5.00"
  currency: "eth" | "usdc" | "base_eth"
}

Response (200):
{
  quote: {
    coinAddress: string,     // Recipient's Zora creator coin
    baseToken: string,       // Token to pay with (e.g. ETH)
    quoteAmount: string,     // Cost in base token
    estimatedCoins: string,  // Estimated coins received
    expiresAt: number,       // Quote expiry timestamp
  },
  tipperWallet: string,      // Resolved wallet or shadow wallet
  action: "buy_coin",        // Action type for wallet signing
}

Flow:
  1. Resolve fediverseActor → tipper wallet (Fediverse → identity KV)
  2. Look up recipient's creator coin (from identity KV or Zora API)
  3. Get buy quote from Zora coins-sdk
  4. Return quote to client — NO signing happens on the bridge
  5. Client (frontend) signs + submits tx via ethers/wagmi
  6. Frontend calls POST /api/zora-bridge/confirm with txHash
  7. Bridge records: recordZoraTip() → unified ledger + Zora API
```

---

## 7. Data Models

### 7.1 KV State (Bridge Worker)

```typescript
// Last-seen event tracking (dedup)
interface BridgeState {
  lastPollTimestamp: number;         // Last successful poll
  lastEventIds: Record<string, string>;  // Per-type last event ID
  totalEventsBridged: number;
  totalErrors: number;
  lastError?: { timestamp: number; message: string };
}
// Key: "bridge:state"
// TTL: none (manual clear on reset)

// Bridged event log (for debugging)
interface BridgedEvent {
  eventId: string;
  eventType: ZoraEvent['type'];
  zoraObjectId: string;      // The Zora object (coin addr, token ID, etc.)
  apObjectId: string;         // The AP object URI
  gtsStatusId: string;        // The GoToSocial status ID
  timestamp: number;
  bridgedAt: number;
}
// Key: "bridge:events:{eventId}"
// TTL: 30 days
```

### 7.2 KV Identity Extensions (Shared KV)

```typescript
// Shadow wallet record (in IDENTITIES KV)
interface ShadowWalletRecord {
  walletAddress: string;
  actorURI: string;
  handle: string;
  instance: string;
  isShadow: true;
  linkedAt: number;
}
// Key: "shadow:{actorURIHash}"

// Zora identity link (in IDENTITIES KV)
interface ZoraIdentityLink {
  walletAddress: string;
  zoraAddress: string;        // Same as wallet address on Base
  creatorCoinAddress?: string;
  username?: string;
  verified: boolean;
}
// Key: "zora:{walletAddress}"
```

### 7.3 Ledger Extensions

```typescript
// Zora-specific tip record (in TIP_LEDGER KV)
interface ZoraTipRecord {
  protocol: 'zora';
  fediverseActor: string;      // Tipping user's Fediverse identity
  tipperWallet: string;        // Resolved wallet (may be shadow)
  recipientWallet: string;     // Post creator's wallet
  coinAddress: string;         // Zora creator coin bought
  amountUsd: string;
  coinsBought: string;
  txHash: string;              // Base transaction hash
  bridgedPostId: string;       // GtS status ID of bridged post
  timestamp: number;
}
// Key: "zora:tip:{txHash}"
// TTL: 365 days

// Cross-reference tip → unified ledger
// Existing unified ledger extended with "zora" platform
// Key: "tip:zora:{gtsStatusId}"
```

---

## 8. Error Handling & Resilience

### 8.1 Outbound Flow Failures

| Failure Mode | Handling | Retry |
|-------------|----------|-------|
| Zora API unreachable | Skip poll cycle, log error, record in BridgeState | Next cron |
| GtS API returns 429 | Exponential backoff, skip batch | Next cron |
| AP object build fails | Log error with event details, skip event | Manual retry via admin endpoint |
| Identity not found | Post as bot account with `@mention` attribution | No retry (check identity) |
| Media attachment fails | Post without attachment, include link | No retry |

### 8.2 Inbound Flow Failures

| Failure Mode | Handling | Retry |
|-------------|----------|-------|
| Unknown webhook signature | Reject with 401 | No retry |
| Actor not mapped to wallet | Create shadow wallet silently | No retry (success) |
| Zora API write fails | Log error, return 502 | 3 attempts, 5s apart |
| Tip quote expired | Return expired error to client | Client re-quotes |

### 8.3 Webhook Verification

GoToSocial supports `X-Hub-Signature` verification. The bridge validates:

```typescript
function verifyGtSWebhook(request: Request, secret: string): boolean {
  const signature = request.headers.get('X-Hub-Signature');
  const body = request.body;  // raw body
  const expected = 'sha256=' + hmacSHA256(secret, body);
  return timingSafeEqual(signature, expected);
}
```

---

## 9. Security Considerations

### 9.1 Shadow Wallet Risk

Shadow wallets are **receive-only**. They derive deterministically from a Fediverse actor URI, so:
- Anyone who knows the derivation formula and actor URI can compute the address
- Funds sent to shadow wallets are visible but the private key is not available for signing
- **Mitigation**: Shadow wallets should only receive small amounts (e.g., tips < $50). Users who want full control must link a real wallet.

### 9.2 Identity Spoofing

A Fediverse user could claim to be a Zora creator they're not.
- **Mitigation 1**: Cross-link verification — the creator must prove they control both the Fediverse account AND the wallet (existing SIWE pattern)
- **Mitigation 2**: For unverified identities, bridged posts include a notice: "Unverified. Creator has not linked their Fediverse account."

### 9.3 Tip Fraud

A malicious actor could spam the tip endpoint to drain gas.
- **Mitigation 1**: Rate limit on `/api/zora-bridge/tip` (per actor, per wallet)
- **Mitigation 2**: Require quote to be fresh (< 60s)
- **Mitigation 3**: Shadow wallets limited to $50/day total outgoing

### 9.4 Webhook Auth

All GtS webhook endpoints must verify the `X-Hub-Signature` header using a shared secret stored in Worker secrets.

### 9.5 Contract Interaction

The bridge worker never holds private keys. All on-chain transactions are:
- Signed by the user's wallet (via the frontend)
- Or executed by a separate signing service with explicit auth

---

## 10. Implementation Order

### Phase 1: Foundation (Week 1-2)

| Step | Component | Description | Depends On |
|------|-----------|-------------|------------|
| 1.1 | `packages/ap-types/` | ActivityPub type definitions | Nothing |
| 1.2 | `packages/zora-sdk/` | Zora API client (read-only: events, coins) | Nothing |
| 1.3 | `packages/activitypub-bridge/` | Core bridge interfaces + formatter | 1.1, 1.2 |
| 1.4 | Identity extension | Add `zora` protocol + shadow wallet | Nothing |
| 1.5 | Testing | Unit tests for formatter, identity resolver | 1.1-1.4 |

**Checkpoint:** Formatter can convert any ZoraEvent → AP Activity, identity resolver can map Fediverse actors.

### Phase 2: Outbound Bridge (Week 3-4)

| Step | Component | Description | Depends On |
|------|-----------|-------------|------------|
| 2.1 | `workers/zora-bridge/` | Cloudflare Worker scaffolding + health | 1.3 |
| 2.2 | Event poller | Cron-triggered Zora API polling + dedup | 1.2 |
| 2.3 | GtS poster | Post formatted events to GoToSocial | 1.3 |
| 2.4 | State management | KV-based last-seen tracking, error counts | 2.1 |
| 2.5 | Integration test | End-to-end: mock Zora event appears on Fediverse | 2.1-2.4 |

**Checkpoint:** New NFT mint on Zora appears as a post on social.degenfeed.xyz within 5 minutes.

### Phase 3: Inbound Bridge (Week 5-6)

| Step | Component | Description | Depends On |
|------|-----------|-------------|------------|
| 3.1 | GtS webhook config | Configure GtS to send webhooks to bridge | 2.1 |
| 3.2 | Webhook handler | Receive + verify GtS webhooks | 1.4 |
| 3.3 | Action mapper | Map AP interactions → Zora actions | 1.3 |
| 3.4 | Action executor | Write to Zora API | 1.2 |
| 3.5 | Integration test | Fediverse Like → recorded on Zora | 3.1-3.4 |

**Checkpoint:** Liking a bridged post on Mastodon records the interaction on Zora.

### Phase 4: Tipping Bridge (Week 7-8)

| Step | Component | Description | Depends On |
|------|-----------|-------------|------------|
| 4.1 | Quote endpoint | `GET /api/zora-bridge/quote` | 1.2, 1.4 |
| 4.2 | Tip execution | `POST /api/zora-bridge/tip` | 4.1 |
| 4.3 | Frontend widget | Tip button for bridged posts on Fediverse | 4.2 |
| 4.4 | Ledger integration | Zora tip records in unified ledger | 4.2 |
| 4.5 | Integration test | Fediverse tip → Zora coin buy recorded | 4.1-4.4 |

**Checkpoint:** User on Mastodon can tip a bridged post → creator's Zora coin is bought.

### Phase 5: Polish (Week 9-10)

| Step | Component | Description | Depends On |
|------|-----------|-------------|------------|
| 5.1 | Attack vector sweep | Rate limiting, shadow wallet caps, signature verification | 4.x |
| 5.2 | Error budget | Circuit breakers for Zora API failures, GtS failures | 2.x, 3.x |
| 5.3 | Monitoring | Bridge health dashboard (p99 latency, event throughput, error rate) | 2.x-4.x |
| 5.4 | Documentation | Bridge ops manual, incident response | All |

---

## 11. Testing Strategy

### 11.1 Unit Tests

- **`packages/ap-types/`**: Validate JSON-LD serialization round-trip
- **`packages/zora-sdk/`**: Mock Zora API responses, test event parsing
- **`packages/activitypub-bridge/`**: Test each formatter with known Zora event shapes
- **Identity resolver**: Test Fediverse actor → wallet mapping with KV mocks

### 11.2 Integration Tests

- **Outbound**: Mock Zora GraphQL → assert correct GtS API call
- **Inbound**: Mock GtS webhook payload → assert correct Zora API call
- **Tipping**: Full flow from tip request to quote generation

### 11.3 E2E Tests

- Deploy bridge to staging with test GtS instance
- Mint test NFT on Zora testnet → verify post on test GtS
- Like test post on test GtS → verify interaction on Zora
- Execute tip → verify coin buy + ledger record

---

## 12. Future Considerations

### 12.1 Bidirectional Replies

Currently, replies to bridged posts are one-directional (Fediverse → Zora). Full bidirectional replies would require:
- Zora posts appearing as threads on Fediverse
- Fediverse replies being mirrored back to Zora
- Thread state management (complex, requires coordination)

**Deferred** until Phase 6 or later.

### 12.2 Zora → Multiple Fediverse Instances

The bridge currently posts to DegenFeed's GoToSocial instance, which federates naturally. For users who want posts to originate from their OWN Fediverse instance, we'd need:
- Per-user posting credentials to their home instance
- OAuth delegation

**Deferred**: Start with bot account posting, explore per-user posting later.

### 12.3 Self-Hosted Zora Node

For more reliable event detection, consider running a Zora RPC node (or using a Zora-indexed service) instead of polling the public API. This would enable:
- Real-time contract event subscriptions
- No API rate limits
- Historical event backfill

**Deferred**: Current polling approach is sufficient for Phase 1-4.

### 12.4 Content Moderation

Bridged content inherits Moderation from Zora's side. Fediverse users may report bridged content. A bridge-specific moderation queue in `workers/api/` should be added in a follow-up.

---

## Appendix A: Zora API Reference

Key Zora API endpoints the bridge consumes:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://api.zora.co/graphql` | GraphQL | Event queries, token metadata, creator coin data |
| `https://api.zora.co/discover/events` | REST | Latest events feed |
| `https://api.zora.co/coins/{address}` | REST | Creator coin details |
| `https://api.zora.co/tokens/{chain}/{address}/{tokenId}` | REST | Token metadata |
| coins-sdk | SDK | Buy/sell creator coins programmatically |

## Appendix B: ActivityPub Context

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    {
      "degenfeed": "https://degenfeed.xyz/ns#",
      "Hashtag": "as:Hashtag",
      "sensitive": "as:sensitive",
      "blurhash": "degenfeed:blurhash",
      "zora": "degenfeed:zora",
      "zora:coin": "degenfeed:zora/coin",
      "zora:token": "degenfeed:zora/token",
      "zora:creator": "degenfeed:zora/creator"
    }
  ]
}
```

## Appendix C: Comparison Matrix

| Aspect | This Design | Alternative: monolithic bridge |
|--------|-------------|-------------------------------|
| Components | 3 packages + 2 worker extensions | Single big service |
| Deployment | CF Worker (serverless) + packages | Docker service on Talos |
| Scalability | Serverless, auto-scale | Requires manual scaling |
| Latency | Sub-second for webhooks | Sub-second for webhooks |
| Development | Parallel package work | Sequential monolith |
| Testing | Package-level unit tests + E2E | Service-level integration tests |
| **Recommended** | ✅ **This design** | ❌ Monolith |
