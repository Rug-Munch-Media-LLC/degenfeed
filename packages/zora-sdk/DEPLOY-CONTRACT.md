# DegenFeed Factory — Contract Deployment Guide

> **Status:** 🟡 Contracts compiled, NOT YET DEPLOYED
> **Deployer:** Set `PRIVATE_KEY` in `.env` + fund wallet with ~0.05 ETH on Base

---

## Prerequisites

| Tool | Required | Check |
|------|----------|-------|
| Foundry (`forge`) | ✅ Yes | `which forge` → `/usr/local/bin/forge` (v1.7.1) |
| OpenZeppelin contracts | ✅ Yes | `forge install OpenZeppelin/openzeppelin-contracts --no-git` |
| Deployer private key | ✅ Yes | `$PRIVATE_KEY` env var (0x-prefixed hex) |
| Base RPC URL | ✅ Yes | `$BASE_RPC_URL` env var |
| Explorer API key | 🔶 For verification | `$EXPLORER_API_KEY` env var (Basescan) |
| Deployer ETH balance | ✅ Required | ≥ 0.05 ETH on Base |
| Deployer address | ✅ Required | Derive from private key |

---

## Install Dependencies

```bash
# From monorepo root:
cd packages/zora-sdk

# Install OpenZeppelin contracts (required for ERC20 + Ownable)
forge install OpenZeppelin/openzeppelin-contracts --no-git

# Verify
ls lib/openzeppelin-contracts/contracts/token/ERC20/
```

> **Note:** Our contracts implement ERC20 and Ownable inline to minimize
> external dependencies. The OZ install is optional unless you want to
> use OZ libraries in tests or upgrades.

---

## Compile

```bash
cd packages/zora-sdk
forge build
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 2 files with Solc 0.8.26
[⠑] Solc 0.8.26 finished in 2.34s
Compiler run successful!
```

---

## Quick Deploy (Base Mainnet)

```bash
cd packages/zora-sdk

# 1. Ensure env vars are set
export PRIVATE_KEY=0x...              # Deployer wallet key
export BASE_RPC_URL=https://mainnet.base.org
export EXPLORER_API_KEY=...           # Basescan API key
export DEPLOYER_ADDRESS=0x...         # Derived from PRIVATE_KEY

# 2. Compile (verify)
forge build

# 3. Deploy the Factory
# Constructor args: owner, platformFeeReceiver
# During first deploy, both can be the deployer address
forge create \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  src/contracts/DegenFeedFactory.sol:DegenFeedFactory \
  --constructor-args "$DEPLOYER_ADDRESS" "$DEPLOYER_ADDRESS"

# 4. Note the deployed address and verify on Basescan
forge verify-contract <DEPLOYED_ADDRESS> \
  src/contracts/DegenFeedFactory.sol:DegenFeedFactory \
  --chain-id 8453 \
  --etherscan-api-key "$EXPLORER_API_KEY" \
  --constructor-args "$(cast abi-encode "constructor(address,address)" "$DEPLOYER_ADDRESS" "$DEPLOYER_ADDRESS")"
```

---

## Post-Deploy Steps

### 1. Update the SDK

After deployment, update the factory address in `src/index.ts`:

```ts
// packages/zora-sdk/src/index.ts
export const DEGENFEED_FACTORY_ADDRESS: Address = '0x<DEPLOYED_ADDRESS>';
```

### 2. Configure the Factory

After deployment, the factory owner can:

```bash
# Set platform fee (default 50 bps = 0.5%)
cast send <FACTORY> "setPlatformFeeBps(uint256)" 50 \
  --private-key "$PRIVATE_KEY" --rpc-url "$BASE_RPC_URL"

# Update platform fee receiver (e.g., treasury multisig)
cast send <FACTORY> "setPlatformFeeReceiver(address)" 0x... \
  --private-key "$PRIVATE_KEY" --rpc-url "$BASE_RPC_URL"

# Set max creator fee (default 200 bps = 2%)
cast send <FACTORY> "setMaxCreatorFeeBps(uint256)" 200 \
  --private-key "$PRIVATE_KEY" --rpc-url "$BASE_RPC_URL"
```

