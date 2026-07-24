# Creator Coin Free Posting — Zero-Gas Guide

> **Goal:** Post/announce creator coins on Zora, Lens, and Farcaster without paying gas fees.
> **Status:** Research complete — gasless paths identified for each platform.

---

## Overview

| Platform | Gasless Posting? | Account Required? | One-Time Cost | Per-Post Cost |
|----------|-----------------|-------------------|---------------|---------------|
| **Zora** | ❌ Coins need gas | Wallet (any EVM) | ~$0.02-0.10 gas | ~$0.02-0.10 gas |
| **Zora 1155 NFTs** | ✅ Premint (gasless) | Wallet | $0 (creator) | Gas paid by minter |
| **Lens (Momoka)** | ✅ Gasless | Lens Profile | Profile creation | **$0** |
| **Lens Chain** | ✅ Native gasless | Lens Profile | Profile creation | **$0** |
| **Farcaster (Hubble)** | ✅ After FID | FID + Signer | ~$0.25 (one-time) | **$0** |
| **Farcaster (Neynar)** | ✅ Free tier | Neynar API Key | $0 (sponsored) | 150 credits/cast |

---

## 1. Zora — Coin Creation (Minimal Gas)

### Reality Check
Zora's **2026 Coins Protocol** deploys ERC-20z tokens on **Base** (L2). On-chain gas IS required for deployment because the contract must be created. However:

- **Gas is on Base L2**: ~$0.02-0.10 per coin — NOT Ethereum mainnet gas
- **No ETH needed alongside**: `createCoinCall()` returns `value: 0n` — you only pay gas
- **Zora 1155 premints ARE gasless**: For NFT-style tokens, use the premint system

### How to Minimize Cost

```ts
import { prepareZoraCoinCreation, estimateZoraCoinGas } from '@degenfeed/creator-coin/zora-free';

// Step 1: Prepare creation (no gas yet)
const prepared = await prepareZoraCoinCreation({
  creator: '0x...',
  name: 'My Coin',
  symbol: 'MYCOIN',
  uri: 'ipfs://...',
});

// Step 2: Estimate gas cost
const estimate = await estimateZoraCoinGas(prepared.calls);
console.log(`Cost: ~${estimate.totalCostEth} ETH (~$${estimate.totalCostUsd})`);

// Step 3: Send via any wallet — only gas needed, no ETH value
```

### Gas Sponsorship Options

| Option | How It Works | Cost |
|--------|-------------|------|
| **ERC-4337 Paymaster** | Use a paymaster to sponsor gas | Sponsor pays (~$0.05) |
| **DegenFeed sponsorship** | Backend covers gas via relay | Free for creator |
| **Self-pay** | User pays gas directly | ~$0.02-0.10 |
| **Base Gasless RPC** | Some RPCs offer gasless txs | Limited availability |

### Key SDK: `@zoralabs/coins-sdk`

The `createCoinCall()` function returns:
```ts
{
  calls: Array<{ to: Address; data: Hex; value: bigint }>,  // value is 0n!
  predictedCoinAddress: Address, // deterministic — known before deployment
}
```

---

## 2. Lens — Gasless Posting via Momoka ✅

### Best Free Option

**Momoka** is Lens's Optimistic L3 scaling solution that processes transactions **entirely off-chain**:

> "DA operations don't require gas, making them free to use."
> — Lens Protocol Docs

### How It Works

1. Creator signs a publication (off-chain signature)
2. Submission goes to Lens API → stored on **Arweave** via **Bundlr**
3. Anyone can verify the publication using DA proofs
4. Cost to store: ~1000x cheaper than EVM gas (paid by Lens, not the creator)

### Requirements for Momoka Posts

- ✅ Reference policy must be `ANYONE` (default)
- ✅ No open actions (collects, mirrors with modules)
- ✅ Profile must be authenticated
- ❌ Momoka rate limits reduced to 0 (Lens Chain migration)
- ⚠️ **Lens Chain** is now live — posting is natively gasless there

### For Lens Chain (Current ✅)

Lens Chain posts are **natively gasless**:
```
mutation Post($request: PostRequest!) {
  post(request: $request) {  # Set sponsored: true — free
    ... on RelaySuccess { txId }
  }
}
```

### Implementation

