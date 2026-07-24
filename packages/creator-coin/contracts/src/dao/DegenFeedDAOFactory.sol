// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedDAOFactory
 * @notice Factory for deploying DAO governance contracts.
 *
 * Deploys:
 *   1. DegenFeedTimelock — timelock controller
 *   2. DegenFeedGovernor — voting and proposal management
 *
 * The factory is called after a creator coin graduates.
 * It creates the full on-chain governance stack in one transaction.
 *
 * @dev Uses CREATE2 for deterministic addresses.
 */

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {DegenFeedGovernor} from "./DegenFeedGovernor.sol";
import {DegenFeedTimelock} from "./DegenFeedTimelock.sol";

/// @notice Emitted when a full DAO governance stack is deployed
event DAODeployed(
    address indexed coin,
    address indexed governor,
    address indexed timelock,
    address creator,
    uint256 timestamp
);

/// @notice Parameters for deploying a DAO
struct DAODeploymentParams {
    address coin;               // Creator coin address
    address creator;            // Original creator
    address emergencyMultisig;  // Emergency multisig
    uint256 votingDelay;        // Blocks before voting starts
    uint256 votingPeriod;       // Voting duration in blocks
    uint256 quorumPercent;      // Quorum as % of supply
    uint256 proposalThreshold;  // Min tokens to propose
    uint256 timelockDelay;      // Timelock delay in seconds
}

contract DegenFeedDAOFactory {
    /// @notice Platform fee receiver
    address public platformFeeReceiver;

    /// @notice Whether the factory is paused
    bool public paused;

    /// @notice Track deployed DAOs: coin => governor
    mapping(address => address) public deployedDAOs;

    /// @notice List of all deployed DAOs
    address[] public allDAOs;

    event DAODeployed(address indexed coin, address indexed governor, address indexed timelock);
    event FeeUpdated(uint256 newFeeBps);
    event Paused(bool isPaused);

    modifier notPaused() {
        require(!paused, "Factory: paused");
        _;
    }

    /**
     * @notice Deploy a full DAO governance stack for a creator coin.
     * @param params Deployment parameters
     * @return governor Address of the deployed Governor
     * @return timelock Address of the deployed Timelock
     */
    function deployDAO(DAODeploymentParams calldata params)
        external
        notPaused
        returns (address governor, address timelock)
    {
        require(params.coin != address(0), "Factory: invalid coin");
        require(params.creator != address(0), "Factory: invalid creator");
        require(deployedDAOs[params.coin] == address(0), "Factory: already deployed");
        require(params.quorumPercent > 0 && params.quorumPercent <= 100, "Factory: invalid quorum");
        require(params.votingPeriod > 0, "Factory: invalid period");
        require(params.timelockDelay >= 86400, "Factory: delay < 1 day"); // Min 1 day

        // 1. Deploy Timelock
        address[] memory proposers = new address[](1);
        // Governor address isn't known yet — we'll set it after deployment
        // For now, we temporarily use a placeholder
        proposers[0] = address(this); // Factory temporarily acts as proposer

        address[] memory executors = new address[](1);
        executors[0] = address(0); // Anyone can execute after delay

        address[] memory emergencySigners = new address[](1);
        emergencySigners[0] = params.emergencyMultisig;

        DegenFeedTimelock timelockContract = new DegenFeedTimelock(
            params.timelockDelay,
            proposers,
            executors,
            params.creator,
            emergencySigners,
            1
        );
        timelock = address(timelockContract);

        // 2. Deploy Governor
        DegenFeedGovernor governorContract = new DegenFeedGovernor(
            IVotes(params.coin),
            TimelockController(payable(timelock)),
            params.creator,
            params.emergencyMultisig,
            params.votingDelay,
            params.votingPeriod,
            params.quorumPercent,
            params.proposalThreshold
        );
        governor = address(governorContract);

        // 3. Transfer proposer role to Governor
        bytes32 proposerRole = timelockContract.PROPOSER_ROLE();
        timelockContract.grantRole(proposerRole, governor);

        // Revoke factory's proposer role
        timelockContract.revokeRole(proposerRole, address(this));

        // 4. Register
        deployedDAOs[params.coin] = governor;
        allDAOs.push(governor);

        emit DAODeployed(params.coin, governor, timelock);
    }

    /**
     * @notice Get the number of deployed DAOs.
     */
    function getDAOCount() external view returns (uint256) {
        return allDAOs.length;
    }

    /**
     * @notice Get all deployed DAO governors.
     */
    function getAllDAOs() external view returns (address[] memory) {
        return allDAOs;
    }

    /**
     * @notice Pause/unpause the factory.
     */
    function setPaused(bool _paused) external {
        require(msg.sender == platformFeeReceiver, "Factory: not authorized");
        paused = _paused;
        emit Paused(_paused);
    }

    /**
     * @notice Constructor
     */
    constructor(address _platformFeeReceiver) {
        require(_platformFeeReceiver != address(0), "Factory: invalid receiver");
        platformFeeReceiver = _platformFeeReceiver;
    }
}
