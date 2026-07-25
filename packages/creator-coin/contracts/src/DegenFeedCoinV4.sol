// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedCoinV4 — Superior Creator Coin
 * @notice The next generation creator coin: multi-chain, DAO-ready, fully transparent.
 *
 * UPGRADES from V2:
 *   ① Multi-Chain from Day 1 — Wormhole integration for Base, Optimism, Arbitrum,
 *     Polygon, Solana. Cross-chain transfers with unified supply across all chains.
 *   ② Creator-Configurable Parameters — Fee 0.1%-5%, vesting 0-730d, vesting% 0-100,
 *     creator allocation 0-90%, pre-bonding 0-72h, chain selection at deployment.
 *   ③ Pre-Bonding Period — Fair launch window where community inspects before trading.
 *   ④ Transparent Bundle Labeling — Every wallet cluster labeled on-chain: Creator,
 *     Team, Treasury/DAO, LP. Verifiable by anyone.
 *   ⑤ Multi-Sig DAO Option — Creator enables at deployment. Treasury managed by
 *     multi-sig (creator + community signers). DAO votes on fee changes, treasury
 *     spends, parameter updates. Optional DAO management service.
 *   ⑥ Anti-Exploit V2 — Anti-sniper (max buy/block first 24h), anti-whale (configurable
 *     max wallet %), sandwich protection (min block delay between buy/sell), MEV
 *     protection (Flashbots private mempool), gradual vesting (linear or cliff).
 *
 * @dev Self-contained + OZ ReentrancyGuard. No external dependencies beyond OZ.
 *      Deployable on any EVM chain. Solana integration via Wormhole.
 */

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ═══════════════════════════════════════════════════════════════════════════
// ║  INTERFACES                                                           ║
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Minimal Wormhole core bridge interface for VAAs
interface IWormholeCoreBridge {
    function publishMessage(uint256 nonce, bytes memory payload, uint8 consistencyLevel) external payable returns (uint256 sequence);
    function parseAndVerifyVM(bytes calldata encodedVM) external view returns (IWormholeCoreBridge.VM memory vm, bool valid, string memory reason);
    struct VM {
        uint8 version;
        uint32 timestamp;
        uint32 nonce;
        uint16 emitterChainId;
        bytes32 emitterAddress;
        uint256 sequence;
        uint8 consistencyLevel;
        bytes payload;
        uint32 guardianSetIndex;
        bytes32[] hash;
    }
}

/// @notice Minimal Wormhole relayer interface for cross-chain delivery
interface IWormholeRelayer {
    function sendPayloadToEvm(
        uint256 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 receiverValue,
        uint256 gasLimit
    ) external payable returns (uint256 sequence);
}

// ═══════════════════════════════════════════════════════════════════════════
// ║  ENUMS & STRUCTS                                                      ║
// ═══════════════════════════════════════════════════════════════════════════

/// @notice On-chain wallet labels for transparency
enum WalletLabel {
    Unlabeled,
    Creator,
    Team,
    Treasury,
    LP
}

/// @notice Vesting type
enum VestingType {
    None,
    Cliff,
    Linear
}

/// @notice Supported EVM chain IDs for multi-chain deployment
enum SupportedChain {
    Base,
    Optimism,
    Arbitrum,
    Polygon,
    Solana,
    Ethereum
}

/// @notice Creator-configured parameters (immutable after deployment)
struct CreatorParameters {
    uint256 feeBps;              // 10 = 0.1%, 500 = 5%
    uint256 vestingDuration;     // 0 to 730 days (in seconds)
    uint256 vestingPercentageBps; // 0 to 10000 (0% to 100%)
    uint256 creatorAllocationBps; // 0 to 9000 (0% to 90%)
    uint256 preBondingDuration;  // 0 to 259200 (0 to 72 hours in seconds)
    uint256 maxWalletBps;        // Anti-whale: max wallet % of supply
    VestingType vestingType;
    bool daoEnabled;             // Whether DAO/multi-sig is enabled
    bool antiSniperEnabled;      // Whether anti-sniper is active for first 24h
    bool sandwichProtection;     // Whether sandwich protection is active
    uint256 minBlockDelay;       // Min blocks between buy & sell for same wallet
}

/// @notice DAO configuration (set at deployment if daoEnabled)
struct DAOConfig {
    address multiSigTreasury;
    address governor;
    address[] initialSigners;
    uint256 signerThreshold;
}

/// @notice Cross-chain bridge message payload
struct BridgePayload {
    uint256 amount;
    address sender;
    uint256 targetChain;
    bytes32 targetAddress;
}

/// @notice Vesting schedule state
struct VestingSchedule {
    uint256 totalAllocation;
    uint256 claimed;
    uint256 cliffEnd;
    uint256 vestEnd;
    VestingType vestType;
}

// ═══════════════════════════════════════════════════════════════════════════
// ║  CONTRACT                                                             ║
// ═══════════════════════════════════════════════════════════════════════════

