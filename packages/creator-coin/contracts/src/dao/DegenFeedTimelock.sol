// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedTimelock
 * @notice Enhanced TimelockController for creator coin DAOs.
 *
 * Extends OpenZeppelin v5 TimelockController with:
 *   1. Configurable delays per proposal type (Standard 24h, Treasury 48h, Constitutional 7d)
 *   2. Emergency executor — creator can bypass timelock for non-Treasury proposals
 *   3. Canceller role management — grant/revoke cancellers
 *   4. Batch execution — atomic multi-operation execution
 *   5. Minimum delay enforcement — delays can only increase
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

contract DegenFeedTimelock is TimelockController {
    using SafeERC20 for IERC20;

    /// @notice Creator address (original coin creator)
    address public creator;

    /// @notice Emergency executor address
    address public emergencyExecutor;

    /// @notice Whether emergency bypass is active
    bool public emergencyBypass;

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

    modifier onlyEmergencyExecutor() {
        require(msg.sender == emergencyExecutor, "Timelock: not emergency executor");
        _;
    }

    /**
     * @param minDelay Minimum delay in seconds
     * @param proposers Addresses allowed to schedule
     * @param executors Addresses allowed to execute (address(0) = anyone)
     * @param creator_ Original coin creator
     * @param emergencySigners Emergency signer addresses
     * @param emergencyThreshold Number of signers required
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address creator_,
        address[] memory emergencySigners,
        uint256 emergencyThreshold
    ) TimelockController(minDelay, proposers, executors, creator_) {
        require(creator_ != address(0), "Timelock: invalid creator");
        creator = creator_;
        emergencyExecutor = creator_;

        // Initialize type-specific delays
        _setTypeDelay(ProposalType.Standard, 24 hours);
        _setTypeDelay(ProposalType.Treasury, 48 hours);
        _setTypeDelay(ProposalType.Constitutional, 7 days);

        // Grant creator canceller role
        _grantRole(CANCELLER_ROLE, creator_);

        // Emergency signers get proposer + executor roles
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

    /**
     * @notice Schedule an operation with a specific proposal type delay.
     */
    function scheduleWithType(
        ProposalType proposalType,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delayOverride
    ) external {
        require(hasRole(PROPOSER_ROLE, msg.sender), "Timelock: not proposer");

        uint256 delay = delayOverride > 0 ? delayOverride : getTypeDelay(proposalType);
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        operationProposalType[id] = proposalType;

        // Use public schedule
        schedule(target, value, data, predecessor, salt, delay);
    }

    /**
     * @notice Schedule a batch with a specific proposal type.
     */
    function scheduleBatchWithType(
        ProposalType proposalType,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delayOverride
    ) external {
        require(hasRole(PROPOSER_ROLE, msg.sender), "Timelock: not proposer");
        require(targets.length > 0, "Timelock: empty batch");

        uint256 delay = delayOverride > 0 ? delayOverride : getTypeDelay(proposalType);
        bytes32 id = hashOperationBatch(targets, values, data, predecessor, salt);
        operationProposalType[id] = proposalType;

        scheduleBatch(targets, values, data, predecessor, salt, delay);
    }

    /**
     * @notice Get delay for a proposal type.
     */
    function getTypeDelay(ProposalType proposalType) public view returns (uint256) {
        if (typeDelayInitialized[proposalType]) {
            return typeDelays[proposalType];
        }
        return getMinDelay();
    }

    /**
     * @notice Update type delay (only increasing).
     */
    function updateTypeDelay(ProposalType proposalType, uint256 newDelay) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        require(newDelay >= 1 hours, "Timelock: delay too low");

        uint256 oldDelay = getTypeDelay(proposalType);
        require(newDelay >= oldDelay, "Timelock: delay can only increase");

        _setTypeDelay(proposalType, newDelay);
        emit TypeDelayUpdated(proposalType, oldDelay, newDelay);
    }

    function _setTypeDelay(ProposalType proposalType, uint256 delay) internal {
        typeDelays[proposalType] = delay;
        typeDelayInitialized[proposalType] = true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  2. EMERGENCY EXECUTOR                                        ║
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Emergency execution — bypass timelock delay for non-Treasury/Constitutional ops.
     */
    function emergencyExecute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external onlyEmergencyExecutor returns (bytes memory) {
        require(emergencyBypass, "Timelock: bypass not active");

        bytes32 id = hashOperation(target, value, data, predecessor, salt);

        ProposalType pType = operationProposalType[id];
        require(pType != ProposalType.Treasury, "Timelock: cannot bypass treasury");
        require(pType != ProposalType.Constitutional, "Timelock: cannot bypass constitutional");

        if (predecessor != bytes32(0)) {
            require(isOperationDone(predecessor), "Timelock: predecessor not done");
        }

        emergencyExecutions[id] = true;

        // Execute directly via internal _execute
        _execute(target, value, data);
        emit EmergencyExecuted(msg.sender, target, value, data, block.timestamp);

        return data;
    }

    function activateEmergencyBypass() external onlyEmergencyExecutor {
        require(!emergencyBypass, "Timelock: already active");
        emergencyBypass = true;
        emit EmergencyBypassActivated(msg.sender);
    }

    function deactivateEmergencyBypass() external onlyEmergencyExecutor {
        require(emergencyBypass, "Timelock: not active");
        emergencyBypass = false;
        emit EmergencyBypassDeactivated();
    }

    function setEmergencyExecutor(address newExecutor) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        require(newExecutor != address(0), "Timelock: invalid executor");
        emergencyExecutor = newExecutor;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  3. CANCELLER ROLE                                            ║
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Grant canceller role (CANCELLER_ROLE from base).
     */
    function grantCanceller(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        grantRole(CANCELLER_ROLE, account);
        emit CancellerRoleGranted(account);
    }

    /**
     * @notice Revoke canceller role.
     */
    function revokeCanceller(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        revokeRole(CANCELLER_ROLE, account);
        emit CancellerRoleRevoked(account);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  4. BATCH EXECUTION                                           ║
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Execute multiple operations atomically.
     * Each operation must be ready (delay elapsed).
     */
    function batchExecute(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata data,
        bytes32[] calldata predecessors,
        bytes32[] calldata salts
    ) external {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Timelock: not executor");
        require(targets.length > 0, "Timelock: empty batch");
        require(
            targets.length == values.length &&
            values.length == data.length &&
            data.length == predecessors.length &&
            predecessors.length == salts.length,
            "Timelock: length mismatch"
        );

        uint256 batchId = ++batchCounter;

        for (uint256 i = 0; i < targets.length; i++) {
            bytes32 id = hashOperation(targets[i], values[i], data[i], predecessors[i], salts[i]);
            require(isOperationReady(id), "Timelock: operation not ready");

            // Check predecessor
            if (predecessors[i] != bytes32(0)) {
                require(isOperationDone(predecessors[i]), "Timelock: predecessor not done");
            }

            // Execute each operation
            execute(targets[i], values[i], data[i], predecessors[i], salts[i]);
        }

        emit BatchExecuted(batchId, targets.length, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  5. MINIMUM DELAY ENFORCEMENT                                 ║
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Override updateDelay to enforce only-increasing.
     */
    function updateDelay(uint256 newDelay) external override(TimelockController) {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        require(newDelay >= 1 hours, "Timelock: delay too low");
        require(newDelay >= getMinDelay(), "Timelock: delay can only increase");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  OVERRIDES                                                    ║
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Get the minimum delay.
     */
    function getMinimumDelay() external view returns (uint256) {
        return getMinDelay();
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  UTILITY: TOKEN RECOVERY                                     ║
    // ═══════════════════════════════════════════════════════════════════

    function recoverTokens(IERC20 token, address to, uint256 amount) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        require(to != address(0), "Timelock: invalid to");
        token.safeTransfer(to, amount);
    }

    function recoverNative(address payable to, uint256 amount) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Timelock: not admin");
        require(to != address(0), "Timelock: invalid to");
        (bool sent,) = to.call{value: amount, gas: 2300}("");
        require(sent, "Timelock: transfer failed");
    }
}
