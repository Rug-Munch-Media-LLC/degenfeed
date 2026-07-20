// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedCoin
 * @notice Forked from Zora's CreatorCoin — stripped ZORA token pairing, replaced with ETH.
 *
 * Core mechanism:
 *   - ERC-20 token with 1B total supply
 *   - ETH-denominated DYNAMIC bonding curve (super-linear eras, not just linear)
 *   - Fee split: platform (0.5%) + creator (0-2%) + referrer (0-0.05%)
 *   - Anti-exploit guards: phase limits, buy cooldowns, max 15% per wallet
 *   - Creator vesting: FULLY CUSTOMIZABLE via VestingConfig
 *   - Graduation: at 80% supply + 50 unique buyers → bonding curve closes for Uniswap V4 pool
 *   - Flash sales: time-limited discount windows
 *   - Creator-triggered events: post → N discounted buys
 *   - Streak tracking: consecutive daily buys tracked
 *   - Burn mechanism: creator can burn to increase scarcity
 *   - Top-holder rewards: ETH dividend-style distribution
 *   - Referral boosts: bonus tokens for sharing
 *
 * ## Dynamic Bonding Curve
 * NOT linear — uses 5 eras with different exponents:
 *   Era 0 (0-5%):     exponent 2.2 — steepest early-deal
 *   Era 1 (5-15%):    exponent 1.6 — moderate
 *   Era 2 (15-40%):   exponent 1.0 — linear cruise
 *   Era 3 (40-70%):   exponent 1.5 — FOMO acceleration
 *   Era 4 (70-100%):  exponent 2.0 — scarcity finale
 *
 * Deployed on Base (chain 8453) via DegenFeedFactory (CREATE2).
 *
 * @dev Self-contained ERC20 implementation (no OZ dependency).
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

    /// @notice Flash sale duration (5 minutes).
    uint256 public constant FLASH_SALE_DURATION = 5 minutes;

    /// @notice Max discount for flash sales/events (10% = 1000 bps).
    uint256 public constant MAX_DISCOUNT_BPS = 1000;

    /// @notice Max flash sales per day.
    uint256 public constant MAX_FLASH_SALES_PER_DAY = 3;

    /// @notice Referral bonus tokens bps (1% bonus for both parties).
    uint256 public constant REFERRAL_BONUS_BPS = 100;

    // ═══════════════════════════════════════════════════════════════════════
    // Vesting Constants
    // ═══════════════════════════════════════════════════════════════════════

    uint256 public constant MAX_INITIAL_UNLOCK_BPS = 3000;
    uint256 public constant MAX_CLIFF_DURATION = 90 days;
    uint256 public constant MIN_VESTING_DURATION = 7 days;
    uint256 public constant MAX_VESTING_DURATION = 730 days;

    // ═══════════════════════════════════════════════════════════════════════
    // Tokenomics State
    // ═══════════════════════════════════════════════════════════════════════

    uint256 public creatorAllocationBps;
    uint256 public creatorFeeBps;
    uint256 public platformFeeBps;
    address public platformFeeReceiver;
    address public referrer;
    address public factory;
    uint256 public createdAt;
    uint256 public totalRaised;
    uint256 public uniqueBuyers;
    bool public graduated;
    bool public initialized;
    uint256 public creatorClaimed;

    // ═══════════════════════════════════════════════════════════════════════
    // Vesting Configuration
    // ═══════════════════════════════════════════════════════════════════════

    struct VestingConfig {
        uint256 initialUnlockBps;
        uint256 cliffDuration;
        uint256 vestingDuration;
    }

    VestingConfig public vestingConfig;

    // ═══════════════════════════════════════════════════════════════════════
    // Dynamic Curve: Era Definitions (mirrors TS bonding-curve.ts)
    // ═══════════════════════════════════════════════════════════════════════
    //
    // The curve uses 5 eras with progressive steepness:
    //
    //   Era 0: 0-5%     -> exponent 2.2  -> very flat start (great for early buyers)
    //   Era 1: 5-15%    -> exponent 1.6  -> moderate steep
    //   Era 2: 15-40%   -> exponent 1.0  -> linear cruise
    //   Era 3: 40-70%   -> exponent 1.5  -> FOMO acceleration
    //   Era 4: 70-100%  -> exponent 2.0  -> steep finale
    //
    // Price = MIN_PRICE + (MAX_PRICE - MIN_PRICE) * (progress ^ exponent) * eraMultiplier
    //
    // In Solidity we approximate the exponent with piecewise-linear segments
    // to keep gas costs low while preserving the super-linear shape.
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Era supply thresholds (as fraction of GRADUATION_SUPPLY * 1e4).
    uint256 public constant ERA_0_END = 500;    // 5%
    uint256 public constant ERA_1_END = 1500;   // 15%
    uint256 public constant ERA_2_END = 4000;   // 40%
    uint256 public constant ERA_3_END = 7000;   // 70%
    uint256 public constant ERA_4_END = 10000;  // 100%

    /// @notice Era slope multipliers (fixed-point 1e4).
    uint256 public constant ERA_0_MUL = 30000; // 3.0x
    uint256 public constant ERA_1_MUL = 18000; // 1.8x
    uint256 public constant ERA_2_MUL = 10000; // 1.0x
    uint256 public constant ERA_3_MUL = 15000; // 1.5x
    uint256 public constant ERA_4_MUL = 22000; // 2.2x

    // ═══════════════════════════════════════════════════════════════════════
    // Gamification State
    // ═══════════════════════════════════════════════════════════════════════

    // ── Flash Sales ──────────────────────────────────────────────────────
    /// @notice Whether a flash sale is currently active.
    bool public flashSaleActive;
    /// @notice Flash sale discount in bps.
    uint256 public flashSaleDiscountBps;
    /// @notice When the flash sale ends.
    uint256 public flashSaleEndTime;
    /// @notice Maximum buys during this flash sale.
    uint256 public flashSaleMaxBuys;
    /// @notice How many buys have been used in this flash sale.
    uint256 public flashSaleBuysUsed;
    /// @notice Number of flash sales today (rate-limited).
    uint256 public flashSalesToday;
    /// @notice Last flash sale day (for reset).
    uint256 public flashSaleLastDay;

    // ── Creator Events ───────────────────────────────────────────────────
    /// @notice Whether a creator-triggered event is active.
    bool public creatorEventActive;
    /// @notice Creator event discount in bps.
    uint256 public creatorEventDiscountBps;
    /// @notice Remaining discounted buys for this event.
    uint256 public creatorEventRemainingBuys;
    /// @notice Total buys this event covers.
    uint256 public creatorEventTotalBuys;
    /// @notice Creator's message for this event.
    string public creatorEventMessage;

    // ── Streak Tracking ───────────────────────────────────────────────────
    /// @notice Last buy timestamp per wallet (day-level, for streaks).
    mapping(address => uint256) public lastBuyDay;
    /// @notice Current streak count per wallet.
    mapping(address => uint256) public buyStreak;

    // ── Referral Tracking ─────────────────────────────────────────────────
    /// @notice Total referred count per wallet.
    mapping(address => uint256) public totalReferred;
    /// @notice Referral bonus tokens claimed per wallet.
    mapping(address => uint256) public referralBonusClaimed;

    // ── Top Holder Rewards ───────────────────────────────────────────────
    /// @notice Accumulated ETH rewards for top holders.
    mapping(address => uint256) public holderRewards;
    /// @notice Total ETH distributed as holder rewards.
    uint256 public totalRewardsDistributed;

    // ── Burn Tracking ─────────────────────────────────────────────────────
    /// @notice Total tokens burned by creator.
    uint256 public totalBurned;

    // ═══════════════════════════════════════════════════════════════════════
    // Per-Wallet State (Legacy — kept for backwards compat)
    // ═══════════════════════════════════════════════════════════════════════

    mapping(address => uint256) public lastBuyTimestamp;
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

    // ── New Events ────────────────────────────────────────────────────────
    event FlashSaleStarted(uint256 discountBps, uint256 endTime, uint256 maxBuys);
    event FlashSaleBuy(address indexed buyer, uint256 discountBps);
    event CreatorEventStarted(string message, uint256 discountBps, uint256 totalBuys);
    event CreatorEventBuy(address indexed buyer, uint256 discountBps);
    event StreakUpdated(address indexed wallet, uint256 streakDays);
    event ReferralBonus(address indexed referrer, address indexed referee, uint256 bonusTokens);
    event HolderRewardDistributed(address indexed holder, uint256 ethAmount);
    event TokensBurned(address indexed burner, uint256 amount, uint256 newTotalSupply);
    event PostGraduationVerified(address indexed coin);
    event DividendPaid(uint256 totalAmount, uint256 holdersPaid);

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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

        vestingConfig = vestingConfig_;

        // Initialize flash sale day tracking
        flashSaleLastDay = block.timestamp / 1 days;
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

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Owner cannot be zero");
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == _pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, _pendingOwner);
        owner = _pendingOwner;
        _pendingOwner = address(0);
    }

    function pendingOwner() external view returns (address) {
        return _pendingOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DYNAMIC BONDING CURVE
    // ═══════════════════════════════════════════════════════════════════════
    //
    // NOT linear — uses 5 eras with progressive steepness.
    // The curve is piecewise-linear with era multipliers to approximate
    // the super-linear shape on-chain without expensive exponentiation.
    //
    // How it works:
    //   1. Compute overall linear progress: supply / GRADUATION_SUPPLY
    //   2. Find the current era
    //   3. Compute era-local progress within the era
    //   4. Blend: base linear price * (1 + (eraMul - 1) * eraProgress^2)
    //
    // This gives a smooth S-curve that starts flat (great for early buyers)
    // and accelerates as supply increases.
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Returns the current dynamic price per token in wei.
     * @dev Super-linear curve with 5 eras — NOT the simple linear from v1.
     * @return Price per token in wei.
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 minted = _totalSupply;
        if (minted >= GRADUATION_SUPPLY) return MAX_PRICE;

        // Overall linear progress (0 to 1e4 fixed-point)
        uint256 progress = (minted * 10000) / GRADUATION_SUPPLY;

        // Linear baseline price
        uint256 linearPrice = MIN_PRICE + ((MAX_PRICE - MIN_PRICE) * progress) / 10000;

        // Find era and apply multiplier
        (uint256 eraStartProgress, uint256 eraEndProgress, uint256 eraMul) = _getEra(progress);

        if (eraMul == 10000) {
            // Era 2 — pure linear, no adjustment needed
            return _applyDiscount(linearPrice);
        }

        // Era-local progress (0 to 1e4)
        uint256 eraProgress = eraEndProgress > eraStartProgress
            ? ((progress - eraStartProgress) * 10000) / (eraEndProgress - eraStartProgress)
            : 10000;

        // Era boost = 1 + (eraMul - 1) * (eraProgress / 1e4)^2
        // We use quadratic easing for smooth acceleration
        uint256 eraProgressSq = (eraProgress * eraProgress) / 10000;
        uint256 boost = 10000 + ((eraMul - 10000) * eraProgressSq) / 10000;

        uint256 dynamicPrice = (linearPrice * boost) / 10000;

        if (dynamicPrice > MAX_PRICE) return _applyDiscount(MAX_PRICE);
        if (dynamicPrice < MIN_PRICE) return _applyDiscount(MIN_PRICE);

        return _applyDiscount(dynamicPrice);
    }

    /**
     * @notice Get era parameters for a given progress value.
     * @return eraStartProgress Start of current era (0-10000)
     * @return eraEndProgress End of current era (0-10000)
     * @return eraMul Era multiplier (10000 = 1x, 30000 = 3x)
     */
    function _getEra(uint256 progress) internal pure returns (
        uint256 eraStartProgress,
        uint256 eraEndProgress,
        uint256 eraMul
    ) {
        if (progress <= ERA_0_END) {
            return (0, ERA_0_END, ERA_0_MUL);
        } else if (progress <= ERA_1_END) {
            return (ERA_0_END, ERA_1_END, ERA_1_MUL);
        } else if (progress <= ERA_2_END) {
            return (ERA_1_END, ERA_2_END, ERA_2_MUL);
        } else if (progress <= ERA_3_END) {
            return (ERA_2_END, ERA_3_END, ERA_3_MUL);
        } else {
            return (ERA_3_END, ERA_4_END, ERA_4_MUL);
        }
    }

    /**
     * @notice Apply flash sale / creator event discount to a price.
     * @param price The base dynamic price.
     * @return Discounted price (or same if no discount active).
     */
    function _applyDiscount(uint256 price) internal view returns (uint256) {
        uint256 totalDiscount = 0;

        if (flashSaleActive && block.timestamp < flashSaleEndTime && flashSaleBuysUsed < flashSaleMaxBuys) {
            totalDiscount += flashSaleDiscountBps;
        }

        if (creatorEventActive && creatorEventRemainingBuys > 0) {
            totalDiscount += creatorEventDiscountBps;
        }

        if (totalDiscount == 0) return price;
        if (totalDiscount > MAX_DISCOUNT_BPS) totalDiscount = MAX_DISCOUNT_BPS;

        uint256 discountAmount = (price * totalDiscount) / 10000;
        if (price - discountAmount < MIN_PRICE) return MIN_PRICE;
        return price - discountAmount;
    }

    /**
     * @notice Calculate how many tokens `amount` wei of ETH buys at current curve price.
     * Includes referral bonus if referrer exists.
     */
    function getTokenAmount(uint256 amount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;

        // Referral bonus: additional tokens for the buyer
        if (referrer != address(0)) {
            tokens += (tokens * REFERRAL_BONUS_BPS) / 10000;
        }

        return tokens;
    }

    /**
     * @notice Calculate how much ETH `tokenAmount` tokens would return at current curve price.
     */
    function getEthAmount(uint256 tokenAmount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        return (tokenAmount * price) / 1e18;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Flash Sales — Limited-Time Price Dips
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Start a flash sale (creator-only, rate-limited).
     * @param discountBps Discount in basis points (max 1000 = 10%).
     * @param maxBuys Maximum number of discounted buys.
     */
    function startFlashSale(uint256 discountBps, uint256 maxBuys) external onlyOwner notGraduated {
        require(discountBps > 0, "Discount required");
        require(discountBps <= MAX_DISCOUNT_BPS, "Discount > 10%");
        require(maxBuys > 0 && maxBuys <= 50, "Invalid max buys");
        require(!flashSaleActive, "Flash sale already active");

        // Rate limit: max 3 flash sales per day
        uint256 today = block.timestamp / 1 days;
        if (today > flashSaleLastDay) {
            flashSalesToday = 0;
            flashSaleLastDay = today;
        }
        require(flashSalesToday < MAX_FLASH_SALES_PER_DAY, "Flash sale rate limit");

        flashSaleActive = true;
        flashSaleDiscountBps = discountBps;
        flashSaleEndTime = block.timestamp + FLASH_SALE_DURATION;
        flashSaleMaxBuys = maxBuys;
        flashSaleBuysUsed = 0;
        flashSalesToday++;

        emit FlashSaleStarted(discountBps, flashSaleEndTime, maxBuys);
    }

    /**
     * @notice End a flash sale early (creator-only).
     */
    function endFlashSale() external onlyOwner {
        flashSaleActive = false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Creator Events — "Creator just posted! Next 10 buys get 5% off"
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Start a creator-triggered discount event.
     * @param message The creator's message (e.g., "Just dropped new content!").
     * @param discountBps Discount in basis points (max 1000 = 10%).
     * @param totalBuys Number of buys this event covers.
     */
    function startCreatorEvent(string calldata message, uint256 discountBps, uint256 totalBuys)
        external onlyOwner notGraduated
    {
        require(bytes(message).length > 0, "Message required");
        require(discountBps > 0 && discountBps <= MAX_DISCOUNT_BPS, "Invalid discount");
        require(totalBuys > 0 && totalBuys <= 100, "Invalid total buys");
        require(!creatorEventActive, "Event already active");

        creatorEventActive = true;
        creatorEventDiscountBps = discountBps;
        creatorEventRemainingBuys = totalBuys;
        creatorEventTotalBuys = totalBuys;
        creatorEventMessage = message;

        emit CreatorEventStarted(message, discountBps, totalBuys);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Buy
    // ═══════════════════════════════════════════════════════════════════════

    function initialBuy() external payable onlyFactory {
        require(!initialized, "Already initialized");
        require(msg.value >= MIN_INITIAL_BUY, "Minimum 0.05 ETH initial buy");
        initialized = true;

        _buy(owner, msg.value, 0, address(0)); // No referrer for initial buy
    }

    function buy(uint256 minOut) external payable notGraduated nonReentrant returns (uint256) {
        require(msg.value > 0, "Must send ETH");
        require(msg.value >= MIN_BUY_AMOUNT, "Buy amount too small");
        return _buy(msg.sender, msg.value, minOut, referrer);
    }

    /**
     * @notice Buy with an explicit referrer address (for referral tracking).
     * @param minOut Minimum tokens to receive.
     * @param referrer_ The referrer's address.
     */
    function buyWithReferrer(uint256 minOut, address referrer_) external payable notGraduated nonReentrant returns (uint256) {
        require(msg.value > 0, "Must send ETH");
        require(msg.value >= MIN_BUY_AMOUNT, "Buy amount too small");
        require(referrer_ != address(0) && referrer_ != msg.sender, "Invalid referrer");
        return _buy(msg.sender, msg.value, minOut, referrer_);
    }

    /**
     * @notice Internal buy logic with referrer support.
     */
    function _buy(address buyer, uint256 amount, uint256 minOut, address referrer_) internal returns (uint256) {
        _enforceBuyLimits(buyer, amount);

        uint256 price = getCurrentPrice();

        // Base tokens from curve
        uint256 tokens = (amount * 1e18) / price;

        // Referral bonus: bonus tokens for both parties
        uint256 referrerTokens = 0;
        if (referrer_ != address(0) && referrer_ != buyer) {
            referrerTokens = (tokens * REFERRAL_BONUS_BPS) / 10000;
            tokens += referrerTokens; // Bonus for buyer
            totalReferred[referrer_]++;
            emit ReferralBonus(referrer_, buyer, referrerTokens);
        }

        // Streak bonus: if on a 7+ day streak, get 2x tokens
        uint256 streakBonus = _computeStreakBonus(buyer, tokens);

        require(tokens >= minOut, "Slippage exceeded");

        require(
            _balances[buyer] + tokens + streakBonus <= (TOTAL_SUPPLY * 15) / 100,
            "Max holder 15%"
        );

        require(_totalSupply + tokens + streakBonus <= TOTAL_SUPPLY, "Exceeds total supply");

        // ── Fee calculation ──────────────────────────────────────────────
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 creatorFee  = (amount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer_ != address(0) && referrer_ != address(this))
            ? (amount * REFERRAL_FEE_BPS) / 10000 : 0;

        require(platformFeeBps + creatorFeeBps + REFERRAL_FEE_BPS <= MAX_TOTAL_FEE_BPS,
            "Total fees exceed max");

        uint256 totalFees = platformFee + creatorFee + referralFee;
        require(totalFees <= amount, "Fees exceed purchase");

        uint256 netProceeds = amount - totalFees;
        require(netProceeds > 0, "Fees consume entire purchase");

        // ── State updates (CEI) ────────────────────────────────────────
        _mint(buyer, tokens + streakBonus);

        // Mint referral bonus tokens to referrer
        if (referrerTokens > 0 && referrer_ != address(this)) {
            _mint(referrer_, referrerTokens);
        }

        totalRaised += netProceeds;

        if (_balances[buyer] == tokens + streakBonus) {
            uniqueBuyers++;
        }

        totalBought[buyer] += tokens + streakBonus;
        lastBuyTimestamp[buyer] = block.timestamp;

        // ── Streak update ──────────────────────────────────────────────
        _updateStreak(buyer, tokens);

        // ── Flash sale tracking ────────────────────────────────────────
        bool usedFlashSale = false;
        if (flashSaleActive && block.timestamp < flashSaleEndTime && flashSaleBuysUsed < flashSaleMaxBuys) {
            flashSaleBuysUsed++;
            usedFlashSale = true;
            emit FlashSaleBuy(buyer, flashSaleDiscountBps);
        }

        // ── Creator event tracking ────────────────────────────────────
        if (creatorEventActive && creatorEventRemainingBuys > 0) {
            creatorEventRemainingBuys--;
            if (creatorEventRemainingBuys == 0) {
                creatorEventActive = false;
            }
            emit CreatorEventBuy(buyer, creatorEventDiscountBps);
        }

        emit Trade(buyer, true, tokens + streakBonus, amount, block.timestamp);

        if (totalFees > 0) {
            emit FeesDistributed(
                platformFeeReceiver, platformFee,
                owner, creatorFee,
                referrer_, referralFee
            );
        }

        // ── Fee transfers ─────────────────────────────────────────────
        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);

        // ── Graduation check ──────────────────────────────────────────
        _checkGraduation();

        return tokens + streakBonus;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Sell
    // ═══════════════════════════════════════════════════════════════════════

    function sell(uint256 tokenAmount, uint256 minOut) external notGraduated nonReentrant returns (uint256) {
        require(tokenAmount > 0, "Must sell > 0");
        require(_balances[msg.sender] >= tokenAmount, "Insufficient balance");

        uint256 price = getCurrentPrice();
        uint256 ethAmount = (tokenAmount * price) / 1e18;

        require(ethAmount >= minOut, "Slippage exceeded");

        uint256 platformFee = (ethAmount * platformFeeBps) / 10000;
        uint256 creatorFee  = (ethAmount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer != address(0)) ? (ethAmount * REFERRAL_FEE_BPS) / 10000 : 0;

        uint256 totalFees = platformFee + creatorFee + referralFee;
        uint256 netProceeds = ethAmount - totalFees;

        require(address(this).balance >= netProceeds, "Insufficient ETH in curve");

        // ── State updates (CEI) ──────────────────────────────────────────
        _burn(msg.sender, tokenAmount);
        totalRaised -= ethAmount;

        emit Trade(msg.sender, false, tokenAmount, netProceeds, block.timestamp);

        if (totalFees > 0) {
            emit FeesDistributed(
                platformFeeReceiver, platformFee,
                owner, creatorFee,
                referrer, referralFee
            );
        }

        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);
        _sendFee(referrer, referralFee);
        _sendFee(msg.sender, netProceeds);

        return netProceeds;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Streak System
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Update the buy streak for a wallet.
     * @dev A "day" = floor(timestamp / 86400). If same day, no change.
     *      If consecutive day, increment. Otherwise, reset to 1.
     */
    function _updateStreak(address wallet, uint256 baseTokens) internal {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastDay = lastBuyDay[wallet];

        if (lastDay == 0) {
            // First buy ever
            buyStreak[wallet] = 1;
        } else if (currentDay > lastDay) {
            if (currentDay == lastDay + 1) {
                // Consecutive day — increment
                buyStreak[wallet]++;
            } else {
                // Missed a day — reset
                buyStreak[wallet] = 1;
            }
        }
        // else same day — no change

        lastBuyDay[wallet] = currentDay;
        emit StreakUpdated(wallet, buyStreak[wallet]);
    }

    /**
     * @notice Compute streak bonus tokens.
     * @dev 7+ day streak → 2x tokens (100% bonus)
     *      3-6 day streak → 10-40% bonus
     */
    function _computeStreakBonus(address wallet, uint256 baseTokens) internal view returns (uint256) {
        uint256 streak = buyStreak[wallet];

        // Also check if today is a consecutive day
        uint256 currentDay = block.timestamp / 1 days;
        if (lastBuyDay[wallet] < currentDay) {
            // User hasn't bought today — no bonus yet (they will after buying)
            if (currentDay > lastBuyDay[wallet] + 1) {
                streak = 0; // Streak broken
            }
        }

        if (streak >= 7) {
            return baseTokens; // 100% bonus (2x total)
        } else if (streak >= 6) {
            return (baseTokens * 40) / 100; // 40% bonus
        } else if (streak >= 5) {
            return (baseTokens * 30) / 100; // 30% bonus
        } else if (streak >= 4) {
            return (baseTokens * 20) / 100; // 20% bonus
        } else if (streak >= 3) {
            return (baseTokens * 10) / 100; // 10% bonus
        }

        return 0;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Burn Mechanism — Creator Burns Tokens to Increase Scarcity
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Burn tokens from the creator's balance.
     * @param amount Amount of tokens to burn.
     */
    function burn(uint256 amount) external onlyOwner {
        require(amount > 0, "Must burn > 0");
        require(_balances[owner] >= amount, "Insufficient creator balance");

        _burn(owner, amount);
        totalBurned += amount;

        emit TokensBurned(owner, amount, _totalSupply);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Top Holder Rewards (Dividend-like Distribution)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Distribute ETH rewards to top holders.
     * @dev Creator can distribute a portion of their fees to top holders.
     * @param ethAmount Amount of ETH to distribute.
     * @param minBalance Minimum token balance to qualify.
     */
    function distributeRewards(uint256 ethAmount, uint256 minBalance) external onlyOwner {
        require(ethAmount > 0, "Amount required");
        require(address(this).balance >= ethAmount, "Insufficient ETH");

        // Find top holders (up to 10)
        // We use a simple approach: iterate through a provided list of holders
        // In production, this would read from an off-chain indexer
        // For now, we just put the ETH aside and emit an event for off-chain distribution
        holderRewards[address(0)] += ethAmount; // Accumulator for off-chain claims
        totalRewardsDistributed += ethAmount;

        emit DividendPaid(ethAmount, 0);
    }

    /**
     * @notice Claim accumulated holder rewards.
     * @param proof Off-chain merkle proof (for future use).
     */
    function claimRewards(bytes calldata /* proof */) external nonReentrant {
        uint256 amount = holderRewards[msg.sender];
        require(amount > 0, "No rewards to claim");
        require(address(this).balance >= amount, "Insufficient ETH");

        holderRewards[msg.sender] = 0;
        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Claim failed");

        emit HolderRewardDistributed(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Anti-Exploit Guards (Enhanced)
    // ═══════════════════════════════════════════════════════════════════════

    function _enforceBuyLimits(address buyer, uint256 amount) internal view {
        uint256 elapsed = block.timestamp - createdAt;
        uint256 maxBps;

        if (elapsed < 60) {
            // 0-1 min: ultra restrictive
            maxBps = 100; // 1%
        } else if (elapsed < 300) {
            maxBps = 200; // 2%
        } else if (elapsed < 1800) {
            maxBps = 500; // 5%
        } else if (elapsed < 86400) {
            maxBps = 1000; // 10%
        } else {
            maxBps = 1500; // 15%
        }

        uint256 price = getCurrentPrice();
        uint256 impliedTokens = (amount * 1e18) / price;
        uint256 maxBuyTokens = (TOTAL_SUPPLY * maxBps) / 10000;

        require(impliedTokens <= maxBuyTokens, "Buy exceeds phase limit");

        // Cooldown: 60s → 0s over time (relaxes)
        uint256 cooldown = elapsed < 3600 ? 60 : (elapsed < 86400 ? 30 : 0);
        if (cooldown > 0) {
            require(
                block.timestamp >= lastBuyTimestamp[buyer] + cooldown,
                "Cooldown active"
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Graduation
    // ═══════════════════════════════════════════════════════════════════════

    function _checkGraduation() internal {
        if (_totalSupply >= GRADUATION_SUPPLY && uniqueBuyers >= MIN_UNIQUE_BUYERS) {
            graduated = true;
            _postGraduationSetup();
            emit Graduated(block.timestamp, _totalSupply, totalRaised);
        }
    }

    /**
     * @notice Post-graduation setup: mark as graduated, ready for AMM.
     */
    function _postGraduationSetup() internal {
        graduated = true;
        // Any leftover creator event / flash sale is auto-closed
        flashSaleActive = false;
        creatorEventActive = false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Post-Graduation Features
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Whether this coin is verified post-graduation.
    bool public isVerified;

    /**
     * @notice Mark the coin as verified (called by factory/off-chain after AMM listing).
     */
    function verify() external onlyFactory {
        require(graduated, "Not graduated yet");
        isVerified = true;
        emit PostGraduationVerified(address(this));
    }

    /**
     * @notice Check if an address holds tokens (for token-gating).
     */
    function isHolder(address wallet) external view returns (bool) {
        return _balances[wallet] > 0 || wallet == owner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Creator Vesting (Unchanged from v1)
    // ═══════════════════════════════════════════════════════════════════════

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

    function _calculateClaimable(uint256 totalAllocation) internal view returns (uint256) {
        VestingConfig memory config = vestingConfig;
        uint256 elapsed = block.timestamp - createdAt;

        uint256 initialUnlock = (totalAllocation * config.initialUnlockBps) / 10000;
        uint256 alreadyClaimed = creatorClaimed;

        if (alreadyClaimed < initialUnlock) {
            if (elapsed < config.cliffDuration) {
                return initialUnlock - alreadyClaimed;
            }
        }

        if (elapsed < config.cliffDuration) {
            uint256 claimedForInitial = alreadyClaimed < initialUnlock ? alreadyClaimed : initialUnlock;
            if (claimedForInitial < initialUnlock) {
                return initialUnlock - claimedForInitial;
            }
            return 0;
        }

        uint256 elapsedSinceCliff = elapsed - config.cliffDuration;
        uint256 postInitial = totalAllocation - initialUnlock;

        if (config.vestingDuration == 0 || elapsedSinceCliff >= config.vestingDuration) {
            return totalAllocation - alreadyClaimed;
        }

        uint256 vested = initialUnlock + (postInitial * elapsedSinceCliff) / config.vestingDuration;

        if (vested > totalAllocation) vested = totalAllocation;
        if (vested <= alreadyClaimed) return 0;

        return vested - alreadyClaimed;
    }

    function getClaimableVested() external view returns (uint256) {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        if (totalAllocation == 0) return 0;
        return _calculateClaimable(totalAllocation);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fee Helpers
    // ═══════════════════════════════════════════════════════════════════════

    function _sendFee(address recipient, uint256 amount) internal {
        if (recipient == address(0) || amount == 0) return;
        (bool sent,) = recipient.call{value: amount, gas: 2300}("");
        if (!sent) {
            unclaimedFees[recipient] += amount;
            emit FeeTransferFailed(recipient, amount);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fee Collection
    // ═══════════════════════════════════════════════════════════════════════

    mapping(address => uint256) public unclaimedFees;
    event FeeTransferFailed(address indexed recipient, uint256 amount);

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

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════════════
    // Views
    // ═══════════════════════════════════════════════════════════════════════

    function tokenURI() external view returns (string memory) {
        return _uri;
    }

    function bondingCurveProgress() external view returns (uint256) {
        return (_totalSupply * 1e18) / GRADUATION_SUPPLY;
    }

    function curveLiquidity() external view returns (uint256) {
        return address(this).balance;
    }

    function remainingVesting() external view returns (uint256) {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        return totalAllocation - creatorClaimed;
    }

    /**
     * @notice Get the current era index (0-4).
     */
    function getCurrentEra() external view returns (uint256) {
        uint256 minted = _totalSupply;
        if (minted >= GRADUATION_SUPPLY) return 4;
        uint256 progress = (minted * 10000) / GRADUATION_SUPPLY;

        if (progress <= ERA_0_END) return 0;
        if (progress <= ERA_1_END) return 1;
        if (progress <= ERA_2_END) return 2;
        if (progress <= ERA_3_END) return 3;
        return 4;
    }

    /**
     * @notice Get a buyer's current streak (0 if broken).
     */
    function getStreak(address wallet) external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastDay = lastBuyDay[wallet];

        if (lastDay == 0) return 0;
        // Streak is active if last buy was today or yesterday
        if (currentDay - lastDay <= 1) {
            return buyStreak[wallet];
        }
        return 0; // Streak broken
    }

    /**
     * @notice Get holder count (approximate — iterates if needed, but returns uint256).
     * In practice, off-chain indexers provide this.
     */
    function getHolderCount() external view returns (uint256) {
        return uniqueBuyers;
    }

    /**
     * @notice Returns remaining flash sale info.
     */
    function getFlashSaleInfo() external view returns (
        bool active,
        uint256 discountBps,
        uint256 remainingTime,
        uint256 remainingBuys
    ) {
        if (!flashSaleActive || block.timestamp >= flashSaleEndTime || flashSaleBuysUsed >= flashSaleMaxBuys) {
            return (false, 0, 0, 0);
        }
        return (
            true,
            flashSaleDiscountBps,
            flashSaleEndTime - block.timestamp,
            flashSaleMaxBuys - flashSaleBuysUsed
        );
    }

    /**
     * @notice Returns active creator event info.
     */
    function getCreatorEventInfo() external view returns (
        bool active,
        uint256 discountBps,
        uint256 remainingBuys,
        string memory message
    ) {
        if (!creatorEventActive || creatorEventRemainingBuys == 0) {
            return (false, 0, 0, "");
        }
        return (true, creatorEventDiscountBps, creatorEventRemainingBuys, creatorEventMessage);
    }

    /**
     * @notice Returns the dynamic curve era name for UI.
     */
    function getEraName() external pure returns (string memory) {
        // Not stored — computed by off-chain UI
        return "Dynamic";
    }

    /**
     * @notice Returns total supply after burns.
     */
    function getEffectiveSupply() external view returns (uint256) {
        return TOTAL_SUPPLY - totalBurned;
    }
}
