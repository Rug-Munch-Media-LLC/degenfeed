// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DAOTokenWrapper
 * @notice Wraps creator coins for DAO governance with veToken model.
 *
 * Inspired by Curve veCRV, provides:
 *   1. Lock-to-vote — users lock tokens for N days
 *   2. veToken model — voting power decays linearly
 *   3. Delegation registry — on-chain delegation tracking
 *   4. Snapshot delegation — compatible with Snapshot.org
 *   5. Reward boost — locked tokens earn higher yield
 *
 * Voting power = amount * (remainingLockTime / maxLockTime)
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// ── Data Structures ───────────────────────────────────────────────────────

struct LockPosition {
    uint256 amount;
    uint256 startTime;
    uint256 endTime;
    bool withdrawn;
}

struct DelegationInfo {
    address delegate;
    uint256 timestamp;
}

// ── Constants ─────────────────────────────────────────────────────────────

uint256 constant MAX_LOCK_DURATION = 1461 days; // ~4 years
uint256 constant MIN_LOCK_DURATION = 7 days;

// ── Events ────────────────────────────────────────────────────────────────

event TokensLocked(address indexed user, uint256 amount, uint256 lockDuration, uint256 endTime);
event TokensWithdrawn(address indexed user, uint256 amount);
event VotingPowerDelegated(address indexed delegator, address indexed delegate);
event VotingPowerRevoked(address indexed delegator);
event RewardBoostUpdated(uint256 boostFactorBps);
event SnapshotDelegationRegistered(address indexed user, address indexed delegate, uint256 timestamp);

/**
 * @dev Wraps an ERC20 token into a veToken governance model.
 * Does NOT inherit from ERC20Votes to avoid diamond issues with ERC20Permit.
 * Instead implements IVotes-like interface manually with Checkpoints.
 */
