# Cross-Platform Integration Tests

## Last Updated: 2026-07-18

This document is a living checklist for verifying that the four key cross-protocol features (compose, reply, tip, identity) work end-to-end. Each section covers: what to test, expected results, and how to fix common issues.

---

## 1. Cross-Protocol Compose

### What to test

| Test | Steps | Expected Result |
|------|-------|-----------------|
| ComposeModal opens | Click "Compose" button (or press `c` on desktop) | Modal opens with textarea, protocol toggles, publish button |
| Protocol targets show correctly | Check toggles match linked identities | Only protocols the user has signed into are enabled; disconnected ones show "Sign in" padlock |
| At least one protocol selected | Try clicking "Post" with 0 protocols selected | Button shows disabled state; tooltip explains need to select a target |
| Publish button calls API | Click "Post" with text + selected targets | `POST /api/publish` fires with `{ text, targets, auth }` body |
| Success toast | Publish succeeds | Toast: "Posted to N networks ✅" or partial failure with details |

### Frontend → API flow

```
ComposeModal.onPublish()
  → AuthProvider.handlePublish() (AuthProvider.tsx:466)
    → fetch('POST /api/publish') with { text, targets, auth, lensCollect }
      → workers/api/src/routes/publish.ts handlePublish()
        → tryPostizPublish() (if Postiz configured)
        → perProtocolPublish() (fallback)
    → showToast with per-protocol results
```

### Common fixes

| Symptom | Fix |
|---------|-----|
| 403 on publish | Check `requireSession` — user must have server session. Verify `credentials: 'include'` in fetch call |
| API returns empty results | Check `perProtocolPublishSingle` switch cases match `targets` values |
| Postiz not routing | Check `POSTIZ_BASE_URL` and `POSTIZ_API_KEY` env vars. Verify health check passes |
| Toast not showing | Check `showToast` is called in `handlePublish` (AuthProvider.tsx:485-496) |

---

## 2. Cross-Protocol Replies

### What to test

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Reply opens ComposeModal | Click reply on a Farcaster/Lens/Nostr post | ComposeModal opens in reply mode with parent badge |
| Protocol switcher shows options | Check available reply protocols | Shows user's signed-in protocols; "same" tag on parent protocol |
| Cross-protocol reply posts | Select DIFFERENT protocol than parent, write reply, click Post | `POST /api/cross-reply` fires instead of `/api/publish` |
| Same-protocol reply uses publish | Select SAME protocol as parent | Uses `POST /api/publish` (not cross-reply endpoint) |
| Bridge footer appended | Check posted content | Content ends with `_↻ Replied via DegenFeed cross-protocol bridge (parent → reply)_` |

### Frontend → API flow

```
ComposeModal.handlePublish()
  → if (replyContext && onCrossReply)  → AuthProvider.handleCrossReply() (AuthProvider.tsx:508)
    → Client-side signing for Nostr/Farcaster
    → fetch('POST /api/cross-reply') with { parentPostUri, parentProtocol, replyProtocol, content, ... }
      → workers/api/src/routes/cross-reply.ts handleCrossReply()
        → publishCrossReply() switch(protocol) { nostr, mastodon, farcaster, lens, bluesky }
        → recordThreadRelationship() for cross-protocol thread indexing
```

### Common fixes

| Symptom | Fix |
|---------|-----|
| "No XYZ identity linked" | User must link the reply protocol identity in Settings > Identities |
| "Pre-signed event missing id/sig" | Nostr client-side signing failed — check `signBridgeReplyNote()` in nostr.ts |
| "Farcaster Hub rejected" | Check `FARCASTER_HUB_URL` env var. Verify Hub is reachable from worker |
| "Bluesky publish failed" | Verify `BSKY_SOCIAL_URL` env var. Check access JWT is not expired |
| Bridge records not showing | Check CACHE KV is configured. Bridge keys stored as `bridge:reply:{uri}:{protocol}:{uniqueId}` |

---

## 3. Tipping

