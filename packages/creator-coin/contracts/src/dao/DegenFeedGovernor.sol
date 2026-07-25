// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedGovernor
 * @notice Enhanced on-chain governance for creator coin DAOs with quadratic voting,
 * proposal types, veto, guardian pause, threshold tiers, and gasless voting.
 */

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {DegenFeedTimelock} from "./DegenFeedTimelock.sol";
import {ProposalType as TimelockProposalType} from "./DegenFeedTimelock.sol";

// ── Enums & Structs ──────────────────────────────────────────────────────

enum GovernorProposalType { Standard, Treasury, Constitutional, Signaling }

struct ProposalInfo {
    GovernorProposalType proposalType;
    bool quadraticVoting;
    uint256 createdAt;
    bool vetoed;
}

struct Guardian {
    address addr;
    bool active;
}

struct SigVote {
    uint256 proposalId;
    uint8 support;
    address voter;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

// ── Events ───────────────────────────────────────────────────────────────

event GovernorDeployed(address indexed governor, address indexed timelock, address indexed token);
event ProposalTypeSet(uint256 indexed proposalId, GovernorProposalType proposalType, bool quadraticVoting);
event ProposalVetoed(uint256 indexed proposalId, address indexed creator);
event GuardianAdded(address indexed guardian);
event GuardianRemoved(address indexed guardian);
event EmergencyPaused(uint256 indexed proposalId, address[] guardians);
event EmergencyUnpaused();
event ThresholdTierUpdated(uint256 tierIndex, uint256 supplyFloor, uint256 threshold);
event DelegationDecaySet(uint256 decayRateBps);
event VetoExpirySet(uint256 expiryTimestamp);
event VoteCastWithSignature(address indexed voter, uint256 indexed proposalId, uint8 support);

contract DegenFeedGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // ── Constants ──
    uint256 public constant MAX_GUARDIANS = 7;
    uint256 public constant GUARDIAN_THRESHOLD = 3;
    uint256 public constant DEFAULT_VETO_PERIOD = 90 days;
    uint256 public constant DEFAULT_DECAY_RATE_BPS = 100;

    bytes32 public constant VOTE_TYPEHASH = keccak256(
        "Vote(uint256 proposalId,uint8 support,address voter,uint256 deadline)"
    );
    bytes32 public constant EMERGENCY_PAUSER_ROLE = keccak256("EMERGENCY_PAUSER_ROLE");

    // ── State ──
    address public creator;
    bool public emergencyPaused;
    mapping(uint256 => ProposalInfo) public proposals;
    mapping(address => Guardian) public guardians;
    address[] public guardianList;
    uint256 public vetoExpiry;
    bool public vetoEnabled;
    uint256 public delegationDecayRateBps;
    uint256[] public thresholdTierFloors;
    uint256[] public thresholdTierAmounts;
    mapping(address => uint256) public lastDelegationTimestamp;
    mapping(uint256 => mapping(address => bool)) public guardianConfirmations;
    mapping(uint256 => uint256) public guardianConfirmationCount;
    mapping(address => uint256) public sigNonces;

    // ── Governance proposal deadlines tracking (manual late quorum) ──
    mapping(uint256 => uint256) private _proposalExtendedDeadlines;

    // ── Modifiers ──
    modifier notPaused() { require(!emergencyPaused, "G: paused"); _; }
    modifier onlyCreator() { require(msg.sender == creator, "G: not creator"); _; }
    modifier vetoActive() { require(vetoEnabled && block.timestamp < vetoExpiry, "G: veto expired"); _; }

