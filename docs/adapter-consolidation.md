# Protocol Adapter Consolidation Plan

> **Date:** 2026-07-26
> **Author:** AI Architect
> **Status:** Draft for Review

---

## 1. Executive Summary

After thorough analysis of all 47 adapters across two packages, **only 1 protocol (WriteFreely) exists in both packages, and they are NOT duplicates** — they serve complementary but distinct concerns (inbound ingestion vs outbound publishing). This document recommends **Option B: keep separate packages but improve cross-references, extract shared utilities, and fill coverage gaps**.

**Key finding:** The perceived overlap is a naming coincidence, not code duplication.

---

## 2. Current State

### Package A: `@degenfeed/feed-providers` (28 adapters)

| Aspect | Detail |
|--------|--------|
| Location | `packages/feed-providers/src/adapters/` |
| Purpose | **Content ingestion (READ)** — fetch posts from external protocols |
| Interface | Each exports `fetch*Posts(): Promise<UnifiedPost[]>` |
| Depends on | `@degenfeed/types`, `@degenfeed/feed-core`, `@degenfeed/source-discovery` |
| Adapter size | Minimal (~100 lines), RSS/REST scraping, no SDKs |

#### Full adapter list:

| Protocol | File | Type | Category |
|----------|------|------|----------|
| bonfida | bonfida.ts | SNS resolution | Web3 Identity |
| coinvise | coinvise.ts | Creator economy | Web3 Creator |
| diaspora | diaspora.ts | ActivityPub/Diaspora | Fediverse |
| ens | ens.ts | ENS resolution | Web3 Identity |
| epicyon | epicyon.ts | ActivityPub | Fediverse |
| filecoin | filecoin.ts | Storage | Decentralized Storage |
| friendica | friendica.ts | ActivityPub | Fediverse |
| guppe | guppe.ts | ActivityPub groups | Fediverse |
| hubzilla | hubzilla.ts | ActivityPub/Zot | Fediverse |
| ion | ion.ts | DID resolution | Web3 Identity |
| juicebox | juicebox.ts | DAO treasury | DAO Tooling |
| keri | keri.ts | KERI identity | Web3 Identity |
| mintgate | mintgate.ts | Token-gating | Access Control |
| misskey | misskey.ts | ActivityPub (Misskey) | Fediverse |
| orbis | orbis.ts | Ceramic social | Web3 Social |
| pleroma | pleroma.ts | ActivityPub (Pleroma) | Fediverse |
| sia | sia.ts | Skynet storage | Decentralized Storage |
| snapshot | snapshot.ts | DAO voting | DAO Tooling |
| storj | storj.ts | Storage | Decentralized Storage |
| streams | streams.ts | Streams social | Web3 Social |
| swarm-eth | swarm-eth.ts | Swarm storage | Decentralized Storage |
| syndicate | syndicate.ts | DAO/onchain | DAO Tooling |
| tally | tally.ts | DAO voting | DAO Tooling |
| unlock | unlock.ts | Token-gating | Access Control |
| unstoppable | unstoppable.ts | UD resolution | Web3 Identity |
| veramo | veramo.ts | DID/Verifiable Credentials | Web3 Identity |
| writefreely | writefreely.ts | ActivityPub blog | Fediverse |

### Package B: `@degenfeed/cross-protocol-bridge` (19 adapters)

| Aspect | Detail |
|--------|--------|
| Location | `packages/cross-protocol-bridge/src/adapters/` |
| Purpose | **Content transformation/publishing (WRITE)** — convert `MasterPost` → protocol format |
| Interface | Each exports `PlatformAdapter` with `adapt()` + `preview()` |
| Depends on | `@degenfeed/types`, `@degenfeed/utils`, various SDKs (bluesky-sdk, farcaster-sdk, etc.) |
| Adapter size | Small (~50-100 lines), text transformation only, no networking |

#### Full adapter list:

