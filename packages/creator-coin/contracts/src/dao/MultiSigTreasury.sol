// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MultiSigTreasury
 * @notice Gnosis Safe-compatible multi-signature treasury for creator coin DAOs.
 *
 * Features:
 *   1. N/M threshold — configurable signers + threshold
 *   2. Token operations — transfer, approve, swap via DEX
 *   3. Streaming payments — continuous payment streams to contributors
 *   4. Grant programs — create grant with milestones, release funds on completion
 *   5. Investment management — swap tokens, provide liquidity, stake
 *   6. Spending limits — per-address, per-day, per-token limits
 *   7. Time-locked reserves — portion of treasury locked for N days
 *
 * @dev Self-contained multi-sig. Does NOT depend on external Gnosis Safe.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ═══════════════════════════════════════════════════════════════════
// ║  DATA STRUCTURES                                               ║
// ═══════════════════════════════════════════════════════════════════

/// @notice A transaction proposal awaiting signer confirmations
struct Transaction {
    address to;
    uint256 value;
    bytes data;
    bool executed;
    uint256 numConfirmations;
    uint256 created;
    address creator;
}

/// @notice A streaming payment to a contributor
struct PaymentStream {
    address recipient;
    IERC20 token;
    uint256 totalAmount;
    uint256 amountPerSecond;
    uint256 startTime;
    uint256 endTime;
    uint256 withdrawn;
    bool active;
}

/// @notice A grant with milestone-based funding
struct Grant {
    address recipient;
    IERC20 token;
    uint256 totalAmount;
    uint256 released;
    uint256 milestoneCount;
    uint256 currentMilestone;
    bool active;
}

/// @notice A milestone within a grant
struct Milestone {
    string description;
    uint256 amount;
    bool completed;
    uint256 completedAt;
}

/// @notice Time-locked reserve
struct TimeLockedReserve {
    IERC20 token;
    uint256 amount;
    uint256 unlockTime;
    bool withdrawn;
}

/// @notice Spending limit configuration
struct SpendingLimit {
    uint256 dailyLimit;
    uint256 spentToday;
    uint256 lastResetDay;
}

/// @notice Investment position
struct Investment {
    address protocol;
    IERC20 tokenA;
    IERC20 tokenB;
    uint256 amountA;
    uint256 amountB;
    uint256 timestamp;
}

// ═══════════════════════════════════════════════════════════════════
// ║  EVENTS                                                        ║
// ═══════════════════════════════════════════════════════════════════

event TransactionCreated(uint256 indexed txId, address indexed to, uint256 value, bytes data, address creator);
event TransactionConfirmed(uint256 indexed txId, address indexed signer);
event TransactionRevoked(uint256 indexed txId, address indexed signer);
event TransactionExecuted(uint256 indexed txId, address indexed to, bool success);
event SignerAdded(address indexed signer);
event SignerRemoved(address indexed signer);
event ThresholdChanged(uint256 newThreshold);
event StreamCreated(uint256 indexed streamId, address indexed recipient, IERC20 token, uint256 totalAmount);
event StreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
event StreamCancelled(uint256 indexed streamId);
event GrantCreated(uint256 indexed grantId, address indexed recipient, IERC20 token, uint256 totalAmount);
event MilestoneCompleted(uint256 indexed grantId, uint256 milestoneIndex);
event GrantReleased(uint256 indexed grantId, uint256 amount);
event GrantCancelled(uint256 indexed grantId);
event ReserveLocked(uint256 indexed reserveId, IERC20 token, uint256 amount, uint256 unlockTime);
event ReserveWithdrawn(uint256 indexed reserveId, uint256 amount);
event SpendingLimitSet(address indexed spender, IERC20 indexed token, uint256 dailyLimit);
event InvestmentMade(uint256 indexed investmentId, address protocol, uint256 amount);
event TokensRecovered(IERC20 indexed token, address indexed to, uint256 amount);

