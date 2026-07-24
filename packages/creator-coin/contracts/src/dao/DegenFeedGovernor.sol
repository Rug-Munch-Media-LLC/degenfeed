// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedGovernor
 * @notice On-chain governance for creator coin DAOs.
 *
 * Uses OpenZeppelin Governor with:
 *   - GovernorVotes: voting power from ERC20Votes token
 *   - GovernorVotesQuorumFraction: quorum as % of supply
 *   - GovernorCountingSimple: For/Against/Abstain
 *   - GovernorTimelockControl: 48h timelock on execution
 *   - GovernorSettings: updatable parameters via governance
 *   - GovernorPreventLateQuorum: security against last-minute votes
 *
 * The contract is deployed AFTER a creator coin graduates.
 * It sits between proposals and the treasury (TimelockController).
 *
 * @dev Uses OpenZeppelin v5.x contracts.
 */

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {GovernorPreventLateQuorum} from "@openzeppelin/contracts/governance/extensions/GovernorPreventLateQuorum.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @notice Emitted when the governor is deployed
event GovernorDeployed(address indexed governor, address indexed timelock, address indexed token);

contract DegenFeedGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl,
    GovernorPreventLateQuorum
{
    /// @notice Emergency multisig role for pausing
    bytes32 public constant EMERGENCY_PAUSER_ROLE = keccak256("EMERGENCY_PAUSER_ROLE");

    /// @notice Whether emergency pause is active
    bool public emergencyPaused;

    /// @notice The emergency multisig contract address
    address public emergencyMultisig;

    /// @notice Creator address (original coin creator)
    address public creator;

    modifier notPaused() {
        require(!emergencyPaused, "Governor: emergency paused");
        _;
    }

    /**
     * @notice Deploy the governor with timelock.
     * @param token_ The ERC20Votes token for voting power
     * @param timelock_ The TimelockController for execution delay
     * @param creator_ The original coin creator
     * @param emergencyMultisig_ Emergency multisig address
     * @param _votingDelay Delay before voting starts (in blocks)
     * @param _votingPeriod Voting duration (in blocks)
     * @param _quorumPercent Quorum as percentage of total supply
     * @param _proposalThreshold Minimum tokens to propose
     */
    constructor(
        IVotes token_,
        TimelockController timelock_,
        address creator_,
        address emergencyMultisig_,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _quorumPercent,
        uint256 _proposalThreshold
    )
        Governor("DegenFeedGovernor")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(token_)
        GovernorVotesQuorumFraction(_quorumPercent)
        GovernorTimelockControl(timelock_)
        GovernorPreventLateQuorum(7200) // 1 hour minimum after quorum reached (in blocks)
    {
        creator = creator_;
        emergencyMultisig = emergencyMultisig_;

        emit GovernorDeployed(address(this), address(timelock_), address(token_));
    }

    // ─── Required Overrides ─────────────────────────────────────────────────

    function clock() public view override returns (uint48) {
        return uint48(block.number);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=blocknumber&from=default";
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) notPaused {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _quorumReached(uint256 proposalId)
        internal
        view
        override(Governor, GovernorPreventLateQuorum)
        returns (bool)
    {
        return super._quorumReached(proposalId);
    }

    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(Governor)
        returns (bool)
    {
        return super._voteSucceeded(proposalId);
    }

    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 totalWeight,
        bytes memory params
    ) internal override(Governor, GovernorPreventLateQuorum) {
        super._countVote(proposalId, account, support, totalWeight, params);
    }

    function _getVotes(
        address account,
        uint256 timepoint,
        bytes memory params
    ) internal view override(Governor, GovernorVotes) returns (uint256) {
        return super._getVotes(account, timepoint, params);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) notPaused returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    function castVote(uint256 proposalId, uint8 support)
        public
        override(Governor)
        notPaused
        returns (uint256)
    {
        return super.castVote(proposalId, support);
    }

    function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason)
        public
        override(Governor)
        notPaused
        returns (uint256)
    {
        return super.castVoteWithReason(proposalId, support, reason);
    }

    // ─── Emergency Controls ─────────────────────────────────────────────────

    /**
     * @notice Pause all governance actions. Only callable by emergency multisig.
     */
    function pause() external {
        require(
            msg.sender == emergencyMultisig || hasRole(EMERGENCY_PAUSER_ROLE, msg.sender),
            "Governor: not authorized"
        );
        emergencyPaused = true;
    }

    /**
     * @notice Unpause governance. Only callable by emergency multisig.
     */
    function unpause() external {
        require(
            msg.sender == emergencyMultisig || hasRole(EMERGENCY_PAUSER_ROLE, msg.sender),
            "Governor: not authorized"
        );
        emergencyPaused = false;
    }

    /**
     * @notice Update the emergency multisig address. Requires governance proposal.
     */
    function setEmergencyMultisig(address newMultisig) external onlyGovernance {
        require(newMultisig != address(0), "Governor: invalid address");
        emergencyMultisig = newMultisig;
    }

    /**
     * @notice Check if a role has been granted.
     */
    function hasRole(bytes32 role, address account) public view returns (bool) {
        // This is a simplified check — in production use AccessControl
        return account == emergencyMultisig;
    }

    // ─── Supports Interface ─────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