### 3. Create a Test Coin

```bash
# Predict the coin address first
cast call <FACTORY> "predictCoinAddress(address,string,string)" \
  "$DEPLOYER_ADDRESS" "TestCoin" "TST" \
  --rpc-url "$BASE_RPC_URL"

# Create a coin with 0.05 ETH initial buy
cast send <FACTORY> "createCoin(string,string,string,uint256,uint256,address)" \
  "TestCoin" "TST" "https://example.com/token.json" \
  500 `# 5% creator allocation` \
  50  `# 0.5% creator fee` \
  0x0000000000000000000000000000000000000000 `# no referrer` \
  --value 0.05ether \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_RPC_URL"

# Check the coin was created
cast call <FACTORY> "totalCoins()(uint256)" --rpc-url "$BASE_RPC_URL"
```

### 4. Test Buy/Sell on the Coin

```bash
# Get current price
COIN=0x...  # From factory creation event
cast call $COIN "getCurrentPrice()(uint256)" --rpc-url "$BASE_RPC_URL"

# Buy 0.01 ETH worth of tokens
cast send $COIN "buy(uint256)" 0 \
  --value 0.01ether \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_RPC_URL"

# Check balance
cast call $COIN "balanceOf(address)(uint256)" $DEPLOYER_ADDRESS --rpc-url "$BASE_RPC_URL"

# Sell half the tokens
cast send $COIN "sell(uint256,uint256)" \
  $(cast call $COIN "balanceOf(address)(uint256)" $DEPLOYER_ADDRESS --rpc-url "$BASE_RPC_URL")/2 \
  0 \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$BASE_RPC_URL"
```

---

## Testnet Deploy (Base Sepolia)

```bash
cd packages/zora-sdk
export BASE_RPC_URL=https://sepolia.base.org
forge create \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  src/contracts/DegenFeedFactory.sol:DegenFeedFactory \
  --constructor-args "$DEPLOYER_ADDRESS" "$DEPLOYER_ADDRESS"
```

Get Sepolia ETH: https://www.alchemy.com/faucets/base-sepolia

---

## Chain Info

| Property | Value |
|----------|-------|
| Chain | Base |
| Chain ID | 8453 |
| Mainnet RPC | `https://mainnet.base.org` |
| Sepolia RPC | `https://sepolia.base.org` |
| Explorer | https://basescan.org |
| Native currency | ETH (18 decimals) |
| Target Solidity | 0.8.26 |
| EVM version | Cancun |

---

## Security Notes

- **Factory owner controls**: fee rates, fee receiver, pausing, reputation registry.
  Transfer to a multisig after deployment.
- **DegenFeedCoin** has no admin keys (besides the creator's `transferOwnership`).
  The factory cannot modify deployed coins.
- **No upgradeability** — once deployed, contract logic is immutable.
- **Fee transfers** use `call{gas: 2300}` — if the recipient is a contract that
  reverts, the fee is tracked in `unclaimedFees[]` and can be collected later
  via `collectFees()`.
- **CREATE2 salt** uses `keccak256(creator, name, symbol)` — prevents
  frontrunning. The same creator cannot deploy two coins with the same name/symbol.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `insufficient funds` | Fund deployer wallet with ETH on Base (not L1!) |
| `Failed to decode private key` | Ensure `PRIVATE_KEY` is 0x-prefixed hex (64 chars after 0x) |
| `EIP-1193 chain not found` | Check `BASE_RPC_URL` is correct |
| `Compiler error: PUSH0 not supported` | Use `evm_version = "cancun"` in foundry.toml (Base supports PUSH0) |
| Verification timeout | Wait 30s after deployment, then retry `forge verify-contract` |
| `OpenZeppelin import not found` | Run `forge install OpenZeppelin/openzeppelin-contracts --no-git` |

---

## Post-Deployment Address Book

| Contract | Address |
|----------|---------|
| DegenFeedFactory | ⚠️ Not deployed: run `forge create` above |
| DegenFeedCoin (first) | Determined by CREATE2 |
| ReputationRegistry | Optional: not deployed |

Update these in `src/index.ts` after deployment.
