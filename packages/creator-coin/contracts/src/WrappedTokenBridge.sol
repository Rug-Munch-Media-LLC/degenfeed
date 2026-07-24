// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title WrappedTokenBridge
 * @notice Cross-chain bridge for DegenFeed creator coins.
 *
 * Enables creator coins deployed on Solana (primary) to have
 * wrapped ERC-20 representations on Base.
 *
 * ## Architecture
 * - Creator deploys token on Solana (cheaper gas)
 * - Token is attested via Wormhole-style VAA
 * - This contract creates a wrapped ERC-20 on Base
 * - Wrapped tokens are minted/burned 1:1 with Solana originals
 * - Cross-chain registry records the mapping
 *
 * ## Security
 * - Only verified VAAs from trusted guardians can mint/burn
 * - Pausable for emergency stops
 * - Owner can update the guardian set
 * - No delegatecall, no selfdestruct
 *
 * @dev Deployed on Base (chain 8453).
 */
contract WrappedTokenBridge {
    // ── Types ──────────────────────────────────────────────────────────

    struct TokenImplementation {
        address tokenAddress;
        string name;
        string symbol;
        uint8 decimals;
        uint256 totalSupplyLocked;
        bool initialized;
    }

    struct GuardianSet {
        address[] guardians;
        uint256 threshold;
    }

    // ── State ──────────────────────────────────────────────────────────

    address public owner;
    address private _pendingOwner;
    bool public paused;
    bool public emergencyMode;

    /// @notice Active guardian set (Wormhole guardians or our own)
    GuardianSet public guardians;

    /// @notice Nonce to prevent replay attacks
    uint256 public nonce;

    /// @notice Registered token implementations (solana mint => wrapped address)
    mapping(bytes32 => TokenImplementation) public wrappedTokens;

    /// @notice Reverse lookup: wrapped address => solana mint
    mapping(address => bytes32) public tokenOrigins;

    /// @notice Total value locked across all wrapped tokens
    uint256 public totalValueLocked;

    /// @notice Bridge fee in bps (default 5 = 0.05%)
    uint256 public bridgeFeeBps = 5;

    /// @notice Maximum bridge fee in bps
    uint256 public constant MAX_BRIDGE_FEE_BPS = 50;

    // ── Events ─────────────────────────────────────────────────────────

    event TokenWrapped(
        bytes32 indexed solanaMint,
        address indexed wrappedToken,
        string name,
        string symbol,
        uint256 timestamp
    );

    event TokensMinted(
        bytes32 indexed solanaMint,
        address indexed recipient,
        uint256 amount,
        bytes32 vaaHash
    );

    event TokensBurned(
        bytes32 indexed solanaMint,
        address indexed burner,
        uint256 amount
    );

    event BridgeFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyModeSet(bool enabled);
    event GuardianSetUpdated(uint256 newThreshold, uint256 guardianCount);

    // ── Modifiers ──────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused && !emergencyMode, "Paused");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────

    constructor(address owner_, address[] memory initialGuardians, uint256 threshold) {
        require(owner_ != address(0), "Invalid owner");
        require(initialGuardians.length > 0, "Need guardians");
        require(threshold > 0 && threshold <= initialGuardians.length, "Invalid threshold");

        owner = owner_;
        guardians = GuardianSet({
            guardians: initialGuardians,
            threshold: threshold
        });
    }

    // ── Deploy Wrapped Token ───────────────────────────────────────────

    /**
     * @notice Deploy a wrapped ERC-20 token for a Solana mint.
     * @param solanaMint The Solana token mint address (as bytes32).
     * @param name Token name.
     * @param symbol Token symbol.
     * @return wrappedToken Address of the newly created wrapped token.
     */
    function deployWrappedToken(
        bytes32 solanaMint,
        string calldata name,
        string calldata symbol
    ) external onlyOwner notPaused returns (address wrappedToken) {
        require(wrappedTokens[solanaMint].tokenAddress == address(0), "Already exists");
        require(solanaMint != bytes32(0), "Invalid mint");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");

        wrappedToken = address(new WrappedERC20(name, symbol, 18, address(this)));

        wrappedTokens[solanaMint] = TokenImplementation({
            tokenAddress: wrappedToken,
            name: name,
            symbol: symbol,
            decimals: 18,
            totalSupplyLocked: 0,
            initialized: true
        });

        tokenOrigins[wrappedToken] = solanaMint;

        emit TokenWrapped(solanaMint, wrappedToken, name, symbol, block.timestamp);
    }

    // ── Mint (Bridge from Solana → Base) ──────────────────────────────

    /**
     * @notice Mint wrapped tokens based on a verified VAA.
     * @param solanaMint The Solana token mint address.
     * @param recipient Who receives the wrapped tokens.
     * @param amount Amount to mint (in 18-decimal units).
     * @param vaaHash The VAA hash that proves the burn on Solana.
     * @param vaaSignature Guardian signatures for verification.
     */
    function mintWrapped(
        bytes32 solanaMint,
        address recipient,
        uint256 amount,
        bytes32 vaaHash,
        bytes[] calldata vaaSignature
    ) external notPaused {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(!_isVaaUsed(vaaHash), "VAA already used");

        // Verify guardian signatures
        require(_verifySignatures(vaaHash, vaaSignature), "Invalid signatures");

        TokenImplementation storage tokenImpl = wrappedTokens[solanaMint];
        require(tokenImpl.initialized, "Token not registered");

        WrappedERC20(tokenImpl.tokenAddress).mint(recipient, amount);
        tokenImpl.totalSupplyLocked += amount;
        totalValueLocked += amount;

        _markVaaUsed(vaaHash);
        nonce++;

        emit TokensMinted(solanaMint, recipient, amount, vaaHash);
    }

    // ── Burn (Bridge from Base → Solana) ──────────────────────────────

    /**
     * @notice Burn wrapped tokens to initiate bridge back to Solana.
     * @param solanaMint The Solana token mint to bridge to.
     * @param amount Amount of wrapped tokens to burn.
     */
    function burnWrapped(bytes32 solanaMint, uint256 amount) external notPaused {
        require(amount > 0, "Amount must be > 0");

        TokenImplementation storage tokenImpl = wrappedTokens[solanaMint];
        require(tokenImpl.initialized, "Token not registered");

        WrappedERC20(tokenImpl.tokenAddress).burn(msg.sender, amount);
        tokenImpl.totalSupplyLocked -= amount;
        totalValueLocked -= amount;

        emit TokensBurned(solanaMint, msg.sender, amount);
    }

    // ── Getters ───────────────────────────────────────────────────────

    function getWrappedToken(bytes32 solanaMint) external view returns (address) {
        return wrappedTokens[solanaMint].tokenAddress;
    }

    function getSolanaMint(address wrappedToken) external view returns (bytes32) {
        return tokenOrigins[wrappedToken];
    }

    function isWrappedToken(address token) external view returns (bool) {
        return tokenOrigins[token] != bytes32(0);
    }

    // ── Admin ─────────────────────────────────────────────────────────

    function setBridgeFeeBps(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_BRIDGE_FEE_BPS, "Fee too high");
        uint256 oldFee = bridgeFeeBps;
        bridgeFeeBps = newFee;
        emit BridgeFeeUpdated(oldFee, newFee);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
    }

    function setEmergencyMode(bool enabled) external onlyOwner {
        emergencyMode = enabled;
        emit EmergencyModeSet(enabled);
    }

    function updateGuardians(address[] memory newGuardians, uint256 threshold) external onlyOwner {
        require(newGuardians.length > 0, "Need guardians");
        require(threshold > 0 && threshold <= newGuardians.length, "Invalid threshold");
        guardians = GuardianSet({ guardians: newGuardians, threshold: threshold });
        emit GuardianSetUpdated(threshold, newGuardians.length);
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

    // ── Internal ──────────────────────────────────────────────────────

    /// @dev Track used VAAs to prevent replay
    mapping(bytes32 => bool) private _usedVaas;

    function _isVaaUsed(bytes32 vaaHash) internal view returns (bool) {
        return _usedVaas[vaaHash];
    }

    function _markVaaUsed(bytes32 vaaHash) internal {
        _usedVaas[vaaHash] = true;
    }

    /// @dev Simplified VAA signature verification
    function _verifySignatures(
        bytes32 _hash,
        bytes[] calldata signatures
    ) internal view returns (bool) {
        if (signatures.length < guardians.threshold) return false;

        address[] memory guardianSet = guardians.guardians;
        uint256 validCount = 0;

        for (uint256 i = 0; i < signatures.length && validCount < guardians.threshold; i++) {
            address signer = _recoverSigner(_hash, signatures[i]);
            for (uint256 j = 0; j < guardianSet.length; j++) {
                if (guardianSet[j] == signer) {
                    validCount++;
                    break;
                }
            }
        }

        return validCount >= guardians.threshold;
    }

    /// @dev ECDSA signature recovery
    function _recoverSigner(bytes32 _hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(_hash, v, r, s);
    }
}

/**
 * @title WrappedERC20
 * @notice Minimal ERC-20 for wrapped tokens, controlled by the bridge.
 */
contract WrappedERC20 {
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    address public bridge;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyBridge() {
        require(msg.sender == bridge, "Only bridge");
        _;
    }

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address bridge_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        bridge = bridge_;
    }

    function name() external view returns (string memory) { return _name; }
    function symbol() external view returns (string memory) { return _symbol; }
    function decimals() external view returns (uint8) { return _decimals; }
    function totalSupply() external view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view returns (uint256) { return _balances[account]; }

    function mint(address to, uint256 amount) external onlyBridge {
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyBridge {
        require(_balances[from] >= amount, "Insufficient balance");
        _balances[from] -= amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "Insufficient allowance");
            _allowances[from][msg.sender] = allowed - amount;
        }
        require(_balances[from] >= amount, "Insufficient balance");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
