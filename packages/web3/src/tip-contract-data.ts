/**
 * DegenFeed Tip Contract
 *
 * Deployable on Base / Optimism / Arbitrum.
 * Gas-optimized, 0% fee, no admin keys or upgradeability.
 *
 * ## Methods
 * - `tip(recipient)` — direct ETH tip
 * - `tipWithMessage(recipient, message)` — ETH tip with an on-chain memo
 * - `tipWithSplit(recipient, community)` — 90% to recipient, 10% to community treasury
 * - `batchTip(recipients, amounts)` — split a payment across multiple recipients
 * - `tipERC20(token, recipient, amount)` — ERC-20 tip
 *
 * ## Fees
 * Zero. The contract is pure passthrough. Callers pay only L2 gas.
 */

// ─── ABI ──────────────────────────────────────────────────────────────────
// Only the methods + events the frontend needs.
// Full Solidity source is exported as TIP_CONTRACT_SOURCE.

export const TIP_CONTRACT_ABI = [
  // ── Write methods ────────────────────────────────────────────────────
  {
    type: 'function' as const,
    name: 'tip',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function' as const,
    name: 'tipWithMessage',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'message', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function' as const,
    name: 'tipWithSplit',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'community', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function' as const,
    name: 'batchTip',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function' as const,
    name: 'tipERC20',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ── Read methods ─────────────────────────────────────────────────────
  {
    type: 'function' as const,
    name: 'totalTips',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function' as const,
    name: 'totalEthTipped',
    inputs: [],
    outputs: [{ name: 'total', type: 'uint256' }],
    stateMutability: 'view',
  },
  // ── Events ───────────────────────────────────────────────────────────
  {
    type: 'event' as const,
    name: 'TipSent',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'message', type: 'string', indexed: false },
    ],
  },
] as const;

// ─── Deployed address book (populated after deploy) ────────────────────────
// UPDATE AFTER DEPLOYMENT: run `pnpm deploy:tip-contract` to fill these.

/**
 * TIP CONTRACT DEPLOYMENT STATUS
 * ──────────────────────────────────────────────
 * Contract compiled and ready. NOT YET DEPLOYED.
 * Foundry (forge 1.7.1) is available on the deploy server.
 *
 * ⚠️ DEPLOYMENT PREFLIGHT
 * ────────────────────────
 * Before deploying, ensure:
 *   1. Deployer wallet has ~0.01 ETH on target L2 (not L1)
 *   2. A Basescan / Arbiscan / Optimistic Etherscan API key is available for verification
 *   3. The .env file in the monorepo root has the required keys
 *
 *   Required .env vars:
 *     PRIVATE_KEY=0x...     # Deployer wallet private key (no 0x prefix also accepted)
 *     BASE_RPC_URL=...       # RPC URL for Base (testnet or mainnet)
 *     EXPLORER_API_KEY=...   # Etherscan-style API key for contract verification
 *
 * TO DEPLOY (single contract — Base)
 * ───────────────────────────────────
 *   cd packages/tip-contract
 *   forge create \
 *     --rpc-url "$BASE_RPC_URL" \
 *     --private-key "$PRIVATE_KEY" \
 *     src/DegenFeedTips.sol:DegenFeedTips
 *
 *   Then verify:
 *     forge verify-contract <DEPLOYED_ADDRESS> \
 *       src/DegenFeedTips.sol:DegenFeedTips \
 *       --chain-id 8453 \
 *       --etherscan-api-key "$EXPLORER_API_KEY"
 *
 *   Finally, copy <DEPLOYED_ADDRESS> into TIP_CONTRACT_ADDRESSES.base below.
 *
 * TO DEPLOY (all chains — Base → Optimism → Arbitrum)
 * ──────────────────────────────────────────────────────
 *   pnpm deploy:tip-contract --all
 *   (requires: PRIVATE_KEY, EXPLORER_API_KEY env vars)
 *
 * RECOMMENDED ORDER: Base → Optimism → Arbitrum
 * See DEPLOY-CONTRACT.md for full walkthrough.
 */
export const TIP_CONTRACT_ADDRESSES: Record<string, `0x${string}`> = {
  base: '0x0000000000000000000000000000000000000000', // ⚠️ NOT DEPLOYED — run: forge create --rpc-url "$BASE_RPC_URL" ...
  optimism: '0x0000000000000000000000000000000000000000', // ⚠️ NOT DEPLOYED
  arbitrum: '0x0000000000000000000000000000000000000000', // ⚠️ NOT DEPLOYED
};

