# DegenFeedTips — Contract Deployment Guide

> **Status:** 🟡 Contract compiled, NOT YET DEPLOYED
> **Deployer:** Set `PRIVATE_KEY` in `.env` + fund wallet with ~0.01 ETH on target L2

## Prerequisites

| Tool | Required | Check |
|------|----------|-------|
| Foundry (`forge`) | ✅ Yes | `which forge` → `/usr/local/bin/forge` (v1.7.1) |
| Deployer private key | ✅ Yes | `$PRIVATE_KEY` env var (0x-prefixed hex) |
| L2 RPC URL | ✅ Yes | `$BASE_RPC_URL` env var |
| Explorer API key | 🔶 For verification | `$EXPLORER_API_KEY` env var (Basescan, Arbiscan, etc.) |
| Deployer ETH balance | ✅ Required | ≥ 0.01 ETH on each target L2 |

## Quick Deploy (Base Mainnet)

```bash
# 0. Navigate to the package directory
cd packages/tip-contract

# 1. Ensure env vars are set
export PRIVATE_KEY=0x...          # Deployer wallet key
export BASE_RPC_URL=https://mainnet.base.org
export EXPLORER_API_KEY=...       # Basescan API key

# 2. Compile (already compiled, but safe to verify)
forge build

# 3. Deploy
forge create \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  src/DegenFeedTips.sol:DegenFeedTips

# 4. Verify on Basescan
forge verify-contract <DEPLOYED_ADDRESS> \
  src/DegenFeedTips.sol:DegenFeedTips \
  --chain-id 8453 \
  --etherscan-api-key "$EXPLORER_API_KEY"
```

## Testnet Deploy (Base Sepolia)

For testing before mainnet:

```bash
cd packages/tip-contract
export BASE_RPC_URL=https://sepolia.base.org
forge create \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  src/DegenFeedTips.sol:DegenFeedTips
```

Get Sepolia ETH from a faucet: https://www.alchemy.com/faucets/base-sepolia

## Multi-Chain Deploy (All L2s)

Deploy to Base → Optimism → Arbitrum in sequence:

```bash
pnpm deploy:tip-contract --all
```

This requires `PRIVATE_KEY` + `EXPLORER_API_KEY` env vars and a wallet funded on all 3 chains.

## Post-Deploy Steps

After each successful deployment:

1. **Copy the deployed address** into `src/index.ts`:
   ```ts
   export const TIP_CONTRACT_ADDRESSES = {
     base: '0x<DEPLOYED_ADDRESS>',      // ← update this
     optimism: '0x0000000000000000000000000000000000000000',
     arbitrum: '0x0000000000000000000000000000000000000000',
   };
   ```

2. **Confirm verification** on the block explorer (check the contract page shows source code).

3. **Test with cast**:
   ```bash
   # Read totalTips (should be 0)
   cast call <ADDRESS> "totalTips()(uint256)" --rpc-url "$BASE_RPC_URL"
   ```

4. **Send a test tip** from a funded wallet:
   ```bash
   # Tip 0.001 ETH
   cast send <ADDRESS> "tip(address)" <RECIPIENT> \
     --value 0.001ether \
     --private-key "$PRIVATE_KEY" \
     --rpc-url "$BASE_RPC_URL"
   ```

## Chain IDs & RPC URLs

| Chain     | Chain ID | Mainnet RPC                      | Explorer              |
|-----------|----------|----------------------------------|-----------------------|
| Base      | 8453     | `https://mainnet.base.org`       | https://basescan.org  |
| Optimism  | 10       | `https://mainnet.optimism.io`    | https://optimistic.etherscan.io |
| Arbitrum  | 42161    | `https://arb1.arbitrum.io/rpc`   | https://arbiscan.io   |

## Contract Details

- **Name:** `DegenFeedTips`
- **License:** MIT
- **Solidity:** `^0.8.20`
- **Fee:** 0% — pure passthrough
- **No admin keys** — no upgradeability, no `selfdestruct`, no `delegatecall`
- **Gas cost per tip:** ~35k gas on Base L2

## Security Notes

- The contract has **no owner**, **no admin**, **no upgrade path**. Once deployed, it's immutable.
- Deployer wallet can be discarded after deployment — no ongoing key management needed.
- Verify the deployed bytecode matches source before using in production:
  ```bash
  forge verify-check <GUID> --etherscan-api-key "$EXPLORER_API_KEY"
  ```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `insufficient funds` | Fund deployer wallet with ETH on the target L2 (not L1!) |
| `Failed to decode private key` | Ensure `PRIVATE_KEY` is 0x-prefixed hex (64 chars after 0x) |
| `EIP-1193 chain not found` | Check `BASE_RPC_URL` is correct for the target chain |
| Verification timeout | Wait 30s after deployment, then retry `forge verify-contract` |
