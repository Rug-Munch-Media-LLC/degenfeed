# Cross-Protocol Registration Guide

> **Last updated:** 2026-07-24
> **Package:** `@degenfeed/crossplatform-register`
> **API Routes:** `POST /api/register-platform`, `POST /api/register/all`

DegenFeed can create accounts for users on **8 different social protocols** through a unified registration system. This document covers each protocol's registration method, requirements, limitations, and recovery.

---

## Supported Protocols

| # | Protocol | Endpoint | Cost | Status | Requires |
|---|----------|----------|------|--------|----------|
| 1 | **Mastodon / GoToSocial** | `POST /api/v1/accounts` | Free | ✅ Live | Mastodon instance accepting registrations |
| 2 | **Bluesky (AT Protocol)** | `com.atproto.server.createAccount` | Free | ✅ Live | PDS + invite code (pooled) |
| 3 | **Nostr** | Local keypair generation | Free | ✅ Live | Nothing — keys generated client-side |
| 4 | **Farcaster** | On-chain (Base contract) | $5 gas | ✅ Live | Premium wallet with ETH on Base |
| 5 | **Lens Protocol** | Lens API v2 (Polygon) | $2+ gas | ✅ Live | Premium wallet with MATIC on Polygon |
| 6 | **Lemmy** | `POST /api/v3/user/register` | Free | ✅ Live | Lemmy instance (self-hosted: community.degenfeed.xyz) |
| 7 | **PeerTube** | `POST /api/v1/users/register` | Free | ✅ Live | PeerTube instance with registration enabled |
| 8 | **Pixelfed** | `POST /api/v1/accounts` | Free | ✅ Live | Pixelfed instance accepting registrations |

## Registration Flow

### Architecture

```
User Wallet
    ↓
DegenFeed API (/api/register-platform or /api/register/all)
    ↓
@degenfeed/crossplatform-register — registerOnPlatform()
    ├── registerFarcaster()  →  Base L2 (on-chain tx)
    ├── registerLens()       →  Polygon (Lens API v2)
    ├── registerBluesky()    →  PDS (AT Protocol)
    ├── registerMastodon()   →  Fediverse instance
    ├── registerNostr()      →  Local keypair generation
    ├── registerLemmy()      →  Lemmy instance
    ├── registerPeerTube()   →  PeerTube instance
    └── registerPixelfed()   →  Pixelfed instance (Mastodon-compatible API)
```

### Unified API

```typescript
import { registerOnPlatform, getSupportedProtocolsForRegistration } from '@degenfeed/crossplatform-register';

// Get all protocols that can register users
const protocols = getSupportedProtocolsForRegistration();
// → ['farcaster', 'lens', 'bluesky', 'mastodon', 'nostr', 'lemmy', 'peertube', 'pixelfed']

// Register on a specific protocol
const result = await registerOnPlatform('lemmy', 'myusername', '0x...', {
  walletAddress: '0x...',
  lemmyInstanceUrl: 'https://community.degenfeed.xyz',
  storage: myKVNamespace,
});

// Result:
// { platform: 'lemmy', status: 'created', username: 'myusername@community.degenfeed.xyz', accountInfo: {...} }
```

### Authentication Required

All `/api/register-platform` and `/api/register/all` endpoints require a valid session (wallet signature).

### Premium vs Free Platforms

| Tier | Platforms |
|------|-----------|
| **Free** (no subscription) | Mastodon, Nostr, Lemmy, PeerTube, Pixelfed |
| **Premium** ($10/mo) | Farcaster, Lens, Bluesky (on-chain gas covered) |

---

## Per-Protocol Details

### 1. Mastodon / GoToSocial

| Field | Value |
|-------|-------|
| **API** | `POST /api/v1/accounts` (Mastodon-compatible) |
| **Instance** | `https://social.degenfeed.xyz` (self-hosted GoToSocial) |
| **Required** | Username, email, password, agreement to ToS |
| **Rate Limits** | 30 requests per 5 minutes per IP |
| **CAPTCHA** | None on self-hosted instance |
| **Recovery** | Password + OAuth token (stored in KV) |

**Flow:**
1. Register OAuth app → get client_id / client_secret
2. Create account → `POST /api/v1/accounts`
3. Obtain OAuth token → `POST /oauth/token` (password grant)
4. Store tokens in KV

### 2. Bluesky / AT Protocol

| Field | Value |
|-------|-------|
| **API** | `com.atproto.server.createAccount` |
| **PDS** | `https://pds.degenfeed.xyz` (self-hosted) or `https://bsky.social` |
| **Required** | Handle, email, password, invite code |
| **Invite Codes** | Pooled in KV — depleted codes are returned on failure |
| **Rate Limits** | 100 requests per hour per PDS |
| **Recovery** | App password (generated) + DID |

