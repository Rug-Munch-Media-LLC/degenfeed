# Tipping Architecture

> **Last updated:** 2026-07-18
> **Owner:** Backend Lead
> **Code paths:** `packages/tip-contract/`, `packages/web3/`, `packages/ui/src/*Tip*`, `apps/web/src/components/TipModal*`, `workers/api/src/routes/*tip*`

## 1. Overview

DegenFeed provides **cross-platform, zero-fee tipping** for every creator regardless of which social protocol they signed in with. A user on Farcaster can tip a Nostr commenter via Lightning, a Lens user can receive ETH on Base, and a Bluesky poster can get tips in SOL.

**Core principles:**
- **0% platform fee** — senders pay only L2 gas or Lightning routing fees
- **Protocol-agnostic** — tipper and recipient can use any supported protocol
- **Unified ledger** — every tip across all platforms records to one KV accounting layer
- **Opt-in** — creators configure wallets in Settings; no wallets = no tip button shown

## 2. Supported Currencies & Methods

| Method | Currency | Chain | Gas Cost | Protocol Affinity | Notes |
|--------|----------|-------|----------|-------------------|-------|
| `onchain_tip` | ETH | Base / Optimism / Arbitrum | L2 gas (~$0.01–0.10) | DegenFeed contract | Direct via `DegenFeedTips.sol`, no intermediary |
| `ethereum` | ETH / USDC / ERC-20 | Ethereum / Optimism / Arbitrum / Polygon | Varies ($0.05–5) | General | Backend-routed, wallet-to-wallet |
| `base` | ETH / USDC | Base | ~$0.001 | Farcaster | Via L2, sub-cent fees |
| `solana` | SOL / USDC / SPL | Solana | ~$0.001 | Solana ecosystem | Sub-cent, fast |
| `lightning_zap` | BTC (sats) | Bitcoin Lightning | ~$0.001 | Nostr | Nostr Zaps via LNURL-pay |
| `farcaster_frame` | ETH | Base (via Frame) | ~$0.01–0.50 | Farcaster | Embeddable Frame tipping |
| `lens_collect` | MATIC | Polygon | ~$0.01–1 | Lens | Collect module on Lens publication |

### 2.1 Protocol → Default Method Mapping

When the tipper's signed-in protocol is known, the default currency auto-selects:

| Tipper's Protocol | Default Method | Fallback |
|-------------------|---------------|----------|
| Farcaster | `base` (ETH on Base) | `onchain_tip` |
| Lens | `matic` (MATIC) | `ethereum` |
| Solana | `sol` (SOL) | — |
| Nostr | `btc` (Lightning) | `ethereum` |
| Ethereum | `eth` | `base` |
| Bluesky | `eth` | `base` |
| Mastodon | `eth` | `base` |
| Threads | `eth` | `base` |
| Lemmy | `eth` | all 6 shown |

This mapping lives in `packages/ui/src/QuickTipButton.tsx` (client-side) and `workers/api/src/routes/tip.ts` (server-side method ranking).

### 2.2 Per-Protocol Recipient Method Resolution

The server resolves available methods per protocol via `GET /api/tip/resolve?protocol=…&authorId=…`. For each protocol:

- **Nostr**: Checks for `lightningAddress` or `nostrPubkey` → offers `lightning_zap` as native
- **Farcaster**: Checks for `farcasterCustodyAddress` → offers `farcaster_frame` as native; falls back to `ethereum` if EVM address exists
- **Lens**: Checks for `hasCollectModule` or `lensProfile` → offers `lens_collect` as native
- **Bluesky / Mastodon / Threads / Lemmy**: All generic methods offered (ETH, SOL, USDC, Lightning)

For **commenters** specifically, the method auto-detects based on the **comment author's** linked identities, not the post author's.

## 3. Tip Flow

```
[TIP BUTTON] → [TIP MODAL] → [METHOD SELECT] → [SIGN/CONFIRM] → [CONTRACT/ZAP] → [LEDGER + NOTIFICATION]
```

### 3.1 Full Flow (4-click)

1. **Button → Modal**: User clicks QuickTipButton or Tip button → `TipModal` opens
2. **Resolve methods**: `useTip().resolveMethods()` → `GET /api/tip/resolve?protocol=…&authorId=…` → returns ranked available methods
3. **Method selection**: User picks currency/method, enters amount (or quick-amount)
4. **Send tip**: `useTip().createTip()` → `POST /api/tip/create` → returns intent (contract address + value)
5. **Wallet sign**: User confirms in wallet (MetaMask, Phantom, Alby, etc.)
6. **On-chain/Ledger**: 
   - On-chain tips go straight to `DegenFeedTips.sol` contract → `TipSent` event emitted
   - Lightning tips fetch invoice → user pays via LN wallet
   - ERC-20 tips call `tipERC20()` after approval
