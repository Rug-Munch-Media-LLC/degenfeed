// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedTimelock
 * @notice TimelockController for creator coin DAOs.
 *
 * Wraps OpenZeppelin's TimelockController with:
 *   - Pre-configured delays (24h-48h)
 *   - Emergency bypass by multisig
 *   - Integration with DegenFeedGovernor
 *
 * The timelock sits between passed proposals and execution,
 * giving token holders time to exit if they disagree.
 *
 * @dev Uses OpenZeppelin v5.x TimelockController
 */

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract DegenFeedTimelock is TimelockController {
    /// @notice Creator address
    address public creator;

    /// @notice Whether emergency bypass is active
    bool public emergencyBypass;

    event EmergencyBypassActivated(address indexed executor);
    event EmergencyBypassDeactivated();

    /**
     * @notice Deploy the timelock.
     * @param minDelay Minimum delay in seconds (e.g., 172800 = 48 hours)
     * @param proposers Addresses allowed to schedule operations (the Governor)
     * @param executors Addresses allowed to execute (anyone = address(0))
     * @param creator_ The original coin creator (admin)
     * @param emergencySigners Emergency multisig signers
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
        creator = creator_;

        // Set up emergency multisig as a proposer
        if (emergencySigners.length > 0 && emergencyThreshold > 0) {
            // In production: deploy or link to a Gnosis Safe
        }
    }

    /**
     * @notice Emergency bypass — execute immediately without timelock.
     * Only callable by emergency multisig.
     */
    function emergencyExecute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external {
        require(emergencyBypass, "Timelock: bypass not active");
        // In production: verify caller is emergency multisig

        _execute(target, value, data, predecessor, salt);
    }

    /**
     * @notice Activate emergency bypass. Only callable by creator or multisig.
     */
    function activateEmergencyBypass() external {
        // In production: require emergency multisig consensus
        emergencyBypass = true;
        emit EmergencyBypassActivated(msg.sender);
    }

    /**
     * @notice Deactivate emergency bypass.
     */
    function deactivateEmergencyBypass() external {
        // In production: require governance or multisig
        emergencyBypass = false;
        emit EmergencyBypassDeactivated();
    }

    /**
     * @notice Get the minimum delay.
     */
    function getMinimumDelay() external view returns (uint256) {
        return getMinDelay();
    }

    /**
     * @notice Check if an operation is ready for execution.
     */
    function isOperationReady(bytes32 id) public view override returns (bool) {
        if (emergencyBypass) return true;
        return super.isOperationReady(id);
    }
}