**Invite Code Pool:**
- Codes are stored in `BLUESKY_INVITE_POOL` KV namespace
- Pool stats: `GET /api/register-platform/bluesky-pool`
- Admin can add codes: `addInviteCodesToPool()`

**Known Issues:**
- Bluesky has been invite-only since launch
- Our PDS is self-hosted but may still enforce invite codes for federation
- Email is auto-generated as `user-{wallet_prefix}@register.degenfeed.xyz`

### 3. Nostr

| Field | Value |
|-------|-------|
| **Method** | Local keypair generation (no network call) |
| **Required** | Nothing — keys generated from cryptographic randomness |
| **Rate Limits** | N/A (local operation) |
| **Recovery** | **Private key (nsec) — must be saved by user** |

**Flow:**
1. Generate 32-byte secret key using `@noble/curves/secp256k1`
2. Derive public key
3. Encode as nsec (private) and npub (public) using NIP-19
4. Store encrypted nsec in KV
5. **Warning:** We encrypt the nsec but cannot recover it if the user loses their session

**Future Enhancement:**
- Publish kind 0 metadata event to relays after registration
- Set up NIP-05 verification with our domain

### 4. Farcaster

| Field | Value |
|-------|-------|
| **Method** | On-chain transaction on Base (L2) |
| **Contract** | `0x00000000fc6c5f01fc30151999387bb99a9f489b` (IdRegistry) |
| **Cost** | ~$5 in ETH gas on Base |
| **Required** | Premium subscription or Standard/Complete plan |
| **Rate Limits** | N/A (on-chain, gas-dependent) |
| **Recovery** | Recovery address = user's wallet |

**Flow:**
1. Check username availability via Hub API
2. Encode register call with recovery address
3. Send transaction via premium wallet
4. Wait for confirmation (poll tx receipt up to 60s)
5. FID is extracted from event logs

**Important:**
- Farcaster registration is PERMANENT — cannot be undone
- The user's wallet becomes the recovery address
- Currently uses a centralized premium wallet for gas; future versions will let users pay their own gas

### 5. Lens Protocol

| Field | Value |
|-------|-------|
| **Method** | Lens API v2 GraphQL mutation on Polygon |
| **API** | `https://api-v2.lens.dev/graphql` |
| **Cost** | $2–$55 gas on Polygon (depends on handle length) |
| **Required** | Premium subscription or Standard/Complete plan |
| **Rate Limits** | 100 requests per minute |
| **Recovery** | Profile NFT in user's wallet |

**Handle Pricing:**

| Length | Gas Cost | Example |
|--------|----------|---------|
| 9+ chars | $2 | `myusername` |
| 7-8 chars | $7 | `myuser` |
| 5-6 chars | $17 | `myusr` |
| 3-4 chars | $55 | `meme` |

**Flow:**
1. Check handle availability via GraphQL
2. Submit `CreateProfile` mutation
3. Wait for relay to process (poll profile endpoint)
4. Store profile ID and handle

### 6. Lemmy

| Field | Value |
|-------|-------|
| **API** | `POST /api/v3/user/register` |
| **Instance** | `https://community.degenfeed.xyz` (self-hosted) |
| **Required** | Username, email, password |
| **Rate Limits** | 10 requests per minute per IP |
| **CAPTCHA** | May be required — falls back to manual signup |
| **Recovery** | Password + email (stored in KV) |

**Flow:**
1. Check username availability (search existing user)
2. If captcha required → return manual signup URL
3. Register user with email + password
4. Handle email verification status (pending vs created)

**Notes:**
- Lemmy instances require email verification by default
- Our instance `community.degenfeed.xyz` may have registration open or admin-approval
- Anti-spam honeypot fields must be empty

### 7. PeerTube

| Field | Value |
|-------|-------|
| **API** | `POST /api/v1/users/register` |
| **Instance** | `https://video.degenfeed.xyz` (self-hosted) |
| **Required** | Username, password, display name, email |
| **Rate Limits** | 5 requests per minute per IP |
| **CAPTCHA** | None (configurable by admin) |
| **Recovery** | Password + email (stored in KV) |

**Flow:**
1. Check instance config (`/api/v1/config`) for `signup.allowed`
2. Check username availability
3. Register user with display name
4. Handle email verification if required

**Known Issues:**
- Our PeerTube instance is behind Cloudflare — registration may return 403
- Admin must enable registration in PeerTube admin panel
- Falls back to manual signup URL if API is blocked

### 8. Pixelfed

| Field | Value |
|-------|-------|
| **API** | `POST /api/v1/accounts` (Mastodon-compatible) |
| **Instance** | `https://pixelfed.social` (public) |
| **Required** | Username, email, password, agreement |
| **Rate Limits** | 30 requests per 5 minutes per IP |
| **CAPTCHA** | May be required |
| **Recovery** | Password + email (stored in KV) |

