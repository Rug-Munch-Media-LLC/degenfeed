// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title LiveStreamOracle
 * @notice Oracle that registers when creators go live and applies
 *         temporary boost discounts to their creator coins.
 *
 * When a creator starts a live stream (PeerTube, Owncast, etc.),
 * their coin gets a temporary discount period. This drives
 * engagement between live content and token economics.
 *
 * ## How It Works
 * 1. Creator starts stream → signals oracle (off-chain monitor)
 * 2. Oracle calls `setLiveStatus(creator, true, boostBps)`
 * 3. Creator's coin contract queries `getBoost(creator)` for discount
 * 4. When stream ends → `setLiveStatus(creator, false, 0)`
 * 5. Coin contract stops applying discount
 *
 * ## Security
 * - Only authorized updaters (off-chain monitors) can set status
 * - Rate-limited: max 1 status change per 5 minutes per creator
 * - Boost capped at 500 bps (5%)
 * - Auto-expiry: if not updated for 2 hours, boost expires
 */
contract LiveStreamOracle {
    // ── Types ──────────────────────────────────────────────────────────

    struct LiveStatus {
        bool isLive;
        uint256 boostBps;
        uint256 updatedAt;
        uint256 expiryTime;
        string platform;
        string streamUrl;
        string streamTitle;
    }

    // ── State ──────────────────────────────────────────────────────────

    address public owner;
    address private _pendingOwner;
    bool public paused;

    /// @notice Authorized updaters (off-chain monitors)
    mapping(address => bool) public authorizedUpdaters;

    /// @notice Live status keyed by creator address {chainId}-{creator}
    mapping(bytes32 => LiveStatus) public liveStatuses;

    /// @notice Max boost in bps (default 300 = 3%)
    uint256 public maxBoostBps = 300;

    /// @notice Cooldown between status updates per creator (5 min)
    uint256 public constant UPDATE_COOLDOWN = 5 minutes;

    /// @notice Auto-expiry if not refreshed (2 hours)
    uint256 public constant AUTO_EXPIRE = 2 hours;

    /// @notice Max boost cap
    uint256 public constant MAX_BOOST_CAP = 500;

    // ── Events ─────────────────────────────────────────────────────────

    event LiveStatusChanged(
        bytes32 indexed creatorKey,
        bool isLive,
        uint256 boostBps,
        string platform,
        uint256 timestamp
    );

    event AuthorizedUpdaterAdded(address indexed updater);
    event AuthorizedUpdaterRemoved(address indexed updater);
    event MaxBoostUpdated(uint256 oldBps, uint256 newBps);
    event Paused(bool isPaused);

    // ── Modifiers ──────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyUpdater() {
        require(authorizedUpdaters[msg.sender], "Not authorized");
        _;
    }

    modifier notPaused() {
        require(!paused, "Paused");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────

    constructor(address owner_) {
        require(owner_ != address(0), "Invalid owner");
        owner = owner_;
        authorizedUpdaters[owner_] = true;
    }

    // ── Core: Set Live Status ──────────────────────────────────────────

    /**
     * @notice Set live status for a creator.
     * @param creatorKey keccak256(chainId, creatorAddress)
     * @param isLive Whether creator is live
     * @param boostBps Discount in bps for coin (capped at maxBoostBps)
     * @param platform Stream platform name (peertube, owncast, etc.)
     * @param streamUrl URL to the live stream
     * @param streamTitle Stream title
     */
    function setLiveStatus(
        bytes32 creatorKey,
        bool isLive,
        uint256 boostBps,
        string calldata platform,
        string calldata streamUrl,
        string calldata streamTitle
    ) external onlyUpdater notPaused {
        LiveStatus storage status = liveStatuses[creatorKey];

        // Cooldown check
        if (status.isLive != isLive) {
            require(
                block.timestamp >= status.updatedAt + UPDATE_COOLDOWN,
                "Update cooldown active"
            );
        }

        if (isLive) {
            require(boostBps <= MAX_BOOST_CAP, "Boost exceeds cap");
            require(bytes(platform).length > 0, "Platform required");

            status.isLive = true;
            status.boostBps = boostBps > maxBoostBps ? maxBoostBps : boostBps;
            status.updatedAt = block.timestamp;
            status.expiryTime = block.timestamp + AUTO_EXPIRE;
            status.platform = platform;
            status.streamUrl = streamUrl;
            status.streamTitle = streamTitle;
        } else {
            status.isLive = false;
            status.boostBps = 0;
            status.updatedAt = block.timestamp;
            status.expiryTime = 0;
        }

        emit LiveStatusChanged(creatorKey, isLive, boostBps, platform, block.timestamp);
    }

    // ── Query ──────────────────────────────────────────────────────────

    /**
     * @notice Get the live boost for a creator (0 if not live or expired).
     * @param creatorKey keccak256(chainId, creatorAddress)
     * @return boostBps The active boost discount (0 if none)
     * @return isLive Whether the creator is currently live
     */
    function getBoost(bytes32 creatorKey) external view returns (uint256 boostBps, bool isLive) {
        LiveStatus storage status = liveStatuses[creatorKey];

        if (!status.isLive) return (0, false);
        if (block.timestamp > status.expiryTime) return (0, false);

        return (status.boostBps, true);
    }

    /**
     * @notice Get full live status for a creator.
     */
    function getLiveStatus(bytes32 creatorKey) external view returns (LiveStatus memory) {
        LiveStatus memory status = liveStatuses[creatorKey];

        // Auto-expire if stale
        if (status.isLive && block.timestamp > status.expiryTime) {
            status.isLive = false;
            status.boostBps = 0;
        }

        return status;
    }

    /**
     * @notice Check if a creator's boost is still active.
     */
    function isBoostActive(bytes32 creatorKey) external view returns (bool) {
        LiveStatus storage status = liveStatuses[creatorKey];
        return status.isLive && block.timestamp <= status.expiryTime;
    }

    // ── Admin ─────────────────────────────────────────────────────────

    function addAuthorizedUpdater(address updater) external onlyOwner {
        require(updater != address(0), "Invalid address");
        authorizedUpdaters[updater] = true;
        emit AuthorizedUpdaterAdded(updater);
    }

    function removeAuthorizedUpdater(address updater) external onlyOwner {
        require(updater != owner, "Cannot remove owner");
        authorizedUpdaters[updater] = false;
        emit AuthorizedUpdaterRemoved(updater);
    }

    function setMaxBoostBps(uint256 newBps) external onlyOwner {
        require(newBps <= MAX_BOOST_CAP, "Exceeds cap");
        uint256 old = maxBoostBps;
        maxBoostBps = newBps;
        emit MaxBoostUpdated(old, newBps);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    // ── Ownership ─────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        _pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == _pendingOwner, "Not pending");
        owner = _pendingOwner;
        _pendingOwner = address(0);
    }
}
