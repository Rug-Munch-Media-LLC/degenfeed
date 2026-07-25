// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedDAOFactoryV2
 * @notice Factory for deploying DAO governance contracts.
 *
 * Security fixes applied per DAO-SECURITY-AUDIT.md (2026-07-25):
 *   G-14: Use OpenZeppelin Ownable instead of platformFeeReceiver check
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {DegenFeedGovernorV2} from "./DegenFeedGovernorV2.sol";
import {DegenFeedTimelockV2} from "./DegenFeedTimelockV2.sol";

event DAODeployed(
    address indexed coin,
    address indexed governor,
    address indexed timelock,
    address creator,
    uint256 timestamp
);

struct DAODeploymentParams {
    address coin;
    address creator;
    address emergencyMultisig;
    uint256 votingDelay;
    uint256 votingPeriod;
    uint256 quorumPercent;
    uint256 proposalThreshold;
    uint256 timelockDelay;
}

contract DegenFeedDAOFactoryV2 is Ownable {
    /// @notice Platform fee receiver
    address public platformFeeReceiver;

    /// @notice Whether the factory is paused
    bool public paused;

    /// @notice Track deployed DAOs: coin => governor
    mapping(address => address) public deployedDAOs;

    /// @notice List of all deployed DAOs
    address[] public allDAOs;

    event FeeUpdated(uint256 newFeeBps);
    event Paused(bool isPaused);
    event PlatformFeeReceiverUpdated(address indexed newReceiver);

    modifier notPaused() {
        require(!paused, "FactoryV2: paused");
        _;
    }

    /// @notice G-14: Use Ownable for access control
    constructor(address _platformFeeReceiver) Ownable(msg.sender) {
        require(_platformFeeReceiver != address(0), "FactoryV2: invalid receiver");
        platformFeeReceiver = _platformFeeReceiver;
    }

    function deployDAO(DAODeploymentParams calldata params)
        external
        notPaused
        returns (address governor, address timelock)
    {
        require(params.coin != address(0), "FactoryV2: invalid coin");
        require(params.creator != address(0), "FactoryV2: invalid creator");
        require(deployedDAOs[params.coin] == address(0), "FactoryV2: already deployed");
        require(params.quorumPercent > 0 && params.quorumPercent <= 100, "FactoryV2: invalid quorum");
        require(params.votingPeriod > 0, "FactoryV2: invalid period");
        require(params.timelockDelay >= 86400, "FactoryV2: delay < 1 day");

        address[] memory proposers = new address[](1);
        proposers[0] = address(this);

        address[] memory executors = new address[](1);
        executors[0] = address(0);

        address[] memory emergencySigners = new address[](1);
        emergencySigners[0] = params.emergencyMultisig;

        DegenFeedTimelockV2 timelockContract = new DegenFeedTimelockV2(
            params.timelockDelay,
            proposers,
            executors,
            params.creator,
            emergencySigners,
            1
        );
        timelock = address(timelockContract);

        // Deploy V2 Governor with initial guardians
        address[] memory initialGuardians = new address[](1);
        initialGuardians[0] = params.emergencyMultisig;

        DegenFeedGovernorV2 governorContract = new DegenFeedGovernorV2(
            IVotes(params.coin),
            TimelockController(payable(timelock)),
            params.creator,
            initialGuardians,
            params.votingDelay,
            params.votingPeriod,
            params.quorumPercent,
            params.proposalThreshold
        );
        governor = address(governorContract);

        bytes32 proposerRole = timelockContract.PROPOSER_ROLE();
        timelockContract.grantRole(proposerRole, governor);
        timelockContract.revokeRole(proposerRole, address(this));

        deployedDAOs[params.coin] = governor;
        allDAOs.push(governor);

        emit DAODeployed(params.coin, governor, timelock, params.creator, block.timestamp);
    }

    function getDAOCount() external view returns (uint256) {
        return allDAOs.length;
    }

    function getAllDAOs() external view returns (address[] memory) {
        return allDAOs;
    }

    /// @notice G-14: Use onlyOwner instead of custom check
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Update platform fee receiver
    function setPlatformFeeReceiver(address _newReceiver) external onlyOwner {
        require(_newReceiver != address(0), "FactoryV2: invalid receiver");
        platformFeeReceiver = _newReceiver;
        emit PlatformFeeReceiverUpdated(_newReceiver);
    }
}
