// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {DegenFeedCoin} from "./DegenFeedCoin.sol";

/**
 * @title DegenFeedFactory
 * @notice Factory for deploying DegenFeedCoin tokens via deterministic CREATE2.
 *
 * Forked from Zora's CreatorCoin factory — modified to pair against ETH instead of ZORA.
 * Fee config, pause, and CREATE2 address prediction.
 *
 * Deployed on Base (chain 8453).
 *
 * ## Security
 * - CREATE2 salt = keccak256(creator, name, symbol) — prevents frontrunning
 * - Minimum 0.05 ETH initial buy prevents dust spam
 * - Platform fee capped at 2% (200 bps)
 * - Two-step ownership transfer
 * - No selfdestruct, no delegatecall
 *
 * @dev Off-chain indexing via CoinCreated events.
 * @notice Runtime bytecode ~13.8KB — well under Ethereum 24KB limit and Base 48KB limit.
 */
contract DegenFeedFactory {
    // ── Storage ──────────────────────────────────────────────────────────
    address public platformFeeReceiver;
    uint256 public platformFeeBps = 50;       // 0.5%
    uint256 public constant MAX_CREATOR_FEE_BPS = 200;
    uint256 public constant MIN_INITIAL_BUY = 0.05 ether;
    bool public paused;
    address public owner;
    address private _pendingOwner;
    uint256 public totalCoins;

    // ── Events ───────────────────────────────────────────────────────────
    event CoinCreated(address indexed coin, address indexed creator, uint256 timestamp, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool isPaused);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier notPaused() { require(!paused, "Paused"); _; }

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address owner_, address platformFeeReceiver_) {
        require(owner_ != address(0), "Invalid owner");
        require(platformFeeReceiver_ != address(0), "Invalid fee receiver");
        owner = owner_;
        platformFeeReceiver = platformFeeReceiver_;
    }

    // ── CREATE2 Coin Creation ────────────────────────────────────────────
    /**
     * @notice Create a new DegenFeedCoin via CREATE2.
     * @param name_                Token name.
     * @param symbol_              Token symbol.
     * @param uri_                 Metadata URI.
     * @param creatorAllocationBps Creator allocation (0-1500 bps = 0-15%).
     * @param creatorFeeBps        Creator fee (0-200 bps = 0-2%).
     * @param referrer_            Referrer address (zero = none).
     * @return coin Address of the created DegenFeedCoin.
     */
    function createCoin(
        string memory name_,
        string memory symbol_,
        string memory uri_,
        uint256 creatorAllocationBps,
        uint256 creatorFeeBps,
        address referrer_
    ) external payable notPaused returns (address coin) {
        require(msg.value >= MIN_INITIAL_BUY, "Min 0.05 ETH initial buy");
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        require(creatorAllocationBps <= 1500, "Allocation > 15%");
        require(creatorFeeBps <= MAX_CREATOR_FEE_BPS, "Creator fee > max");

        bytes32 salt = keccak256(abi.encodePacked(msg.sender, name_, symbol_));

        coin = address(new DegenFeedCoin{salt: salt}(
            name_, symbol_, uri_, msg.sender,
            creatorAllocationBps, creatorFeeBps,
            platformFeeBps, platformFeeReceiver,
            referrer_
        ));

        unchecked { totalCoins++; }

        DegenFeedCoin(payable(coin)).initialBuy{value: msg.value}();

        emit CoinCreated(coin, msg.sender, block.timestamp, msg.value);
    }

    // ── Admin ────────────────────────────────────────────────────────────
    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 200, "Fee > 2%");
        platformFeeBps = newFeeBps;
    }

    function setPlatformFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Invalid receiver");
        platformFeeReceiver = newReceiver;
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    // ── Ownership ────────────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Owner cannot be zero");
        _pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == _pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, _pendingOwner);
        owner = _pendingOwner;
        _pendingOwner = address(0);
    }

}
