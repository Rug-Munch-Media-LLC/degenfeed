# Creator Coin System

> **Status:** 🟢 Architecture defined, contracts compiled, SDK built
> **Phase:** Deploying to testnet (Base Sepolia + Solana Devnet)

## Overview

The Creator Coin system enables any creator on DegenFeed to deploy their own token with bonding curve economics. Each creator gets one coin on their preferred chain (Solana OR Base), with an automatically wrapped version on the other chain for cross-chain liquidity.

### Key Concepts

- **One coin, two chains**: Deploy on Solana (cheaper gas), get a wrapped ERC-20 on Base
- **Bonding curve**: 5-era super-linear curve (not linear) — early buyers get better prices
- **Zora integration**: Base coins appear natively on zora.co via ZoraFactory
- **Live stream boost**: Creator goes live → coin gets temporary discount
- **Graduation**: At 80% supply + 50 unique buyers → curve graduates to AMM pool

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                 DegenFeed Creator Coin System          │
├──────────────────┬────────────────────────────────────┤
│   Solana (primary)│         Base (wrapped)              │
│                   │                                     │
│  ┌─────────────┐  │  ┌──────────────────────────────┐  │
│  │ Anchor Prog │  │  │ DegenFeedCoin (ERC-20)       │  │
│  │ BondingCurve│  │  │ Bonding Curve + Flash Sales  │  │
│  │ Creator Vest│  │  │ Live Oracle Integration      │  │
│  │ Live Oracle │  │  │ Cross-Chain Bridge           │  │
│  └──────┬──────┘  │  └──────────┬───────────────────┘  │
│         │         │             │                       │
│         └──Wormhole VAA─────────┘                       │
│                                                          │
│  ┌─────────────┐  │  ┌──────────────────────────────┐  │
│  │ Jupiter DEX │  │  │ Uniswap V4 / Zora            │  │
│  │ SOL Pairs   │  │  │ ETH Pairs                    │  │
│  └─────────────┘  │  └──────────────────────────────┘  │
└──────────────────┴────────────────────────────────────┘
```

### Contract Components

| Component | Solana | Base |
|-----------|--------|------|
| Token | SPL Token (Anchor) | DegenFeedCoin (ERC-20) |
| Bonding Curve | On-chain in program | In-contract (Solidity) |
| Factory | N/A (direct deploy) | DegenFeedFactory (CREATE2) |
| Live Oracle | LiveStreamOracle PDA | LiveStreamOracle contract |
| Bridge | Burn instruction | WrappedTokenBridge |
| Registry | N/A | CrossChainRegistry |

---

## Fee Structure

| Fee | Amount | Recipient |
|-----|--------|-----------|
| Platform fee | 0.5% (50 bps) | DegenFeed treasury |
| Creator fee | 0-2% (0-200 bps) | Creator wallet |
| Referral fee | 0.05% (5 bps) | Referrer |
| Max total | 2.5% (250 bps) | — |
| Token gen fee | $20 one-time | DegenFeed |

All fees collected in native currency (SOL on Solana, ETH on Base).

---

## Smart Contracts (Base/EVM)

### DegenFeedCoin.sol
- **Address (Base Sepolia):** TBD
- **Address (Base Mainnet):** TBD
- **Source:** `packages/creator-coin/contracts/src/DegenFeedCoin.sol`

Core ERC-20 token with:
- Dynamic bonding curve (5 eras)
- Flash sales (time-limited discounts)
- Creator events (post-triggered discounts)
- Live stream boost (oracle-driven)
- Buy streak system
- Referral bonuses
- Creator vesting (customizable)
- Anti-snipe phase limits
- Burn mechanism
- Cross-chain bridge integration

### DegenFeedFactory.sol
- **Address (Base Sepolia):** TBD
- **Source:** `packages/zora-sdk/src/contracts/DegenFeedFactory.sol`

CREATE2 factory for deploying DegenFeedCoin deterministically.

### WrappedTokenBridge.sol
- **Address (Base Sepolia):** TBD
- **Source:** `packages/creator-coin/contracts/src/WrappedTokenBridge.sol`

Mints/burns wrapped ERC-20 tokens based on Wormhole VAAs from Solana.

### LiveStreamOracle.sol
- **Address (Base Sepolia):** TBD
- **Source:** `packages/creator-coin/contracts/src/LiveStreamOracle.sol`

Tracks creator live status and applies boost discounts to coin prices.

### CrossChainRegistry.sol
- **Address (Base Sepolia):** TBD
- **Source:** `packages/zora-sdk/src/contracts/CrossChainRegistry.sol`

Maps creator identities across chains for unified lookups.

---

## Anchor Program (Solana)

### Program ID
- **Devnet:** `DFCCrTn111111111111111111111111111111111111`
- **Mainnet:** TBD
- **Source:** `packages/creator-coin/src/solana/program/programs/degenfeed-creator-token/src/lib.rs`

### Instructions

| Instruction | Description |
|-------------|-------------|
| `createToken` | Deploy a new creator SPL token with bonding curve |
| `buyTokens` | Buy tokens from the bonding curve |
| `sellTokens` | Sell tokens back to the bonding curve |
| `setLiveOracle` | Register live stream oracle |
| `burnForBridge` | Burn tokens to bridge to Base |

### Accounts

| Account | Description |
|---------|-------------|
| `TokenState` | Token metadata, supply, fees |
| `BuyerState` | Per-wallet buy tracking |
| `VestingVault` | Creator vesting schedule |
| `PlatformFeeVault` | Collected platform fees |

---

## TypeScript SDK

### Package: `@degenfeed/creator-coin`

```ts
import { CreatorCoinClient } from '@degenfeed/creator-coin';