**Flow:**
1. Check username availability via account lookup
2. Check instance registration status (`/api/v1/instance`)
3. Register OAuth app → get client credentials
4. Create account → `POST /api/v1/accounts`
5. Obtain OAuth token → `POST /oauth/token`
6. Fallback: direct account creation if app registration fails

**Notes:**
- Some Pixelfed instances require admin approval for new registrations
- Uses Mastodon-compatible API so shares rate limits with Mastodon
- Public instance pixelfed.social may have registration closed

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MASTODON_INSTANCE_URL` | `https://social.degenfeed.xyz` | Mastodon/GoToSocial instance |
| `LEMMY_INSTANCE_URL` | `https://community.degenfeed.xyz` | Lemmy instance |
| `PEERTUBE_INSTANCE_URL` | `https://video.degenfeed.xyz` | PeerTube instance |
| `PIXELFED_INSTANCE_URL` | `https://pixelfed.social` | Pixelfed instance |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base RPC for Farcaster |
| `POLYGON_RPC_URL` | `https://polygon-rpc.com` | Polygon RPC for Lens |
| `PREMIUM_WALLET_KEY` | — | Private key for gas payments |
| `BLUESKY_INVITE_POOL` | — | KV namespace for invite codes |
| `PDS_URL` | `https://pds.degenfeed.xyz` | AT Protocol PDS |
| `PLATFORM_ACCOUNTS` | — | KV namespace for account storage |
| `IDENTITIES` | — | KV namespace for identity linking |

---

## Rate Limits Summary

| Protocol | Limit | Window |
|----------|-------|--------|
| Mastodon / GoToSocial | 30 req | 5 min |
| Bluesky / AT Protocol | 100 req | 1 hour |
| Nostr | N/A | N/A (local) |
| Farcaster | N/A | N/A (on-chain) |
| Lens Protocol | 100 req | 1 min |
| Lemmy | 10 req | 1 min |
| PeerTube | 5 req | 1 min |
| Pixelfed | 30 req | 5 min |

---

## Invite-Only Protocols

| Protocol | Status | Workaround |
|----------|--------|------------|
| **Bluesky** | 🔒 Invite-only (federation) | Pooled invite codes; self-hosted PDS may bypass |
| **Farcaster** | 🔒 On-chain only | Not invite-gated but requires ETH on Base |
| **Lens** | ✅ Open (by invitation on API) | API v2 allows programmatic creation |
| **Others** | ✅ Open | All allow open registration |

---

## API Routes

### POST /api/register-platform

Register a single platform:

```json
{
  "platform": "lemmy",
  "username": "myhandle"
}
```

Response (201 Created):
```json
{
  "data": {
    "platform": "lemmy",
    "status": "created",
    "username": "myhandle@community.degenfeed.xyz",
    "accountInfo": { "username": "myhandle", "instance": "https://community.degenfeed.xyz" }
  }
}
```

### POST /api/register/all

Concierge registration — signs up on ALL free protocols + paid ones depending on plan:

```json
{
  "plan": "free"
}
```

### GET /api/register-platform/status

Get registration status for all platforms.

### GET /api/register/plans

List available plans with pricing.

---

## Testing

### Unit Tests

```bash
cd packages/crossplatform-register
pnpm test
```

Tests cover:
- Nostr key generation (no network required)
- Bluesky failure mode (no invite pool)
- Lemmy/PeerTube/Pixelfed failure modes (invalid instances)
- Platform key helpers
- `getSupportedProtocolsForRegistration()` output

### Integration Tests

Run against running instances:

```bash
# Check instance health
curl https://community.degenfeed.xyz/api/v3/site
curl https://video.degenfeed.xyz/api/v1/config
curl https://social.degenfeed.xyz/api/v1/instance
```

---

## Adding a New Protocol

1. Create `packages/crossplatform-register/src/register/{protocol}.ts`
   - Implement `register{Protocol}()` function
   - Return `PlatformRegistration` type

2. Update `packages/crossplatform-register/src/register/types.ts`
   - Add protocol to `RegistrationPlatform` union type
   - Add option fields to `RegisterOptions` interface

3. Update `packages/crossplatform-register/src/register/register.ts`
   - Import new registration function
   - Add case to `registerOnPlatform()` switch
   - Add to `REGISTRABLE_PLATFORMS` array

4. Update API routes:
   - `workers/api/src/routes/register-platform.ts` — add to VALID_PLATFORMS, PREMIUM_PLATFORMS, or FREE_PLATFORMS
   - `workers/api/src/lib/register-service.ts` — add identity storage + recovery package

5. Update tests in `packages/crossplatform-register/src/index.test.ts`

6. Document in this file