| Protocol | File | Type | Category |
|----------|------|------|----------|
| bluesky | bluesky-adapter.ts | AT Protocol | Web3 Social |
| bookwyrm | bookwyrm-adapter.ts | ActivityPub books | Fediverse |
| castopod | castopod-adapter.ts | ActivityPub podcast | Fediverse |
| discord | discord-adapter.ts | Discord webhooks | Web2 Chat |
| farcaster | farcaster-adapter.ts | Farcaster | Web3 Social |
| funkwhale | funkwhale-adapter.ts | ActivityPub music | Fediverse |
| lemmy | lemmy-adapter.ts | ActivityPub links | Fediverse |
| lens | lens-adapter.ts | Lens Protocol | Web3 Social |
| mastodon | mastodon-adapter.ts | ActivityPub (Mastodon) | Fediverse |
| mobilizon | mobilizon-adapter.ts | ActivityPub events | Fediverse |
| nostr | nostr-adapter.ts | Nostr | Web3 Social |
| peertube | peertube-adapter.ts | ActivityPub video | Fediverse |
| pixelfed | pixelfed-adapter.ts | ActivityPub images | Fediverse |
| reddit | reddit-adapter.ts | Reddit API | Web2 Social |
| telegram | telegram-adapter.ts | Telegram API | Web2 Chat |
| threads | threads-adapter.ts | Threads/Bridgy Fed | Web2 Social |
| writefreely | writefreely-adapter.ts | ActivityPub blog | Fediverse |

---

## 3. Overlap Analysis

### Exact Protocol Overlaps

| Protocol | feed-providers (READ) | cross-protocol-bridge (WRITE) | Truly Duplicate? |
|----------|---------------------|------------------------------|:----------------:|
| **writefreely** | fetchWriteFreelyPosts() from blog RSS/REST → UnifiedPost[] | adapt(MasterPost) → WriteFreely publish params | **NO** |

The WriteFreely adapters:
- **feed-providers**: Reads blog posts from curated WriteFreely instances via REST API and RSS fallback. Returns `UnifiedPost[]` for the feed pipeline. Contains hardcoded blog list, niche guessing, RSS XML parsing.
- **cross-protocol-bridge**: Transforms a `MasterPost` into WriteFreely-compatible publish parameters (title extraction, Markdown formatting, media embedding). No networking — purely data transformation.

**Verdict:** These are **not duplicates**. They are the READ and WRITE sides of the same protocol. Merging them into a single file would increase coupling and violate separation of concerns (ingestion pipeline ≠ publishing pipeline).

### Ecosystem Overlaps (ActivityPub)

Both packages implement ActivityPub adapters, but for **different platform instances** within the same protocol family:

| feed-providers (READ) | cross-protocol-bridge (WRITE) |
|----------------------|------------------------------|
| diaspora, epicyon, friendica, hubzilla, misskey, pleroma, writefreely, guppe | mastodon, pixelfed, writefreely, bookwyrm, peertube, lemmy, funkwhale, mobilizon, castopod |

These are **different implementations** of ActivityPub — they each have unique APIs, features, and content shapes. They are not duplicates of each other. However, they share common patterns (HTML stripping, `.acct` parsing, content-type detection) that **could be consolidated into shared utilities**.

### Pattern: Shared utility code (NOT adapters)

Both packages independently implement:
- **`stripHtml()`** — identical HTML tag stripping (diaspora.ts, misskey.ts, pleroma.ts, friendica.ts, epicyon.ts, hubzilla.ts, writefreely.ts)
- **`guessNiches()`** — keyword-based niche classification with near-identical regex patterns (writefreely.ts, diaspora.ts, friendica.ts, pleroma.ts, etc.)
- **`parseRssItems()`** — RSS item extraction (writefreely.ts, diaspora.ts, friendica.ts)
- **`truncateText()`** — text truncation (cross-protocol-bridge has this as `truncateText` in types.ts)

---

## 4. Consolidation Plan

### Recommendation: Option B — Keep Separate, Cross-Reference, Extract Shared Utilities

**Rationale:**

1. **Different concerns**: feed-providers = **inbound** content ingestion → feed pipeline. cross-protocol-bridge = **outbound** content transformation → publishing pipeline. These operate at different layers and serve different consumers.

2. **Different dependency profiles**: feed-providers depends on `feed-core`, `source-discovery`, and uses lightweight HTTP fetching. cross-protocol-bridge depends on platform SDKs and focuses on text transformation.

3. **Different interfaces**: feed-providers exports `fetch*Posts(): Promise<UnifiedPost[]>`. cross-protocol-bridge exports `PlatformAdapter { adapt(), preview() }`.

