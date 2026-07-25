// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MultiSigTreasuryV2
 * @notice Enhanced multi-signature treasury with confirmation cleanup, stream fix,
 * overflow protection, and rage quit preparation.
 *
 * Security fixes applied per DAO-SECURITY-AUDIT.md (2026-07-25):
 *   G-04: Clear confirmation state after transaction execution
 *   G-11: Overflow-safe arithmetic in spending limits
 *   G-12: Stream remainder distribution when stream ends
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

struct Transaction {
    address to;
    uint256 value;
    bytes data;
    bool executed;
    uint256 numConfirmations;
    uint256 created;
    address creator;
}

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

struct Grant {
    address recipient;
    IERC20 token;
    uint256 totalAmount;
    uint256 released;
    uint256 milestoneCount;
    uint256 currentMilestone;
    bool active;
}

struct Milestone {
    string description;
    uint256 amount;
    bool completed;
    uint256 completedAt;
}

struct TimeLockedReserve {
    IERC20 token;
    uint256 amount;
    uint256 unlockTime;
    bool withdrawn;
}

struct SpendingLimit {
    uint256 dailyLimit;
    uint256 spentToday;
    uint256 lastResetDay;
}

struct Investment {
    address protocol;
    IERC20 tokenA;
    IERC20 tokenB;
    uint256 amountA;
    uint256 amountB;
    uint256 timestamp;
}

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