const client = new CreatorCoinClient({
  solanaKeypair: myKeypair,
  evmPrivateKey: '0x...',
});

// Deploy dual-chain coin
const coin = await client.deployCoin({
  name: 'Alice Coin',
  symbol: 'ALICE',
  uri: 'ipfs://...',
  creator: 'AlicePubkey',
  chain: 'solana',
  creatorAllocationBps: 500,
  creatorFeeBps: 100,
}, true); // cross-chain = true
```

### Module Exports

| Import Path | Contents |
|-------------|----------|
| `@degenfeed/creator-coin` | Unified client + all exports |
| `@degenfeed/creator-coin/client` | CreatorCoinClient |
| `@degenfeed/creator-coin/evm` | CreatorCoinEVMClient |
| `@degenfeed/creator-coin/solana` | CreatorCoinSolanaClient |
| `@degenfeed/creator-coin/cross-chain` | CrossChainBridge |
| `@degenfeed/creator-coin/live-stream` | LiveStreamMonitor |
| `@degenfeed/creator-coin/bonding-curve` | Curve math functions |
| `@degenfeed/creator-coin/fees` | Fee calculations |
| `@degenfeed/creator-coin/types` | All TypeScript types |

---

## Frontend Components

### CreatorCoinDashboard
Main dashboard (`/creator/coins`) showing all creator coins, deploy button, and per-coin detail view.

### CoinCard
Summary card showing token info, price, progress bar, and live status badge.

### TradePanel
Buy/sell interface with amount input, slippage control, and live boost indicator.

### BondingCurveChart
SVG chart visualizing the 5-era bonding curve with current position.

### DeployCoinDialog
Modal for creating a new coin with chain selection, fee sliders, and cost estimate.

### LiveIndicator
"Creator is LIVE" badge shown during active streams.

---

## Live Video Integration

When a creator goes live on a supported platform, their coin gets a temporary discount:

| Feature | Detail |
|---------|--------|
| Boost discount | 2% (200 bps) |
| Duration | While live + auto-expire after 2h |
| Platforms | PeerTube, Owncast, Twitch, YouTube |
| How it works | Oracle contract tracks live status |
| On-chain | `LiveStreamOracle.getBoost(creatorKey)` |

### Supported Platforms

```ts
import { LiveStreamMonitor, SUPPORTED_PLATFORMS } from '@degenfeed/creator-coin/live-stream';

const monitor = new LiveStreamMonitor();

