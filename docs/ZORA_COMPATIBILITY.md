# Zora Compatibility

> **Our coins ARE Zora coins.** They deploy through Zora's own factory, use Zora's ERC-20z standard, trade on Uniswap V4, and are indexed by Zora's API — any app that integrates with Zora's Coins Protocol sees our coins automatically.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     DegenFeed Creator Coins                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Creator launches coin on DegenFeed                            │
│  2. Coin deployed via ZoraFactory on Base                         │
│     → ERC-20z token (Zora's 2026 Coins Protocol)                 │
│     → Uniswap V4 pool created alongside                          │
│     → Indexed by Zora's REST + GraphQL APIs                      │
│  3. Coin appears on zora.co automatically                        │
│  4. Any Zora-integrated app discovers it                         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Key differentiators** (what DegenFeed adds beyond base Zora):

| Feature | Zora Standard | DegenFeed |
|---------|--------------|-----------|
| **Vesting** | Fixed (0.5% creator allocation, no cliff) | Customizable: 0-30% initial unlock, 0-90d cliff, 7d-2y vesting |
| **Anti-Exploit** | None | Phase-based buy limits, whale alerts, badge milestones |
| **Platform Fee** | 0.3% (Zora protocol) | 0.5% (DegenFeed) — lower total with our creator fee sharing |
| **Cross-Chain** | Base-only | Base + Solana via Wormhole bridge |
| **Creator Fee** | 0.5% default | 0-2% configurable |
| **Announcements** | Manual | Auto-announce on Farcaster, Nostr, Bluesky, Lens, ActivityPub |
| **Bonding Curve** | Zora bonding curve | Enhanced multi-era curve with flash sales & streak bonuses |

---

## Compatible Apps

### Tier 1 — Zero-Config (Works Automatically)

These apps require no changes on our end because they read directly from Zora's infrastructure.

| App | What It Shows | How It Works | User Action Required |
|-----|--------------|-------------|---------------------|
| **[zora.co](https://zora.co)** | Coin profile, price chart, trade UI | Automatically indexes coins deployed via ZoraFactory | None — coin appears within minutes of deploy |
| **[Uniswap](https://app.uniswap.org)** | DEX trading (post-graduation) | Each coin has a native Uniswap V4 pool | None — pool is created at deploy time |
| **Zora Coins API** | All coin data (price, volume, holders) | REST API at `coins.zora.co/api/v1/` indexes our coins | None — our transactions emit Zora events |
| **Zora GraphQL API** | Advanced queries, trending, search | `api.zora.co/graphql` | None |
| **Wallet apps** (Rainbow, MetaMask, Zerion) | Token balance display | Standard ERC-20 tokens on Base | None — just add the coin address or it auto-appears |
| **Etherscan / Basescan** | Transaction history, contract source | Standard EVM explorer | None — contracts are verified |

### Tier 2 — API Compatible (Works via Our Compatibility Layer)

These apps need minimal integration — we translate to their expected format.

| App | What We Provide | Endpoint |
|-----|----------------|----------|
| **DexScreener** | Uniswap V4 pool data | Paired with our coin pools automatically |
| **CoinGecko / CoinMarketCap** | Token metadata, price, volume | Via listing request (standard ERC-20 process) |
| **Warpcast / Farcaster** | Coin links + frames | `https://zora.co/collect/base:<address>` works in casts |
| **Telegram bots** | Price alerts, buy/sell signals | Our `/api/zora/compat/coin/:address` endpoint |
| **Discord bots** | Portfolio tracking, price feeds | Our `/api/zora/compat/trending` endpoint |

### Tier 3 — Build-Your-Own (SDK Integration)

Any developer building on Zora's Coins Protocol can use our coins:

```typescript
// Using @degenfeed/zora-sdk
import { ZoraCreatorCoinClient } from '@degenfeed/zora-sdk';

// This works for ANY Zora-compatible coin — ours or native Zora
const client = new ZoraCreatorCoinClient(walletClient, publicClient);
const coinInfo = await client.getCoinInfo('0x...');
const trending = await client.getTrendingCoins(20);

// Or call Zora's API directly
const res = await fetch('https://coins.zora.co/api/v1/trending?limit=20');
const data = await res.json();
```

---

## Deployment Flow

### Standard Flow (Base-native, visible on Zora)

```
User creates coin on DegenFeed
  → POST /api/coin/launch { name, symbol, chain: "base" }
  → Backend calls ZoraFactory.deploy() on Base
  → Coin appears on zora.co (minutes)
  → Uniswap V4 pool is live (post-graduation)
  → Zora API indexes it automatically
```

### Solana-to-Zora Bridged Flow

```
User creates coin on DegenFeed (Solana-first)
  → POST /api/coin/launch { name, symbol, chain: "solana" }
  → SPL token deployed on Solana
  → Wormhole-wrapped version created on Base
  → Wrapped token deployed via ZoraFactory
  → Appears on zora.co as a Base token
```

---

## Smart Contract Details

| Contract | Address (Base) | Purpose |
|----------|----------------|---------|
| **ZoraFactory** | `0x777777751622c0d3258f214F9DF38E35BF45baF3` | Deploys creator coins (ERC-20z) |
| **DegenFeedFactory** | `0x...` (ours) | Our wrapper with customizable vesting, fee override |
| **DegenFeedCoin** | Per-coin CREATE2 | Each token is a DegenFeedCoin instance |
| **CrossChainRegistry** | KV-based | Maps tokens across Base ↔ Solana |
| **Uniswap V4 Pool** | Per-coin (post-graduation) | DEX liquidity pool |

### Coin ABI (ERC-20z Standard)

Every DegenFeed coin implements Zora's ERC-20z interface, so any app that knows how to interact with Zora coins can buy, sell, and read our coins:

```solidity
interface IDegenFeedCoin {
    // ERC-20 standard
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    
    // Zora 2026 Coins Protocol
    function creator() external view returns (address);
    function uri() external view returns (string memory);
    function getPrice() external view returns (uint256);
    function poolAddress() external view returns (address);
    function isGraduated() external view returns (bool);
    
    // Trading
    function buy(address recipient, uint256 minAmount) external payable returns (uint256);
    function sell(uint256 amount, uint256 minEth) external returns (uint256);
    
    // DegenFeed extensions
    function vestingConfig() external view returns (
        uint256 initialUnlockBps,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    function creatorFeeBps() external view returns (uint256);
    function platformFeeBps() external view returns (uint256);
}
```

---

## API Compatibility Layer

Our Zora Compatibility API (`/api/zora/compat/`) exposes endpoints that match Zora's data format so third-party apps can integrate without changes.

### `GET /api/zora/compat/coin/:address`

Returns coin data in Zora's API format:

```json
{
  "address": "0x...",
  "name": "Alice Coin",
  "symbol": "ALICE",
  "creator": "0x...",
  "price": "0.0012",
  "marketCap": "1200000",
  "volume24h": "45000",
  "holders": 342,
  "graduated": true,
  "poolAddress": "0x...",
  "zoraUrl": "https://zora.co/coin/base:0x...",
  "degenfeedUrl": "https://app.degenfeed.xyz/launch/ALICE",
  "deployedVia": "degenfeed",
  "hasEnhancedVesting": true,
  "hasAntiExploit": true,
  "hasCrossNetwork": false
}
```

### `GET /api/zora/compat/trending`

Top coins in Zora-compatible format.

### `POST /api/zora/compat/webhook`

Webhook receiver for external Zora apps sending trade events, price updates, etc.

---

## Third-Party Integration Examples

### Uniswap V4 Trading

Once a coin graduates (reaches its Uniswap threshold), it has a full Uniswap V4 pool. Users can trade it directly on the Uniswap interface:

```
https://app.uniswap.org/swap?chain=base&outputCurrency=<coin-address>
```

### Zora.co Deep Link

Any coin can be linked directly on zora.co:

```
https://zora.co/collect/base:<coin-address>
```

### Farcaster Frames

Coin data is embeddable in Farcaster frames via our frame endpoints.

### Wallet Detection

Standard ERC-20 tokens on Base are auto-detected by wallets. User just needs to import the token address.

---

## Verification

You can verify a coin's Zora compatibility using the Zora API:

```bash
# Check if a coin exists on Zora's API
curl https://coins.zora.co/api/v1/coins/<coin-address>

# Check trending coins (our coins appear here)
curl https://coins.zora.co/api/v1/trending?limit=20

# Check via Zora GraphQL
curl -X POST https://api.zora.co/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ coin(address: \"<coin-address>\") { name symbol price } }"}'
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Coin not appearing on zora.co | Indexing delay | Wait 5-15 minutes after deploy |
| Coin not in Zora API results | Not yet indexed | Check Basescan — if tx confirmed, Zora will pick it up |
| Wallet doesn't show coin | Need to import token | Add contract address manually in wallet |
| Uniswap can't find pool | Pre-graduation | Buy more to graduate the bonding curve |
| App using Zora SDK can't find coin | Using wrong chain | Ensure app is querying Base (chain 8453) |

---

## Revenue & Fee Flow

```
Buyer pays 1 ETH
  → 0.5% (50 bps) → DegenFeed platform fee receiver
  → 0-2% (0-200 bps) → Creator (configurable)
  → 0.05% (5 bps) → Referrer (if applicable)
  → Remaining → to bonding curve / Uniswap V4 pool
```

Our platform fee is **0.5%** (50 bps), lower than typical platform fees. We collect it via the Uniswap V4 hook on Base.

---

## Testing Compatibility

Use our test suite to verify third-party integration:

```bash
# Run compatibility tests
npx vitest run --testPathPattern="zora-compat" -c vitest.config.ts
```

Test coverage:
- Coin deploys and is discoverable on Zora API
- Coin metadata matches across Zora and DegenFeed
- Vesting parameters correctly reflected
- Cross-chain tokens resolve correctly
- Webhook receives external events

---

## Links

| Resource | URL |
|----------|-----|
| **Zora Coins API** | `https://coins.zora.co/api/v1/` |
| **Zora GraphQL** | `https://api.zora.co/graphql` |
| **ZoraFactory on Base** | `0x777777751622c0d3258f214F9DF38E35BF45baF3` |
| **Uniswap on Base** | `https://app.uniswap.org/swap?chain=base` |
| **DegenFeed Compatibility API** | `/api/zora/compat/` |
| **DegenFeed Coin Launch** | `https://app.degenfeed.xyz/launch` |
| **DegenFeed SDK** | `@degenfeed/zora-sdk` |

---

*Last updated: 2026-07-20*
*See also: [Cross-Protocol Coins](./cross-protocol-coin.ts), [Zora Video SDK](../packages/zora-sdk/src/index.ts)*
