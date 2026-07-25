// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DAOTokenWrapperV2
 * @notice Wraps creator coins for DAO governance with veToken model.
 *
 * Security fixes applied per DAO-SECURITY-AUDIT.md (2026-07-25):
 *   G-06: getPastTotalSupply returns 0 when no checkpoints exist instead of totalSupply()
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

uint256 constant MAX_LOCK_DURATION = 1461 days; // ~4 years
uint256 constant MIN_LOCK_DURATION = 7 days;

event TokensLocked(address indexed user, uint256 amount, uint256 lockDuration, uint256 endTime);
event TokensWithdrawn(address indexed user, uint256 amount);
event VotingPowerDelegated(address indexed delegator, address indexed delegate);
event VotingPowerRevoked(address indexed delegator);
event RewardBoostUpdated(uint256 boostFactorBps);
event SnapshotDelegationRegistered(address indexed user, address indexed delegate, uint256 timestamp);

contract DAOTokenWrapperV2 is ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Checkpoints for Checkpoints.Trace208;

    IERC20 public immutable underlying;

    mapping(address => LockPosition) public locks;
    mapping(address => DelegationInfo) public delegationRegistry;
    uint256 public rewardBoostFactorBps;
    uint256 public totalLocked;
    uint256 public revenuePool;

    Checkpoints.Trace208 private _totalSupplyCheckpoints;
    mapping(address => Checkpoints.Trace208) private _delegateCheckpoints;

    constructor(
        IERC20 _underlying,
        string memory _name,
        string memory _symbol
    ) ERC20Permit(_name) ERC20(_name, _symbol) {
        require(address(_underlying) != address(0), "WrapperV2: invalid underlying");
        underlying = _underlying;
        rewardBoostFactorBps = 10000;
    }

    // ═══ 1. LOCK-TO-VOTE ═══

    function lock(uint256 amount, uint256 duration) external nonReentrant {
        require(amount > 0, "WrapperV2: zero amount");
        require(duration >= MIN_LOCK_DURATION, "WrapperV2: lock too short");
        require(duration <= MAX_LOCK_DURATION, "WrapperV2: lock too long");

        LockPosition storage pos = locks[msg.sender];
        if (pos.amount > 0 && !pos.withdrawn && block.timestamp < pos.endTime) {
            revert("WrapperV2: active lock exists");
        }

        uint256 endTime = block.timestamp + duration;
        underlying.safeTransferFrom(msg.sender, address(this), amount);

        if (pos.amount == 0 || pos.withdrawn) {
            pos.amount = amount;
            pos.startTime = block.timestamp;
            pos.endTime = endTime;
            pos.withdrawn = false;
        } else {
            pos.amount += amount;
            if (endTime > pos.endTime) {
                pos.endTime = endTime;
                pos.startTime = block.timestamp;
            }
        }

        totalLocked += amount;

        uint256 veAmount = _calculateVeAmount(amount, duration);
        _mint(msg.sender, veAmount);

        emit TokensLocked(msg.sender, amount, duration, endTime);
    }

    function _calculateVeAmount(uint256 amount, uint256 duration) internal pure returns (uint256) {
        return (amount * duration) / MAX_LOCK_DURATION;
    }

    function withdraw() external nonReentrant {
        LockPosition storage pos = locks[msg.sender];
        require(pos.amount > 0, "WrapperV2: no lock");
        require(block.timestamp >= pos.endTime, "WrapperV2: still locked");
        require(!pos.withdrawn, "WrapperV2: already withdrawn");

        uint256 amount = pos.amount;
        pos.withdrawn = true;
        totalLocked -= amount;

        uint256 veBalance = balanceOf(msg.sender);
        if (veBalance > 0) {
            _burn(msg.sender, veBalance);
        }

        underlying.safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(msg.sender, amount);
    }

    function extendLock(uint256 additionalAmount, uint256 newDuration) external nonReentrant {
        LockPosition storage pos = locks[msg.sender];
        require(pos.amount > 0, "WrapperV2: no lock");
        require(!pos.withdrawn, "WrapperV2: withdrawn");

        uint256 newEndTime = block.timestamp + newDuration;
        require(newEndTime >= pos.endTime, "WrapperV2: cannot shorten lock");

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

    // ═══ 2. VOTING POWER ═══

    function getVotes(address account) public view returns (uint256) {
        LockPosition memory pos = locks[account];
        if (pos.amount == 0 || pos.withdrawn) return 0;
        if (block.timestamp >= pos.endTime) return 0;

        uint256 totalDuration = pos.endTime - pos.startTime;
        uint256 elapsed = block.timestamp - pos.startTime;
        uint256 remaining = totalDuration - elapsed;

        return (pos.amount * remaining) / totalDuration;
    }

    function getLockRemainingRatio(address account) public view returns (uint256) {
        LockPosition memory pos = locks[account];
        if (pos.amount == 0 || pos.withdrawn) return 0;
        if (block.timestamp >= pos.endTime) return 0;

        uint256 totalDuration = pos.endTime - pos.startTime;
        uint256 elapsed = block.timestamp - pos.startTime;
        uint256 remaining = totalDuration - elapsed;

        return (remaining * 1e18) / totalDuration;
    }

    /// @notice G-06: FIXED — return 0 when no checkpoints exist, not totalSupply()
    function getPastTotalSupply(uint256 timepoint) public view returns (uint256) {
        (bool exists,,) = _totalSupplyCheckpoints.latestCheckpoint();
        if (!exists) return 0;
        return _totalSupplyCheckpoints.upperLookupRecent(uint48(timepoint));
    }

    function clock() public view returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public pure returns (string memory) {
        return "mode=timestamp";
    }

    // ═══ 3. DELEGATION ═══

    function delegate(address delegatee) public {
        _updateDelegation(msg.sender, delegatee);
    }

    function delegates(address account) public view returns (address) {
        return delegationRegistry[account].delegate;
    }

    function revokeDelegation() external {
        _updateDelegation(msg.sender, msg.sender);
        emit VotingPowerRevoked(msg.sender);
    }

    function _updateDelegation(address delegator, address delegatee) internal {
        require(delegatee != address(0), "WrapperV2: invalid delegate");
        DelegationInfo storage info = delegationRegistry[delegator];
        info.delegate = delegatee;
        info.timestamp = block.timestamp;
        emit VotingPowerDelegated(delegator, delegatee);
    }

    function getDelegationInfo(address account) external view returns (DelegationInfo memory) {
        return delegationRegistry[account];
    }

    // ═══ 4. SNAPSHOT DELEGATION ═══

    function registerSnapshotDelegation(address delegatee, string calldata /* space */) external {
        _updateDelegation(msg.sender, delegatee);
        emit SnapshotDelegationRegistered(msg.sender, delegatee, block.timestamp);
    }

    // ═══ 5. REWARD BOOST ═══

    function setRewardBoostFactor(uint256 bps) external {
        require(msg.sender == address(this), "WrapperV2: only via self-call");
        require(bps >= 10000, "WrapperV2: boost >= 1x");
        require(bps <= 50000, "WrapperV2: boost <= 5x");
        rewardBoostFactorBps = bps;
        emit RewardBoostUpdated(bps);
    }

    function getUserBoost(address account) public view returns (uint256) {
        LockPosition memory pos = locks[account];
        if (pos.amount == 0 || pos.withdrawn) return 10000;
        uint256 remainingRatio = getLockRemainingRatio(account);
        if (remainingRatio == 0) return 10000;
        uint256 boost = 10000 + ((rewardBoostFactorBps - 10000) * remainingRatio) / 1e18;
        return boost;
    }

    function getBoostedVotes(address account) public view returns (uint256) {
        uint256 baseVotes = getVotes(account);
        uint256 userBoost = getUserBoost(account);
        return (baseVotes * userBoost) / 10000;
    }

    function depositRevenue(IERC20 rewardToken, uint256 amount) external {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        revenuePool += amount;
    }

    function claimRevenue(IERC20 rewardToken) external nonReentrant returns (uint256) {
        uint256 userVotes = getBoostedVotes(msg.sender);
        uint256 totalV = totalSupply();
        require(totalV > 0, "WrapperV2: no supply");
        require(userVotes > 0, "WrapperV2: no votes");
        require(revenuePool > 0, "WrapperV2: no revenue");

        uint256 userShare = (revenuePool * userVotes) / totalV;
        require(userShare > 0, "WrapperV2: nothing to claim");

        revenuePool -= userShare;
        rewardToken.safeTransfer(msg.sender, userShare);

        return userShare;
    }

    // ═══ VIEW FUNCTIONS ═══

    function getLock(address user) external view returns (LockPosition memory) {
        return locks[user];
    }

    function hasActiveLock(address user) external view returns (bool) {
        LockPosition memory pos = locks[user];
        return pos.amount > 0 && !pos.withdrawn && block.timestamp < pos.endTime;
    }

    // ═══ INTERNAL OVERRIDES ═══

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
    {
        super._update(from, to, value);
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
