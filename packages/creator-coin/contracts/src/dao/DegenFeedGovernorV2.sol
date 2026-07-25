// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedGovernorV2
 * @notice Enhanced on-chain governance with flash loan protection, EIP-712 signatures,
 * multi-sig veto guardian, dynamic quorum, emergency pause cooldown, and AccessControl.
 *
 * Security fixes applied per DAO-SECURITY-AUDIT.md (2026-07-25):
 *   G-01: MIN_HOLDING_PERIOD — flash loan protection
 *   G-02: Multi-sig guardian veto (3-of-N) instead of single creator
 *   G-05: EIP-712 typed signatures with domain separator
 *   G-07: Emergency pause cooldown (7 days)
 *   G-08: Veto expiry hard cap (365 days)
 *   G-09: Minimum voting delay enforcement (1 hour)
 *   G-10: OpenZeppelin AccessControl instead of custom hasRole
 *   G-13: Dynamic quorum based on historical participation
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
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
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
event ProposalVetoed(uint256 indexed proposalId, address indexed guardian);
event GuardianAdded(address indexed guardian);
event GuardianRemoved(address indexed guardian);
event EmergencyPaused(uint256 indexed proposalId, address[] guardians);
event EmergencyUnpaused();
event ThresholdTierUpdated(uint256 tierIndex, uint256 supplyFloor, uint256 threshold);
event DelegationDecaySet(uint256 decayRateBps);
event VetoExpirySet(uint256 expiryTimestamp);
event VoteCastWithSignature(address indexed voter, uint256 indexed proposalId, uint8 support);
event FlashLoanVoteBlocked(address indexed voter, uint256 minHoldingPeriod);