```ts
import { LensFreePostClient } from '@degenfeed/creator-coin/lens-free';

const lens = new LensFreePostClient({
  accessToken: '...',  // Get via SIWE / Lens login
});

// Post a creator coin — FREE, no gas
const result = await lens.postCreatorCoin({
  profileId: '0x...',
  coinName: 'My Coin',
  coinSymbol: 'MYCOIN',
  coinAddress: '0x...',
  description: 'Brand new creator coin on DegenFeed!',
});
```

### Limitations

| Limitation | Detail |
|-----------|--------|
| Profile creation cost | One-time gas fee to create Lens profile |
| Momoka posts cannot have collects | Must be simple text posts |
| Rate limits | Previously reduced; Lens Chain recommended |
| Content size | Must fit within Lens publication limits |

---

## 3. Farcaster — Free Cast Posting ✅

### Cost Breakdown

| Cost Type | Amount | Who Pays | Free? |
|-----------|--------|----------|-------|
| FID Registration | ~$0.20 (Optimism) | User (one-time) | ❌ |
| Signer Creation | ~$0.05 (Optimism) | **Neynar sponsors** | ✅ |
| Storage Rent | $0 (after registration) | N/A | ✅ |
| **Posting a cast** | **$0** | **Nobody** | **✅** |

### Option A: Hubble (Self-Hosted) — Completely Free

The DegenFeed fleet has access to **public Hubble nodes** and can run its own. Posting to your own Hubble is **unlimited and free**:

```ts
import { FarcasterFreePostClient } from '@degenfeed/creator-coin/farcaster-free';
import { HubClient } from '@degenfeed/farcaster-sdk';

const poster = new FarcasterFreePostClient({
  mode: 'hubble',
  fid: 1234,               // Your FID
  signerPrivateKey: '0x...', // Your signer private key
  hubClient: new HubClient('https://hub.farcaster.standardcrypto.vc:2281'),
});

const result = await poster.postCreatorCoin({
  coinName: 'My Coin',
  coinSymbol: 'MYCOIN',
  coinAddress: '0x...',
  description: 'Powered by DegenFeed 🪙',
});
```

**Existing infrastructure:**
- `HubClient` already exists in `@degenfeed/farcaster-sdk`
- `buildFarcasterCastMessage` handles protobuf encoding + signing
- Multiple fallback hub URLs configured

### Option B: Neynar Free Tier — Free Tier Credits

Neynar provides a **free API tier** with 25,000 credits:

```ts
const poster = new FarcasterFreePostClient({
  mode: 'neynar',
  neynarApiKey: process.env.NEYNAR_API_KEY,
  neynarSignerUuid: '...', // Get via SIWN flow
});

// Each cast costs 150 credits = ~166 free casts
```

