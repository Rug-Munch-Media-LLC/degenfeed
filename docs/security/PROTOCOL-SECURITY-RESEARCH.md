# Protocol Security Research — DegenFeed Integration Analysis

> **Audience:** Security engineers, protocol integrators, infrastructure operators
> **Date:** 2026-07-25
> **Scope:** Security models of all 7 protocols DegenFeed bridges
> **Version:** 1.0

---

## Table of Contents

1. [Nostr](#1-nostr)
2. [Farcaster](#2-farcaster)
3. [Bluesky / AT Protocol](#3-bluesky--at-protocol)
4. [ActivityPub / Mastodon](#4-activitypub--mastodon)
5. [Lens Protocol](#5-lens-protocol)
6. [Matrix](#6-matrix)
7. [Signal Protocol](#7-signal-protocol)
8. [Comparative Analysis](#8-comparative-analysis)
9. [DegenFeed Security Requirements by Protocol](#9-degenfeed-security-requirements-by-protocol)

---

## 1. Nostr

### 1.1 Encryption: NIP-04 vs NIP-17

| Feature | NIP-04 (Legacy) | NIP-17 (Current) |
|---------|----------------|------------------|
| Algorithm | AES-256-CBC + base64 | AES-256-GCM + base64 |
| Key derivation | Direct nsec usage | ECDH via secp256k1 |
| Authentication | None (no HMAC) | GCM provides authenticated encryption |
| Padding | None | PKCS#7 padding |
| Wrapper event | `kind: 4` DM event | `kind: 1059` sealed + `kind: 1060` gift wrap |
| Recipient hiding | No — `p` tag visible | Yes — rumor + gift wrap |
| **Security status** | **DEPRECATED — vulnerable to padding oracle** | **RECOMMENDED** |

**DegenFeed integration:** We must reject NIP-04 events for new messages and only send NIP-17. Incoming NIP-04 events should be flagged in the UI as "legacy encryption."

### 1.2 Authentication: NIP-42

NIP-42 defines `AUTH` message flow for relay authentication:

```
Client → Relay: ["AUTH", <challenge>]
Relay → Client: ["AUTH", <challenge>]
Client → Relay: ["AUTH", <signed_event>]
```

**Security properties:**
- Challenge-response prevents replay attacks (relay-generated challenges)
- Signed event proves npub ownership without exposing nsec
- No session tokens — every AUTH is stateless

**DegenFeed relay (`relay.degenfeed.xyz`):**
- NIP-42 enforced for `WRITE` and `kind: 4`/`kind: 1059` DM reads
- Read-only (`kind: 1`, `kind: 7`, `kind: 9735`) is public
- Whitelist-based rate limiting per npub (500 events/min authenticated, 50/min anonymous)

### 1.3 Relay Security Model

| Component | Mechanism |
|-----------|-----------|
| Transport | WSS (TLS 1.3) — mandatory for production relays |
| Message signing | Ed25519 (Schnorr) signatures on every event |
| Event deletion | NIP-09 — signed deletion events with time-bound limits |
| Reporting | NIP-56 — labeled reports for spam/illegal content |
| Mute lists | NIP-51 — client-side mute lists (no relay enforcement) |
| DDoS protection | Connection rate limiting, max concurrent connections per IP |
| Content moderation | NIP-33 parameterized replaceable events for moderated lists |

**DegenFeed implementation:** We run `strfry` with a custom moderation plugin that enforces NIP-56 reports against a blocklist in Redis.

---

## 2. Farcaster

### 2.1 Hubble Sync Security

Farcaster Hub-to-Hub sync (gossip protocol):

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Hub A   │────▶│ Hub B   │────▶│ Hub C   │
└─────────┘     └─────────┘     └─────────┘
    │                              │
    └──────────────────────────────┘
       libp2p GossipSub mesh
```

**Security mechanisms:**
- **Peer identity:** Ed25519 peer IDs signed into the libp2p DHT
- **Message integrity:** Each message is a Farcaster `Message` protobuf signed by the user's Ed25519 key, verified by the receiving hub
- **Sync whitelist:** Hubs can restrict sync to a fixed set of peer IDs
- **Rate-limited sync:** Maximum 10,000 messages per sync cycle per peer
- **Trusted peer mode:** Some hubs run in "deny-all-except-whitelist" mode (including DegenFeed's Hubble)

### 2.2 Signer Model

```
┌───────────────────────────────────────────────┐
│                Custody Key                     │
│         (Ed25519 — stored offline)             │
│                      │                         │
│         Signed Key (SignedKeyRequest)          │
│                      │                         │
│              ┌───────┴───────┐                 │
│              │               │                 │
│         Signer Key A   Signer Key B            │
│         (session)      (session)              │
└───────────────────────────────────────────────┘
```

- **Custody key** — the root of trust. Stored in Farcaster's account recovery system (hardware-backed). Never exposed to the client application.
- **Signer keys** — session keys registered on-chain via `SignedKeyRequest`. Each has a fixed lifetime (default 365 days) and can be revoked on-chain.
- **App keys** — per-application signer keys that inherit from the user's signer. DegenFeed requests an app-specific signer during onboarding.
- **Revocation:** Signers are revoked via on-chain transaction to the IdRegistry. Hubble picks up the revocation within the next sync cycle (~1-2 minutes).

### 2.3 Recovery Mechanism

| Component | Description |
|-----------|-------------|
| Recovery address | Pre-registered Ethereum address on L1 |
| Recovery process | 7-day timelock after initiating recovery |
| Recovery cancel | Original owner can cancel within the timelock period |
| Migration | All FID-linked data (signers, storage) migrates to new key |

**DegenFeed risk:** If a user's Farcaster account is compromised via recovery, our cross-protocol identity attestations become stale. We mitigate this by re-verifying Farcaster identity attestations every 24 hours.

---

## 3. Bluesky / AT Protocol

### 3.1 DID Authentication

Bluesky uses `did:plc` (PLC directory) and `did:web`:

```
DID Document (PLC Directory):
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:plc:abc123...",
  "verificationMethod": [{
    "id": "did:plc:abc123...#atproto",
    "type": "EcdsaSecp256r1VerificationKey2019",
    "controller": "did:plc:abc123...",
    "publicKeyMultibase": "zQ3sh..."
  }],
  "service": [{
    "id": "#atproto_pds",
    "type": "AtprotoPersonalDataServer",
    "serviceEndpoint": "https://pds.degenfeed.xyz"
  }]
}
```

**Security properties:**
- DID rotation requires 3-of-8 PLC recovery key signatures (rotation keys are stored separately from the AT Protocol signing key)
- DID document must be signed by the rotation key at each update
- `did:web` trusts the domain's TLS certificate (weaker — domain compromise = DID compromise)

### 3.2 PLC Directory Security

| Attack Vector | Mitigation |
|--------------|------------|
| PLC directory takeover | 3-of-8 multisig for DID updates |
| DID injection (fake DID for existing handle) | Handle-DID binding stored on PLC + DNS TXT record |
| Replay of old DID document | Monotonic clock — `alsoKnownAs` changes increment version |
| PDS impersonation | Service endpoint in DID doc signed by rotation key |
| DNS rebinding on `did:web` | `did:web` domain must match TLS certificate SAN |

### 3.3 AT Protocol Session Tokens

```
Login flow:
1. Client signs a "com.atproto.server.createSession" with PLC signing key
2. PDS returns { accessJwt, refreshJwt }
3. accessJwt: short-lived (2 hours), used for API calls
4. refreshJwt: longer-lived (90 days), used to rotate access token
```

**DegenFeed handling:** We store refresh tokens encrypted with the user's wallet-derived key. Access tokens are held in memory only. On app restart, we re-authenticate.

---

## 4. ActivityPub / Mastodon

### 4.1 HTTP Signatures

ActivityPub uses HTTP Signatures (RFC 9421) for server-to-server authentication:

```
Signature: keyId="https://social.degenfeed.xyz/users/alice#main-key",
          algorithm="rsa-sha256",
          headers="(request-target) host date digest",
          signature="..."
```

**What DegenFeed does:**
- Signs ALL outgoing ActivityPub requests with our instance key
- Verifies ALL incoming ActivityPub requests with the sender's public key (fetched from their webfinger/actor endpoint)
- Rejects unsigned requests for `Create`, `Delete`, `Update`, `Follow`, `Like`, `Announce` activities
- Accepts unsigned `GET` requests for public content

### 4.2 Authorized Fetch (Secure Mode)

```
┌─────────────┐         HTTPS + Sig       ┌─────────────┐
│ Remote      │ ─────────────────────────▶ │ DegenFeed   │
│ Instance    │                            │ (GotoSocial)│
└─────────────┘                            └─────────────┘
     │                                            │
     │ Request actor's public key                 │
     │ via WebFinger + Actor fetch                │
     └────────────────────────────────────────────┘
```

**Security properties of authorized fetch:**
- No anonymous access to any federated content
- Every fetch requires a valid HTTP Signature from a known actor
- Prevents mass data scraping from federated instances
- **DegenFeed:** Enabled on `social.degenfeed.xyz` — all federation is authenticated

### 4.3 Mastodon API Token Model

| Token Type | Lifetime | Scope |
|-----------|----------|-------|
| App token | Permanent | Identifies the app, not the user |
| User token | 90 days (refreshable) | `read`, `write`, `follow`, `push` |
| Client token | Permanent | OAuth client identifier |

**DegenFeed OAuth flow:**
1. User authorizes DegenFeed on their Mastodon instance
2. We receive `access_token` + `refresh_token` + `token_type`
3. `access_token` is used for API calls; stored encrypted at rest
4. We periodically check token validity via `/api/v1/app/verify_credentials`

---

## 5. Lens Protocol

### 5.1 Gasless Transactions (Dispatcher)

```
┌──────────┐         Signed TypedData      ┌──────────┐
│ DegenFeed│ ──────────────────────────────▶│ LensHub │
│ Frontend │                                │ Contract│
└──────────┘                                └──────────┘
     │                                            │
     │ Dispatch (meta-transaction)                │
     │ via Broadcaster                            │
     └────────────────────────────────────────────┘
```

**Security flow:**
1. User signs EIP-712 typed data granting the dispatcher permission
2. The signed message includes a `nonce` (preventing replay) and `deadline` (preventing delayed execution)
3. DegenFeed's broadcaster submits the meta-transaction to the LensHub contract
4. LensHub verifies: signature → nonce → deadline → dispatcher address

**Dispatcher permissions:**
- `CREATE_POST` — create new publications
- `CREATE_COMMENT` — reply to existing publications
- `CREATE_MIRROR` — mirror (share) publications
- `SET_PROFILE_IMAGE_URI` — update profile picture
- `SET_PROFILE_METADATA` — update profile metadata (bio, etc.)

**DegenFeed dispatcher:**
- We request only `CREATE_POST` and `CREATE_COMMENT` permissions
- Dispatcher is a dedicated EOA (not shared with any other protocol)
- All dispatcher transactions are pre-simulated via Polygon RPC

### 5.2 Dispatcher Security

| Risk | Mitigation |
|------|------------|
| Dispatcher key compromised | Profile-specific, user can revoke via LensHub `setDispatcher` |
| Signature replay on different chain | EIP-712 includes `chainId` and `verifyingContract` |
| Deadline bypass | `block.timestamp > deadline` check in contract |
| Nonce reuse | Monotonic nonce per-profile, enforced by LensHub |
| Gas griefing | DegenFeed's broadcaster enforces max gas per transaction |

---

## 6. Matrix

### 6.1 Olm / Megolm Encryption

```
┌─────────────────────────────────────────────┐
│              Olm (1:1)                      │
│                                              │
│  Double Ratchet + X3DH key agreement         │
│  Per-message authenticated encryption         │
│  Perfect Forward Secrecy (PFS)               │
│  Post-Compromise Security (PCS)              │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│            Megolm (Group)                   │
│                                              │
│  Single ratchet shared across group          │
│  No PFS within a session                     │
│  Rotated on membership changes               │
│  Max session size: unlimited                 │
└─────────────────────────────────────────────┘
```

**DegenFeed Matrix bridge encryption policy:**
- 1:1 DMs: Olm with Curve25519 keys, mandatory for all bridged messages
- Group chats: Megolm with key rotation every 24 hours (default) or on membership change
- Session export: Keys are exported encrypted with the user's wallet-derived key for cross-device sync
- Key backup: Encrypted Olm/Megolm session backups stored on Matrix server (encrypted with recovery key)

### 6.2 Key Verification

| Method | Security Level | DegenFeed Support |
|--------|---------------|-------------------|
| Emoji comparison | Medium (manual) | Yes (UI) |
| Number comparison | Medium (manual) | Yes (UI) |
| QR code scan | High (out-of-band) | Yes (mobile) |
| Cross-signing | High (social graph) | Yes |
| Device signature | Very High (crypto binding) | Planned |

**Cross-signing flow in DegenFeed:**
1. User's master key (Ed25519) is cross-signed by wallet signature
2. Each device generates a self-signing key + user-signing key
3. Device keys are signed by the user-signing key
4. Trust is established transitively: wallet → master key → device keys

---

## 7. Signal Protocol

> DegenFeed uses the Signal Protocol for its cross-platform encrypted messaging

### 7.1 X3DH (Extended Triple Diffie-Hellman)

```
Alice                                    Bob
  │                                       │
  │  ┌─────────────────────────────────┐  │
  │  │ SPK = Signed Pre-Key           │  │
  │  │ IK  = Identity Key             │  │
  │  │ OPK = One-Time Pre-Key         │  │
  │  └─────────────────────────────────┘  │
  │  ────── Fetch Bob's pre-key bundle ──▶ │
  │                                       │
  │  Compute shared secret:               │
  │  DH1 = DH(IK_A, SPK_B)               │
  │  DH2 = DH(EK_A, IK_B)                │
  │  DH3 = DH(EK_A, SPK_B)               │
  │  DH4 = DH(EK_A, OPK_B)               │
  │  SK  = KDF(DH1 || DH2 || DH3 || DH4) │
  │                                       │
  │  ───── Send message with IK_A, EK_A ─▶│
  │                                       │
  │        ┌──────────────────────┐       │
  │        │ Double Ratchet       │       │
  │        │ starts from SK       │       │
  │        └──────────────────────┘       │
```

**DegenFeed implementation:**
- X3DH using Curve25519 keys
- 1-time pre-keys rotated after use (prevents replays)
- Signed pre-keys rotated every 7 days
- Pre-key bundle stored in encrypted KV (keys encrypted with HSM-backed key)

### 7.2 Double Ratchet

| Property | Implementation |
|----------|---------------|
| Root key derivation | HKDF-SHA256 with root chain ratchet |
| Symmetric key ratchet | HMAC-SHA256 chain keys |
| Encryption | AES-256-GCM with 96-bit random IV |
| Message numbers | 32-bit unsigned, monotonic per chain |
| Skipped message keys | Stored for up to 1000 messages per chain |
| Max skip | Prevents memory exhaustion from out-of-order messages |

### 7.3 Sealed Sender

```
Standard message:
  Sender Identity Key visible to server (sender can be correlated)

Sealed Sender:
  Sender Identity Key is encrypted with the recipient's Identity Key
  Server sees only recipient

Delivery mechanism:
  Server stores envelope (encrypted sender + ciphertext)
  Recipient polls, decrypts envelope with their Identity Key
```

**DegenFeed:** Sealed Sender is enabled by default. The server (our `relay.degenfeed.xyz`) stores only encrypted envelopes. Sender metadata is never visible at rest.

---

## 8. Comparative Analysis

| Feature | Nostr | Farcaster | Bluesky | Mastodon | Lens | Matrix | Signal |
|---------|-------|-----------|---------|----------|------|--------|--------|
| **Auth mechanism** | NIP-42 (event sig) | Ed25519 signers + on-chain | PLC keys + JWT | OAuth2 | Wallet sig + dispatcher | Token + SSO | X3DH + sealed sender |
| **PFS** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Olm) | ✅ |
| **Post-compromise sec** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Metadata protection** | Partial (NIP-17) | ❌ | ❌ | ❌ | ❌ | Partial | ✅ (Sealed Sender) |
| **Replay protection** | Event ID dedup | Nonce | JWT exp | None (sig) | EIP-712 nonce | Ratchet | Ratchet |
| **Key rotation** | Manual | On-chain signer | DID rotation | Password | Profile dispatcher | Cross-signing | Automatic |
| **Decentralization** | High (50+ relays) | Medium (hubs) | Medium (PDS) | Medium (instances) | Low (Polygon) | Medium (servers) | Central (Signal) |
| **DegenFeed integration** | ✅ Active | ✅ Active | ✅ Active | ✅ Active | ✅ Active | ✅ Bridge | ✅ Messenger |

### Key Takeaways

1. **Nostr** has the weakest encryption model (lacks PFS) — we supplement with Signal Protocol for DMs
2. **Farcaster** has the strongest on-chain key management — we mirror this pattern for our custody system
3. **Bluesky** PLC directory is the most resilient DID system — we use it as the anchor for cross-protocol identity
4. **Signal Protocol** provides our messaging backbone for good reason — it is the only protocol offering PFS + PCS + metadata protection
5. **Matrix** bridges inherit Olm security but Megolm group sessions lack PFS — we add per-member key rotation

---

## 9. DegenFeed Security Requirements by Protocol

| Requirement | Nostr | Farcaster | Bluesky | Mastodon | Lens | Matrix | Signal |
|------------|-------|-----------|---------|----------|------|--------|--------|
| TLS 1.3 transport | ✅ | ✅ | ✅ | ✅ | ✅ (RPC) | ✅ | ✅ |
| Signature verification | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
| Nonce validation | NIP-42 | On-chain | JWT | OAuth | EIP-712 | Ratchet | Ratchet |
| Rate limiting | ✅ per npub | ✅ per peer | ✅ per PDS | ✅ per IP | ✅ per profile | ✅ per user | ✅ per session |
| Content encryption | NIP-17 | ❌ | ❌ | ❌ | ❌ | Olm/Megolm | Signal |
| Replay protection | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Key rotation support | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Incident reporting | NIP-56 | Report channel | Mod service | Report API | DAO | Room mod | N/A |

---

**Security contact:** security@degenfeed.xyz
**Last updated:** 2026-07-25