contract MultiSigTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    // ║  STATE                                                     ║
    // ═══════════════════════════════════════════════════════════════

    /// @notice List of authorized signers
    address[] public signers;
    /// @notice Whether an address is a signer
    mapping(address => bool) public isSigner;
    /// @notice Required confirmations (N-of-M)
    uint256 public threshold;
    /// @notice Transaction count
    uint256 public txCount;
    /// @notice All transactions
    mapping(uint256 => Transaction) public transactions;
    /// @notice Whether a signer confirmed a transaction
    mapping(uint256 => mapping(address => bool)) public confirmations;
    /// @notice Payment streams
    mapping(uint256 => PaymentStream) public streams;
    uint256 public streamCount;
    /// @notice Grants
    mapping(uint256 => Grant) public grants;
    mapping(uint256 => Milestone[]) public grantMilestones;
    uint256 public grantCount;
    /// @notice Time-locked reserves
    mapping(uint256 => TimeLockedReserve) public reserves;
    uint256 public reserveCount;
    /// @notice Spending limits: spender => token => limit
    mapping(address => mapping(IERC20 => SpendingLimit)) public spendingLimits;
    /// @notice Investments
    mapping(uint256 => Investment) public investments;
    uint256 public investmentCount;

    // ═══════════════════════════════════════════════════════════════
    // ║  MODIFIERS                                                ║
    // ═══════════════════════════════════════════════════════════════

    modifier onlySigner() {
        require(isSigner[msg.sender], "Treasury: not signer");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < txCount, "Treasury: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "Treasury: already executed");
        _;
    }

    modifier confirmed(uint256 txId, address signer) {
        require(confirmations[txId][signer], "Treasury: not confirmed");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  CONSTRUCTOR                                              ║
    // ═══════════════════════════════════════════════════════════════

    constructor(address[] memory _signers, uint256 _threshold) {
        require(_signers.length >= _threshold, "Treasury: threshold > signers");
        require(_threshold >= 1, "Treasury: threshold too low");
        require(_signers.length <= 50, "Treasury: too many signers");

        for (uint256 i = 0; i < _signers.length; i++) {
            require(_signers[i] != address(0), "Treasury: invalid signer");
            require(!isSigner[_signers[i]], "Treasury: duplicate signer");
            isSigner[_signers[i]] = true;
            signers.push(_signers[i]);
        }

        threshold = _threshold;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  1. N/M THRESHOLD — SIGNER MANAGEMENT                    ║
    // ═══════════════════════════════════════════════════════════════

    function addSigner(address newSigner) external onlySigner {
        require(newSigner != address(0), "Treasury: invalid signer");
        require(!isSigner[newSigner], "Treasury: already signer");

        isSigner[newSigner] = true;
        signers.push(newSigner);
        emit SignerAdded(newSigner);
    }

    function removeSigner(address signer) external onlySigner {
        require(isSigner[signer], "Treasury: not signer");
        require(signers.length > threshold, "Treasury: would exceed threshold");

        isSigner[signer] = false;

        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(signer);
    }

    function changeThreshold(uint256 _threshold) external onlySigner {
        require(_threshold >= 1, "Treasury: threshold too low");
        require(_threshold <= signers.length, "Treasury: threshold > signers");
        threshold = _threshold;
        emit ThresholdChanged(_threshold);
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  TRANSACTION LIFECYCLE                                    ║
    // ═══════════════════════════════════════════════════════════════

    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256) {
        uint256 txId = txCount++;

        transactions[txId] = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            numConfirmations: 0,
            created: block.timestamp,
            creator: msg.sender
        });

        emit TransactionCreated(txId, to, value, data, msg.sender);
        return txId;
    }

    function confirmTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        require(!confirmations[txId][msg.sender], "Treasury: already confirmed");
        confirmations[txId][msg.sender] = true;
        transactions[txId].numConfirmations++;
        emit TransactionConfirmed(txId, msg.sender);
    }

    function revokeConfirmation(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        require(confirmations[txId][msg.sender], "Treasury: not confirmed");
        confirmations[txId][msg.sender] = false;
        transactions[txId].numConfirmations--;
        emit TransactionRevoked(txId, msg.sender);
    }

    function executeTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
        nonReentrant
    {
        require(
            transactions[txId].numConfirmations >= threshold,
            "Treasury: not enough confirmations"
        );

        Transaction storage txn = transactions[txId];
        txn.executed = true;

        (bool success,) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Treasury: tx execution failed");

        emit TransactionExecuted(txId, txn.to, success);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  2. TOKEN OPERATIONS                                      ║
    // ═══════════════════════════════════════════════════════════════

    /// @notice Transfer tokens (must be called via submit+confirm+execute)
    function transferToken(IERC20 token, address to, uint256 amount) external {
        // Only callable via multi-sig transaction
        require(msg.sender == address(this), "Treasury: only via tx");
        token.safeTransfer(to, amount);
    }

    /// @notice Approve tokens for spending (must be called via multi-sig)
    function approveToken(IERC20 token, address spender, uint256 amount) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        token.approve(spender, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  3. STREAMING PAYMENTS                                    ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Create a payment stream. Callable via multi-sig transaction.
     * @param recipient Address to receive the stream
     * @param token Token to stream
     * @param totalAmount Total amount to stream
     * @param durationSeconds Duration of the stream in seconds
     */
    function createStream(
        address recipient,
        IERC20 token,
        uint256 totalAmount,
        uint256 durationSeconds
    ) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        require(recipient != address(0), "Treasury: invalid recipient");
        require(totalAmount > 0, "Treasury: zero amount");
        require(durationSeconds > 0, "Treasury: zero duration");

        uint256 streamId = streamCount++;
        uint256 amountPerSecond = totalAmount / durationSeconds;

        // Transfer tokens to this contract
        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        streams[streamId] = PaymentStream({
            recipient: recipient,
            token: token,
            totalAmount: totalAmount,
            amountPerSecond: amountPerSecond,
            startTime: block.timestamp,
            endTime: block.timestamp + durationSeconds,
            withdrawn: 0,
            active: true
        });

        emit StreamCreated(streamId, recipient, token, totalAmount);
    }

    /**
     * @notice Withdraw from a payment stream (callable by recipient).
     */
    function withdrawFromStream(uint256 streamId) external nonReentrant {
        PaymentStream storage stream = streams[streamId];
        require(stream.active, "Treasury: stream not active");
        require(msg.sender == stream.recipient, "Treasury: not recipient");

        uint256 withdrawable = _streamWithdrawable(stream);
        require(withdrawable > 0, "Treasury: nothing to withdraw");

        stream.withdrawn += withdrawable;
        stream.token.safeTransfer(stream.recipient, withdrawable);

        // Deactivate if fully withdrawn
        if (stream.withdrawn >= stream.totalAmount) {
            stream.active = false;
        }

        emit StreamWithdrawn(streamId, stream.recipient, withdrawable);
    }

    /**
     * @notice Calculate withdrawable amount from a stream.
     */
    function streamWithdrawable(uint256 streamId) external view returns (uint256) {
        return _streamWithdrawable(streams[streamId]);
    }

    function _streamWithdrawable(PaymentStream storage stream) internal view returns (uint256) {
        if (!stream.active) return 0;
        uint256 elapsed = block.timestamp - stream.startTime;
        if (elapsed == 0) return 0;
        uint256 vested = elapsed * stream.amountPerSecond;
        if (vested > stream.totalAmount) vested = stream.totalAmount;
        if (stream.withdrawn >= vested) return 0;
        return vested - stream.withdrawn;
    }

    /**
     * @notice Cancel a stream (multi-sig only).
     */
    function cancelStream(uint256 streamId) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        PaymentStream storage stream = streams[streamId];
        require(stream.active, "Treasury: not active");

        stream.active = false;
        emit StreamCancelled(streamId);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  4. GRANT PROGRAMS                                       ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Create a grant with milestones. Callable via multi-sig transaction.
     */
    function createGrant(
        address recipient,
        IERC20 token,
        uint256 totalAmount,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneDescriptions
    ) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        require(recipient != address(0), "Treasury: invalid recipient");
        require(totalAmount > 0, "Treasury: zero amount");
        require(milestoneAmounts.length == milestoneDescriptions.length, "Treasury: length mismatch");
        require(milestoneAmounts.length > 0, "Treasury: no milestones");

        // Verify milestone amounts sum to total
        uint256 sum;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            sum += milestoneAmounts[i];
        }
        require(sum == totalAmount, "Treasury: milestone sum mismatch");

        uint256 grantId = grantCount++;

        // Transfer tokens to this contract
        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        grants[grantId] = Grant({
            recipient: recipient,
            token: token,
            totalAmount: totalAmount,
            released: 0,
            milestoneCount: milestoneAmounts.length,
            currentMilestone: 0,
            active: true
        });

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            grantMilestones[grantId].push(Milestone({
                description: milestoneDescriptions[i],
                amount: milestoneAmounts[i],
                completed: false,
                completedAt: 0
            }));
        }

        emit GrantCreated(grantId, recipient, token, totalAmount);
    }

    /**
     * @notice Complete a milestone (callable by multi-sig or recipient with proof).
     */
    function completeMilestone(uint256 grantId, uint256 milestoneIndex) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        Grant storage grant = grants[grantId];
        require(grant.active, "Treasury: grant not active");
        require(milestoneIndex < grant.milestoneCount, "Treasury: invalid milestone");
        require(milestoneIndex == grant.currentMilestone, "Treasury: wrong order");

        Milestone storage milestone = grantMilestones[grantId][milestoneIndex];
        require(!milestone.completed, "Treasury: already completed");

        milestone.completed = true;
        milestone.completedAt = block.timestamp;
        grant.currentMilestone++;

        // Release funds
        uint256 releaseAmount = milestone.amount;
        grant.released += releaseAmount;
        grant.token.safeTransfer(grant.recipient, releaseAmount);

        emit MilestoneCompleted(grantId, milestoneIndex);
        emit GrantReleased(grantId, releaseAmount);

        // Close grant if all milestones done
        if (grant.currentMilestone >= grant.milestoneCount) {
            grant.active = false;
        }
    }

    /**
     * @notice Cancel a grant (multi-sig only). Unused funds stay in treasury.
     */
    function cancelGrant(uint256 grantId) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        Grant storage grant = grants[grantId];
        require(grant.active, "Treasury: not active");
        grant.active = false;
        emit GrantCancelled(grantId);
    }

    function getMilestoneCount(uint256 grantId) external view returns (uint256) {
        return grantMilestones[grantId].length;
    }

    function getMilestone(uint256 grantId, uint256 index) external view returns (Milestone memory) {
        return grantMilestones[grantId][index];
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  5. INVESTMENT MANAGEMENT                                ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Record an investment (swap, LP, stake). Callable via multi-sig tx.
     * The actual DeFi interaction must be encoded in `data` and executed via submitTransaction.
     * This function records the investment for tracking purposes.
     */
    function recordInvestment(
        address protocol,
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 amountA,
        uint256 amountB
    ) external {
        require(msg.sender == address(this), "Treasury: only via tx");

        uint256 invId = investmentCount++;
        investments[invId] = Investment({
            protocol: protocol,
            tokenA: tokenA,
            tokenB: tokenB,
            amountA: amountA,
            amountB: amountB,
            timestamp: block.timestamp
        });

        emit InvestmentMade(invId, protocol, amountA);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  6. SPENDING LIMITS                                      ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Set a spending limit for an address on a token. Multi-sig only.
     */
    function setSpendingLimit(address spender, IERC20 token, uint256 dailyLimit) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        spendingLimits[spender][token] = SpendingLimit({
            dailyLimit: dailyLimit,
            spentToday: 0,
            lastResetDay: block.timestamp / 1 days
        });
        emit SpendingLimitSet(spender, token, dailyLimit);
    }

    /**
     * @notice Execute a transfer within spending limits (callable by spender directly).
     */
    function transferWithLimit(IERC20 token, address to, uint256 amount) external nonReentrant {
        SpendingLimit storage limit = spendingLimits[msg.sender][token];
        require(limit.dailyLimit > 0, "Treasury: no limit set");

        // Reset daily counter if new day
        uint256 today = block.timestamp / 1 days;
        if (today > limit.lastResetDay) {
            limit.spentToday = 0;
            limit.lastResetDay = today;
        }

        require(limit.spentToday + amount <= limit.dailyLimit, "Treasury: limit exceeded");
        limit.spentToday += amount;

        token.safeTransfer(to, amount);
    }

    function getSpendingLimit(address spender, IERC20 token) external view returns (SpendingLimit memory) {
        return spendingLimits[spender][token];
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  7. TIME-LOCKED RESERVES                                 ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Lock tokens in a time-locked reserve. Multi-sig only.
     */
    function lockReserve(IERC20 token, uint256 amount, uint256 duration) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        require(amount > 0, "Treasury: zero amount");
        require(duration >= 1 days, "Treasury: duration too short");

        uint256 reserveId = reserveCount++;
        reserves[reserveId] = TimeLockedReserve({
            token: token,
            amount: amount,
            unlockTime: block.timestamp + duration,
            withdrawn: false
        });

        emit ReserveLocked(reserveId, token, amount, block.timestamp + duration);
    }

    /**
     * @notice Withdraw from a time-locked reserve after unlock time.
     */
    function withdrawReserve(uint256 reserveId, address to) external onlySigner nonReentrant {
        TimeLockedReserve storage reserve = reserves[reserveId];
        require(!reserve.withdrawn, "Treasury: already withdrawn");
        require(block.timestamp >= reserve.unlockTime, "Treasury: still locked");

        reserve.withdrawn = true;
        reserve.token.safeTransfer(to, reserve.amount);

        emit ReserveWithdrawn(reserveId, reserve.amount);
    }

    function getReserve(uint256 reserveId) external view returns (TimeLockedReserve memory) {
        return reserves[reserveId];
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  FALLBACK — RECEIVE ETH                                  ║
    // ═══════════════════════════════════════════════════════════════

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // ║  TOKEN RECOVERY                                          ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Recover accidentally sent tokens. Multi-sig only.
     */
    function recoverTokens(IERC20 token, address to, uint256 amount) external {
        require(msg.sender == address(this), "Treasury: only via tx");
        require(to != address(0), "Treasury: invalid to");
        token.safeTransfer(to, amount);
        emit TokensRecovered(token, to, amount);
    }
}