**Free tier limits:**
- 25,000 initial credits
- 150 credits per POST cast
- Signer creation: **Sponsored by Neynar** (user pays $0)
- Free tier available at [neynar.com](https://neynar.com)

### Option C: x402 Micropayments — Gasless USDC

For programmatic agents, x402 allows gasless posting using EIP-3009:
- User signs a USDC `transferWithAuthorization` (no gas needed)
- Costs 0.001 USDC per call to Neynar's hub
- No ETH needed for gas — just USDC signature

---

## 4. Comparison Matrix

### Cost per Operation

| Operation | Zora | Lens | Farcaster |
|-----------|------|------|-----------|
| Account creation | $0 (any EVM wallet) | Gas (~$0.50) | ~$0.25 (one-time) |
| Coin deploy (on-chain) | ~$0.05 gas | N/A | N/A |
| Post announcement | $0 (on existing coin) | **$0** (Momoka) | **$0** (Hubble) |
| Monthly unlimited posting | $0 (own wallet) | **$0** | **$0** (Hubble) |
| Relayer/sponsor available | ERC-4337 paymasters | Lens API sponsorship | Neynar sponsorship |

### Free vs Paid Tradeoffs

| Platform | Free Method | Tradeoff |
|----------|------------|----------|
| Zora | Self-pay gas (~$0.05) | Still costs pennies, not truly free |
| Zora 1155 | Premint (gasless creation) | Only NFTs, not fungible coins |
| Lens Momoka | Gasless posting | Rate limited, no collects |
| Lens Chain | Native gasless | Must be on Lens Chain |
| Farcaster Hubble | Free self-hosted | Need own Hubble node |
| Farcaster Neynar | Free tier (166 posts) | Limited credits, then paid |

---

## 5. Recommended Architecture

For maximum free posting, use this multi-platform strategy:

```
Creator Coin Deployed on Base (ZoraFactory)
  → Gas cost: ~$0.05 (covered by DegenFeed relay or user)
  ↓
ANNOUNCE ON ALL PLATFORMS FOR FREE:
  → Lens: Momoka gasless post
  → Farcaster: Hubble cast (self-hosted = free)
  → Zora: Coin appears automatically on zora.co
```

### DegenFeed Can Sponsor Zora Gas

Since Base L2 gas is so cheap (~$0.05), DegenFeed can:
1. Maintain a relayer wallet with ~0.1 ETH (~$300)
2. Sponsor ~6,000 coin deployments
3. Recover costs via the 0.5% platform fee on trades

---

## 6. Module Reference

| File | Platform | Gasless? | Key Class |
|------|----------|----------|-----------|
| `packages/creator-coin/src/zora-free.ts` | Zora / Base | ⚠️ Minimal gas | `prepareZoraCoinCreation()` |
| `packages/creator-coin/src/lens-free.ts` | Lens / Momoka | ✅ Truly free | `LensFreePostClient` |
| `packages/creator-coin/src/farcaster-free.ts` | Farcaster | ✅ Free after FID | `FarcasterFreePostClient` |

### Import Paths

```ts
// Zora gas-efficient coin creation
import { prepareZoraCoinCreation } from '@degenfeed/creator-coin/zora-free';

// Lens gasless posting (Momoka)
import { LensFreePostClient } from '@degenfeed/creator-coin/lens-free';

// Farcaster free casting
import { FarcasterFreePostClient } from '@degenfeed/creator-coin/farcaster-free';
```

---

## 7. Quick Start: Post a Coin Everywhere for Free

```ts
import { prepareZoraCoinCreation } from '@degenfeed/creator-coin/zora-free';
import { LensFreePostClient } from '@degenfeed/creator-coin/lens-free';
import { FarcasterFreePostClient } from '@degenfeed/creator-coin/farcaster-free';

async function launchCoinForFree(name: string, symbol: string, uri: string, creatorAddress: string) {
  // 1. Prepare Zora coin creation (gas when sent)
  const zora = await prepareZoraCoinCreation({
    creator: creatorAddress as `0x${string}`,
    name,
    symbol,
    uri,
  });
  console.log(`Predicted address: ${zora.predictedCoinAddress}`);
  console.log(`Estimated gas: ~${(await estimateZoraCoinGas(zora.calls)).totalCostEth} ETH`);

  // 2. Announce on Lens (free via Momoka)
  const lens = new LensFreePostClient({ accessToken: '...' });
  const lensPost = await lens.postCreatorCoin({
    profileId: '0x...',
    coinName: name,
    coinSymbol: symbol,
    coinAddress: zora.predictedCoinAddress,
    description: `Just launched ${name} on DegenFeed!`,
  });
  console.log(`Lens post: ${lensPost.momokaUrl}`);

  // 3. Announce on Farcaster (free via Hubble)
  const fc = new FarcasterFreePostClient({
    mode: 'hubble',
    fid: 1234,
    signerPrivateKey: '0x...',
  });
  const fcPost = await fc.postCreatorCoin({
    coinName: name,
    coinSymbol: symbol,
    coinAddress: zora.predictedCoinAddress,
  });
  console.log(`Farcaster cast: ${fcPost.url}`);
}
```

---

## 8. Links & References

| Platform | Documentation | Free Method Docs |
|----------|--------------|------------------|
| Zora Coins SDK | [docs.zora.co/coins/sdk](https://docs.zora.co/coins/sdk/create-coin) | `createCoinCall()` returns value: 0n |
| Zora 1155 Premints | [nft-docs.zora.co](https://nft-docs.zora.co/protocol-sdk/creator/premint) | Gasless creation for NFTs |
| Lens Momoka | [docs.lens.xyz](https://docs.lens.xyz/docs/momoka) | "DA operations don't require gas" |
| Lens Chain | [lens.xyz/faq](https://lens.xyz/faq) | "You don't need GHO to post" |
| Farcaster + Neynar | [docs.neynar.com](https://docs.neynar.com) | Free tier + sponsored signers |
| Farcaster Hubble | [github.com/farcasterxyz/hub](https://github.com/farcasterxyz/hub-monorepo) | Self-hosted = free posting |

---

*Last updated: 2026-07-25*
*See also: [CREATOR_COINS.md](./CREATOR_COINS.md), [ZORA_COMPATIBILITY.md](./ZORA_COMPATIBILITY.md)*
