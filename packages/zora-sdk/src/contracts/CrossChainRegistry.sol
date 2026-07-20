// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title CrossChainRegistry
 * @notice Maps creator coins across chains for DegenFeed.
 *
 * Creators deploy tokens on multiple chains (Base, Solana, etc.) and register
 * them here so the ecosystem knows they represent the same creator.
 *
 * ## Architecture
 * - Two-directional mapping: (chainId + creatorId) → local token address
 * - Token origins: local token → (originChainId, originProtocol, originCreatorId)
 * - Protocols: "base", "solana", "farcaster", "lens", "zora"
 *
 * ## Security
 * - Only the registry owner can register mappings (prevents spoofing)
 * - Creator verification happens off-chain via the API layer
 * - No token transfers or value storage
 *
 * @dev Deployed on Base (chain 8453). Lightweight — no external dependencies.
 */
contract CrossChainRegistry {
    // ═══════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Origin of a token on another chain
    struct CrossChainOrigin {
        /// Chain ID of the origin chain (e.g., 8453 for Base, 0 for Solana)
        uint256 originChainId;
        /// Protocol name: "base", "solana", "farcaster", "lens", "zora"
        string originProtocol;
        /// Protocol-native identifier (e.g., Farcaster FID, Lens profile ID)
        string originCreatorId;
        /// Token address on the origin chain (address(0) if origin is non-EVM)
        address originToken;
    }

    /// @brief A cross-chain token representation
    struct CrossChainToken {
        /// Chain ID where this token exists
        uint256 chainId;
        /// Protocol name
        string protocol;
        /// Token address on this chain
        address tokenAddress;
        /// Whether this is the primary/origin token
        bool isOrigin;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Owner of the registry.
    address public owner;

    /// @notice Pending owner for two-step transfer.
    address private _pendingOwner;

    /// @notice Whether the registry is paused (emergency stop).
    bool public paused;

    /// @notice Keyed by keccak256(abi.encodePacked(chainId, protocol, creatorId))
    /// @dev Maps a (chain, protocol, creator) tuple to the token address on THIS chain.
    mapping(bytes32 => address) public crossChainTokens;

    /// @notice Keyed by token address on this chain.
    /// @dev Returns the origin information for a local token.
    mapping(address => CrossChainOrigin) public tokenOrigins;

    /// @notice Reverse lookups: for a given origin key, all known cross-chain tokens.
    /// @dev Key = keccak256(...), value = array of (chainId, protocol, tokenAddress)
    mapping(bytes32 => CrossChainToken[]) private _originTokens;

    /// @notice Total cross-chain mappings registered.
    uint256 public totalMappings;

    /// @notice List of all registered local token addresses (for enumeration).
    address[] private _allTokens;

    // ═══════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════

    /// @dev Emitted when a cross-chain mapping is registered.
    event CrossChainRegistered(
        address indexed localToken,
        uint256 indexed originChainId,
        string originProtocol,
        string originCreatorId,
        address originToken,
        uint256 timestamp
    );

    /// @dev Emitted when a mapping is updated (e.g., new chain representation added).
    event CrossChainUpdated(
        address indexed localToken,
        uint256 indexed chainId,
        string protocol,
        address tokenAddress,
        uint256 timestamp
    );

    /// @dev Emitted when a mapping is removed.
    event CrossChainRemoved(
        address indexed localToken,
        uint256 indexed chainId,
        string protocol,
        uint256 timestamp
    );

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool isPaused);

    // ═══════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Paused");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address owner_) {
        require(owner_ != address(0), "Invalid owner");
        owner = owner_;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Registration
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a cross-chain token mapping.
     * @dev Caller must be the registry owner.
     *
     * @param originChainId   Chain ID of the origin chain (e.g., 8453 for Base)
     * @param originProtocol  Protocol name: "base", "solana", "farcaster", "lens", "zora"
     * @param originCreatorId Protocol-native identifier (e.g., Farcaster FID)
     * @param originToken     Token address on the origin chain (address(0) if non-EVM)
     * @param localToken      Token address on THIS chain
     */
    function registerCrossChain(
        uint256 originChainId,
        string calldata originProtocol,
        string calldata originCreatorId,
        address originToken,
        address localToken
    ) external onlyOwner notPaused {
        require(localToken != address(0), "Invalid local token");
        require(bytes(originProtocol).length > 0, "Protocol required");
        require(bytes(originCreatorId).length > 0, "Creator ID required");

        bytes32 key = _deriveKey(originChainId, originProtocol, originCreatorId);

        // If this origin key already has a mapping, update it
        bool isNewMapping = crossChainTokens[key] == address(0);

        crossChainTokens[key] = localToken;

        // Store origin info on the local token
        CrossChainOrigin memory origin = CrossChainOrigin({
            originChainId: originChainId,
            originProtocol: originProtocol,
            originCreatorId: originCreatorId,
            originToken: originToken
        });
        tokenOrigins[localToken] = origin;

        // Append to the reverse lookup if new
        if (isNewMapping) {
            _allTokens.push(localToken);
            totalMappings++;
        }

        emit CrossChainRegistered(
            localToken,
            originChainId,
            originProtocol,
            originCreatorId,
            originToken,
            block.timestamp
        );
    }

    /**
     * @notice Add a secondary chain representation for an existing mapping.
     * @dev Creates an entry in the reverse lookup but doesn't change the primary mapping.
     *
     * @param originChainId  Same origin chain ID as the primary registration
     * @param originProtocol Same origin protocol
     * @param originCreatorId Same origin creator ID
     * @param chainId        Chain ID where this secondary token lives
     * @param protocol       Protocol of the secondary chain
     * @param tokenAddress   Token address on the secondary chain
     */
    function addChainRepresentation(
        uint256 originChainId,
        string calldata originProtocol,
        string calldata originCreatorId,
        uint256 chainId,
        string calldata protocol,
        address tokenAddress
    ) external onlyOwner notPaused {
        bytes32 originKey = _deriveKey(originChainId, originProtocol, originCreatorId);
        require(crossChainTokens[originKey] != address(0), "Origin not registered");

        _originTokens[originKey].push(
            CrossChainToken({
                chainId: chainId,
                protocol: protocol,
                tokenAddress: tokenAddress,
                isOrigin: chainId == originChainId
            })
        );

        emit CrossChainUpdated(crossChainTokens[originKey], chainId, protocol, tokenAddress, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Queries
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Get the local token address for a given creator across chains.
     * @param chainId    Chain ID of the creator's origin
     * @param protocol   Protocol name
     * @param creatorId  Creator's protocol-native identifier
     * @return Token address on this chain, or address(0) if not found
     */
    function getLocalToken(
        uint256 chainId,
        string calldata protocol,
        string calldata creatorId
    ) external view returns (address) {
        bytes32 key = _deriveKey(chainId, protocol, creatorId);
        return crossChainTokens[key];
    }

    /**
     * @notice Get all cross-chain representations for a creator's origin.
     * @param chainId    Chain ID of the creator's origin
     * @param protocol   Protocol name
     * @param creatorId  Creator's protocol-native identifier
     * @return Array of CrossChainToken structs
     */
    function getCrossChainTokens(
        uint256 chainId,
        string calldata protocol,
        string calldata creatorId
    ) external view returns (CrossChainToken[] memory) {
        bytes32 originKey = _deriveKey(chainId, protocol, creatorId);
        address primaryToken = crossChainTokens[originKey];

        // Count existing entries + primary
        CrossChainToken[] memory existing = _originTokens[originKey];
        uint256 totalLen = existing.length + (primaryToken != address(0) ? 1 : 0);

        CrossChainToken[] memory result = new CrossChainToken[](totalLen);
        uint256 idx = 0;

        if (primaryToken != address(0)) {
            result[idx] = CrossChainToken({
                chainId: chainId,
                protocol: protocol,
                tokenAddress: primaryToken,
                isOrigin: true
            });
            idx++;
        }

        for (uint256 i = 0; i < existing.length; i++) {
            result[idx] = existing[i];
            idx++;
        }

        return result;
    }

    /**
     * @notice Get the origin details for a local token address.
     * @param localToken Token address on this chain
     * @return CrossChainOrigin struct, or empty if unregistered
     */
    function getTokenOrigin(address localToken) external view returns (CrossChainOrigin memory) {
        return tokenOrigins[localToken];
    }

    /**
     * @notice Check if a local token is registered.
     */
    function isRegistered(address localToken) external view returns (bool) {
        return tokenOrigins[localToken].originChainId != 0 || bytes(tokenOrigins[localToken].originProtocol).length > 0;
    }

    /**
     * @notice Get total number of registered tokens.
     */
    function totalTokens() external view returns (uint256) {
        return _allTokens.length;
    }

    /**
     * @notice Get the token at a given index (for enumeration).
     */
    function tokenAt(uint256 index) external view returns (address) {
        require(index < _allTokens.length, "Index out of bounds");
        return _allTokens[index];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════════

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Ownership
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

    // ═══════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @dev Derive the storage key for a (chainId, protocol, creatorId) tuple.
     */
    function _deriveKey(
        uint256 chainId,
        string calldata protocol,
        string calldata creatorId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(chainId, protocol, creatorId));
    }
}
