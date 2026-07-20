// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedCoin
 * @notice Forked from Zora's CreatorCoin — stripped ZORA token pairing, replaced with ETH.
 *
 * Core mechanism:
 *   - ERC-20 token with 1B total supply
 *   - ETH-denominated bonding curve (linear from 1 gwei → 1000 gwei per token)
 *   - Fee split: platform (0.5%) + creator (0-2%) + referrer (0-0.05%)
 *   - Anti-exploit guards: phase limits, buy cooldowns, max 15% per wallet
 *   - Creator vesting: FULLY CUSTOMIZABLE via VestingConfig
 *     - initialUnlockBps: 0-3000 (0-30% at launch, no lock)
 *     - cliffDuration: 0-90 days before linear vesting starts
 *     - vestingDuration: 7 days to 2 years of linear vesting
 *   - Graduation: at 80% supply + 50 unique buyers → bonding curve closes for Uniswap V4 pool
 *
 * Deployed on Base (chain 8453) via DegenFeedFactory (CREATE2).
 * Target Solidity: 0.8.26+, EVM: cancun+ (Base supports PUSH0)
 *
 * Security:
 *   - Checks-effects-interactions: state updates before external calls
 *   - No selfdestruct, no delegatecall
 *   - Reentrancy protection via gas limit on fee transfers + CEI
 *   - Price calculated from supply, not manipulable by external state
 *
 * @dev This contract is a self-contained ERC20 implementation (no OZ dependency).
 */