4. **Single true overlap** (writefreely) is complementary, not duplicate. Merging would create a confusing "fetch AND transform" hybrid.

5. **Merging all adapters into a shared package** (Option A) would create a dependency nightmare — both the feed pipeline and the publishing pipeline would depend on a giant package containing concerns they don't need. It would also make tree-shaking more difficult.

### What We WILL Do (Actionable Steps)

#### Step 1: Extract Shared Utilities → `@degenfeed/utils`

Move duplicate utility functions into `@degenfeed/utils` (which cross-protocol-bridge already depends on):

- **`stripHtml(html: string): string`** — currently duplicated across 7+ adapters
- **`guessNiches(text: string, title?: string): string[]`** — currently in writefreely.ts + diaspora.ts + friendica.ts + pleroma.ts (with minor variations)
- **`parseRssItems(xml: string): RssItem[]`** — currently in writefreely.ts + diaspora.ts + friendica.ts
- **`encodeXmlEntities(text: string): string`** — needed by RSS adapters

These are pure functions with no network or protocol dependencies. Consolidating them eliminates ~150 lines of duplicated code across 7+ files.

*Effort: ~2 hours — move + add re-exports + update imports*

#### Step 2: Create Protocol Metadata Registry → `@degenfeed/types`

`@degenfeed/types` already has the `Protocol` union type and `PLATFORM_TIER_WEIGHTS`. Extend it with shared protocol metadata that both packages can use:

```typescript
// packages/types/src/protocols.ts
export interface ProtocolMeta {
  id: Protocol;
  label: string;
  category: 'fediverse' | 'web3-social' | 'web2-social' | 'identity' | 'storage' | 'dao' | 'chat' | 'video';
  hasReadAdapter: boolean;  // exists in feed-providers
  hasWriteAdapter: boolean; // exists in cross-protocol-bridge
}
```

This gives the monorepo a single source of truth for which protocols have read/write/both support, making gaps obvious and preventing future confusion.

*Effort: ~1 hour — add type + data*

#### Step 3: Document Adapter Ownership

Add README files to both adapter directories:

- `packages/feed-providers/src/adapters/README.md`
- `packages/cross-protocol-bridge/src/adapters/README.md`

Each README explains the package's purpose, interface conventions, and **cross-references the other package** when a protocol has both a read and write adapter.

Also add a comment block at the top of `writefreely.ts` and `writefreely-adapter.ts` cross-referencing each other:

```typescript
/**
 * @see cross-protocol-bridge/src/adapters/writefreely-adapter.ts
 * for the WRITE-side (publishing) adapter.
 */
```

*Effort: ~1 hour — documentation only*

#### Step 4: Fill Coverage Gaps (Future)

The current state reveals several gaps where a protocol has only one direction implemented. These are low-priority but worth tracking:

| Protocol | READ (feed-providers) | WRITE (cross-protocol-bridge) | Gap |
|----------|:--------------------:|:-----------------------------:|:---:|
| WriteFreely | ✅ | ✅ | None |
| Nostr | ❌ (missing) | ✅ | Missing READ |
| Farcaster | ❌ (missing) | ✅ | Missing READ |
| Bluesky | ❌ (missing) | ✅ | Missing READ |
| Lens | ❌ (missing) | ✅ | Missing READ |
| Diaspora | ✅ | ❌ (missing) | Missing WRITE |
| Friendica | ✅ | ❌ (missing) | Missing WRITE |
| Misskey | ✅ | ❌ (missing) | Missing WRITE |
| Pleroma | ✅ | ❌ (missing) | Missing WRITE |
| Snapshot | ✅ | ❌ (missing) | Missing WRITE |

Note: feed-providers actually does use full `*Provider` classes for Nostr, Farcaster, Bluesky, Lens, Mastodon, etc. (see its `src/index.ts` — these are in `src/providers/`, not `src/adapters/`). The "adapters" directory specifically holds the lightweight/minimal fetchers. So the READ coverage is broader than the adapter directory suggests.

*Effort: Tracked as separate feature work, not part of this consolidation.*

---

## 5. Migration Path

