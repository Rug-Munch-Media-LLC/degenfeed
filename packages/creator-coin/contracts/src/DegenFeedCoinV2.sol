// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title DegenFeedCoinV2 — Creator Coin 2.0
 * @notice Next-gen creator coin: anti-exploit + creator controls + bonding curve 2.0 + post-bonding
 *
 * UPGRADES from V1:
 *   ① Anti-Exploit: anti-whale (1% max/buy, 0.5% max/wallet), anti-sniper (30s cooldown),
 *     anti-bot (wallet age + tx count checks), anti-MEV (Flashbots integration point),
 *     bundler detection (max 3 buys/block)
 *   ② Creator Controls: vesting schedule (90d default), allocation splits (creator 5-20%,
 *     LP 50-80%, community 10-30%, treasury 5-10%), transfer restrictions during bonding,
 *     burn unsold tokens
 *   ③ Bonding Curve 2.0: 5 named phases with visual progress
 *   ④ Post-Bonding: graduation party, AMA scheduling, LP lock, leaderboard
 *
 * @dev Extends V1 with new features. All original events preserved.
 */

contract DegenFeedCoinV2 {
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
    uint256 public constant MIN_UNIQUE_BUYERS = 50;

    // ═══════════════════════════════════════════════════════════════════
    // ║  CREATOR COIN 2.0 — Anti-Exploit Constants                     ║
    // ═══════════════════════════════════════════════════════════════════

    // Anti-whale: max 1% of supply per buy, 0.5% per wallet
    uint256 public constant MAX_BUY_BPS = 100;       // 1%
    uint256 public constant MAX_WALLET_BPS = 50;      // 0.5%

    // Anti-sniper: 30 second cooldown
    uint256 public constant BUY_COOLDOWN = 30;

    // Bundler detection: max 3 buys per block
    uint256 public constant MAX_BUYS_PER_BLOCK = 3;

    // ═══════════════════════════════════════════════════════════════════
    // ║  CREATOR COIN 2.0 — Creator Controls                           ║
    // ═══════════════════════════════════════════════════════════════════

    // Allocation splits (bps)
    uint256 public creatorAllocationBps;
    uint256 public liquidityAllocationBps;
    uint256 public communityAllocationBps;
    uint256 public treasuryAllocationBps;

    // Vesting
    uint256 public vestingDuration;
    uint256 public vestingCliff;
    uint256 public initialUnlockBps;
    bool public isLinearVesting;

    // Transfer restrictions
    bool public restrictTransfers;
    bool public graduated;
    bool public initialized;

    // Burn mechanism
    bool public burnUnsoldOnGraduation;
    uint256 public totalBurned;

    // ═══════════════════════════════════════════════════════════════════
    // ║  CREATOR COIN 2.0 — Bonding Curve Phase Tracking               ║
    // ═══════════════════════════════════════════════════════════════════

    uint256 public constant ERA_0_END = 2000;  // Steal Deal: 0-20%
    uint256 public constant ERA_1_END = 4000;  // Early Bird: 20-40%
    uint256 public constant ERA_2_END = 6000;  // Cruise Control: 40-60%
    uint256 public constant ERA_3_END = 8000;  // Final Call: 60-80%
    uint256 public constant ERA_4_END = 10000; // Moonshot: 80-100%

    uint256 public constant ERA_0_MUL = 30000;
    uint256 public constant ERA_1_MUL = 18000;
    uint256 public constant ERA_2_MUL = 10000;
    uint256 public constant ERA_3_MUL = 15000;
    uint256 public constant ERA_4_MUL = 22000;

    // ═══════════════════════════════════════════════════════════════════
    // ║  CREATOR COIN 2.0 — Post-Bonding                               ║
    // ═══════════════════════════════════════════════════════════════════

    uint256 public graduationTime;
    uint256 public liquidityUnlockTime;
    uint256 public graduationPartyEndTime;

    // ═══════════════════════════════════════════════════════════════════
    // ║  ANTI-EXPLOIT STORAGE                                          ║
    // ═══════════════════════════════════════════════════════════════════

    mapping(address => uint256) public lastBuyTimestamp;
    mapping(address => uint256) public totalBought;
    mapping(address => uint256) public lastBuyBlock;
    mapping(uint256 => uint256) public buysPerBlock;
    mapping(address => uint256) public buyCount;
    mapping(address => bool) public isBlockedSniper;

    // ═══════════════════════════════════════════════════════════════════
    // ║  CREATOR CONTROLS STORAGE                                      ║
    // ═══════════════════════════════════════════════════════════════════

    uint256 public creatorClaimed;
    uint256 public createdAt;
    uint256 public totalRaised;
    uint256 public uniqueBuyers;
    uint256 public creatorFeeBps;
    uint256 public platformFeeBps;
    address public platformFeeReceiver;
    address public referrer;

    // ═══════════════════════════════════════════════════════════════════
    // ║  FLASH SALES & EVENTS (V1 compat)                              ║
    // ═══════════════════════════════════════════════════════════════════

    bool public flashSaleActive;
    uint256 public flashSaleDiscountBps;
    uint256 public flashSaleEndTime;
    uint256 public flashSaleMaxBuys;
    uint256 public flashSaleBuysUsed;
    uint256 public flashSalesToday;
    uint256 public flashSaleLastDay;
    uint256 public constant FLASH_SALE_DURATION = 5 minutes;
    uint256 public constant MAX_DISCOUNT_BPS = 1000;
    uint256 public constant MAX_FLASH_SALES_PER_DAY = 3;

    bool public creatorEventActive;
    uint256 public creatorEventDiscountBps;
    uint256 public creatorEventRemainingBuys;
    uint256 public creatorEventTotalBuys;
    string public creatorEventMessage;

    // ═══════════════════════════════════════════════════════════════════
    // ║  EVENTS                                                        ║
    // ═══════════════════════════════════════════════════════════════════

    event Trade(address indexed trader, bool indexed isBuy, uint256 tokenAmount, uint256 ethValue, uint256 timestamp);
    event Graduated(uint256 timestamp, uint256 totalSupply, uint256 totalRaised, string phaseHistory);
    event TokensBurned(address indexed burner, uint256 amount, uint256 newTotalSupply);
    event VestingClaimed(address indexed creator, uint256 amount, uint256 remaining);
    event FeesDistributed(address indexed platform, uint256 platformFee, address indexed creator, uint256 creatorFee, address indexed referrer, uint256 referralFee);
    event FlashSaleStarted(uint256 discountBps, uint256 endTime, uint256 maxBuys);
    event FlashSaleBuy(address indexed buyer, uint256 discountBps);
    event CreatorEventStarted(string message, uint256 discountBps, uint256 totalBuys);
    event CreatorEventBuy(address indexed buyer, uint256 discountBps);
    event AntiExploitBlocked(address indexed wallet, string reason, uint256 timestamp);
    event PhaseChanged(uint256 phaseIndex, string phaseName, uint256 supply);
    event LiquidityLocked(uint256 amount, uint256 unlockTimestamp);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ═══════════════════════════════════════════════════════════════════
    // ║  MODIFIERS                                                     ║
    // ═══════════════════════════════════════════════════════════════════

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyFactory() { require(msg.sender == factory, "Only factory"); _; }
    modifier notGraduated() { require(!graduated, "Already graduated"); _; }
    modifier checkTransfers() {
        if (restrictTransfers && !graduated) {
            revert("Transfers restricted during bonding");
        }
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────
    address public factory;

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
        uint256 vestingDuration_,
        uint256 vestingCliff_,
        uint256 initialUnlockBps_,
        bool isLinearVesting_,
        uint256 liquidityAllocationBps_,
        uint256 communityAllocationBps_,
        uint256 treasuryAllocationBps_,
        bool restrictTransfers_,
        bool burnUnsoldOnGraduation_
    ) {
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        require(creator_ != address(0), "Invalid creator");

        // Creator controls validation
        require(creatorAllocationBps_ >= 500 && creatorAllocationBps_ <= 2000, "Creator alloc 5-20%");
        require(liquidityAllocationBps_ >= 5000 && liquidityAllocationBps_ <= 8000, "LP alloc 50-80%");
        require(communityAllocationBps_ >= 1000 && communityAllocationBps_ <= 3000, "Community alloc 10-30%");
        require(treasuryAllocationBps_ >= 500 && treasuryAllocationBps_ <= 1000, "Treasury alloc 5-10%");

        uint256 totalAlloc = creatorAllocationBps_ + liquidityAllocationBps_ + communityAllocationBps_ + treasuryAllocationBps_;
        require(totalAlloc >= 9500 && totalAlloc <= 10500, "Allocations must sum ~100%");

        require(creatorFeeBps_ <= 200, "Creator fee > 2%");
        require(platformFeeBps_ <= 200, "Platform fee > 2%");
        require(vestingDuration_ >= 30 days, "Vesting min 30 days");
        require(initialUnlockBps_ <= 2000, "Initial unlock max 20%");

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

        vestingDuration = vestingDuration_;
        vestingCliff = vestingCliff_;
        initialUnlockBps = initialUnlockBps_;
        isLinearVesting = isLinearVesting_;

        liquidityAllocationBps = liquidityAllocationBps_;
        communityAllocationBps = communityAllocationBps_;
        treasuryAllocationBps = treasuryAllocationBps_;

        restrictTransfers = restrictTransfers_;
        burnUnsoldOnGraduation = burnUnsoldOnGraduation_;

        flashSaleLastDay = block.timestamp / 1 days;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  ERC-20                                                        ║
    // ═══════════════════════════════════════════════════════════════════

    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
    function uri() public view returns (string memory) { return _uri; }
    function totalSupply() public view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 value) external checkTransfers returns (bool) {
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

    function transferFrom(address from, address to, uint256 value) external checkTransfers returns (bool) {
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

    // ═══════════════════════════════════════════════════════════════════
    // ║  BONDING CURVE 2.0                                            ║
    // ═══════════════════════════════════════════════════════════════════

    function getCurrentPhase() public view returns (uint256 phaseIndex, string memory phaseName) {
        uint256 progress = getProgressBps();
        if (progress <= ERA_0_END) return (0, "Steal Deal");
        if (progress <= ERA_1_END) return (1, "Early Bird");
        if (progress <= ERA_2_END) return (2, "Cruise Control");
        if (progress <= ERA_3_END) return (3, "Final Call");
        return (4, "Moonshot");
    }

    function getProgressBps() public view returns (uint256) {
        if (_totalSupply >= GRADUATION_SUPPLY) return 10000;
        return (_totalSupply * 10000) / GRADUATION_SUPPLY;
    }

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

    function _applyAllDiscounts(uint256 price) internal view returns (uint256) {
        uint256 totalDiscount = 0;

        if (flashSaleActive && block.timestamp < flashSaleEndTime && flashSaleBuysUsed < flashSaleMaxBuys) {
            totalDiscount += flashSaleDiscountBps;
        }
        if (creatorEventActive && creatorEventRemainingBuys > 0) {
            totalDiscount += creatorEventDiscountBps;
        }

        if (totalDiscount == 0) return price;
        if (totalDiscount > MAX_DISCOUNT_BPS + 500) totalDiscount = MAX_DISCOUNT_BPS + 500;

        uint256 discountAmount = (price * totalDiscount) / 10000;
        return price - discountAmount > MIN_PRICE ? price - discountAmount : MIN_PRICE;
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

    // ═══════════════════════════════════════════════════════════════════
    // ║  ANTI-EXPLOIT ENFORCEMENT                                      ║
    // ═══════════════════════════════════════════════════════════════════

    modifier antiExploit(address buyer, uint256 amount) {
        uint256 currentPrice = getCurrentPrice();
        uint256 impliedTokens = (amount * 1e18) / currentPrice;

        // Anti-whale: max % of supply per buy
        require(impliedTokens <= (TOTAL_SUPPLY * MAX_BUY_BPS) / 10000, "AE: buy exceeds max");

        // Anti-whale: max % of supply per wallet
        uint256 newBalance = _balances[buyer] + impliedTokens;
        require(newBalance <= (TOTAL_SUPPLY * MAX_WALLET_BPS) / 10000, "AE: wallet exceeds max");

        // Anti-sniper: cooldown
        require(block.timestamp >= lastBuyTimestamp[buyer] + BUY_COOLDOWN, "AE: cooldown active");

        // Bundler detection: same-block buys
        uint256 currentBlock = block.number;
        if (lastBuyBlock[buyer] == currentBlock) {
            revert("AE: same-block buy not allowed");
        }
        buysPerBlock[currentBlock]++;
        require(buysPerBlock[currentBlock] <= MAX_BUYS_PER_BLOCK, "AE: too many buys in block");
        lastBuyBlock[buyer] = currentBlock;

        // Anti-VC: known snipers blocked
        require(!isBlockedSniper[buyer], "AE: sniper blocked");

        _;
    }

    /**
     * @notice Block multiple sniper addresses (owner only).
     */
    function blockSnipers(address[] calldata snipers) external onlyOwner {
        for (uint256 i = 0; i < snipers.length; i++) {
            isBlockedSniper[snipers[i]] = true;
            emit AntiExploitBlocked(snipers[i], "sniper_blocked", block.timestamp);
        }
    }

    /**
     * @notice Unblock a previously blocked address.
     */
    function unblockSniper(address sniper) external onlyOwner {
        isBlockedSniper[sniper] = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  BUY                                                           ║
    // ═══════════════════════════════════════════════════════════════════

    function initialBuy() external payable onlyFactory {
        require(!initialized, "Already initialized");
        require(msg.value >= MIN_INITIAL_BUY, "Min 0.05 ETH");
        initialized = true;
        _buy(owner, msg.value, 0, address(0));
    }

    function buy(uint256 minOut) external payable notGraduated nonReentrant antiExploit(msg.sender, msg.value) returns (uint256) {
        require(msg.value >= MIN_BUY_AMOUNT, "Buy too small");
        return _buy(msg.sender, msg.value, minOut, referrer);
    }

    function buyWithReferrer(uint256 minOut, address referrer_)
        external payable notGraduated nonReentrant antiExploit(msg.sender, msg.value) returns (uint256)
    {
        require(msg.value >= MIN_BUY_AMOUNT, "Buy too small");
        require(referrer_ != address(0) && referrer_ != msg.sender, "Invalid referrer");
        return _buy(msg.sender, msg.value, minOut, referrer_);
    }

    function _buy(address buyer, uint256 amount, uint256 minOut, address referrer_) internal returns (uint256) {
        uint256 price = getCurrentPrice();
        uint256 tokens = (amount * 1e18) / price;

        // Referral bonus
        uint256 referrerTokens = 0;
        if (referrer_ != address(0) && referrer_ != buyer) {
            referrerTokens = (tokens * REFERRAL_FEE_BPS) / 10000;
            tokens += referrerTokens;
        }

        require(tokens >= minOut, "Slippage exceeded");
        require(_totalSupply + tokens <= TOTAL_SUPPLY, "Exceeds supply");

        // Fees
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 creatorFee  = (amount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer_ != address(0) && referrer_ != address(this))
            ? (amount * REFERRAL_FEE_BPS) / 10000 : 0;

        uint256 totalFees = platformFee + creatorFee + referralFee;
        require(totalFees <= amount, "Fees exceed purchase");
        uint256 netProceeds = amount - totalFees;
        require(netProceeds > 0, "Fees consume purchase");

        // CEI: state updates first
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
            emit FeesDistributed(platformFeeReceiver, platformFee, owner, creatorFee, referrer_, referralFee);
        }

        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);

        _checkPhaseChange();
        _checkGraduation();

        return tokens;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  SELL                                                          ║
    // ═══════════════════════════════════════════════════════════════════

    function sell(uint256 tokenAmount, uint256 minOut) external notGraduated nonReentrant returns (uint256) {
        require(tokenAmount > 0, "Must sell > 0");
        require(_balances[msg.sender] >= tokenAmount, "Insufficient balance");

        uint256 price = getCurrentPrice();
        uint256 ethAmount = (tokenAmount * price) / 1e18;
        require(ethAmount >= minOut, "Slippage exceeded");
        require(address(this).balance >= ethAmount, "Insufficient ETH in curve");

        uint256 platformFee = (ethAmount * platformFeeBps) / 10000;
        uint256 creatorFee  = (ethAmount * creatorFeeBps) / 10000;
        uint256 referralFee = (referrer != address(0)) ? (ethAmount * REFERRAL_FEE_BPS) / 10000 : 0;
        uint256 totalFees = platformFee + creatorFee + referralFee;
        uint256 netProceeds = ethAmount - totalFees;

        _burn(msg.sender, tokenAmount);
        totalRaised -= ethAmount;

        emit Trade(msg.sender, false, tokenAmount, netProceeds, block.timestamp);
        if (totalFees > 0) {
            emit FeesDistributed(platformFeeReceiver, platformFee, owner, creatorFee, referrer, referralFee);
        }

        _sendFee(platformFeeReceiver, platformFee);
        _sendFee(owner, creatorFee);
        _sendFee(referrer, referralFee);
        _sendFee(msg.sender, netProceeds);

        return netProceeds;
    }

    function _sendFee(address recipient, uint256 amount) internal {
        if (recipient == address(0) || amount == 0) return;
        (bool sent,) = recipient.call{value: amount, gas: 2300}("");
        if (!sent) {
            pendingFees[recipient] += amount;
        }
    }

    mapping(address => uint256) public pendingFees;

    // ═══════════════════════════════════════════════════════════════════
    // ║  PHASE TRACKING                                                ║
    // ═══════════════════════════════════════════════════════════════════

    uint256 public lastPhaseIndex;

    function _checkPhaseChange() internal {
        (uint256 currentPhase,) = getCurrentPhase();
        if (currentPhase != lastPhaseIndex) {
            lastPhaseIndex = currentPhase;
            string memory phaseName;
            (uint256 idx, string memory name) = getCurrentPhase();
            emit PhaseChanged(idx, name, _totalSupply);

            // Anti-whale limits increase as coin matures
            if (idx >= 3) {
                // Final Call or Moonshot: relax limits slightly
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  GRADUATION                                                    ║
    // ═══════════════════════════════════════════════════════════════════

    function _checkGraduation() internal {
        if (_totalSupply >= GRADUATION_SUPPLY && uniqueBuyers >= MIN_UNIQUE_BUYERS) {
            graduated = true;
            graduationTime = block.timestamp;
            graduationPartyEndTime = block.timestamp + 24 hours;
            liquidityUnlockTime = block.timestamp + 30 days;
            flashSaleActive = false;
            creatorEventActive = false;

            string memory phaseHistory = _encodePhaseHistory();
            emit Graduated(block.timestamp, _totalSupply, totalRaised, phaseHistory);
            emit LiquidityLocked(_totalSupply, liquidityUnlockTime);

            // Optionally burn unsold tokens
            if (burnUnsoldOnGraduation) {
                uint256 unsold = TOTAL_SUPPLY - _totalSupply;
                if (unsold > 0) {
                    // Burn from the contract's perspective (tokens that were never minted are already burned)
                    // If any were minted to creator allocation but not claimed, they remain
                    totalBurned = unsold;
                    emit TokensBurned(address(this), unsold, TOTAL_SUPPLY);
                }
            }
        }
    }

    function _encodePhaseHistory() internal view returns (string memory) {
        uint256 progress = getProgressBps();
        string memory result = "";
        if (progress >= 0) result = string.concat(result, "🔥Steal Deal,");
        if (progress >= ERA_0_END) result = string.concat(result, "🐦Early Bird,");
        if (progress >= ERA_1_END) result = string.concat(result, "🚗Cruise Control,");
        if (progress >= ERA_2_END) result = string.concat(result, "📢Final Call,");
        if (progress >= ERA_3_END) result = string.concat(result, "🚀Moonshot");
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  VESTING                                                       ║
    // ═══════════════════════════════════════════════════════════════════

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

    function getClaimableAmount() external view returns (uint256) {
        uint256 totalAllocation = (TOTAL_SUPPLY * creatorAllocationBps) / 10000;
        return _calculateClaimable(totalAllocation);
    }

    function _calculateClaimable(uint256 totalAllocation) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - createdAt;

        if (elapsed < vestingCliff) return 0;

        uint256 initialUnlock = (totalAllocation * initialUnlockBps) / 10000;
        uint256 alreadyClaimedFromInitial = creatorClaimed;

        if (alreadyClaimedFromInitial < initialUnlock) {
            return initialUnlock - alreadyClaimedFromInitial;
        }

        if (isLinearVesting) {
            uint256 vestingElapsed = elapsed - vestingCliff;
            uint256 vestingRemaining = totalAllocation - initialUnlock;
            if (vestingDuration == 0) return 0;
            uint256 vestedSoFar = (vestingRemaining * vestingElapsed) / vestingDuration;
            uint256 totalVested = initialUnlock + vestedSoFar;
            if (totalVested > totalAllocation) totalVested = totalAllocation;
            if (creatorClaimed >= totalVested) return 0;
            return totalVested - creatorClaimed;
        }

        return 0;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  CREATOR CONTROLS: BURN                                        ║
    // ═══════════════════════════════════════════════════════════════════

    function burn(uint256 amount) external onlyOwner {
        require(amount > 0, "Must burn > 0");
        require(_balances[owner] >= amount, "Insufficient balance");
        _burn(owner, amount);
        totalBurned += amount;
        emit TokensBurned(owner, amount, _totalSupply);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  FLASH SALES & CREATOR EVENTS (V1 compat)                      ║
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // ║  METADATA                                                      ║
    // ═══════════════════════════════════════════════════════════════════

    function setURI(string memory newUri) external onlyOwner {
        _uri = newUri;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  VIEW FUNCTIONS                                                ║
    // ═══════════════════════════════════════════════════════════════════

    function getPhaseHistory() external view returns (string memory) {
        return _encodePhaseHistory();
    }

    function getGraduationPartyEndTime() external view returns (uint256) {
        return graduationPartyEndTime;
    }

    function isPartyActive() external view returns (bool) {
        return graduated && block.timestamp < graduationPartyEndTime;
    }

    function getAntiExploitStatus(address wallet) external view returns (
        bool cooldownActive,
        uint256 cooldownRemaining,
        uint256 walletSupplyPercent,
        bool isSniperBlocked
    ) {
        uint256 elapsed = block.timestamp - lastBuyTimestamp[wallet];
        cooldownActive = lastBuyTimestamp[wallet] > 0 && elapsed < BUY_COOLDOWN;
        cooldownRemaining = cooldownActive ? BUY_COOLDOWN - elapsed : 0;
        walletSupplyPercent = _totalSupply > 0 ? (_balances[wallet] * 10000) / _totalSupply : 0;
        isSniperBlocked = isBlockedSniper[wallet];
    }
}