### What to test

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Tip button opens modal | Click tip icon on a post | TipModal opens with available methods |
| Methods resolve | Wait for method resolution | Shows Lightning, ETH, SOL, USDC, Lens Collect, etc. based on author's linked wallets |
| Quick amounts | Click amount preset | Input field updates to selected amount |
| Multi-currency | Switch between methods | Currency label updates: sats/ETH/SOL based on selected method |
| Send tip (ETH) | Select Ethereum, connect MetaMask, confirm tx | Toast: "⚡ Tip sent!" + tx explorer link |
| Send tip (SOL) | Select Solana, connect Phantom, confirm | Same success flow |
| Lightning invoice | Select Lightning Zap, send | QR code + invoice string for Lightning wallet |

### Frontend → API flow

```
TipModal handleSend()
  → resolveMethods GET /api/tip/resolve?protocol=nostr&authorId=xyz
    → workers/api/src/routes/tip.ts handleTipResolve()
      → buildBaseMethods() + rankMethods()
  → createTip POST /api/tip/create with { recipient, method, amount, ... }
    → workers/api/src/routes/tip.ts handleTipCreate()
      → returns intent with { method, intent: { to, value, chain } }
  → Client-side wallet interaction (eth_sendTransaction / signAndSendTransaction)
  → setTipStatus('sent', txHash)
```

### Common fixes

| Symptom | Fix |
|---------|-----|
| No methods available | Creator must link wallet in Settings > Monetization. Check `GET /api/tip/settings?wallet=0x...` |
| "Failed to create tip" | Verify `recipient`, `method`, `amount` in request body. Check amount is positive number |
| Wallet not connecting | Verify Web3Provider is wrapping the component. Check `account` state in TipModal |
| Lightning invoice fails | Check `RELAY_URLS` env var. Verify author has lnurl configured on Nostr profile |
| Base chain switch fails | Check `wallet_switchEthereumChain` params: chainId must be `0x2105` (8453) |

### Currency support matrix

| Method | Currency | Wallet Required | Fee |
|--------|----------|----------------|-----|
| `onchain_tip` | ETH (Base/Opt/Arb) | MetaMask/Rabby | 0% (L2 gas) |
| `ethereum` | ETH, USDC, ERC-20 | MetaMask/Rabby | ~$0.05-5 |
| `base` | ETH (Base) | MetaMask/Rabby | < $0.01 |
| `solana` | SOL, USDC, SPL | Phantom/Backpack | < $0.01 |
| `lightning_zap` | BTC (sats) | Alby/WoS | < $0.001 |
| `lens_collect` | MATIC | MetaMask | ~$0.01-1 |

---

## 4. Cross-Protocol Identity

### What to test

| Test | Steps | Expected Result |
|------|-------|-----------------|
| IdentityLinker loads | Open Settings > Identities | Shows wallet address + 6 protocol slots (Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit) |
| Linked protocols show | Check already-linked protocols | Shows "✓ Linked" badge + handle |
| Link a protocol | Click "Link" on a protocol, fill in fields, submit | `POST /api/identity/link` fires, success toast, profile shows linked |
| Unlink a protocol | Click "Unlink" on an already-linked protocol | Confirmation, `DELETE /api/identity/link` fires, profile updates |
| Wallet switcher | Change active wallet | Linked identities update to selected wallet's links |

### Frontend → API flow

```
IdentityLinker.fetchLinked()  GET /api/identity/profile?wallet=0x...
  → workers/api/src/routes/identity.ts handleGetIdentityProfile()
    → read from env.IDENTITIES KV

handleLink()  POST /api/identity/link with { protocol, identity, walletAddress }
  → workers/api/src/routes/identity.ts handleLinkIdentity()
    → requireSession() → validateProtocolIdentity() → write to env.IDENTITIES KV

handleUnlink()  DELETE /api/identity/link?protocol=nostr&wallet=0x...
  → workers/api/src/routes/identity.ts handleUnlinkIdentity()
    → requireSession() → remove protocol key → write to env.IDENTITIES KV
```

### Common fixes

