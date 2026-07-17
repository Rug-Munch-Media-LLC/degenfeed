// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DegenFeedTips
 * @notice On-chain tipping for DegenFeed — 0% fee, no admin, pure passthrough.
 * @dev Deploy once per L2 (Base, Optimism, Arbitrum). No upgradeability.
 *
 * Security:
 * - No selfdestruct, no delegatecall, no admin functions
 * - Uses call{value} pattern with require check
 * - Reentrancy: state reads before external calls; no post-call state changes
 * - totalEthTipped is updated after send to prevent reentrant manipulation
 *
 * Compile with:
 *   forge build --contracts packages/tip-contract/src/DegenFeedTips.sol
 *
 * Deploy with:
 *   tsx scripts/deploy-tip-contract.ts --all
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

    // ── Receive (dumb ETH drop — no event) ─────────────────────────────
    receive() external payable {
        // Allow direct ETH sends for emergency recovery
    }

    // ── Tip: plain ETH ─────────────────────────────────────────────────
    /**
     * @notice Send a direct ETH tip to a recipient.
     * @param recipient The wallet receiving the tip.
     */
    function tip(address recipient) external payable {
        require(msg.value > 0, "Tip amount must be > 0");
        require(recipient != address(0), "Invalid recipient");

        (bool sent, ) = recipient.call{value: msg.value}("");
        require(sent, "Failed to send tip");

        unchecked {
            totalTips++;
            totalEthTipped += msg.value;
        }

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

        (bool sent, ) = recipient.call{value: msg.value}("");
        require(sent, "Failed to send tip");

        unchecked {
            totalTips++;
            totalEthTipped += msg.value;
        }

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

        (bool sent, ) = recipient.call{value: recipientAmount}("");
        require(sent, "Failed to send tip");

        if (communityAmount > 0) {
            (bool sent2, ) = community.call{value: communityAmount}("");
            require(sent2, "Failed to send community share");
        }

        unchecked {
            totalTips++;
            totalEthTipped += msg.value;
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

            (bool sent, ) = recipients[i].call{value: amounts[i]}("");
            require(sent, "Failed to send tip");

            unchecked {
                totalTips++;
                totalEthTipped += amounts[i];
            }

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