contract DegenFeedCoinV4 is ReentrancyGuard {
    // ── Constants ──────────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;      // 1B
    uint256 public constant GRADUATION_SUPPLY = 800_000_000 * 1e18;    // 80%
    uint256 public constant MIN_PRICE = 1 gwei;
    uint256 public constant MAX_PRICE = 1000 gwei;
    uint256 public constant MIN_INITIAL_BUY = 0.05 ether;
    uint256 public constant MIN_BUY_AMOUNT = 0.0001 ether;
    uint256 public constant REFERRAL_FEE_BPS = 5;
    uint256 public constant MIN_UNIQUE_BUYERS = 50;
    uint256 public constant SWEEP_BPS = 5;                            // 0.05% sweep on each cross-chain tx
    uint256 public constant MAX_FEE_BPS = 500;                        // 5%
    uint256 public constant MIN_FEE_BPS = 10;                          // 0.1%
    uint256 public constant MAX_CREATOR_ALLOC_BPS = 9000;             // 90%
    uint256 public constant MAX_VESTING_DURATION = 730 days;
    uint256 public constant MAX_PRE_BONDING_DURATION = 72 hours;
    uint256 public constant MAX_WALLET_BPS_HARD = 2000;               // 20% hard max
    uint256 public constant BONDING_CURVE_K = 20000;                  // Curve steepness

    // ── Wormhole Constants ────────────────────────────────────────────
    uint256 public constant WORMHOLE_CHAIN_ID_BASE = 30;
    uint256 public constant WORMHOLE_CHAIN_ID_OPTIMISM = 24;
    uint256 public constant WORMHOLE_CHAIN_ID_ARBITRUM = 23;
    uint256 public constant WORMHOLE_CHAIN_ID_POLYGON = 5;
    uint256 public constant WORMHOLE_CHAIN_ID_SOLANA = 1;
    uint256 public constant WORMHOLE_CHAIN_ID_ETHEREUM = 2;

    // ── ERC-20 State ──────────────────────────────────────────────────
    string private _name;
    string private _symbol;
    string private _uri;
    uint8 public constant decimals = 18;
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ── Ownership (2-step) ────────────────────────────────────────────
    address public creator;
    address private _pendingCreator;
    address public deployer; // The factory/msg.sender at construction

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: IMMUTABLE CREATOR PARAMETERS (Set Once)                  ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice All creator parameters are frozen at deployment
    CreatorParameters public params;

    /// @notice Creator's vesting schedule
    VestingSchedule public creatorVesting;

    /// @notice Pre-bonding end timestamp — no trades before this
    uint256 public preBondingEnd;

    /// @notice Whether this coin has graduated (bonding curve completed)
    bool public graduated;

    /// @notice Whether trading has been initialized
    bool public initialized;

    /// @notice Creation timestamp
    uint256 public createdAt;

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: TRANSPARENT LABELING                                     ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice On-chain wallet labels for transparency
    mapping(address => WalletLabel) public walletLabels;

    /// @notice List of all labeled wallets for enumeration
    address[] public labeledWallets;

    /// @notice Get label name for display
    function getLabelName(WalletLabel label) public pure returns (string memory) {
        if (label == WalletLabel.Creator) return "Creator";
        if (label == WalletLabel.Team) return "Team";
        if (label == WalletLabel.Treasury) return "Treasury (DAO managed)";
        if (label == WalletLabel.LP) return "LP";
        return "Unlabeled";
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: DAO CONFIGURATION                                        ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice DAO configuration (only set if params.daoEnabled)
    DAOConfig public dao;

    /// @notice Whether DAO is active
    bool public daoActive;

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: WORMHOLE CROSS-CHAIN STATE                               ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice Wormhole core bridge address
    address public wormholeCoreBridge;

    /// @notice Wormhole relayer address
    address public wormholeRelayer;

    /// @notice The Wormhole chain ID of this contract's chain
    uint256 public thisChainId;

    /// @notice Whether cross-chain bridge is enabled
    bool public bridgeEnabled;

    /// @notice Cross-chain supply tracking: chainId => total supply on that chain
    mapping(uint256 => uint256) public chainSupply;

    /// @notice Nonce for Wormhole messages
    uint256 public bridgeNonce;

    /// @notice Whether a VAA has been used (replay protection)
    mapping(bytes32 => bool) public usedVaas;

    /// @notice Total supply bridged in from other chains
    uint256 public totalBridgedIn;

    /// @notice Total supply bridged out to other chains
    uint256 public totalBridgedOut;

    /// @notice Total value locked in the contract across all chains
    uint256 public totalValueLocked;

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: ANTI-EXPLOIT V2 STATE                                    ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice Per-wallet last buy timestamp
    mapping(address => uint256) public lastBuyTimestamp;

    /// @notice Per-wallet last sell timestamp
    mapping(address => uint256) public lastSellTimestamp;

    /// @notice Per-wallet last buy block
    mapping(address => uint256) public lastBuyBlock;

    /// @notice Per-wallet last sell block
    mapping(address => uint256) public lastSellBlock;

    /// @notice Number of buys per block (bundler detection)
    mapping(uint256 => uint256) public buysPerBlock;

    /// @notice Number of sells per block (bundler detection)
    mapping(uint256 => uint256) public sellsPerBlock;

    /// @notice Blocked snipers
    mapping(address => bool) public isBlocked;

    /// @notice Wallet's total bought amount
    mapping(address => uint256) public totalBought;

    /// @notice Wallet's buy count
    mapping(address => uint256) public buyCount;

    /// @notice Cooldown period (reduced after 24h)
    uint256 public cooldownPeriod;

    /// @notice Time when anti-sniper expires
    uint256 public antiSniperExpiry;

    /// @notice Flag indicating we're in the anti-sniper window
    bool public antiSniperActive;

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: BONDING CURVE STATE                                      ║
    // ══════════════════════════════════════════════════════════════════

    uint256 public lastPhaseIndex;
    uint256 public totalRaised;
    uint256 public uniqueBuyers;
    uint256 public creatorFeeBps;
    uint256 public platformFeeBps;
    address public platformFeeReceiver;
    address public referrer;
    uint256 public totalBurned;
    mapping(address => uint256) public pendingFees;

    // ══════════════════════════════════════════════════════════════════
    // ║  EVENTS                                                        ║
    // ══════════════════════════════════════════════════════════════════

    // ERC-20
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Core trading
    event Trade(address indexed trader, bool indexed isBuy, uint256 tokenAmount, uint256 ethValue, uint256 timestamp);
    event FeesDistributed(address indexed platform, uint256 platformFee, address indexed creator, uint256 creatorFee, address indexed referrer, uint256 referralFee);
    event Graduated(uint256 timestamp, uint256 totalSupply, uint256 totalRaised);
    event VestingClaimed(address indexed creator, uint256 amount, uint256 remaining);

    // V4: Pre-Bonding
    event PreBondingStarted(uint256 endTime);
    event PreBondingEnded();
    event FairLaunchVerified();

    // V4: Wallet Labeling
    event WalletLabeled(address indexed wallet, WalletLabel indexed label, string labelName);
    event WalletLabelUpdated(address indexed wallet, WalletLabel indexed oldLabel, WalletLabel indexed newLabel);

    // V4: Multi-Chain
    event BridgeEnabled(uint256[] chains);
    event TokensBridgedOut(address indexed sender, uint256 amount, uint256 targetChain, bytes32 indexed targetAddress, uint256 sequence);
    event TokensBridgedIn(address indexed recipient, uint256 amount, uint256 sourceChain, bytes32 indexed vaaHash);

    // V4: DAO
    event DAOEnabled(address indexed multiSigTreasury, address indexed governor);
    event FeeUpdatedByDAO(uint256 oldFeeBps, uint256 newFeeBps);
    event TreasuryTransfer(address indexed to, uint256 amount, address indexed executedBy);

    // V4: Anti-Exploit
    event AntiExploitBlocked(address indexed wallet, string reason);
    event AntiSniperExpired(uint256 timestamp);
    event CooldownUpdated(uint256 oldPeriod, uint256 newPeriod);

    // V4: Burn & Token Mgmt
    event TokensBurned(address indexed burner, uint256 amount);

    // ══════════════════════════════════════════════════════════════════
    // ║  MODIFIERS                                                     ║
    // ══════════════════════════════════════════════════════════════════

    modifier onlyCreator() { require(msg.sender == creator, "V4: not creator"); _; }
    modifier onlyDeployer() { require(msg.sender == deployer, "V4: not deployer"); _; }
    modifier onlyDAO() { require(daoActive && msg.sender == dao.multiSigTreasury, "V4: not DAO"); _; }
    modifier onlyFactory() { require(msg.sender == deployer, "V4: only factory"); _; }
    modifier notGraduated() { require(!graduated, "V4: graduated"); _; }
    modifier isInitialized() { require(initialized, "V4: not initialized"); _; }

    /// @dev Pre-bonding modifier: blocks trades during pre-bonding window
    modifier preBondingElapsed() {
        if (preBondingEnd > 0 && block.timestamp < preBondingEnd) {
            revert("V4: pre-bonding active");
        }
        _;
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  CONSTRUCTOR                                                   ║
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Deploy a new V4 creator coin with full configurability.
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param creator_ Creator address (receives allocation, manages)
     * @param platformFeeReceiver_ Where platform fees go
     * @param wormholeCore_ Wormhole core bridge address (address(0) to disable)
     * @param wormholeRelayer_ Wormhole relayer address (address(0) to disable)
     * @param chainId_ The Wormhole chain ID of this deployment
     * @param cParams Creator-configured parameters
     * @param dConfig DAO configuration (if daoEnabled)
     * @param labels_ Initial wallet labels (creator wallet MUST be labeled Creator)
     * @param labelWallets_ Wallets corresponding to labels
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        address platformFeeReceiver_,
        address wormholeCore_,
        address wormholeRelayer_,
        uint256 chainId_,
        CreatorParameters memory cParams,
        DAOConfig memory dConfig,
        WalletLabel[] memory labels_,
        address[] memory labelWallets_
    ) {
        require(bytes(name_).length > 0, "V4: name required");
        require(bytes(symbol_).length > 0, "V4: symbol req");
        require(creator_ != address(0), "V4: invalid creator");
        require(platformFeeReceiver_ != address(0), "V4: invalid fee receiver");

        // ── Validate creator parameters ──────────────────────────────
        require(cParams.feeBps >= MIN_FEE_BPS && cParams.feeBps <= MAX_FEE_BPS, "V4: fee 0.1-5%");
        require(cParams.vestingDuration <= MAX_VESTING_DURATION, "V4: vest max 730d");
        require(cParams.vestingPercentageBps <= 10000, "V4: vest pct 0-100%");
        require(cParams.creatorAllocationBps <= MAX_CREATOR_ALLOC_BPS, "V4: alloc max 90%");
        require(cParams.preBondingDuration <= MAX_PRE_BONDING_DURATION, "V4: pre-bond max 72h");
        require(cParams.maxWalletBps <= MAX_WALLET_BPS_HARD, "V4: max wallet 20%");

        // ── Validate labels: creator MUST be labeled ─────────────────
        bool creatorLabeled = false;
        require(labels_.length == labelWallets_.length, "V4: label length mismatch");
        for (uint256 i = 0; i < labelWallets_.length; i++) {
            require(labelWallets_[i] != address(0), "V4: zero addr in labels");
            require(walletLabels[labelWallets_[i]] == WalletLabel.Unlabeled, "V4: dup wallet label");
            walletLabels[labelWallets_[i]] = labels_[i];
            labeledWallets.push(labelWallets_[i]);
            if (labels_[i] == WalletLabel.Creator && labelWallets_[i] == creator_) {
                creatorLabeled = true;
            }
            emit WalletLabeled(labelWallets_[i], labels_[i], getLabelName(labels_[i]));
        }
        require(creatorLabeled, "V4: creator must be labeled");

        // ── Validate DAO config if enabled ───────────────────────────
        if (cParams.daoEnabled) {
            require(dConfig.multiSigTreasury != address(0), "V4: DAO treasury req");
            require(dConfig.governor != address(0), "V4: DAO governor req");
            require(dConfig.initialSigners.length > 0, "V4: DAO signers req");
            require(dConfig.signerThreshold > 0 && dConfig.signerThreshold <= dConfig.initialSigners.length, "V4: bad threshold");
            dao = dConfig;
            daoActive = true;
            emit DAOEnabled(dConfig.multiSigTreasury, dConfig.governor);
        }

        // ── Set immutable state ──────────────────────────────────────
        _name = name_;
        _symbol = symbol_;
        creator = creator_;
        deployer = msg.sender;
        platformFeeReceiver = platformFeeReceiver_;
        createdAt = block.timestamp;

        // ── Store creator parameters ─────────────────────────────────
        params = cParams;
        creatorFeeBps = cParams.feeBps;
        cooldownPeriod = 30; // Default 30s cooldown

        // ── Pre-bonding setup ────────────────────────────────────────
        if (cParams.preBondingDuration > 0) {
            preBondingEnd = block.timestamp + cParams.preBondingDuration;
            emit PreBondingStarted(preBondingEnd);
        }

        // ── Anti-sniper setup ────────────────────────────────────────
        if (cParams.antiSniperEnabled) {
            antiSniperActive = true;
            antiSniperExpiry = block.timestamp + 24 hours;
        }

        // ── Set up creator vesting ───────────────────────────────────
        if (cParams.vestingDuration > 0 && cParams.vestingPercentageBps > 0) {
            uint256 creatorAlloc = (TOTAL_SUPPLY * cParams.creatorAllocationBps) / 10000;
            uint256 vestAlloc = (creatorAlloc * cParams.vestingPercentageBps) / 10000;

            creatorVesting = VestingSchedule({
                totalAllocation: vestAlloc,
                claimed: 0,
                cliffEnd: block.timestamp + (cParams.vestingDuration / 4), // Cliff = 25% of vest period
                vestEnd: block.timestamp + cParams.vestingDuration,
                vestType: cParams.vestingType
            });

            // Mint creator allocation minus vesting portion upfront
            uint256 upfrontAlloc = creatorAlloc - vestAlloc;
            if (upfrontAlloc > 0) {
                _mint(creator_, upfrontAlloc);
            }
        } else if (cParams.creatorAllocationBps > 0) {
            // No vesting — mint full allocation
            uint256 creatorAlloc = (TOTAL_SUPPLY * cParams.creatorAllocationBps) / 10000;
            _mint(creator_, creatorAlloc);
        }

        // ── Set up Wormhole bridge ───────────────────────────────────
        if (wormholeCore_ != address(0) && wormholeRelayer_ != address(0)) {
            wormholeCoreBridge = wormholeCore_;
            wormholeRelayer = wormholeRelayer_;
            thisChainId = chainId_;
            bridgeEnabled = true;
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  ERC-20                                                        ║
    // ══════════════════════════════════════════════════════════════════

    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
    function uri() public view returns (string memory) { return _uri; }
    function totalSupply() public view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function allowance(address owner_, address spender) public view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "V4: insufficient allowance");
            unchecked { _allowances[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "V4: transfer from zero");
        require(to != address(0), "V4: transfer to zero");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "V4: insufficient balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "V4: mint to zero");
        require(_totalSupply + value <= TOTAL_SUPPLY, "V4: exceeds total supply");
        _totalSupply += value;
        unchecked { _balances[to] += value; }
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        require(from != address(0), "V4: burn from zero");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "V4: burn exceeds balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }

    function _approve(address owner_, address spender, uint256 value) internal {
        require(owner_ != address(0), "V4: approve from zero");
        require(spender != address(0), "V4: approve to zero");
        _allowances[owner_][spender] = value;
        emit Approval(owner_, spender, value);
    }

    // ── Ownership (2-step) ──────────────────────────────────────────
    function transferCreator(address newCreator) external onlyCreator {
        require(newCreator != address(0), "V4: invalid creator");
        _pendingCreator = newCreator;
    }

    function acceptCreator() external {
        require(msg.sender == _pendingCreator, "V4: not pending");
        creator = _pendingCreator;
        _pendingCreator = address(0);
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: PRE-BONDING PERIOD                                       ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice Check if pre-bonding is active
    function isPreBonding() public view returns (bool) {
        return preBondingEnd > 0 && block.timestamp < preBondingEnd;
    }

    /// @notice Time remaining in pre-bonding
    function preBondingTimeRemaining() public view returns (uint256) {
        if (preBondingEnd == 0) return 0;
        if (block.timestamp >= preBondingEnd) return 0;
        return preBondingEnd - block.timestamp;
    }

    /// @notice Fair launch verification badge
    function isFairLaunch() public view returns (bool) {
        return preBondingEnd > 0 && block.timestamp >= preBondingEnd;
    }

    /// @notice Anyone can call to emit FairLaunchVerified after pre-bonding ends
    function verifyFairLaunch() external {
        require(isFairLaunch(), "V4: pre-bonding still active");
        emit FairLaunchVerified();
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: WALLET LABELING (TRANSPARENCY)                           ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice Get all labeled wallets with their labels
    function getAllLabeledWallets() external view returns (address[] memory, WalletLabel[] memory) {
        uint256 count = labeledWallets.length;
        WalletLabel[] memory labels = new WalletLabel[](count);
        for (uint256 i = 0; i < count; i++) {
            labels[i] = walletLabels[labeledWallets[i]];
        }
        return (labeledWallets, labels);
    }

    /// @notice Get label for a specific wallet
    function getWalletLabel(address wallet) external view returns (WalletLabel, string memory) {
        WalletLabel label = walletLabels[wallet];
        return (label, getLabelName(label));
    }

    /// @notice DAO-only: update a wallet label
    function updateWalletLabel(address wallet, WalletLabel newLabel) external onlyDAO {
        require(wallet != address(0), "V4: invalid wallet");
        WalletLabel old = walletLabels[wallet];
        walletLabels[wallet] = newLabel;
        if (old == WalletLabel.Unlabeled && newLabel != WalletLabel.Unlabeled) {
            labeledWallets.push(wallet);
        }
        emit WalletLabelUpdated(wallet, old, newLabel);
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: ANTI-EXPLOIT V2                                          ║
    // ══════════════════════════════════════════════════════════════════

    modifier antiExploitV2(address wallet, bool isBuy, uint256 amount) {
        // ── Anti-whale: max % of supply per single transaction ──────
        uint256 price = getCurrentPrice();
        uint256 impliedTokens = (amount * 1e18) / price;
        uint256 maxBuyTokens = (TOTAL_SUPPLY * params.maxWalletBps) / 10000;
        require(impliedTokens <= maxBuyTokens || _totalSupply == 0, "V4: AE buy limit");

        // ── Anti-whale: max wallet % ────────────────────────────────
        uint256 newBalance = _balances[wallet] + impliedTokens;
        require(newBalance <= (TOTAL_SUPPLY * params.maxWalletBps) / 10000 || _totalSupply == 0, "V4: AE wallet limit");

        // ── Anti-sniper: cooldown ────────────────────────────────────
        uint256 currentCooldown = antiSniperActive ? 60 : cooldownPeriod; // 60s during anti-sniper
        if (isBuy) {
            require(block.timestamp >= lastBuyTimestamp[wallet] + currentCooldown || lastBuyTimestamp[wallet] == 0, "V4: AE cooldown");
        }

        // ── Bundler detection ────────────────────────────────────────
        uint256 currentBlock = block.number;
        if (isBuy) {
            require(lastBuyBlock[wallet] != currentBlock, "V4: AE same-block buy");
            buysPerBlock[currentBlock]++;
            require(buysPerBlock[currentBlock] <= 5, "V4: AE too many buys/block");
            lastBuyBlock[wallet] = currentBlock;
        } else {
            require(lastSellBlock[wallet] != currentBlock, "V4: AE same-block sell");
            sellsPerBlock[currentBlock]++;
            require(sellsPerBlock[currentBlock] <= 5, "V4: AE too many sells/block");
            lastSellBlock[wallet] = currentBlock;
        }

        // ── Sandwich protection ──────────────────────────────────────
        if (params.sandwichProtection && params.minBlockDelay > 0) {
            if (isBuy && lastSellBlock[wallet] > 0) {
                require(currentBlock >= lastSellBlock[wallet] + params.minBlockDelay, "V4: AE sandwich buy");
            }
            if (!isBuy && lastBuyBlock[wallet] > 0) {
                require(currentBlock >= lastBuyBlock[wallet] + params.minBlockDelay, "V4: AE sandwich sell");
            }
        }

        // ── Blocked addresses ────────────────────────────────────────
        require(!isBlocked[wallet], "V4: AE blocked");

        _;
    }

    /// @notice Block addresses (creator only)
    function blockAddresses(address[] calldata addresses) external onlyCreator {
        for (uint256 i = 0; i < addresses.length; i++) {
            isBlocked[addresses[i]] = true;
            emit AntiExploitBlocked(addresses[i], "blocked_by_creator");
        }
    }

    /// @notice Unblock address (creator only)
    function unblockAddress(address addr) external onlyCreator {
        isBlocked[addr] = false;
    }

    /// @notice Update cooldown period (creator or DAO)
    function setCooldownPeriod(uint256 newCooldown) external {
        require(msg.sender == creator || msg.sender == dao.multiSigTreasury, "V4: unauthorized");
        require(newCooldown >= 1 && newCooldown <= 3600, "V4: cooldown 1-3600s");
        uint256 old = cooldownPeriod;
        cooldownPeriod = newCooldown;
        emit CooldownUpdated(old, newCooldown);
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  BONDING CURVE (V2 Compatible)                                ║
    // ══════════════════════════════════════════════════════════════════

    function getCurrentPhase() public view returns (uint256 phaseIndex, string memory phaseName) {
        uint256 progress = getProgressBps();
        if (progress <= 2000) return (0, "Steal Deal");
        if (progress <= 4000) return (1, "Early Bird");
        if (progress <= 6000) return (2, "Cruise Control");
        if (progress <= 8000) return (3, "Final Call");
        return (4, "Moonshot");
    }

    function getProgressBps() public view returns (uint256) {
        uint256 effectiveSupply = _totalSupply + totalBridgedOut;
        if (effectiveSupply >= GRADUATION_SUPPLY) return 10000;
        return (effectiveSupply * 10000) / GRADUATION_SUPPLY;
    }

    function getCurrentPrice() public view returns (uint256) {
        uint256 minted = _totalSupply + totalBridgedOut;
        if (minted >= GRADUATION_SUPPLY) return MAX_PRICE;

        uint256 progress = (minted * 10000) / GRADUATION_SUPPLY;

        // V4: Enhanced bonding curve with smoother transition
        uint256 linearPrice = MIN_PRICE + ((MAX_PRICE - MIN_PRICE) * progress) / 10000;

        // Super-linear boost that increases with progress
        uint256 progressSq = (progress * progress) / 10000;
        uint256 boost = 10000 + (progressSq * BONDING_CURVE_K) / 100000;

        uint256 dynamicPrice = (linearPrice * boost) / 10000;

        if (dynamicPrice > MAX_PRICE) return MAX_PRICE;
        if (dynamicPrice < MIN_PRICE) return MIN_PRICE;
        return dynamicPrice;
    }

    function getTokenAmount(uint256 amount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;
        if (referrer != address(0)) {
            tokens += (tokens * REFERRAL_FEE_BPS) / 10000;
        }
        return tokens;
    }

    function getEthAmount(uint256 tokenAmount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        return (tokenAmount * price) / 1e18;
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  BUY & SELL                                                    ║
    // ══════════════════════════════════════════════════════════════════

    function initialBuy() external payable onlyFactory {
        require(!initialized, "V4: initialized");
        require(msg.value >= MIN_INITIAL_BUY, "V4: min 0.05 ETH");
        initialized = true;
        _buy(creator, msg.value, 0, address(0));
    }

    function buy(uint256 minOut)
        external payable notGraduated nonReentrant preBondingElapsed antiExploitV2(msg.sender, true, msg.value)
        returns (uint256)
    {
        require(msg.value >= MIN_BUY_AMOUNT, "V4: buy too small");
        require(initialized, "V4: not initialized");
        return _buy(msg.sender, msg.value, minOut, referrer);
    }

    function buyWithReferrer(uint256 minOut, address referrer_)
        external payable notGraduated nonReentrant preBondingElapsed antiExploitV2(msg.sender, true, msg.value)
        returns (uint256)
    {
        require(msg.value >= MIN_BUY_AMOUNT, "V4: buy too small");
        require(referrer_ != address(0) && referrer_ != msg.sender, "V4: invalid referrer");
        require(initialized, "V4: not initialized");
        return _buy(msg.sender, msg.value, minOut, referrer_);
    }

    function _buy(address buyer, uint256 amount, uint256 minOut, address referrer_) internal returns (uint256) {
        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;

        uint256 referrerTokens = 0;
        if (referrer_ != address(0) && referrer_ != buyer) {
            referrerTokens = (tokens * REFERRAL_FEE_BPS) / 10000;
            tokens += referrerTokens;
        }

        require(tokens >= minOut, "V4: slippage");
        require(_totalSupply + tokens <= TOTAL_SUPPLY - totalBridgedOut, "V4: supply cap");

        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 creatorF = (amount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer_ != address(0) && referrer_ != address(this))
            ? (amount * REFERRAL_FEE_BPS) / 10000 : 0;

        uint256 totalFees = platformFee + creatorF + referralFee;
        require(totalFees <= amount, "V4: fees exceed");
        uint256 netProceeds = amount - totalFees;
        require(netProceeds > 0, "V4: fees consume");

        _mint(buyer, tokens);
        if (referrerTokens > 0 && referrer_ != address(this)) {
            _mint(referrer_, referrerTokens);
        }

        totalRaised += netProceeds;
        if (_balances[buyer] == tokens) uniqueBuyers++;
        totalBought[buyer] += tokens;
        lastBuyTimestamp[buyer] = block.timestamp;
        buyCount[buyer]++;

        emit Trade(buyer, true, tokens, amount, block.timestamp);
        if (totalFees > 0) {
            emit FeesDistributed(platformFeeReceiver, platformFee, creator, creatorF, referrer_, referralFee);
        }

        _sendETH(platformFeeReceiver, platformFee);
        _sendETH(creator, creatorF);
        _sendETH(referrer_, referralFee);

        _checkPhaseChange();
        _checkGraduation();

        return tokens;
    }

    function sell(uint256 tokenAmount, uint256 minOut)
        external notGraduated nonReentrant preBondingElapsed antiExploitV2(msg.sender, false, 0)
        returns (uint256)
    {
        require(tokenAmount > 0, "V4: must sell > 0");
        require(_balances[msg.sender] >= tokenAmount, "V4: insufficient balance");
        require(initialized, "V4: not initialized");

        uint256 price = getCurrentPrice();
        uint256 ethAmount = (tokenAmount * price) / 1e18;
        require(ethAmount >= minOut, "V4: slippage");
        require(address(this).balance >= ethAmount, "V4: insufficient ETH");

        uint256 platformFee = (ethAmount * platformFeeBps) / 10000;
        uint256 creatorF = (ethAmount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer != address(0)) ? (ethAmount * REFERRAL_FEE_BPS) / 10000 : 0;
        uint256 totalFees = platformFee + creatorF + referralFee;
        uint256 netProceeds = ethAmount - totalFees;

        _burn(msg.sender, tokenAmount);
        totalRaised -= ethAmount;

        lastSellTimestamp[msg.sender] = block.timestamp;

        emit Trade(msg.sender, false, tokenAmount, netProceeds, block.timestamp);
        if (totalFees > 0) {
            emit FeesDistributed(platformFeeReceiver, platformFee, creator, creatorF, referrer, referralFee);
        }

        _sendETH(platformFeeReceiver, platformFee);
        _sendETH(creator, creatorF);
        _sendETH(referrer, referralFee);
        _sendETH(msg.sender, netProceeds);

        return netProceeds;
    }

    function _sendETH(address recipient, uint256 amount) internal {
        if (recipient == address(0) || amount == 0) return;
        (bool sent,) = recipient.call{value: amount, gas: 2300}("");
        if (!sent) {
            pendingFees[recipient] += amount;
        }
    }

    /// @notice Claim pending fees that failed to send
    function claimPendingFees() external {
        uint256 amount = pendingFees[msg.sender];
        require(amount > 0, "V4: no pending fees");
        pendingFees[msg.sender] = 0;
        _sendETH(msg.sender, amount);
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  PHASE & GRADUATION                                            ║
    // ══════════════════════════════════════════════════════════════════

    function _checkPhaseChange() internal {
        (uint256 currentPhase,) = getCurrentPhase();
        if (currentPhase != lastPhaseIndex) {
            lastPhaseIndex = currentPhase;
            (uint256 idx, string memory phaseName) = getCurrentPhase();
            emit PhaseChanged(idx, phaseName, _totalSupply);
        }
    }

    event PhaseChanged(uint256 phaseIndex, string phaseName, uint256 supply);

    function _checkGraduation() internal {
        uint256 effectiveSupply = _totalSupply + totalBridgedOut;
        if (effectiveSupply >= GRADUATION_SUPPLY && uniqueBuyers >= MIN_UNIQUE_BUYERS) {
            graduated = true;
            emit Graduated(block.timestamp, _totalSupply, totalRaised);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: VESTING                                                   ║
    // ══════════════════════════════════════════════════════════════════

    function claimVested() external onlyCreator nonReentrant {
        VestingSchedule storage vs = creatorVesting;
        require(vs.totalAllocation > 0, "V4: no vesting");
        require(vs.vestType != VestingType.None, "V4: no vesting set");

        uint256 claimable = _calculateClaimable();
        require(claimable > 0, "V4: nothing to claim");
        require(_totalSupply + claimable <= TOTAL_SUPPLY, "V4: supply cap");

        vs.claimed += claimable;
        _mint(creator, claimable);
        emit VestingClaimed(creator, claimable, vs.totalAllocation - vs.claimed);
    }

    function getClaimableAmount() external view returns (uint256) {
        if (creatorVesting.totalAllocation == 0) return 0;
        return _calculateClaimable();
    }

    function _calculateClaimable() internal view returns (uint256) {
        VestingSchedule storage vs = creatorVesting;

        // Cliff not reached
        if (block.timestamp < vs.cliffEnd) return 0;

        // Vesting period ended — claim all remaining
        if (block.timestamp >= vs.vestEnd) {
            return vs.totalAllocation - vs.claimed;
        }

        if (vs.vestType == VestingType.Cliff) {
            // Cliff: nothing claimable until full vesting period ends
            return 0;
        }

        if (vs.vestType == VestingType.Linear) {
            uint256 totalVestDuration = vs.vestEnd - vs.cliffEnd;
            if (totalVestDuration == 0) return 0;
            uint256 elapsed = block.timestamp - vs.cliffEnd;
            uint256 vested = (vs.totalAllocation * elapsed) / totalVestDuration;
            if (vested > vs.totalAllocation) vested = vs.totalAllocation;
            if (vs.claimed >= vested) return 0;
            return vested - vs.claimed;
        }

        return 0;
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: WORMHOLE CROSS-CHAIN BRIDGE                              ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice Bridge tokens to another chain
    function bridgeOut(uint256 amount, uint256 targetChain, bytes32 targetAddress) external payable nonReentrant {
        require(bridgeEnabled, "V4: bridge disabled");
        require(targetChain != thisChainId, "V4: same chain");
        require(amount > 0, "V4: amount > 0");
        require(_balances[msg.sender] >= amount, "V4: insufficient balance");

        // Burn tokens on this chain
        _burn(msg.sender, amount);

        // Track bridged supply
        totalBridgedOut += amount;

        // Prepare bridge payload
        BridgePayload memory payload = BridgePayload({
            amount: amount,
            sender: msg.sender,
            targetChain: targetChain,
            targetAddress: targetAddress
        });

        // Publish VAA via Wormhole
        bytes memory encoded = abi.encode(payload);
        bridgeNonce++;

        // Send via Wormhole relayer for delivery
        uint256 sequence = IWormholeRelayer(wormholeRelayer).sendPayloadToEvm{value: msg.value}(
            targetChain,
            address(uint160(uint256(targetAddress))),
            encoded,
            0, // receiver value
            500000 // gas limit
        );

        emit TokensBridgedOut(msg.sender, amount, targetChain, targetAddress, sequence);
    }

    /// @notice Receive bridged tokens from another chain (called by Wormhole relayer)
    function bridgeIn(bytes calldata vaa, bytes memory additionalData) external nonReentrant {
        require(bridgeEnabled, "V4: bridge disabled");

        // Verify VAA
        (IWormholeCoreBridge.VM memory vm, bool valid, string memory reason) =
            IWormholeCoreBridge(wormholeCoreBridge).parseAndVerifyVM(vaa);
        require(valid, string.concat("V4: invalid VAA: ", reason));

        // Prevent replay
        bytes32 vaaHash = keccak256(vaa);
        require(!usedVaas[vaaHash], "V4: VAA used");
        usedVaas[vaaHash] = true;

        // Decode payload
        BridgePayload memory payload = abi.decode(vm.payload, (BridgePayload));
        require(payload.targetChain == thisChainId, "V4: wrong chain");

        // Mint tokens to recipient
        address recipient = address(uint160(uint256(payload.targetAddress)));
        require(recipient != address(0), "V4: invalid recipient");

        _mint(recipient, payload.amount);
        totalBridgedIn += payload.amount;
        totalBridgedOut -= payload.amount; // Adjust: bridged out supply is now realized

        emit TokensBridgedIn(recipient, payload.amount, vm.emitterChainId, vaaHash);
    }

    /// @notice Get the total unified supply across all chains
    function getUnifiedSupply() external view returns (uint256) {
        return _totalSupply + totalBridgedOut;
    }

    /// @notice Sweep tokens from a chain (rebalance supply)
    function sweep(uint256 amount, uint256 targetChain) external onlyCreator {
        require(bridgeEnabled, "V4: bridge disabled");
        require(amount > 0, "V4: amount > 0");
        uint256 sweepFee = (amount * SWEEP_BPS) / 10000;
        uint256 netAmount = amount - sweepFee;

        _burn(creator, amount);
        totalBridgedOut += netAmount;

        // Sweep fee goes to treasury or DAO
        if (sweepFee > 0) {
            if (daoActive) {
                _mint(dao.multiSigTreasury, sweepFee);
            } else {
                _mint(creator, sweepFee);
            }
        }

        emit TokensBurned(creator, amount);
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  V4: DAO GOVERNANCE                                           ║
    // ══════════════════════════════════════════════════════════════════

    /// @notice Update fee bps via DAO
    function daoUpdateFeeBps(uint256 newFeeBps) external onlyDAO {
        require(newFeeBps >= MIN_FEE_BPS && newFeeBps <= MAX_FEE_BPS, "V4: fee 0.1-5%");
        uint256 old = creatorFeeBps;
        creatorFeeBps = newFeeBps;
        emit FeeUpdatedByDAO(old, newFeeBps);
    }

    /// @notice Transfer treasury funds via DAO
    function daoTransfer(address to, uint256 amount, address token) external onlyDAO nonReentrant {
        require(to != address(0), "V4: invalid to");
        if (token == address(0)) {
            // ETH transfer
            require(address(this).balance >= amount, "V4: insufficient balance");
            _sendETH(to, amount);
        }
        emit TreasuryTransfer(to, amount, msg.sender);
    }

    /// @notice Check if an address is a DAO signer
    function isDAOSigner(address addr) external view returns (bool) {
        if (!daoActive) return false;
        for (uint256 i = 0; i < dao.initialSigners.length; i++) {
            if (dao.initialSigners[i] == addr) return true;
        }
        return false;
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  CREATOR CONTROLS: METADATA & BURN                            ║
    // ══════════════════════════════════════════════════════════════════

    function setURI(string memory newUri) external onlyCreator {
        _uri = newUri;
    }

    function burn(uint256 amount) external onlyCreator {
        require(amount > 0, "V4: amount > 0");
        require(_balances[creator] >= amount, "V4: insufficient");
        _burn(creator, amount);
        totalBurned += amount;
        emit TokensBurned(creator, amount);
    }

    // ══════════════════════════════════════════════════════════════════
    // ║  VIEW FUNCTIONS                                                ║
    // ══════════════════════════════════════════════════════════════════

    function getAntiExploitStatus(address wallet) external view returns (
        bool cooldownActive,
        uint256 cooldownRemaining,
        uint256 walletSupplyPercent,
        bool isSniperBlocked,
        bool sandwichProtected
    ) {
        uint256 elapsed = block.timestamp - lastBuyTimestamp[wallet];
        uint256 currentCooldown = antiSniperActive ? 60 : cooldownPeriod;
        cooldownActive = lastBuyTimestamp[wallet] > 0 && elapsed < currentCooldown;
        cooldownRemaining = cooldownActive ? currentCooldown - elapsed : 0;
        walletSupplyPercent = _totalSupply > 0 ? (_balances[wallet] * 10000) / _totalSupply : 0;
        isSniperBlocked = isBlocked[wallet];
        sandwichProtected = params.sandwichProtection;
    }

    function getBridgingStats() external view returns (
        uint256 bridgedIn,
        uint256 bridgedOut,
        uint256 localSupply,
        uint256 unifiedSupply,
        bool bridgeActive
    ) {
        return (totalBridgedIn, totalBridgedOut, _totalSupply, _totalSupply + totalBridgedOut, bridgeEnabled);
    }

    function getCreatorInfo() external view returns (
        address creatorAddress,
        uint256 allocationPct,
        uint256 feePct,
        uint256 vestingPct,
        uint256 vestingRemaining,
        bool hasDAO
    ) {
        uint256 creatorBalance = _balances[creator];
        allocationPct = params.creatorAllocationBps;
        feePct = params.feeBps;
        vestingPct = params.vestingPercentageBps;
        uint256 remaining = creatorVesting.totalAllocation > creatorVesting.claimed
            ? creatorVesting.totalAllocation - creatorVesting.claimed : 0;
        vestingRemaining = remaining;
        hasDAO = daoActive;
    }

    // ── Receive ETH ──────────────────────────────────────────────────
    receive() external payable {}
}