| Symptom | Fix |
|---------|-----|
| "Failed to link identity" | Verify all required fields are filled. Check `session.address` matches `walletAddress` |
| "Unsupported protocol: X" | Only nostr, farcaster, lens, bluesky, mastodon, reddit are supported |
| Identity not persisting | Check `IDENTITIES` KV namespace is bound in wrangler.toml |
| "No identity record found" on unlink | User's wallet is not in KV. Check wallet address format (must be lowercase) |

---

## 5. API Route Verification

### Required endpoints (all registered in workers/api/src/app.ts)

| Endpoint | Method | App.ts Line | Handler | Status |
|----------|--------|-------------|---------|--------|
| `/api/publish` | POST | 541 | `handlePublish` | ✅ |
| `/api/cross-reply` | POST | 484 | `handleCrossReply` | ✅ |
| `/api/tip/create` | POST | 550 | `handleTipCreate` | ✅ (Frontend uses `/api/tip/create` not bare `/api/tip`) |
| `/api/identity/link` | POST | 612 | `handleLinkIdentity` | ✅ |
| `/api/register-platform` | POST | 667 | `handleRegisterPlatform` | ✅ |
| `/api/shorts` | GET | 413 | `handleShortsFeed` | ✅ |
| `/api/trending/aggregated` | GET | 749 | `handleTrendingAggregated` | ✅ |
| `/api/feed/category/:category` | GET | 449 | `handleCategorySlugFeed` | ✅ |
| `/api/feed/mix` | GET | 452 | `handleCategoryMixFeed` | ✅ |
| `/api/sources/discover` | GET | 1268 | `handleSourcesDiscover` | ✅ |

### All 10 required API routes are registered and functional.

---

## 6. Known Issues & Fixes

### Active issues as of 2026-07-18

| Issue | File | Severity | Fix |
|-------|------|----------|-----|
| `@degenfeed/reputation` package missing | `workers/api/src/routes/reputation.ts:8` | 🔴 BLOCKING | Create package or inline the 3 imported functions |
| TS errors in governance (possibly undefined) | `workers/api/src/routes/governance.ts:79,255,256,334` | 🟡 MEDIUM | Add null checks / early returns for `proposal`, `votingPeriod` |
| TS errors in source-discovery (maybe undefined `after`) | `workers/api/src/routes/source-discovery.ts:162,163` | 🟡 MEDIUM | Add nullish coalescing for `cursor` param |
| `process` not defined in worker context | Multiple files | 🟡 MEDIUM | Replace `process.env.X` with `env.X` binding pattern |

### Check script

```bash
# TypeScript check (worker only)
npx tsc --noEmit --project workers/api/tsconfig.json

# Run integration tests
cd workers/api && npx vitest run

# Run frontend tests
cd apps/web && npx vitest run
```

---

## 7. Verification Process

Before declaring any cross-protocol feature "working":

1. **Check the route** is registered in `workers/api/src/app.ts`
2. **Check the handler** is exported from its route file
3. **Check the frontend** calls the correct endpoint path
4. **Check the import** chain has no TypeScript errors
5. **Verify with a manual curl test** against a local/CI worker instance

### Quick curl tests

```bash
# Compose
curl -X POST http://localhost:8787/api/publish \
  -H 'Content-Type: application/json' \
  -d '{"text":"test","targets":["farcaster"],"auth":{}}'

# Cross-reply
curl -X POST http://localhost:8787/api/cross-reply \
  -H 'Content-Type: application/json' \
  -d '{"parentPostUri":"df://farcaster:0xabc","parentProtocol":"farcaster","replyProtocol":"nostr","content":"cross-reply test","walletAddress":"0x..."}'

# Tip resolve
curl http://localhost:8787/api/tip/resolve?protocol=nostr\&authorId=npub1...

# Tip create
curl -X POST http://localhost:8787/api/tip/create \
  -H 'Content-Type: application/json' \
  -d '{"recipient":"0x...","recipientProtocol":"farcaster","method":"ethereum","amount":"0.001"}'

# Identity link
curl -X POST http://localhost:8787/api/identity/link \
  -H 'Content-Type: application/json' \
  -d '{"protocol":"farcaster","identity":{"fid":1,"username":"test"}}'
```