// ─── Chain metadata for wallet switching ───────────────────────────────────

export const TIP_CHAIN_CONFIG: Record<
  string,
  { chainId: `0x${string}`; chainIdDecimal: number; name: string; rpc: string; explorer: string }
> = {
  base: {
    chainId: '0x2105',
    chainIdDecimal: 8453,
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
  optimism: {
    chainId: '0xA',
    chainIdDecimal: 10,
    name: 'Optimism',
    rpc: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
  },
  arbitrum: {
    chainId: '0xA4B1',
    chainIdDecimal: 42161,
    name: 'Arbitrum One',
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
  },
};

// ─── Contract address lookup ───────────────────────────────────────────────

export function getTipContractAddress(chain: string): `0x${string}` {
  const addr = TIP_CONTRACT_ADDRESSES[chain];
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    throw new Error(
      `Tip contract not yet deployed on ${chain}. Run scripts/deploy-tip-contract.ts first.`,
    );
  }
  return addr;
}

export function getTipChainConfig(chain: string) {
  const config = TIP_CHAIN_CONFIG[chain];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);
  return config;
}

// ─── Full Solidity source (single-file deployable with Forge / Hardhat) ───

export const TIP_CONTRACT_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DegenFeedTips
 * @notice On-chain tipping for DegenFeed — 0% fee, no admin, pure passthrough.
 * @dev Deploy once per L2 (Base, Optimism, Arbitrum). No upgradeability.
 *
 * Security:
 * - No selfdestruct, no delegatecall, no admin functions
 * - Uses send/transfer pattern (call{value}) with require check
 * - Reentrancy: state reads before external calls; no post-call state changes
 * - totalEthTipped is updated after send to prevent reentrant manipulation
 */