contract MultiSigTreasuryV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold;
    uint256 public txCount;
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;
    mapping(uint256 => PaymentStream) public streams;
    uint256 public streamCount;
    mapping(uint256 => Grant) public grants;
    mapping(uint256 => Milestone[]) public grantMilestones;
    uint256 public grantCount;
    mapping(uint256 => TimeLockedReserve) public reserves;
    uint256 public reserveCount;
    mapping(address => mapping(IERC20 => SpendingLimit)) public spendingLimits;
    mapping(uint256 => Investment) public investments;
    uint256 public investmentCount;

    modifier onlySigner() {
        require(isSigner[msg.sender], "TreasuryV2: not signer");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < txCount, "TreasuryV2: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "TreasuryV2: already executed");
        _;
    }

    modifier confirmed(uint256 txId, address signer) {
        require(confirmations[txId][signer], "TreasuryV2: not confirmed");
        _;
    }

    constructor(address[] memory _signers, uint256 _threshold) {
        require(_signers.length >= _threshold, "TreasuryV2: threshold > signers");
        require(_threshold >= 1, "TreasuryV2: threshold too low");
        require(_signers.length <= 50, "TreasuryV2: too many signers");

        for (uint256 i = 0; i < _signers.length; i++) {
            require(_signers[i] != address(0), "TreasuryV2: invalid signer");
            require(!isSigner[_signers[i]], "TreasuryV2: duplicate signer");
            isSigner[_signers[i]] = true;
            signers.push(_signers[i]);
        }

        threshold = _threshold;
    }

    // ═══ 1. N/M THRESHOLD ═══

    function addSigner(address newSigner) external onlySigner {
        require(newSigner != address(0), "TreasuryV2: invalid signer");
        require(!isSigner[newSigner], "TreasuryV2: already signer");
        isSigner[newSigner] = true;
        signers.push(newSigner);
        emit SignerAdded(newSigner);
    }

    function removeSigner(address signer) external onlySigner {
        require(isSigner[signer], "TreasuryV2: not signer");
        require(signers.length > threshold, "TreasuryV2: would exceed threshold");
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
        require(_threshold >= 1, "TreasuryV2: threshold too low");
        require(_threshold <= signers.length, "TreasuryV2: threshold > signers");
        threshold = _threshold;
        emit ThresholdChanged(_threshold);
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    // ═══ TRANSACTION LIFECYCLE ═══

    function submitTransaction(address to, uint256 value, bytes calldata data)
        external onlySigner returns (uint256)
    {
        uint256 txId = txCount++;
        transactions[txId] = Transaction({
            to: to, value: value, data: data, executed: false,
            numConfirmations: 0, created: block.timestamp, creator: msg.sender
        });
        emit TransactionCreated(txId, to, value, data, msg.sender);
        return txId;
    }

    function confirmTransaction(uint256 txId)
        external onlySigner txExists(txId) notExecuted(txId)
    {
        require(!confirmations[txId][msg.sender], "TreasuryV2: already confirmed");
        confirmations[txId][msg.sender] = true;
        transactions[txId].numConfirmations++;
        emit TransactionConfirmed(txId, msg.sender);
    }

    function revokeConfirmation(uint256 txId)
        external onlySigner txExists(txId) notExecuted(txId)
    {
        require(confirmations[txId][msg.sender], "TreasuryV2: not confirmed");
        confirmations[txId][msg.sender] = false;
        transactions[txId].numConfirmations--;
        emit TransactionRevoked(txId, msg.sender);
    }

    function executeTransaction(uint256 txId)
        external onlySigner txExists(txId) notExecuted(txId) nonReentrant
    {
        require(transactions[txId].numConfirmations >= threshold, "TreasuryV2: not enough confirmations");

        Transaction storage txn = transactions[txId];
        txn.executed = true;

        // G-04: Clear all confirmations to prevent reuse
        for (uint256 i = 0; i < signers.length; i++) {
            confirmations[txId][signers[i]] = false;
        }
        txn.numConfirmations = 0;

        (bool success,) = txn.to.call{value: txn.value}(txn.data);
        require(success, "TreasuryV2: tx execution failed");

        emit TransactionExecuted(txId, txn.to, success);
    }

    // ═══ 2. TOKEN OPERATIONS ═══

    function transferToken(IERC20 token, address to, uint256 amount) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        token.safeTransfer(to, amount);
    }

    function approveToken(IERC20 token, address spender, uint256 amount) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        token.approve(spender, amount);
    }

    // ═══ 3. STREAMING PAYMENTS ═══

    function createStream(address recipient, IERC20 token, uint256 totalAmount, uint256 durationSeconds) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        require(recipient != address(0), "TreasuryV2: invalid recipient");
        require(totalAmount > 0, "TreasuryV2: zero amount");
        require(durationSeconds > 0, "TreasuryV2: zero duration");

        uint256 streamId = streamCount++;
        uint256 amountPerSecond = totalAmount / durationSeconds;

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

    /// @notice G-12: Stream remainder distribution when stream ends
    function withdrawFromStream(uint256 streamId) external nonReentrant {
        PaymentStream storage stream = streams[streamId];
        require(stream.active, "TreasuryV2: stream not active");
        require(msg.sender == stream.recipient, "TreasuryV2: not recipient");

        uint256 withdrawable = _streamWithdrawable(stream);
        require(withdrawable > 0, "TreasuryV2: nothing to withdraw");

        stream.withdrawn += withdrawable;
        stream.token.safeTransfer(stream.recipient, withdrawable);

        // Deactivate if fully withdrawn
        if (stream.withdrawn >= stream.totalAmount) {
            stream.active = false;
        }

        emit StreamWithdrawn(streamId, stream.recipient, withdrawable);
    }

    function streamWithdrawable(uint256 streamId) external view returns (uint256) {
        return _streamWithdrawable(streams[streamId]);
    }

    /// @notice G-12: Distribute remainder when stream ends
    function _streamWithdrawable(PaymentStream storage stream) internal view returns (uint256) {
        if (!stream.active) return 0;
        uint256 elapsed = block.timestamp - stream.startTime;
        uint256 totalDuration = stream.endTime - stream.startTime;

        if (elapsed >= totalDuration) {
            // Stream ended — return all remaining
            return stream.totalAmount - stream.withdrawn;
        }

        if (elapsed == 0) return 0;
        uint256 vested = elapsed * stream.amountPerSecond;
        if (vested > stream.totalAmount) vested = stream.totalAmount;
        if (stream.withdrawn >= vested) return 0;
        return vested - stream.withdrawn;
    }

    function cancelStream(uint256 streamId) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        PaymentStream storage stream = streams[streamId];
        require(stream.active, "TreasuryV2: not active");
        stream.active = false;
        emit StreamCancelled(streamId);
    }

    // ═══ 4. GRANT PROGRAMS ═══

    function createGrant(address recipient, IERC20 token, uint256 totalAmount, uint256[] calldata milestoneAmounts, string[] calldata milestoneDescriptions) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        require(recipient != address(0), "TreasuryV2: invalid recipient");
        require(totalAmount > 0, "TreasuryV2: zero amount");
        require(milestoneAmounts.length == milestoneDescriptions.length, "TreasuryV2: length mismatch");
        require(milestoneAmounts.length > 0, "TreasuryV2: no milestones");

        uint256 sum;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) sum += milestoneAmounts[i];
        require(sum == totalAmount, "TreasuryV2: milestone sum mismatch");

        uint256 grantId = grantCount++;
        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        grants[grantId] = Grant({
            recipient: recipient, token: token, totalAmount: totalAmount, released: 0,
            milestoneCount: milestoneAmounts.length, currentMilestone: 0, active: true
        });

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            grantMilestones[grantId].push(Milestone({
                description: milestoneDescriptions[i], amount: milestoneAmounts[i],
                completed: false, completedAt: 0
            }));
        }

        emit GrantCreated(grantId, recipient, token, totalAmount);
    }

    function completeMilestone(uint256 grantId, uint256 milestoneIndex) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        Grant storage grant = grants[grantId];
        require(grant.active, "TreasuryV2: grant not active");
        require(milestoneIndex < grant.milestoneCount, "TreasuryV2: invalid milestone");
        require(milestoneIndex == grant.currentMilestone, "TreasuryV2: wrong order");

        Milestone storage milestone = grantMilestones[grantId][milestoneIndex];
        require(!milestone.completed, "TreasuryV2: already completed");

        milestone.completed = true;
        milestone.completedAt = block.timestamp;
        grant.currentMilestone++;

        uint256 releaseAmount = milestone.amount;
        grant.released += releaseAmount;
        grant.token.safeTransfer(grant.recipient, releaseAmount);

        emit MilestoneCompleted(grantId, milestoneIndex);
        emit GrantReleased(grantId, releaseAmount);

        if (grant.currentMilestone >= grant.milestoneCount) {
            grant.active = false;
        }
    }

    function cancelGrant(uint256 grantId) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        Grant storage grant = grants[grantId];
        require(grant.active, "TreasuryV2: not active");
        grant.active = false;
        emit GrantCancelled(grantId);
    }

    function getMilestoneCount(uint256 grantId) external view returns (uint256) {
        return grantMilestones[grantId].length;
    }

    function getMilestone(uint256 grantId, uint256 index) external view returns (Milestone memory) {
        return grantMilestones[grantId][index];
    }

    // ═══ 5. INVESTMENT MANAGEMENT ═══

    function recordInvestment(address protocol, IERC20 tokenA, IERC20 tokenB, uint256 amountA, uint256 amountB) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        uint256 invId = investmentCount++;
        investments[invId] = Investment({
            protocol: protocol, tokenA: tokenA, tokenB: tokenB,
            amountA: amountA, amountB: amountB, timestamp: block.timestamp
        });
        emit InvestmentMade(invId, protocol, amountA);
    }

    // ═══ 6. SPENDING LIMITS ═══

    function setSpendingLimit(address spender, IERC20 token, uint256 dailyLimit) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        spendingLimits[spender][token] = SpendingLimit({
            dailyLimit: dailyLimit, spentToday: 0, lastResetDay: block.timestamp / 1 days
        });
        emit SpendingLimitSet(spender, token, dailyLimit);
    }

    /// @notice G-11: Overflow-safe arithmetic in spending limits
    function transferWithLimit(IERC20 token, address to, uint256 amount) external nonReentrant {
        SpendingLimit storage limit = spendingLimits[msg.sender][token];
        require(limit.dailyLimit > 0, "TreasuryV2: no limit set");

        uint256 today = block.timestamp / 1 days;
        if (today > limit.lastResetDay) {
            limit.spentToday = 0;
            limit.lastResetDay = today;
        }

        // G-11: Overflow-safe check
        uint256 newSpent = limit.spentToday + amount;
        require(newSpent >= limit.spentToday, "TreasuryV2: overflow");
        require(newSpent <= limit.dailyLimit, "TreasuryV2: limit exceeded");
        limit.spentToday = newSpent;

        token.safeTransfer(to, amount);
    }

    function getSpendingLimit(address spender, IERC20 token) external view returns (SpendingLimit memory) {
        return spendingLimits[spender][token];
    }

    // ═══ 7. TIME-LOCKED RESERVES ═══

    function lockReserve(IERC20 token, uint256 amount, uint256 duration) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        require(amount > 0, "TreasuryV2: zero amount");
        require(duration >= 1 days, "TreasuryV2: duration too short");

        uint256 reserveId = reserveCount++;
        reserves[reserveId] = TimeLockedReserve({
            token: token, amount: amount, unlockTime: block.timestamp + duration, withdrawn: false
        });

        emit ReserveLocked(reserveId, token, amount, block.timestamp + duration);
    }

    function withdrawReserve(uint256 reserveId, address to) external onlySigner nonReentrant {
        TimeLockedReserve storage reserve = reserves[reserveId];
        require(!reserve.withdrawn, "TreasuryV2: already withdrawn");
        require(block.timestamp >= reserve.unlockTime, "TreasuryV2: still locked");

        reserve.withdrawn = true;
        reserve.token.safeTransfer(to, reserve.amount);

        emit ReserveWithdrawn(reserveId, reserve.amount);
    }

    function getReserve(uint256 reserveId) external view returns (TimeLockedReserve memory) {
        return reserves[reserveId];
    }

    // ═══ FALLBACK ═══

    receive() external payable {}

    // ═══ TOKEN RECOVERY ═══

    function recoverTokens(IERC20 token, address to, uint256 amount) external {
        require(msg.sender == address(this), "TreasuryV2: only via tx");
        require(to != address(0), "TreasuryV2: invalid to");
        token.safeTransfer(to, amount);
        emit TokensRecovered(token, to, amount);
    }
}