7. **Accounting**: `recordUnifiedTip()` called → writes to KV:
   - Entity aggregate (`tip:{platform}:{entityId}`)
   - Sender ledger (`tip:user:{sender}:sent`)
   - Recipient ledger (`tip:user:{recipient}:received`)
   - Leaderboards (`tip:leaderboard:{period}`)
   - Activity feed (`tip:activity:recent`)
8. **Notification**: KV notification stored (`notifications:{recipient}`) → real-time push via WebSocket

### 3.2 Quick Tip (2-click)

QuickTipButton in `PostCardEngagement` provides one-click presets. Flow:

1. Click ⚡ → dropup shows $1 / $5 / $10 amounts + currency badge
2. Click amount → `fetch('/api/tip', { method: 'POST', … })` → wallet prompt
3. On success → optimistic UI update ✓

## 4. Contract Architecture

### 4.1 `DegenFeedTips.sol`

Deployed on **Base, Optimism, and Arbitrum** (L2s only; no mainnet to keep gas near-zero).

```
contract DegenFeedTips {
    uint256 public totalTips;
    uint256 public totalEthTipped;
    
    function tip(address recipient) external payable;
    function tipWithMessage(address recipient, string message) external payable;
    function tipWithSplit(address recipient, address community) external payable;
    function batchTip(address[] recipients, uint256[] amounts) external payable;
    function tipERC20(address token, address recipient, uint256 amount) external;
    
    event TipSent(address indexed from, address indexed to, uint256 amount, string message);
}
```

**Security properties:**
- No `selfdestruct`, no `delegatecall`, no admin functions
- No upgradeability (permanent, immutable)
- Reentrancy: state reads before external calls; no post-call state changes
- Total supply tracking after send to prevent reentrant manipulation
- `receive()` allows direct ETH for emergency recovery

**Deployment:** `packages/tip-contract/src/DegenFeedTips.sol`  
**Status:** Compiled and ready. NOT YET DEPLOYED (addresses are zeroed). Run `pnpm deploy:tip-contract --all`.

### 4.2 Address Book

| Chain | Contract Address | Status |
|-------|-----------------|--------|
| Base | `0x0000…0000` | ⚠️ Not deployed |
| Optimism | `0x0000…0000` | ⚠️ Not deployed |
| Arbitrum | `0x0000…0000` | ⚠️ Not deployed |

## 5. Unified Ledger KV Schema

All tips route through `recordUnifiedTip()` in `workers/api/src/routes/unified-tip.ts`. KV (Cloudflare Workers KV) is the persistence layer.

### 5.1 Entity Aggregate

```
Key:   tip:{platform}:{entityId}
Value: {
  platform: "degenfeed" | "lemmy" | "peertube" | "bluesky" | "mastodon",
  entityId: string,
  entityType: "post" | "comment" | "video" | "space",
  totalUsd: number,
  tips: [{ amountUsd, fromUserId?, toUserId?, method?, at: timestamp }],
  lastTipAt: timestamp
}
TTL: 365 days
Caps: 200 tips per entity
```

### 5.2 Sender Ledger

```
Key:   tip:user:{userId}:sent
Value: {
  totalUsd: number,
  count: number,
  lastTipAt: timestamp,
  byPlatform: { "degenfeed": { totalUsd, count }, ... },
  recent: ActivityItem[] (capped at 25)
}
```

### 5.3 Recipient Ledger

```
Key:   tip:user:{userId}:received
Value: {
  totalUsd: number,
  count: number,
  lastTipAt: timestamp,
  byPlatform: { ... },
  tippers: string[] (unique, capped at 1000),
  recent: ActivityItem[] (capped at 25)
}
```

### 5.4 Leaderboard

```
Key:   tip:leaderboard:{period}
Periods: daily, weekly, monthly, alltime
Value: {
  bucket: "2026-W29",
  updatedAt: timestamp,
  entries: [{ userId, totalUsd, count, platform, byPlatform }]
}
Bucketing: periodBucket() resets when date rolls over
```

### 5.5 Activity Feed

```
Key:   tip:activity:recent
Value: ActivityItem[] (newest first, capped at 100)
Polled by: TipActivityFeed component (every 15s)
```

### 5.6 Platform-Specific KV