    // ── Constructor ──
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
        GovernorSettings(uint48(_votingDelay), uint32(_votingPeriod), _proposalThreshold)
        GovernorVotes(token_)
        GovernorVotesQuorumFraction(_quorumPercent)
        GovernorTimelockControl(timelock_)
    {
        require(creator_ != address(0), "G: invalid creator");
        creator = creator_;
        vetoEnabled = true;
        vetoExpiry = block.timestamp + DEFAULT_VETO_PERIOD;
        delegationDecayRateBps = DEFAULT_DECAY_RATE_BPS;

        thresholdTierFloors = [0, 10_000_000 ether, 100_000_000 ether, 500_000_000 ether];
        thresholdTierAmounts = [1_000 ether, 5_000 ether, 25_000 ether, 100_000 ether];

        emit GovernorDeployed(address(this), address(timelock_), address(token_));
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  1. QUADRATIC VOTING                                      ║
    // ═══════════════════════════════════════════════════════════════

    function _getVotes(address account, uint256 timepoint, bytes memory params)
        internal view override(Governor, GovernorVotes) returns (uint256)
    {
        uint256 votes = super._getVotes(account, timepoint, params);

        // Delegation decay
        uint256 lastDel = lastDelegationTimestamp[account];
        if (lastDel > 0 && votes > 0) {
            uint256 daysSince = (block.timestamp - lastDel) / 1 days;
            if (daysSince > 0) {
                uint256 decayFactor = 10000 - (delegationDecayRateBps * daysSince);
                if (decayFactor < 1000) decayFactor = 1000;
                votes = (votes * decayFactor) / 10000;
            }
        }

        // Quadratic voting
        if (params.length >= 32 && abi.decode(params, (bool))) {
            votes = _sqrt(votes * 1e18);
        }
        return votes;
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
        return y;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  2. DELEGATION DECAY                                      ║
    // ═══════════════════════════════════════════════════════════════

    function recordDelegation(address delegator) external {
        require(msg.sender == address(token()), "G: only token");
        lastDelegationTimestamp[delegator] = block.timestamp;
    }

    function setDelegationDecayRate(uint256 rateBps) external onlyGovernance {
        require(rateBps <= 1000, "G: decay too high");
        delegationDecayRateBps = rateBps;
        emit DelegationDecaySet(rateBps);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  3. PROPOSAL TYPES                                        ║
    // ═══════════════════════════════════════════════════════════════

    function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
        public override(Governor) notPaused returns (uint256)
    {
        (GovernorProposalType pType, bool quadratic, string memory cleanDesc) = _parseDescription(description);
        bytes memory voteParams = quadratic ? abi.encode(true) : bytes("");

        uint256 proposalId = super.propose(targets, values, calldatas, description);

        proposals[proposalId] = ProposalInfo({
            proposalType: pType,
            quadraticVoting: quadratic,
            createdAt: block.timestamp,
            vetoed: false
        });

        emit ProposalTypeSet(proposalId, pType, quadratic);
        return proposalId;
    }

    function _parseDescription(string memory desc)
        internal pure returns (GovernorProposalType, bool, string memory)
    {
        bytes memory b = bytes(desc);
        if (b.length == 0 || b[0] != 0x23) return (GovernorProposalType.Standard, false, desc);

        uint256 spacePos = b.length;
        for (uint256 i = 0; i < b.length; i++) { if (b[i] == 0x20) { spacePos = i; break; } }

        bytes memory tag;
        bytes memory rest;
        if (spacePos == b.length) { tag = b; rest = new bytes(0); }
        else {
            tag = new bytes(spacePos - 1);
            for (uint256 i = 1; i < spacePos; i++) tag[i - 1] = b[i];
            rest = new bytes(b.length - spacePos);
            for (uint256 i = spacePos; i < b.length; i++) rest[i - spacePos] = b[i];
        }

        string memory tagStr = string(tag);
        bool quad;

        // Check for +Quadratic suffix
        bytes memory tBytes = bytes(tagStr);
        if (tBytes.length > 9) {
            bytes memory suffix = new bytes(9);
            for (uint256 i = tBytes.length - 9; i < tBytes.length; i++) suffix[i - (tBytes.length - 9)] = tBytes[i];
            if (keccak256(suffix) == keccak256(bytes("+Quadratic"))) {
                quad = true;
                bytes memory stripped = new bytes(tBytes.length - 9);
                for (uint256 i = 0; i < tBytes.length - 9; i++) stripped[i] = tBytes[i];
                tagStr = string(stripped);
            }
        }

        bytes32 h = keccak256(bytes(tagStr));
        if (h == keccak256(bytes("Treasury"))) return (GovernorProposalType.Treasury, quad, string(rest));
        if (h == keccak256(bytes("Constitutional"))) return (GovernorProposalType.Constitutional, quad, string(rest));
        if (h == keccak256(bytes("Signaling"))) return (GovernorProposalType.Signaling, quad, string(rest));
        if (h == keccak256(bytes("Quadratic"))) return (GovernorProposalType.Standard, true, string(rest));

        return (GovernorProposalType.Standard, false, desc);
    }

    // ── Proposal type: quorum ──
    function _quorumReached(uint256 proposalId)
        internal view override(Governor, GovernorCountingSimple) returns (bool)
    {
        GovernorProposalType pType = proposals[proposalId].proposalType;
        if (pType == GovernorProposalType.Signaling) return true;

        (uint256 against,,) = proposalVotes(proposalId);
        (uint256 _for,,) = proposalVotes(proposalId);
        (,, uint256 abstain) = proposalVotes(proposalId);
        // Actually just use proposalVotes once
        (uint256 aV, uint256 fV, uint256 abV) = proposalVotes(proposalId);
        uint256 totalWeight = aV + fV + abV;
        uint256 supply = token().getPastTotalSupply(proposalSnapshot(proposalId));

        if (pType == GovernorProposalType.Treasury) return totalWeight >= (supply * 60) / 100;
        if (pType == GovernorProposalType.Constitutional) return totalWeight >= (supply * 75) / 100;

        return totalWeight >= quorum(proposalSnapshot(proposalId));
    }

    // ── Proposal type: vote success ──
    function _voteSucceeded(uint256 proposalId)
        internal view override(Governor, GovernorCountingSimple) returns (bool)
    {
        GovernorProposalType pType = proposals[proposalId].proposalType;
        if (pType == GovernorProposalType.Signaling) return true;

        (uint256 aV, uint256 fV, uint256 abV) = proposalVotes(proposalId);
        uint256 total = aV + fV + abV;
        if (total == 0) return false;

        if (pType == GovernorProposalType.Treasury) return (fV * 3) >= (total * 2);
        if (pType == GovernorProposalType.Constitutional) return (fV * 4) >= (total * 3);
        return fV > aV;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  4. VETO                                                 ║
    // ═══════════════════════════════════════════════════════════════

    function veto(uint256 proposalId) external onlyCreator vetoActive {
        ProposalInfo storage info = proposals[proposalId];
        require(!info.vetoed, "G: already vetoed");
        require(info.proposalType != GovernorProposalType.Treasury && info.proposalType != GovernorProposalType.Constitutional, "G: cannot veto");
        require(state(proposalId) == ProposalState.Pending || state(proposalId) == ProposalState.Active, "G: wrong state");

        info.vetoed = true;
        emit ProposalVetoed(proposalId, msg.sender);
    }

    function isVetoed(uint256 proposalId) external view returns (bool) {
        return proposals[proposalId].vetoed;
    }

    function disableVeto() external onlyGovernance { vetoEnabled = false; }

    function extendVeto(uint256 additionalSeconds) external onlyGovernance {
        require(additionalSeconds <= 90 days, "G: too long");
        vetoExpiry = block.timestamp + additionalSeconds;
        emit VetoExpirySet(vetoExpiry);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  5. EMERGENCY PAUSE — GUARDIANS (3-of-N)                 ║
    // ═══════════════════════════════════════════════════════════════

    function addGuardian(address guardian) external onlyGovernance {
        require(guardian != address(0) && !guardians[guardian].active && guardianList.length < MAX_GUARDIANS, "G: bad guardian");
        guardians[guardian] = Guardian(guardian, true);
        guardianList.push(guardian);
        emit GuardianAdded(guardian);
    }

    function removeGuardian(address guardian) external onlyGovernance {
        require(guardians[guardian].active, "G: not guardian");
        guardians[guardian].active = false;
        for (uint256 i = 0; i < guardianList.length; i++) {
            if (guardianList[i] == guardian) { guardianList[i] = guardianList[guardianList.length - 1]; guardianList.pop(); break; }
        }
        emit GuardianRemoved(guardian);
    }

    function confirmMalicious(uint256 proposalId) external {
        require(guardians[msg.sender].active, "G: not guardian");
        require(!guardianConfirmations[proposalId][msg.sender], "G: already confirmed");
        guardianConfirmations[proposalId][msg.sender] = true;
        guardianConfirmationCount[proposalId]++;
        if (guardianConfirmationCount[proposalId] >= GUARDIAN_THRESHOLD) {
            emergencyPaused = true;
            emit EmergencyPaused(proposalId, guardianList);
        }
    }

    function pause() external {
        require(hasRole(EMERGENCY_PAUSER_ROLE, msg.sender), "G: unauthorized");
        emergencyPaused = true;
    }

    function unpause() external {
        require(hasRole(EMERGENCY_PAUSER_ROLE, msg.sender), "G: unauthorized");
        emergencyPaused = false;
        emit EmergencyUnpaused();
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return (role == EMERGENCY_PAUSER_ROLE) && (account == creator || guardians[account].active);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  6. PROPOSAL THRESHOLD TIERS                             ║
    // ═══════════════════════════════════════════════════════════════

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        uint256 supply = token().getPastTotalSupply(clock());
        for (uint256 i = thresholdTierFloors.length; i > 0; i--) {
            if (supply >= thresholdTierFloors[i - 1]) return thresholdTierAmounts[i - 1];
        }
        return super.proposalThreshold();
    }

    function setThresholdTiers(uint256[] calldata floors, uint256[] calldata amounts) external onlyGovernance {
        require(floors.length == amounts.length && floors.length > 0, "G: bad tiers");
        for (uint256 i = 0; i < floors.length; i++) emit ThresholdTierUpdated(i, floors[i], amounts[i]);
        thresholdTierFloors = floors; thresholdTierAmounts = amounts;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  7. LATE QUORUM EXTENSION (manual implementation)         ║
    // ═══════════════════════════════════════════════════════════════

    function proposalDeadline(uint256 proposalId) public view override(Governor) returns (uint256) {
        uint256 extended = _proposalExtendedDeadlines[proposalId];
        return extended > 0 ? extended : super.proposalDeadline(proposalId);
    }

    function _countVote(uint256 proposalId, address account, uint8 support, uint256 totalWeight, bytes memory params)
        internal override(Governor, GovernorCountingSimple) returns (uint256)
    {
        uint256 result = super._countVote(proposalId, account, support, totalWeight, params);

        // Late quorum extension
        uint256 origDead = super.proposalDeadline(proposalId);
        if (block.timestamp < origDead && _proposalExtendedDeadlines[proposalId] == 0 && (origDead - block.timestamp) <= 1 hours) {
            (uint256 aV, uint256 fV, uint256 abV) = proposalVotes(proposalId);
            uint256 totV = aV + fV + abV;
            (uint256 sup, uint256 q) = _getSnapshotData(proposalId);
            if (totV > 0 && (totV * 10000) >= (sup * q)) {
                _proposalExtendedDeadlines[proposalId] = origDead + 1 hours;
            }
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  8. GASLESS VOTING (EIP-712 style)                       ║
    // ═══════════════════════════════════════════════════════════════

    function castVoteBySig(SigVote calldata sigVote) external notPaused returns (uint256) {
        require(sigVote.deadline >= block.timestamp, "G: expired");
        require(sigVote.voter != address(0), "G: invalid voter");

        bytes32 structHash = keccak256(abi.encode(VOTE_TYPEHASH, sigVote.proposalId, sigVote.support, sigVote.voter, sigVote.deadline));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
        require(ECDSA.recover(ethSigned, sigVote.v, sigVote.r, sigVote.s) == sigVote.voter, "G: bad signature");

        sigNonces[sigVote.voter]++;

        ProposalInfo storage info = proposals[sigVote.proposalId];
        bytes memory params = info.quadraticVoting ? abi.encode(true) : bytes("");

        uint256 weight = super._castVote(sigVote.proposalId, sigVote.voter, sigVote.support, "", params);
        emit VoteCastWithSignature(sigVote.voter, sigVote.proposalId, sigVote.support);
        return weight;
    }

    function getSigNonce(address voter) external view returns (uint256) { return sigNonces[voter]; }

    // ═══════════════════════════════════════════════════════════════
    // ║  REQUIRED GOVERNOR OVERRIDES                              ║
    // ═══════════════════════════════════════════════════════════════

    function clock() public view override(Governor, GovernorVotes) returns (uint48) { return uint48(block.timestamp); }
    function CLOCK_MODE() public pure override(Governor, GovernorVotes) returns (string memory) { return "mode=timestamp"; }
    function quorum(uint256 timepoint) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) { return super.quorum(timepoint); }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        if (proposals[proposalId].vetoed) return ProposalState.Canceled;
        return super.state(proposalId);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal override(Governor, GovernorTimelockControl) returns (uint256) { return super._cancel(targets, values, calldatas, descriptionHash); }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) { return super._executor(); }

    function _queueOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal override(Governor, GovernorTimelockControl) returns (uint48)
    {
        GovernorProposalType gType = proposals[proposalId].proposalType;
        if (gType == GovernorProposalType.Treasury || gType == GovernorProposalType.Constitutional) {
            TimelockProposalType tType = gType == GovernorProposalType.Treasury ? TimelockProposalType.Treasury : TimelockProposalType.Constitutional;
            DegenFeedTimelock timelock = DegenFeedTimelock(payable(address(super._executor())));
            timelock.scheduleBatchWithType(tType, targets, values, calldatas, bytes32(0), keccak256(abi.encode(proposalId)), 0);
            return uint48(block.timestamp + timelock.getTypeDelay(tType));
        }
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal override(Governor, GovernorTimelockControl) { super._executeOperations(proposalId, targets, values, calldatas, descriptionHash); }

    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(Governor) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ── View helpers ──
    function timelockAddress() external view returns (address) { return address(super._executor()); }
    function tokenAddress() external view returns (address) { return address(token()); }
    function getGuardians() external view returns (address[] memory) { return guardianList; }
    function getThresholdTiers() external view returns (uint256[] memory, uint256[] memory) { return (thresholdTierFloors, thresholdTierAmounts); }
    function getProposalInfo(uint256 proposalId) external view returns (ProposalInfo memory) { return proposals[proposalId]; }

    /// @dev Helper to reduce stack depth in _countVote
    function _getSnapshotData(uint256 proposalId) internal view returns (uint256 supply, uint256 q) {
        uint256 snap = proposalSnapshot(proposalId);
        supply = token().getPastTotalSupply(snap);
        q = quorum(snap);
    }
}
