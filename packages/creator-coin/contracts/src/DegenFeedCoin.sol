// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedCoin (v2 — Creator Coin)
 * @notice Creator coin with bonding curve + live-stream boost.
 *
 * Extends the original DegenFeedCoin with:
 *   - Live stream oracle integration (temporary boost)
 *   - Cross-chain bridge support (Solana ↔ Base)
 *   - Enhanced flash sale mechanics
 *   - Referral tracking with on-chain bonuses
 *
 * All coins pair against ETH on Base.
 *
 * @dev Self-contained ERC20, no external dependencies.
 */
contract DegenFeedCoin {
    // ── Reentrancy ─────────────────────────────────────────────────────
    uint256 private _guard = 1;
    modifier nonReentrant() {
        require(_guard == 1, "Reentrant");
        _guard = 2;
        _;
        _guard = 1;
    }

    // ── ERC-20 State ──────────────────────────────────────────────────
    string private _name;
    string private _symbol;
    string private _uri;
    uint8 public constant decimals = 18;
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ── Ownable ──────────────────────────────────────────────────────
    address public owner;
    address private _pendingOwner;

    // ── Constants ─────────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant GRADUATION_SUPPLY = 800_000_000 * 10**18;
    uint256 public constant MIN_PRICE = 1 gwei;
    uint256 public constant MAX_PRICE = 1000 gwei;
    uint256 public constant MIN_INITIAL_BUY = 0.05 ether;
    uint256 public constant MIN_BUY_AMOUNT = 0.0001 ether;
    uint256 public constant MAX_TOTAL_FEE_BPS = 250;
    uint256 public constant REFERRAL_FEE_BPS = 5;
    uint256 public constant MAX_CREATOR_ALLOCATION_BPS = 1500;
    uint256 public constant MIN_UNIQUE_BUYERS = 50;
    uint256 public constant COOLDOWN_SECONDS = 60;
    uint256 public constant FLASH_SALE_DURATION = 5 minutes;
    uint256 public constant MAX_DISCOUNT_BPS = 1000;
    uint256 public constant MAX_FLASH_SALES_PER_DAY = 3;
    uint256 public constant REFERRAL_BONUS_BPS = 100;
    uint256 public constant LIVE_BOOST_CAP_BPS = 500; // 5% max live boost

    // ── Tokenomics ────────────────────────────────────────────────────
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

    // ── Vesting ───────────────────────────────────────────────────────
    struct VestingConfig {
        uint256 initialUnlockBps;
        uint256 cliffDuration;
        uint256 vestingDuration;
    }
    VestingConfig public vestingConfig;

    // ── Era Constants ─────────────────────────────────────────────────
    uint256 public constant ERA_0_END = 500;
    uint256 public constant ERA_1_END = 1500;
    uint256 public constant ERA_2_END = 4000;
    uint256 public constant ERA_3_END = 7000;
    uint256 public constant ERA_4_END = 10000;
    uint256 public constant ERA_0_MUL = 30000;
    uint256 public constant ERA_1_MUL = 18000;
    uint256 public constant ERA_2_MUL = 10000;
    uint256 public constant ERA_3_MUL = 15000;
    uint256 public constant ERA_4_MUL = 22000;

    // ── Gamification State ────────────────────────────────────────────

    // Flash sales
    bool public flashSaleActive;
    uint256 public flashSaleDiscountBps;
    uint256 public flashSaleEndTime;
    uint256 public flashSaleMaxBuys;
    uint256 public flashSaleBuysUsed;
    uint256 public flashSalesToday;
    uint256 public flashSaleLastDay;

    // Creator events
    bool public creatorEventActive;
    uint256 public creatorEventDiscountBps;
    uint256 public creatorEventRemainingBuys;
    uint256 public creatorEventTotalBuys;
    string public creatorEventMessage;

    // Streaks
    mapping(address => uint256) public lastBuyDay;
    mapping(address => uint256) public buyStreak;

    // Referral
    mapping(address => uint256) public totalReferred;
    mapping(address => uint256) public referralBonusClaimed;

    // Top holder rewards
    mapping(address => uint256) public holderRewards;
    uint256 public totalRewardsDistributed;

    // Burn tracking
    uint256 public totalBurned;

    // Legacy per-wallet
    mapping(address => uint256) public lastBuyTimestamp;
    mapping(address => uint256) public totalBought;

    // ── Live Stream Oracle Integration ─────────────────────────────────
    /// @notice LiveStreamOracle contract address
    address public liveOracle;
    /// @notice Creator key for oracle queries (keccak256(chainId, creator))
    bytes32 public creatorKey;
    /// @notice Cache of live boost to save gas (not used directly, oracle is source of truth)
    uint256 private _cachedLiveBoost;

    // ── Cross-Chain Bridge ─────────────────────────────────────────────
    /// @notice WrappedTokenBridge contract address
    address public crossChainBridge;
    /// @notice Solana mint as bytes32 (only if bridged)
    bytes32 public solanaMint;
    /// @notice Whether this coin has a cross-chain representation
    bool public hasCrossChain;

    // ── Events ─────────────────────────────────────────────────────────
    event Trade(address indexed trader, bool indexed isBuy, uint256 tokenAmount, uint256 ethValue, uint256 timestamp);
    event Graduated(uint256 timestamp, uint256 totalSupply, uint256 totalRaised);
    event FeesDistributed(address indexed platform, uint256 platformFee, address indexed creator, uint256 creatorFee, address indexed referrer, uint256 referralFee);
    event VestingClaimed(address indexed creator, uint256 amount, uint256 remaining);
    event FlashSaleStarted(uint256 discountBps, uint256 endTime, uint256 maxBuys);
    event FlashSaleBuy(address indexed buyer, uint256 discountBps);
    event CreatorEventStarted(string message, uint256 discountBps, uint256 totalBuys);
    event CreatorEventBuy(address indexed buyer, uint256 discountBps);
    event StreakUpdated(address indexed wallet, uint256 streakDays);
    event ReferralBonus(address indexed referrer, address indexed referee, uint256 bonusTokens);
    event TokensBurned(address indexed burner, uint256 amount, uint256 newTotalSupply);
    event LiveOracleSet(address indexed oracle);
    event CrossChainBridgeSet(address indexed bridge, bytes32 solanaMint);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Modifiers ─────────────────────────────────────────────────────
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyFactory() { require(msg.sender == factory, "Only factory"); _; }
    modifier notGraduated() { require(!graduated, "Already graduated"); _; }

    // ── Constructor ──────────────────────────────────────────────────
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
        VestingConfig memory vestingConfig_,
        address liveOracle_,
        address crossChainBridge_
    ) {
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        require(creator_ != address(0), "Invalid creator");
        require(creatorAllocationBps_ <= MAX_CREATOR_ALLOCATION_BPS, "Alloc > 15%");
        require(creatorFeeBps_ <= 200, "Creator fee > 2%");
        require(platformFeeBps_ <= 200, "Platform fee > 2%");

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
        liveOracle = liveOracle_;
        crossChainBridge = crossChainBridge_;
        flashSaleLastDay = block.timestamp / 1 days;

        // Compute creator key for live oracle
        creatorKey = keccak256(abi.encodePacked(uint256(8453), creator_));
    }

    // ── ERC-20 ────────────────────────────────────────────────────────
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
            require(allowed >= value, "Insufficient allowance");
            unchecked { _allowances[from][msg.sender] = allowed - value; }
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

    // ── Ownable ──────────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Owner cannot be zero");
        _pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == _pendingOwner, "Not pending owner");
        owner = _pendingOwner;
        _pendingOwner = address(0);
    }

    // ── Bonding Curve ─────────────────────────────────────────────────
    function getCurrentPrice() public view returns (uint256) {
        uint256 minted = _totalSupply;
        if (minted >= GRADUATION_SUPPLY) return MAX_PRICE;

        uint256 progress = (minted * 10000) / GRADUATION_SUPPLY;
        uint256 linearPrice = MIN_PRICE + ((MAX_PRICE - MIN_PRICE) * progress) / 10000;

        (uint256 eraStart, uint256 eraEnd, uint256 eraMul) = _getEra(progress);

        if (eraMul == 10000) return _applyAllDiscounts(linearPrice);

        uint256 eraProgress = eraEnd > eraStart
            ? ((progress - eraStart) * 10000) / (eraEnd - eraStart)
            : 10000;

        uint256 eraProgressSq = (eraProgress * eraProgress) / 10000;
        uint256 boost = 10000 + ((eraMul - 10000) * eraProgressSq) / 10000;
        uint256 dynamicPrice = (linearPrice * boost) / 10000;

        if (dynamicPrice > MAX_PRICE) return _applyAllDiscounts(MAX_PRICE);
        if (dynamicPrice < MIN_PRICE) return _applyAllDiscounts(MIN_PRICE);

        return _applyAllDiscounts(dynamicPrice);
    }

    function _getEra(uint256 progress) internal pure returns (uint256, uint256, uint256) {
        if (progress <= ERA_0_END) return (0, ERA_0_END, ERA_0_MUL);
        if (progress <= ERA_1_END) return (ERA_0_END, ERA_1_END, ERA_1_MUL);
        if (progress <= ERA_2_END) return (ERA_1_END, ERA_2_END, ERA_2_MUL);
        if (progress <= ERA_3_END) return (ERA_2_END, ERA_3_END, ERA_3_MUL);
        return (ERA_3_END, ERA_4_END, ERA_4_MUL);
    }

    /**
     * @notice Apply all applicable discounts (flash sale + creator event + live boost).
     */
    function _applyAllDiscounts(uint256 price) internal view returns (uint256) {
        uint256 totalDiscount = 0;

        // Flash sale discount
        if (flashSaleActive && block.timestamp < flashSaleEndTime && flashSaleBuysUsed < flashSaleMaxBuys) {
            totalDiscount += flashSaleDiscountBps;
        }

        // Creator event discount
        if (creatorEventActive && creatorEventRemainingBuys > 0) {
            totalDiscount += creatorEventDiscountBps;
        }

        // Live stream boost
        if (liveOracle != address(0)) {
            (uint256 liveBoost, bool isLive) = _queryLiveBoost();
            if (isLive && liveBoost > 0) {
                totalDiscount += liveBoost;
            }
        }

        if (totalDiscount == 0) return price;
        if (totalDiscount > MAX_DISCOUNT_BPS + LIVE_BOOST_CAP_BPS) totalDiscount = MAX_DISCOUNT_BPS + LIVE_BOOST_CAP_BPS;

        uint256 discountAmount = (price * totalDiscount) / 10000;
        return price - discountAmount > MIN_PRICE ? price - discountAmount : MIN_PRICE;
    }

    /**
     * @notice Query the live stream oracle for creator's boost status.
     */
    function _queryLiveBoost() internal view returns (uint256 boostBps, bool isLive) {
        if (liveOracle == address(0)) return (0, false);
        (bool success, bytes memory data) = address(liveOracle).staticcall(
            abi.encodeWithSignature("getBoost(bytes32)", creatorKey)
        );
        if (success && data.length >= 64) {
            boostBps = abi.decode(data, (uint256));
            isLive = true;
        }
        return (boostBps, isLive);
    }

    function getTokenAmount(uint256 amount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;
        if (referrer != address(0)) {
            tokens += (tokens * REFERRAL_BONUS_BPS) / 10000;
        }
        return tokens;
    }

    function getEthAmount(uint256 tokenAmount) public view returns (uint256) {
        uint256 price = getCurrentPrice();
        return (tokenAmount * price) / 1e18;
    }

    // ── Live Stream Oracle Management ─────────────────────────────────
    function setLiveOracle(address oracle_) external onlyOwner {
        liveOracle = oracle_;
        emit LiveOracleSet(oracle_);
    }

    /**
     * @notice Get live boost for this creator's coin.
     */
    function getLiveBoost() external view returns (uint256 boostBps, bool isLive) {
        return _queryLiveBoost();
    }

    // ── Cross-Chain Bridge ─────────────────────────────────────────────
    function setCrossChainBridge(address bridge_, bytes32 solanaMint_) external onlyOwner {
        crossChainBridge = bridge_;
        solanaMint = solanaMint_;
        hasCrossChain = true;
        emit CrossChainBridgeSet(bridge_, solanaMint_);
    }

    // ── Flash Sales ────────────────────────────────────────────────────
    function startFlashSale(uint256 discountBps, uint256 maxBuys) external onlyOwner notGraduated {
        require(discountBps > 0 && discountBps <= MAX_DISCOUNT_BPS, "Invalid discount");
        require(maxBuys > 0 && maxBuys <= 50, "Invalid max buys");
        require(!flashSaleActive, "Already active");

        uint256 today = block.timestamp / 1 days;
        if (today > flashSaleLastDay) { flashSalesToday = 0; flashSaleLastDay = today; }
        require(flashSalesToday < MAX_FLASH_SALES_PER_DAY, "Rate limit");

        flashSaleActive = true;
        flashSaleDiscountBps = discountBps;
        flashSaleEndTime = block.timestamp + FLASH_SALE_DURATION;
        flashSaleMaxBuys = maxBuys;
        flashSaleBuysUsed = 0;
        flashSalesToday++;
        emit FlashSaleStarted(discountBps, flashSaleEndTime, maxBuys);
    }

    function endFlashSale() external onlyOwner { flashSaleActive = false; }

    // ── Creator Events ─────────────────────────────────────────────────
    function startCreatorEvent(string calldata message, uint256 discountBps, uint256 totalBuys)
        external onlyOwner notGraduated
    {
        require(bytes(message).length > 0, "Message required");
        require(discountBps > 0 && discountBps <= MAX_DISCOUNT_BPS, "Invalid discount");
        require(totalBuys > 0 && totalBuys <= 100, "Invalid total buys");
        require(!creatorEventActive, "Event active");

        creatorEventActive = true;
        creatorEventDiscountBps = discountBps;
        creatorEventRemainingBuys = totalBuys;
        creatorEventTotalBuys = totalBuys;
        creatorEventMessage = message;
        emit CreatorEventStarted(message, discountBps, totalBuys);
    }

    // ── Buy ────────────────────────────────────────────────────────────
    function initialBuy() external payable onlyFactory {
        require(!initialized, "Already initialized");
        require(msg.value >= MIN_INITIAL_BUY, "Min 0.05 ETH");
        initialized = true;
        _buy(owner, msg.value, 0, address(0));
    }

    function buy(uint256 minOut) external payable notGraduated nonReentrant returns (uint256) {
        require(msg.value >= MIN_BUY_AMOUNT, "Buy too small");
        return _buy(msg.sender, msg.value, minOut, referrer);
    }

    function buyWithReferrer(uint256 minOut, address referrer_)
        external payable notGraduated nonReentrant returns (uint256)
    {
        require(msg.value >= MIN_BUY_AMOUNT, "Buy too small");
        require(referrer_ != address(0) && referrer_ != msg.sender, "Invalid referrer");
        return _buy(msg.sender, msg.value, minOut, referrer_);
    }

    function _buy(address buyer, uint256 amount, uint256 minOut, address referrer_) internal returns (uint256) {
        _enforceBuyLimits(buyer, amount);

        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;

        // Referral bonus
        uint256 referrerTokens = 0;
        if (referrer_ != address(0) && referrer_ != buyer) {
            referrerTokens = (tokens * REFERRAL_BONUS_BPS) / 10000;
            tokens += referrerTokens;
            totalReferred[referrer_]++;
            emit ReferralBonus(referrer_, buyer, referrerTokens);
        }

        // Streak bonus
        uint256 streakBonus = _computeStreakBonus(buyer, tokens);
        require(tokens >= minOut, "Slippage exceeded");
        require(_balances[buyer] + tokens + streakBonus <= (TOTAL_SUPPLY * 15) / 100, "Max holder 15%");
        require(_totalSupply + tokens + streakBonus <= TOTAL_SUPPLY, "Exceeds supply");

        // Fees (individual fee splits are recomputed in _settleBuyFees —
        // keeping only the totals here avoids a codegen stack-too-deep).
        uint256 totalFees = _totalBuyFees(amount, referrer_);
        require(totalFees <= amount, "Fees exceed purchase");
        uint256 netProceeds = amount - totalFees;
        require(netProceeds > 0, "Fees consume purchase");

        // State updates (CEI)
        _mint(buyer, tokens + streakBonus);
        if (referrerTokens > 0 && referrer_ != address(this)) {
            _mint(referrer_, referrerTokens);
        }

        totalRaised += netProceeds;
        if (_balances[buyer] == tokens + streakBonus) uniqueBuyers++;
        totalBought[buyer] += tokens + streakBonus;
        lastBuyTimestamp[buyer] = block.timestamp;
        _updateStreak(buyer, tokens);

        // Flash sale tracking
        if (flashSaleActive && block.timestamp < flashSaleEndTime && flashSaleBuysUsed < flashSaleMaxBuys) {
            flashSaleBuysUsed++;
            emit FlashSaleBuy(buyer, flashSaleDiscountBps);
        }

        // Creator event tracking
        if (creatorEventActive && creatorEventRemainingBuys > 0) {
            creatorEventRemainingBuys--;
            if (creatorEventRemainingBuys == 0) creatorEventActive = false;
            emit CreatorEventBuy(buyer, creatorEventDiscountBps);
        }

        emit Trade(buyer, true, tokens + streakBonus, amount, block.timestamp);

        // ── CEI: graduation state transition BEFORE external fee sends ──
        _checkGraduation();

        _settleBuyFees(amount, referrer_);

        return tokens + streakBonus;
    }

    /// @dev Total fees charged on a buy: platform + creator + referral.
    function _totalBuyFees(uint256 amount, address referrer_) internal view returns (uint256) {
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 creatorFee = (amount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer_ != address(0) && referrer_ != address(this))
            ? (amount * REFERRAL_FEE_BPS) / 10000
            : 0;
        return platformFee + creatorFee + referralFee;
    }

    /// @dev Emit the fee-split event and transfer each fee to its receiver.
    ///      Split out of _buy into its own frame (stack depth) — the splits
    ///      are deterministic recomputations of _totalBuyFees.
    function _settleBuyFees(uint256 amount, address referrer_) internal {
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 creatorFee = (amount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer_ != address(0) && referrer_ != address(this))
            ? (amount * REFERRAL_FEE_BPS) / 10000
            : 0;
        uint256 totalFees = platformFee + creatorFee + referralFee;
        if (totalFees == 0) return;

        emit FeesDistributed(platformFeeReceiver, platformFee, owner, creatorFee, referrer_, referralFee);

        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);
    }

    // ── Sell ───────────────────────────────────────────────────────────
    function sell(uint256 tokenAmount, uint256 minOut) external notGraduated nonReentrant returns (uint256) {
        require(tokenAmount > 0, "Must sell > 0");
        require(_balances[msg.sender] >= tokenAmount, "Insufficient balance");

        uint256 price = getCurrentPrice();
        uint256 ethAmount = (tokenAmount * price) / 1e18;
        require(ethAmount >= minOut, "Slippage exceeded");
        require(address(this).balance >= ethAmount, "Insufficient ETH in curve");

        uint256 netProceeds = _netSellProceeds(ethAmount);

        _burn(msg.sender, tokenAmount);
        totalRaised -= ethAmount;

        emit Trade(msg.sender, false, tokenAmount, netProceeds, block.timestamp);

        _settleSellFees(ethAmount, netProceeds);

        return netProceeds;
    }

    /// @dev ETH owed to the seller after platform/creator/referral fees.
    function _netSellProceeds(uint256 ethAmount) internal view returns (uint256) {
        uint256 totalFees = ((ethAmount * platformFeeBps) / 10000)
            + ((ethAmount * creatorFeeBps) / 10000)
            + (referrer != address(0) ? (ethAmount * REFERRAL_FEE_BPS) / 10000 : 0);
        return ethAmount - totalFees;
    }

    /// @dev Emit the fee-split event and distribute sell proceeds.
    ///      Split out of sell into its own frame (stack depth).
    function _settleSellFees(uint256 ethAmount, uint256 netProceeds) internal {
        uint256 platformFee = (ethAmount * platformFeeBps) / 10000;
        uint256 creatorFee = (ethAmount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer != address(0)) ? (ethAmount * REFERRAL_FEE_BPS) / 10000 : 0;
        uint256 totalFees = platformFee + creatorFee + referralFee;
        if (totalFees == 0) {
            _sendFee(msg.sender, netProceeds);
            return;
        }

        emit FeesDistributed(platformFeeReceiver, platformFee, owner, creatorFee, referrer, referralFee);

        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);
        _sendFee(referrer, referralFee);
        _sendFee(msg.sender, netProceeds);
    }

    // ── Fee Helper ─────────────────────────────────────────────────────
    function _sendFee(address recipient, uint256 amount) internal {
        if (recipient == address(0) || amount == 0) return;
        (bool sent,) = recipient.call{value: amount, gas: 2300}("");
        if (!sent) {
            // Track unclaimed fees
            holderRewards[recipient] += amount;
        }
    }

    // ── Streak System ──────────────────────────────────────────────────
    function _updateStreak(address wallet, uint256) internal {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastDay = lastBuyDay[wallet];
        if (lastDay == 0) {
            buyStreak[wallet] = 1;
        } else if (currentDay > lastDay) {
            buyStreak[wallet] = (currentDay == lastDay + 1) ? buyStreak[wallet] + 1 : 1;
        }
        lastBuyDay[wallet] = currentDay;
        emit StreakUpdated(wallet, buyStreak[wallet]);
    }

    function _computeStreakBonus(address wallet, uint256 baseTokens) internal view returns (uint256) {
        uint256 streak = buyStreak[wallet];
        if (streak >= 7) return baseTokens;
        if (streak >= 6) return (baseTokens * 40) / 100;
        if (streak >= 5) return (baseTokens * 30) / 100;
        if (streak >= 4) return (baseTokens * 20) / 100;
        if (streak >= 3) return (baseTokens * 10) / 100;
        return 0;
    }

    // ── Burn ───────────────────────────────────────────────────────────
    function burn(uint256 amount) external onlyOwner {
        require(amount > 0, "Must burn > 0");
        require(_balances[owner] >= amount, "Insufficient balance");
        _burn(owner, amount);
        totalBurned += amount;
        emit TokensBurned(owner, amount, _totalSupply);
    }

    // ── Anti-Exploit ───────────────────────────────────────────────────
    function _enforceBuyLimits(address buyer, uint256 amount) internal view {
        uint256 elapsed = block.timestamp - createdAt;
        uint256 maxBps;
        if (elapsed < 60) maxBps = 100;
        else if (elapsed < 300) maxBps = 200;
        else if (elapsed < 1800) maxBps = 500;
        else if (elapsed < 86400) maxBps = 1000;
        else maxBps = 1500;

        uint256 price = getCurrentPrice();
        uint256 impliedTokens = (amount * 1e18) / price;
        require(impliedTokens <= (TOTAL_SUPPLY * maxBps) / 10000, "Exceeds phase limit");

        uint256 cooldown = elapsed < 3600 ? 60 : (elapsed < 86400 ? 30 : 0);
        if (cooldown > 0) {
            require(block.timestamp >= lastBuyTimestamp[buyer] + cooldown, "Cooldown active");
        }
    }

    // ── Graduation ─────────────────────────────────────────────────────
    function _checkGraduation() internal {
        if (_totalSupply >= GRADUATION_SUPPLY && uniqueBuyers >= MIN_UNIQUE_BUYERS) {
            graduated = true;
            flashSaleActive = false;
            creatorEventActive = false;
            emit Graduated(block.timestamp, _totalSupply, totalRaised);
        }
    }

    // ── Vesting ────────────────────────────────────────────────────────
    function claimVested() external onlyOwner nonReentrant {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        require(totalAllocation > 0, "No allocation");

        uint256 claimable = _calculateClaimable(totalAllocation);
        require(claimable > 0, "Nothing to claim");
        require(_totalSupply + claimable <= TOTAL_SUPPLY, "Vesting exceeds supply");

        creatorClaimed += claimable;
        _mint(owner, claimable);
        emit VestingClaimed(owner, claimable, totalAllocation - creatorClaimed);
    }

    function _calculateClaimable(uint256 totalAllocation) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - createdAt;

        // Cliff not yet passed
        if (elapsed < vestingConfig.cliffDuration) return 0;

        // Initial unlock
        uint256 initialUnlock = (totalAllocation * vestingConfig.initialUnlockBps) / 10000;
        uint256 alreadyClaimedFromInitial = creatorClaimed;

        if (alreadyClaimedFromInitial < initialUnlock) {
            return initialUnlock - alreadyClaimedFromInitial;
        }

        // Linear vesting after cliff
        uint256 vestingElapsed = elapsed - vestingConfig.cliffDuration;
        uint256 vestingRemaining = totalAllocation - initialUnlock;
        uint256 vestedSoFar = (vestingRemaining * vestingElapsed) / vestingConfig.vestingDuration;
        uint256 totalVested = initialUnlock + vestedSoFar;

        if (totalVested > totalAllocation) totalVested = totalAllocation;
        if (creatorClaimed >= totalVested) return 0;

        return totalVested - creatorClaimed;
    }

    // ── Metadata ───────────────────────────────────────────────────────
    function setURI(string memory newUri) external onlyOwner {
        _uri = newUri;
    }
}