| Platform | KV Prefix | Purpose |
|----------|-----------|---------|
| DegenFeed | `tip:{platform}:{entityId}` | Unified ledger IS the store |
| Lemmy | `lemmy:tip:{contentId}` | Per-content aggregates + leaderboard |
| PeerTube | `peertube:tip:{videoId}` | Per-video aggregates |
| Bluesky | `bsky:tip:{postId}` | Per-post aggregates |
| Mastodon | `masto:tip:{statusId}` | Per-status aggregates |

### 5.7 Notification KV

```
Key:   notifications:{walletAddress}
Value: Array of notification objects (capped at 100)
TTL: 30 days
```

## 6. Commenter Tipping Architecture

### 6.1 How Commenters Receive Tips

Every comment author is tippable via their **linked wallet/protocol identity**, not the post author's wallet. The tipping system:

1. **Resolves the comment author's identity** from the CommentNode data
2. **Checks linked wallets** (evmAddress, solanaAddress, lightningAddress, nostrPubkey, farcasterCustodyAddress, lensProfile) from their identity record
3. **Shows available methods** automatically based on which wallets are linked
4. **Routes the tip** to the appropriate method (Nostr → Lightning Zap, Farcaster → Frame/Base, etc.)

### 6.2 Comment Tip UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `CommentNode` | `packages/ui/src/LemmyThreadView.tsx` | Individual comment renderer with inline tip button |
| `LemmyTipButton` | `packages/ui/src/LemmyTipButton.tsx` | Compact tip button preset for comments (6 methods) |
| `QuickTipButton` | `packages/ui/src/QuickTipButton.tsx` | Generic quick tip button (used in PostCardEngagement) |

### 6.3 Comment Tip Data Flow

```
CommentNode renders
  → LemmyTipButton (compact mode)
    → Dropdown shows 6 method tabs (ETH, SOL, Lightning, USDC, Farcaster, Lens)
    → User selects amount ($1, $5, $10)
    → POST /api/lemmy/tip { contentId, contentType: "comment", amount, currency, recipientEvm, recipientSol }
      → recordLemmyTip() writes Lemmy aggregation
      → recordUnifiedTip() writes unified ledger
        → Entity aggregate (tip:lemmy:{contentId})
        → Recipient ledger (tip:user:{recipientAddress}:received)
        → Leaderboard + activity feed
```

### 6.4 Protocol Auto-Detection for Commenters

The `CommentNode` currently passes `postAuthorEvmAddress` and `postAuthorSolanaAddress` to `LemmyTipButton`. This means ALL tips in a comment thread go to the post author, not the comment author.

**TODO/known gap:** CommentNode needs to pass the **comment author's** wallet addresses (evmAddress, solanaAddress) rather than (or in addition to) the post author's. This requires:
1. `LemmyComment` type to carry `authorEvmAddress?` and `authorSolanaAddress?` fields
2. `CommentNode` to look up the comment author's linked identities before rendering the tip button
3. `LemmyTipButton` to accept comment-author-specific wallet addresses

### 6.5 Tip Method Auto-Detection Logic

When a user opens the tip modal for a commenter:

1. **Client-side** (`TipModal.tsx`): calls `resolveMethods(recipientProtocol, recipientAuthorId, postContext)`
2. **Server-side** (`tip.ts:handleTipResolve`): 
   - Looks up identity KV for the recipient wallet address
   - Resolves linked protocols: evmAddress, solanaAddress, farcasterCustodyAddress, lensProfile, nostrPubkey, lightningAddress
   - Builds method list with availability flags
   - Ranks: native protocol method → Lightning → on-chain → EVM → Solana → Frame → Lens collect
3. **Returns** sorted methods to client → renders method selector

## 7. Fee Structure

| Fee Type | Amount | Who Pays |
|----------|--------|----------|
| **Platform fee** | **0%** | Nobody |
| L2 gas (Base/Opt/Arb) | ~$0.01–0.10 | Tipper |
| Ethereum mainnet gas | ~$2–50 | Tipper |
| Solana transaction fee | ~$0.001 | Tipper |
| Lightning routing fee | ~0.001% | Tipper |
| Lens collect gas | ~$0.01–1 | Tipper |

The contract is pure passthrough — no admin fees are taken. The only costs are blockchain transaction fees.

## 8. Notification Pipeline

```
Tip sent → recordUnifiedTip()
  → KV notification stored (notifications:{recipient})
  → WebSocket broadcast via broadcastToAll("tip:received", { ... })
  → Unified notification pipeline delivers push/email/in-app
```