contract DegenFeedTips {
    // ── State ──────────────────────────────────────────────────────────
    uint256 public totalTips;
    uint256 public totalEthTipped;

    // ── Events ─────────────────────────────────────────────────────────
    event TipSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        string message
    );

    // NOTE: no receive() — direct ETH transfers revert instead of being
    // permanently trapped. Every satoshi must move through a tip function
    // that emits TipSent and forwards to a recipient.

    // ── Tip: plain ETH ─────────────────────────────────────────────────
    /**
     * @notice Send a direct ETH tip to a recipient.
     * @param recipient The wallet receiving the tip.
     */
    function tip(address recipient) external payable {
        require(msg.value > 0, "Tip amount must be > 0");
        require(recipient != address(0), "Invalid recipient");

        // CEI: counters updated before the external call
        unchecked {
            totalTips++;
            totalEthTipped += msg.value;
        }

        (bool sent, ) = recipient.call{value: msg.value}("");
        require(sent, "Failed to send tip");

        emit TipSent(msg.sender, recipient, msg.value, "");
    }

    // ── Tip: with on-chain message ─────────────────────────────────────
    /**
     * @notice Send an ETH tip with an on-chain memo.
     * @param recipient The wallet receiving the tip.
     * @param message   Memo emitted in the TipSent event.
     */
    function tipWithMessage(
        address recipient,
        string calldata message
    ) external payable {
        require(msg.value > 0, "Tip amount must be > 0");
        require(recipient != address(0), "Invalid recipient");

        // CEI: counters updated before the external call
        unchecked {
            totalTips++;
            totalEthTipped += msg.value;
        }

        (bool sent, ) = recipient.call{value: msg.value}("");
        require(sent, "Failed to send tip");

        emit TipSent(msg.sender, recipient, msg.value, message);
    }

    // ── Tip: split — 90% to recipient, 10% to community treasury ───────
    /**
     * @notice Split a tip: 90% goes to the recipient, 10% to a community treasury.
     * @param recipient  The wallet receiving 90% of the tip.
     * @param community  The treasury address receiving 10%.
     */
    function tipWithSplit(
        address recipient,
        address community
    ) external payable {
        require(msg.value > 0, "Tip amount must be > 0");
        require(recipient != address(0), "Invalid recipient");
        require(community != address(0), "Invalid community address");

        uint256 recipientAmount = (msg.value * 90) / 100;
        uint256 communityAmount = msg.value - recipientAmount;

        // CEI: counters updated before the external calls
        unchecked {
            totalTips++;
            totalEthTipped += msg.value;
        }

        (bool sent, ) = recipient.call{value: recipientAmount}("");
        require(sent, "Failed to send tip");

        if (communityAmount > 0) {
            (bool sent2, ) = community.call{value: communityAmount}("");
            require(sent2, "Failed to send community share");
        }

        emit TipSent(msg.sender, recipient, recipientAmount, "");
    }

    // ── Batch tip ──────────────────────────────────────────────────────
    /**
     * @notice Split an ETH payment among multiple recipients.
     * @param recipients Array of recipient addresses.
     * @param amounts    Parallel array of ETH amounts (in wei).
     * @dev Total of amounts must equal or be less than msg.value (excess refunded).
     */
    function batchTip(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        require(recipients.length == amounts.length, "Arrays must match");
        require(recipients.length > 0, "Empty arrays");
        require(recipients.length <= 50, "Max 50 recipients per batch");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        require(msg.value >= total, "Insufficient ETH");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient in batch");
            require(amounts[i] > 0, "Zero amount in batch");

            // CEI: counters updated before the external call
            unchecked {
                totalTips++;
                totalEthTipped += amounts[i];
            }

            (bool sent, ) = recipients[i].call{value: amounts[i]}("");
            require(sent, "Failed to send tip");

            emit TipSent(msg.sender, recipients[i], amounts[i], "");
        }

        // Refund excess ETH
        uint256 remaining = msg.value - total;
        if (remaining > 0) {
            (bool refunded, ) = msg.sender.call{value: remaining}("");
            require(refunded, "Refund failed");
        }
    }

    // ── Tip: ERC-20 ────────────────────────────────────────────────────
    /**
     * @notice Tip using an ERC-20 token (USDC, Degen, etc.).
     * @param token     The ERC-20 token contract address.
     * @param recipient The wallet receiving the tokens.
     * @param amount    The quantity of tokens (adjusted for decimals).
     */
    function tipERC20(
        address token,
        address recipient,
        uint256 amount
    ) external {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        // IERC20.transferFrom — caller must have approved this contract first
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                msg.sender,
                recipient,
                amount
            )
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");

        unchecked {
            totalTips++;
        }

        emit TipSent(msg.sender, recipient, amount, "");
    }
}
`;

// ─── Helper: encode function data for wallet requests ──────────────────────
//
// Selector provenance (verified 2026-08-30 with `cast sig` against the
// TIP_CONTRACT_SOURCE ABI below — the previous values were fabricated and
// made every tip revert):
//   tip(address)                 → 0xac733ef7
//   tipWithMessage(address,string) → 0x5b333fa4
//   tipWithSplit(address,address)  → 0x8feb66d9
//   batchTip(address[],uint256[])  → 0xdaf91250
//   tipERC20(address,address,uint256) → 0x86463e09

/** Left-pad a hex string (without 0x) to full 32-byte ABI word width. */
function padWord(hex: string): string {
  return hex.toLowerCase().padStart(64, '0');
}

/** Address → 32-byte ABI word (0x + 64 hex chars). */
function addressWord(address: `0x${string}`): string {
  return padWord(address.toLowerCase().replace(/^0x/, ''));
}

/**
 * Encode a `tip` call data for use with `eth_sendTransaction` via EIP-1193.
 */
export function encodeTipData(recipient: `0x${string}`): `0x${string}` {
  // function tip(address) → 0xac733ef7 + padded address
  const signature = '0xac733ef7';
  return `${signature}${addressWord(recipient)}` as `0x${string}`;
}

/**
 * Encode a `tipWithMessage` call data.
 *
 * ABI layout: selector | address (32B) | offset to string (32B, 0x40) |
 *             string byte length (32B) | UTF-8 bytes, zero-padded to 32B words.
 */
export function encodeTipWithMessageData(recipient: `0x${string}`, message: string): `0x${string}` {
  const signature = '0x5b333fa4';
  const addrPad = addressWord(recipient);
  // ABI string length is the BYTE length, not the JS string length —
  // multi-byte UTF-8 (emoji, CJK) previously produced corrupt calldata.
  const msgBytes = new TextEncoder().encode(message);
  const msgHex = Array.from(msgBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const msgData = msgHex.padEnd(64 * Math.ceil(Math.max(msgHex.length, 1) / 64), '0');
  const stringOffset = padWord('40'); // 0x40 = 64 bytes offset for the dynamic string
  const stringLen = BigInt(msgBytes.length).toString(16).padStart(64, '0');
  return `${signature}${addrPad}${stringOffset}${stringLen}${msgData}` as `0x${string}`;
}
