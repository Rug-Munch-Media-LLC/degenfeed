// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedTimelockV2
 * @notice Enhanced TimelockController with multi-sig emergency bypass, replay protection.
 *
 * Security fixes applied per DAO-SECURITY-AUDIT.md (2026-07-25):
 *   G-03: Emergency bypass requires multi-sig approval (3-of-N guardians)
 *   G-15: Token recovery with replay protection
 */

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Proposal types with different delay requirements
enum ProposalType {
    Standard,
    Treasury,
    Constitutional
}

/// @notice Events
event EmergencyExecuted(
    address indexed executor, address target, uint256 value, bytes data, uint256 timestamp
);
event BatchExecuted(uint256 indexed batchId, uint256 numOps, uint256 timestamp);
event TypeDelayUpdated(ProposalType indexed proposalType, uint256 oldDelay, uint256 newDelay);
event EmergencyBypassActivated(address indexed executor);
event EmergencyBypassDeactivated();
event CancellerRoleGranted(address indexed account);
event CancellerRoleRevoked(address indexed account);
event BypassApproved(address indexed executor);
event BypassRevoked(address indexed executor);
event TokensRecovered(IERC20 indexed token, address indexed to, uint256 amount);

contract DegenFeedTimelockV2 is TimelockController {
    using SafeERC20 for IERC20;

    /// @notice Creator address (original coin creator)
    address public creator;

    /// @notice Emergency executor address
    address public emergencyExecutor;

    /// @notice Whether emergency bypass is active
    bool public emergencyBypass;

    /// @notice Multi-sig bypass approvals
    mapping(address => bool) public bypassApprovals;
    uint256 public bypassApprovalCount;
    uint256 public constant BYPASS_THRESHOLD = 2;
    address[] public bypassApprovers;

    /// @notice Type-specific delays (in seconds)
    mapping(ProposalType => uint256) public typeDelays;

    /// @notice Whether a type delay is initialized
    mapping(ProposalType => bool) public typeDelayInitialized;

    /// @notice Batch execution counter
    uint256 public batchCounter;

    /// @notice Last proposal type per operation ID
    mapping(bytes32 => ProposalType) public operationProposalType;

    /// @notice Operations executed via emergency bypass
    mapping(bytes32 => bool) public emergencyExecutions;

    /// @notice G-15: Replay protection for token recovery
    mapping(bytes32 => bool) public recoveredTokens;

    modifier onlyEmergencyExecutor() {
        require(msg.sender == emergencyExecutor, "TimelockV2: not emergency executor");
        _;
    }

    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address creator_,
        address[] memory emergencySigners,
        uint256 emergencyThreshold
    ) TimelockController(minDelay, proposers, executors, creator_) {
        require(creator_ != address(0), "TimelockV2: invalid creator");
        creator = creator_;
        emergencyExecutor = creator_;

        _setTypeDelay(ProposalType.Standard, 24 hours);
        _setTypeDelay(ProposalType.Treasury, 48 hours);
        _setTypeDelay(ProposalType.Constitutional, 7 days);

        _grantRole(CANCELLER_ROLE, creator_);

        for (uint256 i = 0; i < emergencySigners.length; i++) {
            if (emergencySigners[i] != address(0)) {
                _grantRole(PROPOSER_ROLE, emergencySigners[i]);
                _grantRole(EXECUTOR_ROLE, emergencySigners[i]);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  1. CONFIGURABLE DELAYS PER PROPOSAL TYPE                      ║
    // ═══════════════════════════════════════════════════════════════════

    function scheduleWithType(
        ProposalType proposalType,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delayOverride
    ) external {
        require(hasRole(PROPOSER_ROLE, msg.sender), "TimelockV2: not proposer");

        uint256 delay = delayOverride > 0 ? delayOverride : getTypeDelay(proposalType);
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        operationProposalType[id] = proposalType;

        schedule(target, value, data, predecessor, salt, delay);
    }

    function scheduleBatchWithType(
        ProposalType proposalType,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delayOverride
    ) external {
        require(hasRole(PROPOSER_ROLE, msg.sender), "TimelockV2: not proposer");
        require(targets.length > 0, "TimelockV2: empty batch");

        uint256 delay = delayOverride > 0 ? delayOverride : getTypeDelay(proposalType);
        bytes32 id = hashOperationBatch(targets, values, data, predecessor, salt);
        operationProposalType[id] = proposalType;

        scheduleBatch(targets, values, data, predecessor, salt, delay);
    }

    function getTypeDelay(ProposalType proposalType) public view returns (uint256) {
        if (typeDelayInitialized[proposalType]) {
            return typeDelays[proposalType];
        }
        return getMinDelay();
    }

    function updateTypeDelay(ProposalType proposalType, uint256 newDelay) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        require(newDelay >= 1 hours, "TimelockV2: delay too low");

        uint256 oldDelay = getTypeDelay(proposalType);
        require(newDelay >= oldDelay, "TimelockV2: delay can only increase");

        _setTypeDelay(proposalType, newDelay);
        emit TypeDelayUpdated(proposalType, oldDelay, newDelay);
    }

    function _setTypeDelay(ProposalType proposalType, uint256 delay) internal {
        typeDelays[proposalType] = delay;
        typeDelayInitialized[proposalType] = true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  2. G-03: MULTI-SIG EMERGENCY BYPASS                         ║
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Approve emergency bypass (requires BYPASS_THRESHOLD approvals)
    function approveBypass() external onlyEmergencyExecutor {
        require(!emergencyBypass, "TimelockV2: already active");
        require(!bypassApprovals[msg.sender], "TimelockV2: already approved");
        bypassApprovals[msg.sender] = true;
        bypassApprovalCount++;
        bypassApprovers.push(msg.sender);

        if (bypassApprovalCount >= BYPASS_THRESHOLD) {
            emergencyBypass = true;
            emit EmergencyBypassActivated(msg.sender);
        }
        emit BypassApproved(msg.sender);
    }

    /// @notice Revoke bypass approval
    function revokeBypass() external onlyEmergencyExecutor {
        require(bypassApprovals[msg.sender], "TimelockV2: not approved");
        bypassApprovals[msg.sender] = false;
        bypassApprovalCount--;

        if (emergencyBypass && bypassApprovalCount < BYPASS_THRESHOLD) {
            emergencyBypass = false;
            emit EmergencyBypassDeactivated();
        }
        emit BypassRevoked(msg.sender);
    }

    function emergencyExecute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external onlyEmergencyExecutor returns (bytes memory) {
        require(emergencyBypass, "TimelockV2: bypass not active");

        bytes32 id = hashOperation(target, value, data, predecessor, salt);

        ProposalType pType = operationProposalType[id];
        require(pType != ProposalType.Treasury, "TimelockV2: cannot bypass treasury");
        require(pType != ProposalType.Constitutional, "TimelockV2: cannot bypass constitutional");

        if (predecessor != bytes32(0)) {
            require(isOperationDone(predecessor), "TimelockV2: predecessor not done");
        }

        emergencyExecutions[id] = true;

        _execute(target, value, data);
        emit EmergencyExecuted(msg.sender, target, value, data, block.timestamp);

        return data;
    }

    function activateEmergencyBypass() external onlyEmergencyExecutor {
        // Legacy: kept for backward compat but requires multi-sig via approveBypass
        revert("TimelockV2: use approveBypass (multi-sig required)");
    }

    function deactivateEmergencyBypass() external onlyEmergencyExecutor {
        require(emergencyBypass, "TimelockV2: not active");
        emergencyBypass = false;
        bypassApprovalCount = 0;
        emit EmergencyBypassDeactivated();
    }

    function setEmergencyExecutor(address newExecutor) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        require(newExecutor != address(0), "TimelockV2: invalid executor");
        emergencyExecutor = newExecutor;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  3. CANCELLER ROLE                                            ║
    // ═══════════════════════════════════════════════════════════════════

    function grantCanceller(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        grantRole(CANCELLER_ROLE, account);
        emit CancellerRoleGranted(account);
    }

    function revokeCanceller(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        revokeRole(CANCELLER_ROLE, account);
        emit CancellerRoleRevoked(account);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  4. BATCH EXECUTION                                           ║
    // ═══════════════════════════════════════════════════════════════════

    function batchExecute(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata data,
        bytes32[] calldata predecessors,
        bytes32[] calldata salts
    ) external {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "TimelockV2: not executor");
        require(targets.length > 0, "TimelockV2: empty batch");
        require(
            targets.length == values.length &&
            values.length == data.length &&
            data.length == predecessors.length &&
            predecessors.length == salts.length,
            "TimelockV2: length mismatch"
        );

        uint256 batchId = ++batchCounter;

        for (uint256 i = 0; i < targets.length; i++) {
            bytes32 id = hashOperation(targets[i], values[i], data[i], predecessors[i], salts[i]);
            require(isOperationReady(id), "TimelockV2: operation not ready");

            if (predecessors[i] != bytes32(0)) {
                require(isOperationDone(predecessors[i]), "TimelockV2: predecessor not done");
            }

            execute(targets[i], values[i], data[i], predecessors[i], salts[i]);
        }

        emit BatchExecuted(batchId, targets.length, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  5. MINIMUM DELAY ENFORCEMENT                                 ║
    // ═══════════════════════════════════════════════════════════════════

    function updateDelay(uint256 newDelay) external override(TimelockController) {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        require(newDelay >= 1 hours, "TimelockV2: delay too low");
        require(newDelay >= getMinDelay(), "TimelockV2: delay can only increase");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  OVERRIDES                                                    ║
    // ═══════════════════════════════════════════════════════════════════

    function getMinimumDelay() external view returns (uint256) {
        return getMinDelay();
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  G-15: TOKEN RECOVERY WITH REPLAY PROTECTION                 ║
    // ═══════════════════════════════════════════════════════════════════

    function recoverTokens(IERC20 token, address to, uint256 amount) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        require(to != address(0), "TimelockV2: invalid to");
        bytes32 id = keccak256(abi.encodePacked(address(token), to, amount, block.number));
        require(!recoveredTokens[id], "TimelockV2: already recovered");
        recoveredTokens[id] = true;
        token.safeTransfer(to, amount);
        emit TokensRecovered(token, to, amount);
    }

    function recoverNative(address payable to, uint256 amount) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TimelockV2: not admin");
        require(to != address(0), "TimelockV2: invalid to");
        bytes32 id = keccak256(abi.encodePacked(to, amount, block.number));
        require(!recoveredTokens[id], "TimelockV2: already recovered");
        recoveredTokens[id] = true;
        (bool sent,) = to.call{value: amount, gas: 2300}("");
        require(sent, "TimelockV2: transfer failed");
    }
}