```
Phase 1 (Week 1) — Shared Utilities
├── Extract stripHtml() → @degenfeed/utils
├── Extract guessNiches() → @degenfeed/utils  
├── Extract parseRssItems() → @degenfeed/utils
├── Update 7+ adapter imports
└── Verify: yarn lint && yarn typecheck && yarn test

Phase 2 (Week 1-2) — Protocol Metadata
├── Add ProtocolMeta type to @degenfeed/types
├── Populate registry with all 47+ protocols
├── Cross-reference in both packages
└── Verify: yarn typecheck

Phase 3 (Week 2) — Documentation
├── Add README.md in both adapter directories
├── Add JSDoc cross-references (@see tags)
├── Update adapter-consolidation.md with implementation results
└── Verify: review renders correctly

Phase 4 (Future) — Coverage Gaps
└── File issues for missing READ/WRITE adapters
```

---

## 6. Impact Analysis

| Dimension | Impact |
|-----------|--------|
| **Packages affected** | `@degenfeed/feed-providers`, `@degenfeed/cross-protocol-bridge`, `@degenfeed/utils`, `@degenfeed/types` |
| **Breaking changes** | Minor — moving `stripHtml()`, `guessNiches()`, `parseRssItems()` from adapter files to `@degenfeed/utils` requires import updates in 7+ files. The function signatures remain identical. |
| **Public API changes** | None — these functions were internal to the adapter files (not exported from package index). Adding to utils is additive only. |
| **Test impact** | Existing adapter tests may need import adjustments. Shared utilities gain their own test suite. |
| **Bundle size** | Slight reduction — shared utilities are imported once instead of duplicated across files. |
| **Dependency graph** | No new cross-package deps added (cross-protocol-bridge already depends on `@degenfeed/utils`; feed-providers adds it). |

---

## 7. Detailed Adapter Comparison (writefreely as Case Study)

To illustrate why these are NOT duplicates:

### feed-providers `writefreely.ts` (174 lines)
```typescript
// INTERFACE
export async function fetchWriteFreelyPosts(limit = 10): Promise<UnifiedPost[]>

// INTERNAL LOGIC
- Hardcoded CURATED_BLOGS list
- HTTP fetch from REST API + RSS fallback
- XML RSS parsing (parseRssItems)
- HTML stripping (stripHtml)
- Content niche classification (guessNiches)
- Builds full UnifiedPost with author identity, embeds, metrics
```

### cross-protocol-bridge `writefreely-adapter.ts` (64 lines)
```typescript
// INTERFACE
export const writefreelyAdapter: PlatformAdapter = {
  protocol: 'writefreely',
  adapt(master: MasterPost): ProtocolPublishParams,
  preview(master: MasterPost): string,
}

// INTERNAL LOGIC
- No networking
- No fetching
- Title extraction from MasterPost
- Hashtag formatting
- Media-to-Markdown conversion
- Character limit enforcement
```

**These share:**
- The string `'writefreely'` as a protocol identifier
- General awareness of WriteFreely's blogging model

**These do NOT share:**
- Any code logic (zero line overlap)
- Any imported types (UnifiedPost vs MasterPost/ProtocolPublishParams)
- Any exported functions
- Any dependencies

---

## 8. Appendix: Missing READ Coverage in feed-providers

The feed-providers package has two levels of ingestion:

1. **`src/adapters/`** (28 files) — lightweight/minimal fetchers for niche protocols
2. **`src/providers/`** — full `FeedProvider` implementations for major protocols (Nostr, Farcaster, Bluesky, Lens, Mastodon, Reddit, etc.)

The cross-protocol-bridge missing READ side is largely already handled by the providers directory. The adapter directory specifically targets protocols without full SDK support or those needing only basic RSS/REST scraping. This design is intentional and should be preserved.

---

## 9. Effort Estimate

| Task | Hours | Who |
|------|-------|-----|
| Extract shared utilities | 2 | 1 backend dev |
| Add protocol metadata registry | 1 | 1 backend dev |
| Write READMEs + JSDoc cross-refs | 1 | 1 dev |
| Update imports across 7+ files | 1 | 1 dev |
| Update tests | 1 | 1 dev |
| **Total** | **6 hours** | — |

No breaking changes to consumer APIs. The cross-protocol-bridge adapter interfaces (`PlatformAdapter`, `adapt()`, `preview()`) remain stable. The feed-providers adapter interfaces (`fetch*Posts()`) remain stable.