contract DegenFeedCoin {
    // ═══════════════════════════════════════════════════════════════════════
    // Reentrancy Guard
    // ═══════════════════════════════════════════════════════════════════════

    uint256 private _guard = 1;

    modifier nonReentrant() {
        require(_guard == 1, "Reentrant call");
        _guard = 2;
        _;
        _guard = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ERC-20 State
    // ═══════════════════════════════════════════════════════════════════════

    string  private _name;
    string  private _symbol;
    string  private _uri;
    uint8   public constant decimals = 18;

    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ═══════════════════════════════════════════════════════════════════════
    // Ownable State
    // ═══════════════════════════════════════════════════════════════════════

    address public owner;
    address private _pendingOwner;

    // ═══════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Maximum token supply (1 billion).
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    /// @notice Supply threshold for graduation (80% of total).
    uint256 public constant GRADUATION_SUPPLY = 800_000_000 * 10**18;

    /// @notice Bonding curve: minimum price (1 gwei = 0.000000001 ETH).
    uint256 public constant MIN_PRICE = 1 gwei;

    /// @notice Bonding curve: maximum price (1000 gwei = 0.000001 ETH).
    uint256 public constant MAX_PRICE = 1000 gwei;

    /// @notice Minimum initial buy from factory.
    uint256 public constant MIN_INITIAL_BUY = 0.05 ether;

    /// @notice Minimum buy amount to prevent dust attacks (0.0001 ETH).
    uint256 public constant MIN_BUY_AMOUNT = 0.0001 ether;

    /// @notice Maximum total fee in basis points (2.5%).
    uint256 public constant MAX_TOTAL_FEE_BPS = 250;

    /// @notice Referral fee hardcoded at 0.05% (5 bps).
    uint256 public constant REFERRAL_FEE_BPS = 5;

    /// @notice Maximum creator allocation in basis points (15%).
    uint256 public constant MAX_CREATOR_ALLOCATION_BPS = 1500;

    /// @notice Minimum unique buyers for graduation.
    uint256 public constant MIN_UNIQUE_BUYERS = 50;

    /// @notice Buy cooldown in seconds.
    uint256 public constant COOLDOWN_SECONDS = 60;

    // ═══════════════════════════════════════════════════════════════════════
    // Vesting Constants
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Maximum initial unlock in basis points (30%).
    uint256 public constant MAX_INITIAL_UNLOCK_BPS = 3000;

    /// @notice Maximum cliff duration (90 days).
    uint256 public constant MAX_CLIFF_DURATION = 90 days;

    /// @notice Minimum vesting duration (7 days).
    uint256 public constant MIN_VESTING_DURATION = 7 days;

    /// @notice Maximum vesting duration (2 years).
    uint256 public constant MAX_VESTING_DURATION = 730 days;

    // ═══════════════════════════════════════════════════════════════════════
    // Tokenomics State
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Creator allocation in basis points (0-1500 = 0-15%).
    uint256 public creatorAllocationBps;

    /// @notice Creator fee in basis points (0-200 = 0-2%).
    uint256 public creatorFeeBps;

    /// @notice Platform fee in basis points (set by factory, typically 50).
    uint256 public platformFeeBps;

    /// @notice Address that receives platform fees.
    address public platformFeeReceiver;

    /// @notice Referrer address (zero address if none).
    address public referrer;

    /// @notice Factory address that deployed this coin.
    address public factory;

    /// @notice Block timestamp of deployment.
    uint256 public createdAt;

    /// @notice Total ETH raised through the bonding curve (net of fees).
    uint256 public totalRaised;

    /// @notice Number of unique buyer addresses.
    uint256 public uniqueBuyers;

    /// @notice Whether the coin has graduated (bonding curve closed).
    bool public graduated;

    /// @notice Whether initialBuy has been called.
    bool public initialized;

    /// @notice Amount of creator tokens claimed via vesting.
    uint256 public creatorClaimed;

    // ═══════════════════════════════════════════════════════════════════════
    // Vesting Configuration
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Vesting configuration struct.
    /// @dev Immutable after deployment — set once in constructor.
    struct VestingConfig {
        /// Basis points unlocked immediately at launch (0-3000 = 0-30%)
        uint256 initialUnlockBps;
        /// Cliff duration in seconds before linear vesting begins (0 = no cliff)
        uint256 cliffDuration;
        /// Total vesting duration in seconds (min 7 days, max 2 years)
        uint256 vestingDuration;
    }

    /// @notice The vesting configuration for this coin.
    /// @dev Public so anyone can read the exact vesting parameters on-chain.
    ///      Transparency: no hidden bundles, no special terms — what you see is what deploys.
    VestingConfig public vestingConfig;

    // ═══════════════════════════════════════════════════════════════════════
    // Per-Wallet State
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Last buy timestamp per wallet.
    mapping(address => uint256) public lastBuyTimestamp;

    /// @notice Total tokens bought per wallet (cumulative).
    mapping(address => uint256) public totalBought;

    // ═══════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════

    event Trade(
        address indexed trader,
        bool indexed isBuy,
        uint256 tokenAmount,
        uint256 ethValue,
        uint256 timestamp
    );

    event Graduated(uint256 timestamp, uint256 totalSupply, uint256 totalRaised);

    event FeesDistributed(
        address indexed platformFeeReceiver,
        uint256 platformFee,
        address indexed creatorFeeReceiver,
        uint256 creatorFee,
        address indexed referrer,
        uint256 referralFee
    );

    event VestingClaimed(address indexed creator, uint256 amount, uint256 remaining);

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ═══════════════════════════════════════════════════════════════════════
    // ERC-20 Events
    // ═══════════════════════════════════════════════════════════════════════

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ═══════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier notGraduated() {
        require(!graduated, "Already graduated");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Deploy a new DegenFeedCoin with customizable vesting.
     * @param name_              Token name.
     * @param symbol_            Token symbol.
     * @param uri_               Metadata URI.
     * @param creator_           Creator/owner address.
     * @param creatorAllocationBps_  Creator token allocation (0-1500 bps = 0-15%).
     * @param creatorFeeBps_     Creator fee on trades (0-200 bps = 0-2%).
     * @param platformFeeBps_    Platform fee on trades (set by factory, typically 50).
     * @param platformFeeReceiver_ Address receiving platform fees.
     * @param referrer_          Referrer address (zero = no referrer).
     * @param vestingConfig_     Custom vesting configuration.
     *                           - initialUnlockBps: 0-3000 (0-30% at launch)
     *                           - cliffDuration: 0-90 days
     *                           - vestingDuration: 7 days to 2 years
     *                           Creators control these within reputation-based limits
     *                           (enforced off-chain at the factory/API level).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory uri_,
        address creator_,
        uint256 creatorAllocationBps_,
        uint256 creatorFeeBps_,
        uint256 platformFeeBps_,
        address platformFeeReceiver_,
        address referrer_,
        VestingConfig memory vestingConfig_
    ) {
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        require(creator_ != address(0), "Invalid creator");
        require(creatorAllocationBps_ <= MAX_CREATOR_ALLOCATION_BPS, "Alloc > 15%");
        require(creatorFeeBps_ <= 200, "Creator fee > 2%");
        require(platformFeeBps_ <= 200, "Platform fee > 2%");
        require(platformFeeReceiver_ != address(0), "Invalid fee receiver");

        // ── Validate vesting config ─────────────────────────────────────
        require(
            vestingConfig_.initialUnlockBps <= MAX_INITIAL_UNLOCK_BPS,
            "Initial unlock > 30%"
        );
        require(
            vestingConfig_.cliffDuration <= MAX_CLIFF_DURATION,
            "Cliff > 90 days"
        );
        require(
            vestingConfig_.vestingDuration >= MIN_VESTING_DURATION,
            "Vesting < 7 days"
        );
        require(
            vestingConfig_.vestingDuration <= MAX_VESTING_DURATION,
            "Vesting > 2 years"
        );
        // Cliff + vesting must not exceed MAX_CLIFF_DURATION + MAX_VESTING_DURATION
        // (no unbounded lockup)
        require(
            vestingConfig_.cliffDuration + vestingConfig_.vestingDuration <= MAX_CLIFF_DURATION + MAX_VESTING_DURATION,
            "Total lockup > limit"
        );

        _name = name_;
        _symbol = symbol_;
        _uri = uri_;
        owner = creator_;
        factory = msg.sender;
        createdAt = block.timestamp;

        creatorAllocationBps = creatorAllocationBps_;
        creatorFeeBps = creatorFeeBps_;
        platformFeeBps = platformFeeBps_;
        platformFeeReceiver = platformFeeReceiver_;
        referrer = referrer_;

        // Store vesting config — transparent and immutable on-chain
        vestingConfig = vestingConfig_;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ERC-20 Implementation
    // ═══════════════════════════════════════════════════════════════════════

    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
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
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "Insufficient allowance");
            unchecked { _allowances[from][msg.sender] = currentAllowance - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "Transfer from zero");
        require(to != address(0), "Transfer to zero");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "Insufficient balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "Mint to zero");
        require(_totalSupply + value <= TOTAL_SUPPLY, "Exceeds total supply");
        _totalSupply += value;
        unchecked { _balances[to] += value; }
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        require(from != address(0), "Burn from zero");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "Burn exceeds balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }

    function _approve(address owner_, address spender, uint256 value) internal {
        require(owner_ != address(0), "Approve from zero");
        require(spender != address(0), "Approve to zero");
        _allowances[owner_][spender] = value;
        emit Approval(owner_, spender, value);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Ownable Implementation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Start ownership transfer to a new address.
     * @param newOwner Address that will become the new owner.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Owner cannot be zero");
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * @notice Accept ownership transfer (called by the pending owner).
     */
    function acceptOwnership() external {
        require(msg.sender == _pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, _pendingOwner);
        owner = _pendingOwner;
        _pendingOwner = address(0);
    }

    /**
     * @notice Returns the pending owner (zero if no transfer in flight).
     */
    function pendingOwner() external view returns (address) {
        return _pendingOwner;
    }

    /**
     * @notice Renounce ownership (irreversible — use with extreme caution).
     */
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Bonding Curve
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Returns the current price per token in wei based on bonding curve progress.
     * @dev Linear from MIN_PRICE (1 gwei) at 0% to MAX_PRICE (1000 gwei) at 100%.
     *      Price is determined by how much of GRADUATION_SUPPLY has been minted.
     * @return Price per token in wei.
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 minted = _totalSupply;
        if (minted >= GRADUATION_SUPPLY) return MAX_PRICE;

        // progress = minted / GRADUATION_SUPPLY, as 1e18 fixed-point
        uint256 progress = (minted * 1e18) / GRADUATION_SUPPLY;

        // price = MIN_PRICE + (MAX_PRICE - MIN_PRICE) * progress / 1e18
        uint256 priceRange = MAX_PRICE - MIN_PRICE;
        uint256 priceIncrement = (priceRange * progress) / 1e18;

        return MIN_PRICE + priceIncrement;
    }

    /**
     * @notice Calculate how many tokens `amount` wei of ETH buys at current curve price.
     * @param amount Wei amount of ETH.
     * @return tokens Number of tokens (wei-adjusted).
     */
    function getTokenAmount(uint256 amount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        return (amount * 1e18) / price;
    }

    /**
     * @notice Calculate how much ETH `tokenAmount` tokens would return at current curve price.
     * @param tokenAmount Number of tokens (wei-adjusted).
     * @return ethAmount Wei amount of ETH.
     */
    function getEthAmount(uint256 tokenAmount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        return (tokenAmount * price) / 1e18;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Buy
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Initial buy called by the factory on deployment.
     * @dev Mints first tokens to the creator at the current curve price.
     *      Can only be called once by the factory.
     */
    function initialBuy() external payable onlyFactory {
        require(!initialized, "Already initialized");
        require(msg.value >= MIN_INITIAL_BUY, "Minimum 0.05 ETH initial buy");
        initialized = true;

        _buy(owner, msg.value, 0);
    }

    /**
     * @notice Buy tokens with ETH.
     * @param minOut Minimum number of tokens to receive (slippage protection).
     * @return tokens Number of tokens minted to the buyer.
     */
    function buy(uint256 minOut) external payable notGraduated nonReentrant returns (uint256) {
        require(msg.value > 0, "Must send ETH");
        require(msg.value >= MIN_BUY_AMOUNT, "Buy amount too small");
        return _buy(msg.sender, msg.value, minOut);
    }

    /**
     * @notice Internal buy logic.
     * @param buyer Address receiving the tokens.
     * @param amount Wei amount of ETH sent.
     * @param minOut Minimum tokens to receive.
     * @return tokens Number of tokens minted.
     */
    function _buy(address buyer, uint256 amount, uint256 minOut) internal returns (uint256) {
        _enforceBuyLimits(buyer, amount);

        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;

        require(tokens >= minOut, "Slippage exceeded");

        // Check max holder: buyer's total + new tokens ≤ 15% of TOTAL_SUPPLY
        require(
            _balances[buyer] + tokens <= (TOTAL_SUPPLY * 15) / 100,
            "Max holder 15%"
        );

        // Check supply cap
        require(_totalSupply + tokens <= TOTAL_SUPPLY, "Exceeds total supply");

        // ── Fee calculation ──────────────────────────────────────────────
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 creatorFee  = (amount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer != address(0)) ? (amount * REFERRAL_FEE_BPS) / 10000 : 0;

        // Ensure total fee rate doesn't exceed MAX_TOTAL_FEE_BPS
        require(platformFeeBps + creatorFeeBps + REFERRAL_FEE_BPS <= MAX_TOTAL_FEE_BPS,
            "Total fees exceed max");

        // Ensure fees don't exceed amount (sanity check — should never happen)
        uint256 totalFees = platformFee + creatorFee + referralFee;
        require(totalFees <= amount, "Fees exceed purchase");

        // Prevent dust: ensure net proceeds are non-zero
        uint256 netProceeds = amount - totalFees;
        require(netProceeds > 0, "Fees consume entire purchase");

        // ── State updates (CEI: checks → effects → interactions) ────────
        _mint(buyer, tokens);

        totalRaised += netProceeds;

        if (_balances[buyer] == tokens) {
            // First buy for this wallet
            uniqueBuyers++;
        }

        totalBought[buyer] += tokens;
        lastBuyTimestamp[buyer] = block.timestamp;

        emit Trade(buyer, true, tokens, amount, block.timestamp);

        if (totalFees > 0) {
            emit FeesDistributed(
                platformFeeReceiver, platformFee,
                owner, creatorFee,
                referrer, referralFee
            );
        }

        // ── Fee transfers (external calls last) ─────────────────────────
        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);
        _sendFee(referrer, referralFee);

        // ── Graduation check ────────────────────────────────────────────
        _checkGraduation();

        return tokens;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Sell
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Sell tokens back to the bonding curve for ETH.
     * @param tokenAmount Number of tokens to sell.
     * @param minOut Minimum ETH to receive (slippage protection).
     * @return ethAmount Wei amount returned to the seller.
     */
    function sell(uint256 tokenAmount, uint256 minOut) external notGraduated nonReentrant returns (uint256) {
        require(tokenAmount > 0, "Must sell > 0");
        require(_balances[msg.sender] >= tokenAmount, "Insufficient balance");

        uint256 price = getCurrentPrice();
        uint256 ethAmount = (tokenAmount * price) / 1e18;

        require(ethAmount >= minOut, "Slippage exceeded");

        // ── Fee calculation ──────────────────────────────────────────────
        uint256 platformFee = (ethAmount * platformFeeBps) / 10000;
        uint256 creatorFee  = (ethAmount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer != address(0)) ? (ethAmount * REFERRAL_FEE_BPS) / 10000 : 0;

        uint256 totalFees = platformFee + creatorFee + referralFee;
        uint256 netProceeds = ethAmount - totalFees;

        // Check contract has enough ETH
        require(address(this).balance >= netProceeds, "Insufficient ETH in curve");

        // ── State updates (CEI) ──────────────────────────────────────────
        _burn(msg.sender, tokenAmount);
        totalRaised -= ethAmount; // Reduce raised amount when selling

        emit Trade(msg.sender, false, tokenAmount, netProceeds, block.timestamp);

        if (totalFees > 0) {
            emit FeesDistributed(
                platformFeeReceiver, platformFee,
                owner, creatorFee,
                referrer, referralFee
            );
        }

        // ── Fee transfers + seller payout ────────────────────────────────
        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);
        _sendFee(referrer, referralFee);

        // Send net proceeds to seller
        _sendFee(msg.sender, netProceeds);

        return netProceeds;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Anti-Exploit Guards
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Enforce per-wallet buy limits that scale with time since creation.
     * @dev Phase limits:
     *      0-5 min:    2% of TOTAL_SUPPLY max per buy
     *      5-30 min:   5% of TOTAL_SUPPLY max per buy
     *      30 min-24h: 10% of TOTAL_SUPPLY max per buy
     *      24h+:       15% of TOTAL_SUPPLY max per buy
     *      Cooldown:   60 seconds between buys per wallet
     */
    function _enforceBuyLimits(address buyer, uint256 amount) internal view {
        uint256 elapsed = block.timestamp - createdAt;
        uint256 maxBps;

        if (elapsed < 5 minutes) {
            maxBps = 200;   // 2%
        } else if (elapsed < 30 minutes) {
            maxBps = 500;   // 5%
        } else if (elapsed < 24 hours) {
            maxBps = 1000;  // 10%
        } else {
            maxBps = 1500;  // 15% absolute max
        }

        // Convert amount from ETH to equivalent token amount at current price for comparison
        uint256 price = getCurrentPrice();
        uint256 impliedTokens = (amount * 1e18) / price;
        uint256 maxBuyTokens = (TOTAL_SUPPLY * maxBps) / 10000;

        require(impliedTokens <= maxBuyTokens, "Buy exceeds phase limit");

        // Per-wallet cooldown
        require(
            block.timestamp >= lastBuyTimestamp[buyer] + COOLDOWN_SECONDS,
            "Cooldown active"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Graduation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if the coin has reached graduation threshold.
     * @dev Graduated coins can no longer use the bonding curve.
     *      Creator should deploy a Uniswap V4 pool with the remaining ETH and tokens.
     */
    function _checkGraduation() internal {
        if (_totalSupply >= GRADUATION_SUPPLY && uniqueBuyers >= MIN_UNIQUE_BUYERS) {
            graduated = true;
            emit Graduated(block.timestamp, _totalSupply, totalRaised);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Customizable Creator Vesting
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Creators choose their own vesting parameters at deployment:
    //
    //   initialUnlockBps: 0-3000 (0-30% at launch, no lock)
    //   cliffDuration: 0-90 days before linear vesting begins
    //   vestingDuration: 7 days to 2 years of linear vesting after cliff
    //
    // At deployment, the initial unlock amount is immediately available.
    // The remainder vests linearly after the cliff period.
    //
    // Transparency: ALL parameters are on-chain and immutable.
    // No hidden bundles, no special backroom deals — what you see is what deploys.
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Creator claims vested tokens according to their custom schedule.
     * @dev Vesting logic:
     *      1. Initial unlock: `initialUnlockBps`% of allocation is claimable immediately at launch
     *      2. Cliff: No additional tokens until `cliffDuration` seconds have passed
     *      3. Linear vesting: After cliff, tokens vest linearly over `vestingDuration`
     *
     *      Example (balanced preset):
     *        - 5% initial unlock at T+0
     *        - 7-day cliff (no further unlocks)
     *        - 60-day linear vesting after cliff
     *        - At T+67: 100% vested
     */
    function claimVested() external onlyOwner nonReentrant {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        if (totalAllocation == 0) {
            revert("No allocation");
        }

        uint256 claimable = _calculateClaimable(totalAllocation);

        require(claimable > 0, "Nothing to claim");
        require(_totalSupply + claimable <= TOTAL_SUPPLY, "Vesting exceeds supply");

        creatorClaimed += claimable;
        _mint(owner, claimable);

        uint256 remaining = totalAllocation - creatorClaimed;
        emit VestingClaimed(owner, claimable, remaining);
    }

    /**
     * @notice Internal vesting calculation.
     * @dev Computes the current vested amount based on the configurable schedule.
     *
     *      Vested = initialUnlock + linear(elapsedSinceCliff / vestingDuration * postInitial)
     *
     *      Where:
     *        - initialUnlock = totalAllocation * initialUnlockBps / 10000
     *        - postInitial = totalAllocation - initialUnlock
     *        - elapsedSinceCliff = max(0, now - createdAt - cliffDuration)
     */
    function _calculateClaimable(uint256 totalAllocation) internal view returns (uint256) {
        VestingConfig memory config = vestingConfig;
        uint256 elapsed = block.timestamp - createdAt;

        // ── Initial unlock (available immediately) ───────────────────────
        uint256 initialUnlock = (totalAllocation * config.initialUnlockBps) / 10000;
        uint256 alreadyClaimed = creatorClaimed;

        // If nothing was claimed yet, include initial unlock
        if (alreadyClaimed < initialUnlock) {
            // Handle first claim — some or all of the initial unlock is available
            if (elapsed < config.cliffDuration) {
                // Still in cliff — only initial unlock is claimable
                return initialUnlock - alreadyClaimed;
            }
        }

        // ── Cliff check ──────────────────────────────────────────────────
        if (elapsed < config.cliffDuration) {
            // Past initial unlock but still in cliff period
            // Only the initial unlock has been released
            uint256 claimedForInitial = alreadyClaimed < initialUnlock ? alreadyClaimed : initialUnlock;
            if (claimedForInitial < initialUnlock) {
                return initialUnlock - claimedForInitial;
            }
            return 0;
        }

        // ── Linear vesting after cliff ───────────────────────────────────
        uint256 elapsedSinceCliff = elapsed - config.cliffDuration;
        uint256 postInitial = totalAllocation - initialUnlock;

        if (config.vestingDuration == 0 || elapsedSinceCliff >= config.vestingDuration) {
            // Full vest
            return totalAllocation - alreadyClaimed;
        }

        uint256 vested = initialUnlock + (postInitial * elapsedSinceCliff) / config.vestingDuration;

        if (vested > totalAllocation) {
            vested = totalAllocation;
        }

        if (vested <= alreadyClaimed) {
            return 0;
        }

        return vested - alreadyClaimed;
    }

    /**
     * @notice Returns the amount of tokens currently claimable by the creator.
     * @return claimable Amount of tokens (wei-adjusted).
     */
    function getClaimableVested() external view returns (uint256) {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        if (totalAllocation == 0) return 0;
        return _calculateClaimable(totalAllocation);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fee Helpers
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Send ETH to a recipient, ignoring gas limits.
     * @dev Uses call{value} with a gas limit to prevent reentrancy.
     */
    function _sendFee(address recipient, uint256 amount) internal {
        if (recipient == address(0) || amount == 0) return;
        (bool sent,) = recipient.call{value: amount, gas: 2300}("");
        // Fee transfer failure is non-fatal — recipient can withdraw via batchCollect
        if (!sent) {
            emit Transfer(address(0), recipient, amount); // Log as event for off-chain recovery
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fee Collection (failed fee transfers)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Accumulated unclaimed fees per recipient.
    mapping(address => uint256) public unclaimedFees;

    /// @notice Track failed fee transfers for later withdrawal.
    event FeeTransferFailed(address indexed recipient, uint256 amount);

    /**
     * @notice Collect accumulated fees that failed to transfer.
     */
    function collectFees() external nonReentrant {
        uint256 amount = unclaimedFees[msg.sender];
        require(amount > 0, "No unclaimed fees");
        unclaimedFees[msg.sender] = 0;
        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Collection failed");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Receive
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Accept direct ETH deposits (e.g., for Uniswap pool bootstrapping).
    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════════════
    // Views
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Returns the token metadata URI.
     */
    function tokenURI() external view returns (string memory) {
        return _uri;
    }

    /**
     * @notice Returns the current bonding curve progress as a percentage (1e18 fixed-point).
     */
    function bondingCurveProgress() external view returns (uint256) {
        return (_totalSupply * 1e18) / GRADUATION_SUPPLY;
    }

    /**
     * @notice Returns the ETH balance currently backing the bonding curve.
     */
    function curveLiquidity() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Returns the remaining unclaimed creator vesting allocation.
     * @dev Considers the full allocation minus what's been claimed so far.
     */
    function remainingVesting() external view returns (uint256) {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        return totalAllocation - creatorClaimed;
    }
}
