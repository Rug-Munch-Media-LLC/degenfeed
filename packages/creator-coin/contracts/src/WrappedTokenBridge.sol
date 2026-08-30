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

    /// @notice Full bridge attestation payload. The guardian signatures commit
    ///         to EVERY field of this struct via the computed VAA hash.
    struct BridgeAttestation {
        uint16 emitterChainId;
        bytes32 emitterAddress;
        bytes32 solanaMint;
        address recipient;
        uint256 amount;
        uint64 sequence;
    }

    // ── State ──────────────────────────────────────────────────────────

    address public owner;
    address private _pendingOwner;
    bool public paused;
    bool public emergencyMode;

    /// @notice Active guardian set (Wormhole guardians or our own)
    GuardianSet public guardians;

    /// @notice Trusted VAA emitter (Wormhole chain id of the source chain, e.g. 1 = Solana)
    uint16 public trustedEmitterChain;

    /// @notice Trusted VAA emitter address (32-byte left-padded program/address).
    /// @dev Zero until the owner configures it — minting is disabled until then.
    bytes32 public trustedEmitter;

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
    event TrustedEmitterSet(uint16 chainId, bytes32 emitter);

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

    /// @notice Domain separator for VAA hash binding. Prevents cross-protocol
    ///         signature replay: guardians sign hashes that only authenticate
    ///         mint intents for THIS bridge.
    bytes32 public constant VAA_DOMAIN = keccak256("DegenFeedWrappedTokenBridge.v1");

    /**
     * @notice Mint wrapped tokens based on guardian-signed bridge attestation.
     *
     * Security model (fixes the 2026-08 audit findings):
     *  - The VAA hash is COMPUTED from the full payload (emitter chain/address,
     *    mint, recipient, amount, sequence) — callers cannot supply an
     *    unbound hash, so signatures cryptographically commit to every field.
     *  - Signatures are only valid for the trusted emitter (set by owner).
     *  - Signers are deduplicated: one guardian signing twice no longer
     *    satisfies a multi-sig threshold.
     *  - The hash is marked used BEFORE the external mint call (CEI).
     *
     * @param attestation Full bridge payload (emitter, mint, recipient, amount, sequence).
     * @param signatures Guardian signatures over the computed VAA hash.
     */
    function mintWrapped(
        BridgeAttestation calldata attestation,
        bytes[] calldata signatures
    ) external notPaused {
        require(attestation.recipient != address(0), "Invalid recipient");
        require(attestation.amount > 0, "Amount must be > 0");
        require(
            trustedEmitter != bytes32(0) &&
                attestation.emitterChainId == trustedEmitterChain &&
                attestation.emitterAddress == trustedEmitter,
            "Untrusted emitter"
        );

        // Bind the guardian signatures to the FULL payload — no caller-supplied hash.
        bytes32 vaaHash = keccak256(
            abi.encode(
                VAA_DOMAIN,
                attestation.emitterChainId,
                attestation.emitterAddress,
                attestation.solanaMint,
                attestation.recipient,
                attestation.amount,
                attestation.sequence
            )
        );
        require(!_isVaaUsed(vaaHash), "VAA already used");

        TokenImplementation storage tokenImpl = wrappedTokens[attestation.solanaMint];
        require(tokenImpl.initialized, "Token not registered");

        require(_verifySignatures(vaaHash, signatures), "Invalid signatures");

        // ── CEI: all state changes BEFORE the external mint call ────────
        tokenImpl.totalSupplyLocked += attestation.amount;
        totalValueLocked += attestation.amount;
        _markVaaUsed(vaaHash);
        nonce++;

        WrappedERC20(tokenImpl.tokenAddress).mint(attestation.recipient, attestation.amount);

        emit TokensMinted(attestation.solanaMint, attestation.recipient, attestation.amount, vaaHash);
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

        // ── CEI: all state changes BEFORE the external burn call ────────
        tokenImpl.totalSupplyLocked -= amount;
        totalValueLocked -= amount;

        WrappedERC20(tokenImpl.tokenAddress).burn(msg.sender, amount);

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

    /// @notice Configure the only emitter whose VAAs can mint wrapped tokens.
    /// @dev Minting is impossible until this is set (trustedEmitter defaults to zero).
    function setTrustedEmitter(uint16 chainId, bytes32 emitter) external onlyOwner {
        require(emitter != bytes32(0), "Invalid emitter");
        trustedEmitterChain = chainId;
        trustedEmitter = emitter;
        emit TrustedEmitterSet(chainId, emitter);
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

    /// @dev Guardian signature verification with signer deduplication.
    ///      Each guardian may contribute AT MOST ONE valid signature — a single
    ///      guardian repeating the same (or a malleated) signature can never
    ///      satisfy a multi-signature threshold.
    function _verifySignatures(
        bytes32 _hash,
        bytes[] calldata signatures
    ) internal view returns (bool) {
        if (signatures.length < guardians.threshold) return false;

        address[] memory guardianSet = guardians.guardians;
        uint256 guardianCount = guardianSet.length;
        uint256 validCount = 0;
        address[] memory seenSigners = new address[](signatures.length);

        for (uint256 i = 0; i < signatures.length && validCount < guardians.threshold; i++) {
            address signer = _recoverSigner(_hash, signatures[i]);
            if (signer == address(0)) continue;

            // ── Dedup: reject a signer already counted in this proof ────
            bool duplicate = false;
            for (uint256 k = 0; k < i; k++) {
                if (seenSigners[k] == signer) {
                    duplicate = true;
                    break;
                }
            }
            if (duplicate) continue;
            seenSigners[i] = signer;

            // ── Count only if the signer is a guardian ──────────────────
            for (uint256 j = 0; j < guardianCount; j++) {
                if (guardianSet[j] == signer) {
                    validCount++;
                    break;
                }
            }
        }

        return validCount >= guardians.threshold;
    }

    /// @dev ECDSA signature recovery. Rejects non-canonical (high-s)
    ///      signatures so malleated variants cannot be used to sidestep
    ///      signature-level dedup or replay checks.
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
        require(v == 27 || v == 28, "Invalid signature v");
        // Lower half of the secp256k1 group order — canonical s values only.
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "High-s signature");
        address recovered = ecrecover(_hash, v, r, s);
        require(recovered != address(0), "Invalid signature");
        return recovered;
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