contract DegenFeedGovernorV2 is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl,
    GovernorPreventLateQuorum,
    AccessControl
{
    // ── Constants ──
    uint256 public constant MAX_GUARDIANS = 7;
    uint256 public constant GUARDIAN_THRESHOLD = 3;
    uint256 public constant DEFAULT_VETO_PERIOD = 90 days;
    uint256 public constant MAX_VETO_TOTAL = 365 days;
    uint256 public constant DEFAULT_DECAY_RATE_BPS = 100;
    uint256 public constant MIN_HOLDING_PERIOD = 3 days;
    uint256 public constant MIN_VOTING_DELAY = 1 hours;
    uint256 public constant PAUSE_COOLDOWN = 7 days;
    uint256 public constant MIN_QUORUM_BPS = 200; // 2% minimum
    uint256 public constant QUORUM_DECAY_BPS = 1000; // 10% decay per period

    bytes32 public constant EMERGENCY_PAUSER_ROLE = keccak256("EMERGENCY_PAUSER_ROLE");
    bytes32 public constant VETO_GUARDIAN_ROLE = keccak256("VETO_GUARDIAN_ROLE");

    // ── EIP-712 Domain ──
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant VOTE_TYPEHASH = keccak256(
        "Vote(uint256 proposalId,uint8 support,address voter,uint256 deadline,uint256 nonce)"
    );

    // ── State ──
    address public creator;
    bool public emergencyPaused;
    uint256 public pauseActivatedAt;
    mapping(uint256 => ProposalInfo) public proposals;
    mapping(address => Guardian) public guardians;
    address[] public guardianList;
    uint256 public vetoExpiry;
    uint256 public vetoStartTimestamp;
    bool public vetoEnabled;
    uint256 public delegationDecayRateBps;
    uint256[] public thresholdTierFloors;
    uint256[] public thresholdTierAmounts;
    mapping(address => uint256) public lastDelegationTimestamp;
    mapping(address => uint256) public tokenLockTimestamps;
    mapping(uint256 => mapping(address => bool)) public guardianConfirmations;
    mapping(uint256 => uint256) public guardianConfirmationCount;
    mapping(address => uint256) public sigNonces;

    // ── Dynamic quorum tracking ──
    uint256[] public recentProposalQuorums;
    uint256 public constant MAX_QUORUM_HISTORY = 10;

    // ── Modifiers ──
    modifier notPaused() { require(!emergencyPaused, "Gv2: paused"); _; }
    modifier onlyCreator() { require(msg.sender == creator, "Gv2: not creator"); _; }
    modifier vetoActive() { require(vetoEnabled && block.timestamp < vetoExpiry, "Gv2: veto expired"); _; }

    // ── Constructor ──
    constructor(
        IVotes token_,
        TimelockController timelock_,
        address creator_,
        address[] memory initialGuardians,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _quorumPercent,
        uint256 _proposalThreshold
    )
        Governor("DegenFeedGovernorV2")
        GovernorSettings(uint48(_votingDelay), uint32(_votingPeriod), _proposalThreshold)
        GovernorVotes(token_)
        GovernorVotesQuorumFraction(_quorumPercent)
        GovernorTimelockControl(timelock_)
        GovernorPreventLateQuorum(1 hours) // 1 hour late quorum extension
    {
        require(creator_ != address(0), "Gv2: invalid creator");
        creator = creator_;
        vetoEnabled = true;
        vetoExpiry = block.timestamp + DEFAULT_VETO_PERIOD;
        vetoStartTimestamp = block.timestamp;
        delegationDecayRateBps = DEFAULT_DECAY_RATE_BPS;

        thresholdTierFloors = [0, 10_000_000 ether, 100_000_000 ether, 500_000_000 ether];
        thresholdTierAmounts = [1_000 ether, 5_000 ether, 25_000 ether, 100_000 ether];

        // Grant EMERGENCY_PAUSER_ROLE to creator and initial guardians
        _grantRole(EMERGENCY_PAUSER_ROLE, creator_);
        for (uint256 i = 0; i < initialGuardians.length; i++) {
            if (initialGuardians[i] != address(0)) {
                guardians[initialGuardians[i]] = Guardian(initialGuardians[i], true);
                guardianList.push(initialGuardians[i]);
                _grantRole(EMERGENCY_PAUSER_ROLE, initialGuardians[i]);
                _grantRole(VETO_GUARDIAN_ROLE, initialGuardians[i]);
            }
        }

        emit GovernorDeployed(address(this), address(timelock_), address(token_));
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  1. FLASH LOAN PROTECTION (G-01 fix)                     ║
    // ═══════════════════════════════════════════════════════════════

    /// @notice Record when a user acquires tokens for flash loan protection
    function recordTokenLock(address account) external {
        require(msg.sender == address(token()), "Gv2: only token");
        tokenLockTimestamps[account] = block.timestamp;
    }

    /// @notice Check if account has held tokens long enough to vote
    function _hasMetHoldingPeriod(address account) internal view returns (bool) {
        return block.timestamp >= tokenLockTimestamps[account] + MIN_HOLDING_PERIOD;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  2. QUADRATIC VOTING                                      ║
    // ═══════════════════════════════════════════════════════════════

    function _getVotes(address account, uint256 timepoint, bytes memory params)
        internal view override(Governor, GovernorVotes) returns (uint256)
    {
        // G-01: Flash loan protection — require MIN_HOLDING_PERIOD
        if (!_hasMetHoldingPeriod(account)) return 0;

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
    // ║  3. DELEGATION DECAY                                      ║
    // ═══════════════════════════════════════════════════════════════

    function recordDelegation(address delegator) external {
        require(msg.sender == address(token()), "Gv2: only token");
        lastDelegationTimestamp[delegator] = block.timestamp;
    }

    function setDelegationDecayRate(uint256 rateBps) external onlyGovernance {
        require(rateBps <= 1000, "Gv2: decay too high");
        delegationDecayRateBps = rateBps;
        emit DelegationDecaySet(rateBps);
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  4. PROPOSAL TYPES                                        ║
    // ═══════════════════════════════════════════════════════════════

    /// @notice G-09: Enforce minimum voting delay
    function setVotingDelay(uint48 newVotingDelay) public override onlyGovernance {
        require(newVotingDelay >= MIN_VOTING_DELAY, "Gv2: min delay 1 hour");
        super.setVotingDelay(newVotingDelay);
    }

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

    // ═══════════════════════════════════════════════════════════════
    // ║  5. G-13: DYNAMIC QUORUM BASED ON PARTICIPATION          ║
    // ═══════════════════════════════════════════════════════════════

    /// @notice Record quorum usage for dynamic calculation
    function _recordQuorum(uint256 proposalId) internal {
        (uint256 aV, uint256 fV, uint256 abV) = proposalVotes(proposalId);
        uint256 totalWeight = aV + fV + abV;
        uint256 snap = proposalSnapshot(proposalId);
        uint256 supply = token().getPastTotalSupply(snap);

        if (supply > 0) {
            uint256 quorumBps = (totalWeight * 10000) / supply;
            recentProposalQuorums.push(quorumBps);
            if (recentProposalQuorums.length > MAX_QUORUM_HISTORY) {
                // Remove oldest entry
                for (uint256 i = 0; i < recentProposalQuorums.length - 1; i++) {
                    recentProposalQuorums[i] = recentProposalQuorums[i + 1];
                }
                recentProposalQuorums.pop();
            }
        }
    }

    /// @notice Calculate dynamic quorum based on recent proposal participation
    function _calculateDynamicQuorum(uint256 supply) internal view returns (uint256) {
        if (supply == 0) return 0;

        // Base quorum from OZ
        uint256 baseQuorum = quorum(clock());

        // If we have historical data, adjust based on average participation
        if (recentProposalQuorums.length > 0) {
            uint256 totalBps;
            for (uint256 i = 0; i < recentProposalQuorums.length; i++) {
                totalBps += recentProposalQuorums[i];
            }
            uint256 avgBps = totalBps / recentProposalQuorums.length;

            // Decay from current average toward minimum
            uint256 decayAmount = (avgBps * QUORUM_DECAY_BPS) / 10000;
            uint256 dynamicBps = avgBps > decayAmount ? avgBps - decayAmount : MIN_QUORUM_BPS;

            if (dynamicBps < MIN_QUORUM_BPS) dynamicBps = MIN_QUORUM_BPS;

            uint256 dynamicQuorum = (supply * dynamicBps) / 10000;
            return dynamicQuorum > baseQuorum ? dynamicQuorum : baseQuorum;
        }

        return baseQuorum;
    }

    function _quorumReached(uint256 proposalId)
        internal view override(Governor, GovernorCountingSimple) returns (bool)
    {
        GovernorProposalType pType = proposals[proposalId].proposalType;
        if (pType == GovernorProposalType.Signaling) return true;

        (uint256 aV, uint256 fV, uint256 abV) = proposalVotes(proposalId);
        uint256 totalWeight = aV + fV + abV;
        uint256 snap = proposalSnapshot(proposalId);
        uint256 supply = token().getPastTotalSupply(snap);

        if (pType == GovernorProposalType.Treasury) return totalWeight >= (supply * 60) / 100;
        if (pType == GovernorProposalType.Constitutional) return totalWeight >= (supply * 75) / 100;

        // Dynamic quorum for Standard proposals
        uint256 dynamicQ = _calculateDynamicQuorum(supply);
        return totalWeight >= dynamicQ;
    }

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
    // ║  6. G-02: MULTI-SIG GUARDIAN VETO                         ║
    // ═══════════════════════════════════════════════════════════════

    /// @notice Multi-sig veto: requires GUARDIAN_THRESHOLD confirmations
    function veto(uint256 proposalId) external vetoActive {
        require(guardians[msg.sender].active, "Gv2: not guardian");
        ProposalInfo storage info = proposals[proposalId];
        require(!info.vetoed, "Gv2: already vetoed");
        require(info.proposalType != GovernorProposalType.Treasury && info.proposalType != GovernorProposalType.Constitutional, "Gv2: cannot veto");
        require(state(proposalId) == ProposalState.Pending || state(proposalId) == ProposalState.Active, "Gv2: wrong state");
        require(!guardianConfirmations[proposalId][msg.sender], "Gv2: already confirmed");

        guardianConfirmations[proposalId][msg.sender] = true;
        guardianConfirmationCount[proposalId]++;

        if (guardianConfirmationCount[proposalId] >= GUARDIAN_THRESHOLD) {
            info.vetoed = true;
            emit ProposalVetoed(proposalId, msg.sender);
        }
    }

    function isVetoed(uint256 proposalId) external view returns (bool) {
        return proposals[proposalId].vetoed;
    }

    /// @notice G-08: Hard cap on total veto extension
    function extendVeto(uint256 additionalSeconds) external onlyGovernance {
        require(additionalSeconds <= 90 days, "Gv2: too long");
        require(block.timestamp - vetoStartTimestamp + additionalSeconds <= MAX_VETO_TOTAL, "Gv2: total too long");
        vetoExpiry = block.timestamp + additionalSeconds;
        emit VetoExpirySet(vetoExpiry);
    }

    function disableVeto() external onlyGovernance { vetoEnabled = false; }

    // ═══════════════════════════════════════════════════════════════
    // ║  7. G-07: EMERGENCY PAUSE WITH COOLDOWN                   ║
    // ═══════════════════════════════════════════════════════════════

    function addGuardian(address guardian) external onlyGovernance {
        require(guardian != address(0) && !guardians[guardian].active && guardianList.length < MAX_GUARDIANS, "Gv2: bad guardian");
        guardians[guardian] = Guardian(guardian, true);
        guardianList.push(guardian);
        _grantRole(EMERGENCY_PAUSER_ROLE, guardian);
        _grantRole(VETO_GUARDIAN_ROLE, guardian);
        emit GuardianAdded(guardian);
    }

    function removeGuardian(address guardian) external onlyGovernance {
        require(guardians[guardian].active, "Gv2: not guardian");
        guardians[guardian].active = false;
        _revokeRole(EMERGENCY_PAUSER_ROLE, guardian);
        _revokeRole(VETO_GUARDIAN_ROLE, guardian);
        for (uint256 i = 0; i < guardianList.length; i++) {
            if (guardianList[i] == guardian) { guardianList[i] = guardianList[guardianList.length - 1]; guardianList.pop(); break; }
        }
        emit GuardianRemoved(guardian);
    }

    function confirmMalicious(uint256 proposalId) external {
        require(guardians[msg.sender].active, "Gv2: not guardian");
        require(!guardianConfirmations[proposalId][msg.sender], "Gv2: already confirmed");
        guardianConfirmations[proposalId][msg.sender] = true;
        guardianConfirmationCount[proposalId]++;
        if (guardianConfirmationCount[proposalId] >= GUARDIAN_THRESHOLD) {
            emergencyPaused = true;
            pauseActivatedAt = block.timestamp;
            emit EmergencyPaused(proposalId, guardianList);
        }
    }

    /// @notice G-10: Use AccessControl for EMERGENCY_PAUSER_ROLE
    function pause() external {
        require(hasRole(EMERGENCY_PAUSER_ROLE, msg.sender), "Gv2: unauthorized");
        emergencyPaused = true;
        pauseActivatedAt = block.timestamp;
    }

    /// @notice G-07: Pause cooldown allows unpause after PAUSE_COOLDOWN
    function unpause() external {
        if (!hasRole(EMERGENCY_PAUSER_ROLE, msg.sender)) {
            require(block.timestamp >= pauseActivatedAt + PAUSE_COOLDOWN, "Gv2: too early (cooldown)");
        }
        emergencyPaused = false;
        emit EmergencyUnpaused();
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  8. PROPOSAL THRESHOLD TIERS                              ║
    // ═══════════════════════════════════════════════════════════════

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        uint256 supply = token().getPastTotalSupply(clock());
        for (uint256 i = thresholdTierFloors.length; i > 0; i--) {
            if (supply >= thresholdTierFloors[i - 1]) return thresholdTierAmounts[i - 1];
        }
        return super.proposalThreshold();
    }

    function setThresholdTiers(uint256[] calldata floors, uint256[] calldata amounts) external onlyGovernance {
        require(floors.length == amounts.length && floors.length > 0, "Gv2: bad tiers");
        for (uint256 i = 0; i < floors.length; i++) emit ThresholdTierUpdated(i, floors[i], amounts[i]);
        thresholdTierFloors = floors; thresholdTierAmounts = amounts;
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  9. G-05: EIP-712 GASLESS VOTING                          ║
    // ═══════════════════════════════════════════════════════════════

    function getDomainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256(bytes("DegenFeedGovernorV2")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function castVoteBySig(SigVote calldata sigVote) external notPaused returns (uint256) {
        require(sigVote.deadline >= block.timestamp, "Gv2: expired");
        require(sigVote.voter != address(0), "Gv2: invalid voter");

        // EIP-712 typed data with nonce for replay protection
        uint256 nonce = sigNonces[sigVote.voter];
        bytes32 structHash = keccak256(abi.encode(
            VOTE_TYPEHASH,
            sigVote.proposalId, sigVote.support, sigVote.voter, sigVote.deadline, nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", getDomainSeparator(), structHash));
        address recovered = ECDSA.recover(digest, sigVote.v, sigVote.r, sigVote.s);
        require(recovered == sigVote.voter, "Gv2: bad signature");

        ProposalInfo storage info = proposals[sigVote.proposalId];
        bytes memory params = info.quadraticVoting ? abi.encode(true) : bytes("");

        uint256 weight = super._castVote(sigVote.proposalId, sigVote.voter, sigVote.support, "", params);

        // Only increment nonce AFTER successful _castVote (G-05 fix)
        sigNonces[sigVote.voter]++;

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
        internal override(Governor, GovernorTimelockControl)
    {
        // G-13: Record quorum for dynamic calculation
        _recordQuorum(proposalId);
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalDeadline(uint256 proposalId) public view override(Governor, GovernorPreventLateQuorum) returns (uint256) {
        return super.proposalDeadline(proposalId);
    }

    function _tallyUpdated(uint256 proposalId) internal override(Governor, GovernorPreventLateQuorum) {
        super._tallyUpdated(proposalId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(Governor, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice Override _countVote to call GovernorPreventLateQuorum
    function _countVote(uint256 proposalId, address account, uint8 support, uint256 totalWeight, bytes memory params)
        internal override(Governor, GovernorCountingSimple) returns (uint256)
    {
        return super._countVote(proposalId, account, support, totalWeight, params);
    }

    // ── View helpers ──
    function timelockAddress() external view returns (address) { return address(super._executor()); }
    function tokenAddress() external view returns (address) { return address(token()); }
    function getGuardians() external view returns (address[] memory) { return guardianList; }
    function getThresholdTiers() external view returns (uint256[] memory, uint256[] memory) { return (thresholdTierFloors, thresholdTierAmounts); }
    function getProposalInfo(uint256 proposalId) external view returns (ProposalInfo memory) { return proposals[proposalId]; }
    function getRecentQuorums() external view returns (uint256[] memory) { return recentProposalQuorums; }

    /// @dev Helper to reduce stack depth
    function _getSnapshotData(uint256 proposalId) internal view returns (uint256 supply, uint256 q) {
        uint256 snap = proposalSnapshot(proposalId);
        supply = token().getPastTotalSupply(snap);
        q = quorum(snap);
    }
}