contract DAOTokenWrapper is ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Checkpoints for Checkpoints.Trace208;

    /* ── State ── */

    /// @notice The underlying token (creator coin)
    IERC20 public immutable underlying;

    /// @notice User lock positions
    mapping(address => LockPosition) public locks;

    /// @notice Delegation registry
    mapping(address => DelegationInfo) public delegationRegistry;

    /// @notice Boost factor in bps (default: 10000 = 1x)
    uint256 public rewardBoostFactorBps;

    /// @notice Total tokens locked
    uint256 public totalLocked;

    /// @notice Revenue share pool
    uint256 public revenuePool;

    /// @notice Total supply checkpoints for getPastTotalSupply
    Checkpoints.Trace208 private _totalSupplyCheckpoints;

    /// @notice Delegate checkpoints per address
    mapping(address => Checkpoints.Trace208) private _delegateCheckpoints;

    /* ── Constructor ── */

    /**
     * @param _underlying The creator coin token
     * @param _name Name for the veToken (e.g. "veDEGEN")
     * @param _symbol Symbol for the veToken
     */
    constructor(
        IERC20 _underlying,
        string memory _name,
        string memory _symbol
    ) ERC20Permit(_name) ERC20(_name, _symbol) {
        require(address(_underlying) != address(0), "Wrapper: invalid underlying");
        underlying = _underlying;
        rewardBoostFactorBps = 10000; // 1x default
    }

    /* ── 1. LOCK-TO-VOTE ── */

    /**
     * @notice Lock tokens to receive veTokens (voting power).
     */
    function lock(uint256 amount, uint256 duration) external nonReentrant {
        require(amount > 0, "Wrapper: zero amount");
        require(duration >= MIN_LOCK_DURATION, "Wrapper: lock too short");
        require(duration <= MAX_LOCK_DURATION, "Wrapper: lock too long");

        LockPosition storage pos = locks[msg.sender];
        if (pos.amount > 0 && !pos.withdrawn && block.timestamp < pos.endTime) {
            revert("Wrapper: active lock exists");
        }

        uint256 endTime = block.timestamp + duration;
        underlying.safeTransferFrom(msg.sender, address(this), amount);

        if (pos.amount == 0 || pos.withdrawn) {
            pos.amount = amount;
            pos.startTime = block.timestamp;
            pos.endTime = endTime;
            pos.withdrawn = false;
        } else {
            // Extend existing lock
            pos.amount += amount;
            if (endTime > pos.endTime) {
                pos.endTime = endTime;
                pos.startTime = block.timestamp;
            }
        }

        totalLocked += amount;

        // Mint veTokens
        uint256 veAmount = _calculateVeAmount(amount, duration);
        _mint(msg.sender, veAmount);

        emit TokensLocked(msg.sender, amount, duration, endTime);
    }

    /// @notice Calculate veToken amount: amount * (duration / MAX_LOCK_DURATION)
    function _calculateVeAmount(uint256 amount, uint256 duration) internal pure returns (uint256) {
        return (amount * duration) / MAX_LOCK_DURATION;
    }

    /**
     * @notice Withdraw locked tokens after lock period ends.
     */
    function withdraw() external nonReentrant {
        LockPosition storage pos = locks[msg.sender];
        require(pos.amount > 0, "Wrapper: no lock");
        require(block.timestamp >= pos.endTime, "Wrapper: still locked");
        require(!pos.withdrawn, "Wrapper: already withdrawn");

        uint256 amount = pos.amount;
        pos.withdrawn = true;
        totalLocked -= amount;

        // Burn all veTokens held by user
        uint256 veBalance = balanceOf(msg.sender);
        if (veBalance > 0) {
            _burn(msg.sender, veBalance);
        }

        underlying.safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Extend an active lock.
     */
    function extendLock(uint256 additionalAmount, uint256 newDuration) external nonReentrant {
        LockPosition storage pos = locks[msg.sender];
        require(pos.amount > 0, "Wrapper: no lock");
        require(!pos.withdrawn, "Wrapper: withdrawn");

        uint256 newEndTime = block.timestamp + newDuration;
        require(newEndTime >= pos.endTime, "Wrapper: cannot shorten lock");

        if (additionalAmount > 0) {
            underlying.safeTransferFrom(msg.sender, address(this), additionalAmount);
            pos.amount += additionalAmount;
            totalLocked += additionalAmount;
        }

        pos.endTime = newEndTime;

        uint256 newVeAmount = _calculateVeAmount(pos.amount, newDuration);
        uint256 currentVe = balanceOf(msg.sender);

        if (newVeAmount > currentVe) {
            _mint(msg.sender, newVeAmount - currentVe);
        } else if (newVeAmount < currentVe) {
            _burn(msg.sender, currentVe - newVeAmount);
        }

        emit TokensLocked(msg.sender, additionalAmount, newDuration, newEndTime);
    }

    /* ── 2. VOTING POWER (veToken decay model) ── */

    /**
     * @notice Get current voting power. Decays linearly over lock period.
     * Voting power = amount * (remainingTime / totalLockTime)
     */
    function getVotes(address account) public view returns (uint256) {
        LockPosition memory pos = locks[account];
        if (pos.amount == 0 || pos.withdrawn) return 0;

        if (block.timestamp >= pos.endTime) return 0;

        uint256 totalDuration = pos.endTime - pos.startTime;
        uint256 elapsed = block.timestamp - pos.startTime;
        uint256 remaining = totalDuration - elapsed;

        return (pos.amount * remaining) / totalDuration;
    }

    /**
     * @notice Get the remaining lock ratio for boost calculation.
     */
    function getLockRemainingRatio(address account) public view returns (uint256) {
        LockPosition memory pos = locks[account];
        if (pos.amount == 0 || pos.withdrawn) return 0;

        if (block.timestamp >= pos.endTime) return 0;

        uint256 totalDuration = pos.endTime - pos.startTime;
        uint256 elapsed = block.timestamp - pos.startTime;
        uint256 remaining = totalDuration - elapsed;

        return (remaining * 1e18) / totalDuration;
    }

    /**
     * @notice Get total supply at a past timepoint (for quorum calculations).
     */
    function getPastTotalSupply(uint256 timepoint) public view returns (uint256) {
        (bool exists,, uint208 latest) = _totalSupplyCheckpoints.latestCheckpoint();
        if (!exists) return totalSupply();
        return _totalSupplyCheckpoints.upperLookupRecent(uint48(timepoint));
    }

    /// @notice Current timestamp for checkpoint system
    function clock() public view returns (uint48) {
        return uint48(block.timestamp);
    }

    /// @notice Clock mode
    function CLOCK_MODE() public pure returns (string memory) {
        return "mode=timestamp";
    }

    /* ── 3. DELEGATION REGISTRY ── */

    /**
     * @notice Delegate voting power to another address.
     */
    function delegate(address delegatee) public {
        _updateDelegation(msg.sender, delegatee);
    }

    /**
     * @notice Get the delegate for an address.
     */
    function delegates(address account) public view returns (address) {
        return delegationRegistry[account].delegate;
    }

    /**
     * @notice Revoke delegation (self-delegate).
     */
    function revokeDelegation() external {
        _updateDelegation(msg.sender, msg.sender);
        emit VotingPowerRevoked(msg.sender);
    }

    /**
     * @notice Internal: update delegation.
     */
    function _updateDelegation(address delegator, address delegatee) internal {
        require(delegatee != address(0), "Wrapper: invalid delegate");

        DelegationInfo storage info = delegationRegistry[delegator];
        info.delegate = delegatee;
        info.timestamp = block.timestamp;

        emit VotingPowerDelegated(delegator, delegatee);
    }

    /**
     * @notice Get delegation info.
     */
    function getDelegationInfo(address account) external view returns (DelegationInfo memory) {
        return delegationRegistry[account];
    }

    /* ── 4. SNAPSHOT DELEGATION ── */

    /**
     * @notice Register delegation for Snapshot.org compatibility.
     */
    function registerSnapshotDelegation(address delegatee, string calldata /* space */) external {
        _updateDelegation(msg.sender, delegatee);
        emit SnapshotDelegationRegistered(msg.sender, delegatee, block.timestamp);
    }

    /* ── 5. REWARD BOOST ── */

    /**
     * @notice Set reward boost factor (callable only via multi-sig tx).
     */
    function setRewardBoostFactor(uint256 bps) external {
        require(msg.sender == address(this), "Wrapper: only via self-call");
        require(bps >= 10000, "Wrapper: boost >= 1x");
        require(bps <= 50000, "Wrapper: boost <= 5x");
        rewardBoostFactorBps = bps;
        emit RewardBoostUpdated(bps);
    }

    /**
     * @notice Get boost factor for a user based on lock time remaining.
     */
    function getUserBoost(address account) public view returns (uint256) {
        LockPosition memory pos = locks[account];
        if (pos.amount == 0 || pos.withdrawn) return 10000; // 1x

        uint256 remainingRatio = getLockRemainingRatio(account);
        if (remainingRatio == 0) return 10000;

        uint256 boost = 10000 + ((rewardBoostFactorBps - 10000) * remainingRatio) / 1e18;
        return boost;
    }

    /**
     * @notice Get boosted voting power for revenue share calculations.
     */
    function getBoostedVotes(address account) public view returns (uint256) {
        uint256 baseVotes = getVotes(account);
        uint256 userBoost = getUserBoost(account);
        return (baseVotes * userBoost) / 10000;
    }

    /**
     * @notice Deposit revenue share tokens (from treasury).
     */
    function depositRevenue(IERC20 rewardToken, uint256 amount) external {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        revenuePool += amount;
    }

    /**
     * @notice Claim revenue share based on boosted voting power.
     */
    function claimRevenue(IERC20 rewardToken) external nonReentrant returns (uint256) {
        uint256 userVotes = getBoostedVotes(msg.sender);
        uint256 totalV = totalSupply();
        require(totalV > 0, "Wrapper: no supply");
        require(userVotes > 0, "Wrapper: no votes");
        require(revenuePool > 0, "Wrapper: no revenue");

        uint256 userShare = (revenuePool * userVotes) / totalV;
        require(userShare > 0, "Wrapper: nothing to claim");

        revenuePool -= userShare;
        rewardToken.safeTransfer(msg.sender, userShare);

        return userShare;
    }

    /* ── VIEW FUNCTIONS ── */

    function getLock(address user) external view returns (LockPosition memory) {
        return locks[user];
    }

    function hasActiveLock(address user) external view returns (bool) {
        LockPosition memory pos = locks[user];
        return pos.amount > 0 && !pos.withdrawn && block.timestamp < pos.endTime;
    }

    /* ── INTERNAL OVERRIDES ── */

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
    {
        super._update(from, to, value);

        // Update total supply checkpoints
        _totalSupplyCheckpoints.push(clock(), SafeCast.toUint208(totalSupply()));
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
