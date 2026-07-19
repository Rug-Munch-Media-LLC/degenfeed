# DegenFeed Protocol — Migration from Zora CreatorCoin

> **Date:** 2026-07-20
> **Status:** ☑️ Contracts compiled, NOT YET DEPLOYED
> **Base Chain ID:** 8453
> **Target Solidity:** `0.8.26` (cancun EVM)

---

## Why We Forked

Zora's CreatorCoin protocol pioneered on-chain creator tokens, but its architecture
has several limitations for our use case on DegenFeed:

| Zora Original | DegenFeed Fork | Rationale |
|---------------|----------------|-----------|
| ZORA token as pair currency (`0x1111…`) | **ETH** as native pair currency | Universal accessibility — no ZORA token required |
| 1% hardcoded protocol fee | **0.5% platform fee** + creator sets 0-2% + referrer 0-0.05% | Lower fees, flexible split, referral incentives |
| Zora protocol rewards split | **Our fee split** to platform + creator + referrer | Revenue stays in the DegenFeed ecosystem |
| No anti-exploit guards | **Phase limits, cooldowns, max 15% holder** | Prevents sniping, bundling, and whale dominance |
| No vesting | **90-day linear vesting + 30-day cliff** | Aligns creator incentives with long-term value |
| No reputation checks | **Optional reputation registry** | Gated creation for trusted creators only |
| Uniswap V4 integration | **Uniswap V4 ready** (same pool architecture) | Compatible — just different pair token |

---

## What Is Compatible

- **Uniswap V4 pools** — Same pool deployment flow. The coin's graduation
  (80% supply + 50 unique buyers) triggers the same post-curve Uniswap V4
  pool bootstrapping. The only difference is the pool pairs against ETH
  instead of ZORA.
- **Base chain** — Both deploy on Base (8453). Same RPCs, same explorers.
- **CREATE2 deterministic deployment** — Same pattern. Coins have
  deterministic addresses based on creator + name + symbol.
- **ERC-20 interface** — Standard `transfer`, `approve`, `transferFrom`,
  `balanceOf`. Any existing Zora integration using these methods will work.
- **Bonding curve mechanics** — Same linear bonding curve (price increases
  as tokens are minted). Our curve ranges from **1 gwei → 1000 gwei**
  (vs Zora's which was ZORA-denominated).

---

## What Changed (Breaking)

### 1. Factory Address

**Zora:**
```ts
import {deployCreatorCoin, getCreatorClient} from '@zoralabs/protocol-sdk';
```

**DegenFeed:**
```ts
import {createCoinClient} from '@degenfeed/zora-sdk';
// Factory: to be deployed — see DEPLOY-CONTRACT.md
const DEGENFEED_FACTORY = '0x...';
```

### 2. Pair Currency

All bonding curve prices are now in **ETH (wei)**, not ZORA tokens.

```diff
- // Zora: buy with ZORA tokens
- const price = await coin.zoraPrice();
+ // DegenFeed: buy with ETH
+ const price = await publicClient.readContract({
+   address: coinAddress,
+   abi: DEGENFEED_COIN_ABI,
+   functionName: 'getCurrentPrice',
+ });
```

### 3. Fee Model

```diff
- // Zora: 1% hardcoded fee, all to protocol
- uint256 fee = msg.value / 100; // 1%
+ // DegenFeed: configurable fees
+ uint256 platformFee = (amount * platformFeeBps) / 10000;  // 0.5% default
+ uint256 creatorFee  = (amount * creatorFeeBps) / 10000;   // 0-2%
+ uint256 referralFee = (amount * REFERRAL_FEE_BPS) / 10000; // 0-0.05%
```

### 4. Creator Vesting

**Zora:** Creators received their allocation immediately.

**DegenFeed:**
- 30-day cliff — no tokens claimable before 30 days
- 90-day linear vesting after cliff
- Total allocation: creator sets 0-15% of 1B supply

Run `claimVested()` after the cliff to receive tokens.

### 5. Anti-Exploit Guards (New)

| Guard | Detail |
|-------|--------|
| **Phase limits** | 0-5 min: 2% max buy → 5-30 min: 5% → 30 min-24h: 10% → 24h+: 15% |
| **Buy cooldown** | 60 seconds between buys per wallet |
| **Max holder** | No wallet can hold >15% of total supply |
| **Minimum initial buy** | 0.05 ETH (prevents dust deployments) |

### 6. ABI Changes

Zora's coin ABI included `zoraPrice()`, `zoraFee()`, `protocolRewards()`.
These are replaced with:

- `getCurrentPrice()` → ETH-denominated price
- `buy(uint256 minOut)` → pay with ETH
- `sell(uint256 tokenAmount, uint256 minOut)` → receive ETH
- `claimVested()` → creator vesting
- `curveLiquidity()` → ETH in bonding curve

See `src/index.ts` for the full ABI.

---

## Migration Guide for Existing Zora Creators

### If you have an existing Zora token and want to migrate:

1. **Create a new DegenFeed coin** via the factory. Your old Zora coin
   remains on-chain — this is a new token, not an upgrade.

2. **Announce the migration** to your community. Share the new coin address
   and explain the improved economics (lower fees, ETH pair, vesting).

3. **Optional: Bridge liquidity** — After your new coin graduates,
   provide ETH/coin liquidity on Uniswap V4. You can leave your old Zora
   coin's liquidity in place or migrate it.

4. **Update your frontend** — Replace `@zoralabs/protocol-sdk` imports
   with `@degenfeed/zora-sdk`:

```ts
// Before (Zora)
import { deployCreatorCoin, getCreatorClient } from '@zoralabs/protocol-sdk';

// After (DegenFeed)
import { createCoinClient } from '@degenfeed/zora-sdk';

const client = createCoinClient({ walletClient, publicClient });

const { coinAddress } = await client.createCoin({
  name: 'My Token',
  symbol: 'MYC',
  uri: 'https://example.com/metadata.json',
  creatorAllocationPercent: 5,   // 5% to creator
  creatorFeeBps: 50,             // 0.5% creator fee on trades
  initialBuyAmount: '0.05',      // Minimum 0.05 ETH
});
```

---

## Contract Addresses

| Contract | Base Mainnet | Notes |
|----------|--------------|-------|
| `DegenFeedFactory` | `0x...` | Deploy via `forge create` |
| `DegenFeedCoin` | Deterministic (CREATE2) | First coin at predictable address |
| Reputation Registry | `address(0)` (optional) | Set after deployment if desired |

*Addresses will be populated after deployment — see DEPLOY-CONTRACT.md.*

---

## Deployment Checklist

- [ ] `forge install OpenZeppelin/openzeppelin-contracts --no-git`
- [ ] `forge build` — compiles both contracts
- [ ] Deploy `DegenFeedFactory` to Base
- [ ] Verify on Basescan
- [ ] Update `DEGENFEED_FACTORY_ADDRESS` in `src/index.ts`
- [ ] Test with `cast` — create a coin, buy, sell
- [ ] Optional: deploy reputation registry
- [ ] Optional: set factory fee config
- [ ] Announce to community