monitor.startMonitoring(
  'creator-id',
  'peertube',
  'https://peertube.instance.com',
  (info) => {
    if (info.isLive) {
      console.log(`Creator is live! ${info.title}`);
      // Apply boost to coin price
    }
  },
);
```

---

## Deployment Guide

### Prerequisites

```bash
# Tools
forge --version      # Foundry (Solidity compiler)
anchor --version     # Anchor (Solana framework)
node --version       # Node.js >= 18

# Environment variables
export PRIVATE_KEY=0x...              # Deployer key
export BASE_RPC_URL=https://sepolia.base.org
export SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Deploy EVM Contracts

```bash
cd packages/creator-coin/contracts

# Compile
forge build

# Deploy DegenFeedFactory
forge create \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  src/DegenFeedFactory.sol:DegenFeedFactory \
  --constructor-args $DEPLOYER $DEPLOYER

# Deploy LiveStreamOracle
forge create \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  src/LiveStreamOracle.sol:LiveStreamOracle \
  --constructor-args $DEPLOYER

# Deploy WrappedTokenBridge
forge create \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  src/WrappedTokenBridge.sol:WrappedTokenBridge \
  --constructor-args $DEPLOYER "[$DEPLOYER]" 1

# Deploy CrossChainRegistry
forge create \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  src/CrossChainRegistry.sol:CrossChainRegistry \
  --constructor-args $DEPLOYER
```

### Deploy Anchor Program

```bash
cd packages/creator-coin/src/solana/program

anchor build
anchor deploy --provider.cluster devnet
```

### Update SDK Addresses

After deployment, update contract addresses in:
- `packages/creator-coin/src/evm/client.ts`
- `packages/creator-coin/src/index.ts`

---

## Security

### Audited Patterns
- ✅ Reentrancy guard (mutex pattern)
- ✅ CEI (Checks-Effects-Interactions) on all state changes
- ✅ No delegatecall or selfdestruct
- ✅ CREATE2 salt prevents frontrunning
- ✅ Phase-based buy limits (anti-snipe)
- ✅ Cooldown between buys
- ✅ Max 15% per wallet holding
- ✅ Graduation conditions prevent manipulation
- ✅ Fee caps (max 2.5% total)
- ✅ Pull over push for fee distribution

### Cross-Chain Security
- ✅ Wormhole VAA verification for bridge operations
- ✅ Guardian threshold for attestation
- ✅ Nonce-based replay protection
- ✅ Pausable bridge in emergencies

### Live Oracle Security
- ✅ Authorized updaters only
- ✅ Rate-limited status changes (5 min cooldown)
- ✅ Auto-expiry after 2 hours
- ✅ Boost capped at 5% max

---

## Testnet Addresses

> Will be populated after testnet deployment

| Contract | Base Sepolia | Solana Devnet |
|----------|-------------|---------------|
| DegenFeedFactory | TBD | N/A |
| DegenFeedCoin | TBD (CREATE2) | N/A |
| WrappedTokenBridge | TBD | N/A |
| LiveStreamOracle | TBD | TBD (PDA) |
| CrossChainRegistry | TBD | N/A |
| Anchor Program | N/A | `DFCCrTn...` |

---

## Roadmap

### Phase 1 (Current)
- [x] Bonding curve math (TypeScript + Solidity + Rust)
- [x] Creator coin deployment (Base + Solana)
- [x] Buy/sell trading
- [ ] Testnet deployment
- [ ] Frontend integration

### Phase 2
- [ ] Flash sales and creator events
- [ ] Live stream oracle integration
- [ ] Cross-chain bridge (Wormhole)
- [ ] Graduation to AMM (Uniswap V4 / Jupiter)

### Phase 3
- [ ] Top holder rewards
- [ ] Recurring buys
- [ ] Price alerts
- [ ] Mobile support

---

## Glossary

| Term | Definition |
|------|------------|
| Bonding Curve | Mathematical curve that determines token price based on supply |
| Era | Phase of the bonding curve with different steepness |
| Graduation | When 80% supply + 50 buyers reached; curve closes for AMM |
| Flash Sale | Time-limited price discount started by creator |
| Creator Event | Post-triggered discount for next N buys |
| Live Boost | Temporary price discount during creator's live stream |
| VAA | Verified Action Approval (Wormhole attestation) |
| Wrapped Token | ERC-20 on Base representing an SPL token from Solana |