Notification schema:
```typescript
{
  id: string,
  type: "tip",
  protocol: "degenfeed" | "lemmy" | "peertube" | "bluesky" | "mastodon",
  sourceProtocol: string,
  actorName: string,
  actorHandle: string,
  amount: string,
  currency: string,
  createdAt: number,
  read: false
}
```

## 9. Component Tree & Data Flow

```
┌─ PostCard ─────────────────────────────────────────────────────┐
│  │                                                            │
│  ├─ PostCardEngagement                                        │
│  │  └─ QuickTipButton (post author tipping)                   │
│  │                                                            │
│  └─ LemmyThreadView (if lemmy protocol)                       │
│     └─ VirtualizedCommentList                                 │
│        └─ CommentNode (per comment)                           │
│           └─ LemmyTipButton (compact) ← comment author tip    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ TipModal ────────────────────────────────────────────────────┐
│  useTip() → GET /api/tip/resolve → method selector             │
│  → wallet prompt → tx sent → recordUnifiedTip()                │
└────────────────────────────────────────────────────────────────┘
```

## 10. API Routes Inventory

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/tip/resolve` | GET | `workers/api/src/routes/tip.ts` | Resolve available tipping methods |
| `/api/tip/create` | POST | `workers/api/src/routes/tip.ts` | Create tip intent (pre-sign) |
| `/api/tip/settings` | GET/POST | `workers/api/src/routes/tip.ts` | Creator wallet config |
| `/api/tip/lightning/invoice` | GET | `workers/api/src/routes/tip.ts` | Fetch LN invoice |
| `/api/tip/frame/…` | GET/POST | `workers/api/src/routes/tip.ts` | Farcaster Frame endpoints |
| `/api/tip/unified` | POST | `workers/api/src/routes/unified-tip.ts` | Create + route unified tip |
| `/api/tip/unified/stats` | GET | `workers/api/src/routes/unified-tip.ts` | Cross-platform user stats |
| `/api/tip/unified/leaderboard` | GET | `workers/api/src/routes/unified-tip.ts` | Cross-platform leaderboard |
| `/api/tip/unified/activity` | GET | `workers/api/src/routes/unified-tip.ts` | Live activity feed |
| `/api/lemmy/tip` | POST | `workers/api/src/routes/lemmy-tip.ts` | Record Lemmy tip |
| `/api/lemmy/tip/stats` | GET | `workers/api/src/routes/lemmy-tip.ts` | Get Lemmy tip stats |
| `/api/lemmy/tip/leaderboard` | GET | `workers/api/src/routes/lemmy-tip.ts` | Lemmy tip leaderboard |
| `/api/bluesky/tip` | POST | `workers/api/src/routes/bluesky-tip.ts` | Record Bluesky tip |
| `/api/mastodon/tip` | POST | `workers/api/src/routes/mastodon-tip.ts` | Record Mastodon tip |
| `/api/peertube/tip` | POST | `workers/api/src/routes/peertube-tip.ts` | Record PeerTube tip |

## 11. Identity Resolution for Tipping

When resolving tipping methods for an unknown wallet address, the server performs an identity KV lookup:

1. Check if authorId matches a wallet address pattern (0x… or base58)
2. If yes, look up `identity:{walletAddress}` in `IDENTITIES` KV
3. Extract linked wallets: evmAddress, solanaAddress, farcasterCustodyAddress, lensProfile
4. Merge into postContext.author for method availability checks

This enables cross-registered users to receive tips on any protocol they've linked.

**Identity KV key:** `identityKey(authorId)` → `identity:{normalizedAddress}`  
**Storage:** `env.IDENTITIES` KV namespace  
**Best-effort:** Identity lookup failures never block tip resolution.

## 12. Filing Tips for Missing Comment Author Wallet Support

### Current State
- `CommentNode` receives `postAuthorEvmAddress` and `postAuthorSolanaAddress` from `LemmyThreadView`
- These are the **post author's** wallets
- When a user tips a comment, the tip currently goes to the post author

### Required Fix
The `LemmyComment` interface needs to carry per-comment-author wallet addresses so that comment tips go to the **comment author**, not the post author. This requires:

1. Extend `LemmyComment` with `authorEvmAddress?: string` and `authorSolanaAddress?: string`
2. Populate these from the comment data source (Lemmy API or identity KV)
3. Pass them to `CommentNode` instead of the post author's wallets
4. Fall back to post author's wallets when comment author wallets are unavailable
5. The `LemmyTipButton` already handles per-author wallets correctly via its `authorEvmAddress`/`authorSolanaAddress` props
