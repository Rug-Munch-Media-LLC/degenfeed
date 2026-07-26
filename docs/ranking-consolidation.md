# Feed Ranking Engine Consolidation

> **Date:** 2026-07-26  
> **Author:** AI Architect (automated survey)  
> **Status:** Design Proposal — Implementation Ready

---

## 1. Executive Summary

The monorepo currently has **3 separate scoring/ranking implementations** spanning 2 packages, with **duplicate files containing identical logic** and **multiple quality-score versions (v2, v3, v4)** all exported simultaneously. Production uses a mix of imports from both packages, creating maintenance burden and the risk of inconsistent behavior.

**Total dead/duplicate code to eliminate: ~11 files, ~3,800+ lines.**

---

## 2. Current State

### 2.1 Complete File Inventory

#### `@degenfeed/feed-core` (packages/feed-core)

| File | Lines | What It Does | Status |
|------|-------|-------------|--------|
| `src/algorithm.ts` | 862 | Class-based FeedAlgorithm — 5 pluggable scorers (recency, popularity, relevance, niche, protocol). Marked `@deprecated` in its own header. | **DEPRECATED** — zero production consumers |
| `src/quality.ts` | 314 | Quality scoring V2: `computeQualityScore()` 0-100, engagement density, author quality, uniqueness, Jaccard similarity | **ACTIVE** — used by `ranking/` packages |
| `src/quality-v3.ts` | 615 | Quality V3: engagement velocity, creator quality, source diversity, freshness, evergreen, language quality, protocol multipliers | **ACTIVE** — used by feed-quality-dashboard.ts |
| `src/quality-v4.ts` | 340 | Quality V4: sigmoid freshness, source diversity, cross-protocol boost, creator reputation, preference alignment | **UNUSED** — test file only; no production imports |
| `src/quality-presets.ts` | 312 | Protocol quality presets/ filters for feed content (minEngagement, hideLinkOnly, etc.) | **ACTIVE** — used by feed-scorer.ts + routes |
| `src/protocol-quality.ts` | 359 | Per-protocol quality scoring (Farcaster, Lens, Bluesky etc.) — additive points per protocol | **ACTIVE** — used by feed-scorer.ts |
| `src/ranking/index.ts` | 444 | **DUPLICATE** of ranking/src/index.ts's `scoreBreakdownV2()`, `rankV2()`, `rankDiverse()` — identical logic, different import path | **DUPLICATE** — used by feed-scorer.ts |
| `src/ranking/scorer.ts` | 211 | **DUPLICATE** of ranking/src/scorer.ts — `computeQualitySignals()`, `computeAuthorReputation()`, `checkDiversity()` | **DUPLICATE** — identical copy |

#### `@degenfeed/ranking` (packages/ranking)

| File | Lines | What It Does | Status |
|------|-------|-------------|--------|
| `src/unified-scorer.ts` | 665 | **PRIMARY ENGINE**: `scorePost()` — 8-factor weighted sum. Replaces FeedAlgorithm + scoreBreakdownV2. Mode presets, freshness boosts, personalization. | **ACTIVE** — used by feed-scorer.ts, feed-explainer, custom-feed, for-you |
| `src/scorer.ts` | 211 | `computeQualitySignals()`, `computeAuthorReputation()`, `checkDiversity()` | **ACTIVE** — used by unified-scorer.ts + index.ts |
| `src/feed-algorithm-v2.ts` | 321 | V2 orchestrator: wraps `scorePost()` + qualityV2 + userAlgoV2 + protocolAlgo + antiGaming | **DEAD** — no production imports (test-only) |
| `src/quality-v2.ts` | 501 | Quality V2 signals (engagement rate, text quality, media quality, etc.) | **DEAD** — only used by feed-algorithm-v2 (dead) |
| `src/user-algo-v2.ts` | ~400 | User personalization V2 (interests, temporal, format, discovery injection) | **DEAD** — only used by feed-algorithm-v2 (dead) |
| `src/protocol-algo.ts` | 443 | Protocol-specific scorer (Nostr, Farcaster, Bluesky, Mastodon, PeerTube) | **DEAD** — only used by feed-algorithm-v2 (dead) |
| `src/anti-gaming.ts` | 481 | Anti-gaming detection (engagement farms, bots, spam, sybils) | **DEAD** — only used by feed-algorithm-v2 (dead) |
| `src/transparency.ts` | 446 | "Why This Post?" builder, score breakdown UI, A/B testing | **DEAD** — only used by feed-algorithm-v2 (dead) |
| `src/video-scorer.ts` | ~300 | Video-specific scoring | **ACTIVE** — used by video-discovery.ts |
| `src/index.ts` | 630 | Barrel — re-exports unified-scorer + has its own `scoreBreakdownV2()`/`rankV2()`/`rankDiverse()` | Has duplicate `rankV2`/`rankDiverse` |

#### `@degenfeed/feed-providers` (packages/feed-providers)

| File | Concern |
|------|---------|
| `src/source-discovery/quality.ts` | **SOURCE DISCOVERY** — not post ranking. Scores RSS/channel sources for discovery. Stays. |
| `src/providers/rss/quality.ts` | **RSS QUALITY** — RSS-specific quality signals for the RSS provider. Stays. |
| `src/providers/mastodon-data.ts` | **RELEVANCE FILTER** — `scoreFediverseRelevance()` for crypto/tech relevance. Stays. |

### 2.2 Duplication Map

```
packages/feed-core/src/ranking/index.ts  ─── identical code ───  packages/ranking/src/index.ts
  (scoreBreakdownV2, rankV2, rankDiverse)                         (scoreBreakdownV2, rankV2, rankDiverse)

packages/feed-core/src/ranking/scorer.ts  ─── identical code ───  packages/ranking/src/scorer.ts
  (computeQualitySignals, computeAuthorReputation, etc.)           (computeQualitySignals, computeAuthorReputation, etc.)
```

Note: Even the `PLATFORM_TIER`, `RECENCY_HALF_LIFE_HOURS`, and `WEIGHTS_V2` constants are duplicated.

### 2.3 Quality Version Proliferation

```
quality.ts (v2) ← active, used by ranking/
quality-v3.ts    ← active, used by feed-quality-dashboard  
quality-v4.ts    ← unused, test file only
```

Three parallel quality systems with overlapping concerns. V3 uses a 0-100 composite; V2 uses 0-100; V4 uses 0-10. All normalize differently.

### 2.4 Production Import Flow (Trace)

```
workers/api/src/feed/feed-scorer.ts
  ├── from @degenfeed/feed-core → scoreBreakdownV2, rankDiverse  ← FEED-CORE'S DUPLICATE
  └── from @degenfeed/ranking   → scorePost (unified-scorer)     ← PRIMARY ENGINE

workers/api/src/feed/feed-quality-dashboard.ts
  └── from @degenfeed/feed-core → scoreQualityV3                 ← V3 quality

workers/api/src/routes/for-you.ts
  └── from @degenfeed/ranking   → scorePost                      ← PRIMARY ENGINE

workers/api/src/routes/custom-feed.ts
  └── from @degenfeed/ranking   → scorePost                      ← PRIMARY ENGINE

workers/api/src/lib/feed-explainer.ts
  └── from @degenfeed/ranking   → scorePost                      ← PRIMARY ENGINE

workers/api/src/feed/video-discovery.ts
  └── from @degenfeed/ranking   → VideoScoreEngine               ← Video scorer
```

**Critical inconsistency:** `feed-scorer.ts` uses `scoreBreakdownV2()` from **feed-core** for ranking context, but also uses `scorePost()` from **ranking** for individual scoring. These are different scoring algorithms.

---

## 3. Target Architecture

### 3.1 Single Pipeline

```
Raw Posts
    │
    ▼
┌─────────────────────────────┐
│ 1. Quality Scoring           │ ← unified-scorer.ts (scorePost)
│    • computeQualityScore()   │   from @degenfeed/feed-core/quality.ts (v2)
│    • scorePost()             │   8-factor weighted sum
│    • transparency reasons    │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ 2. Quality Dashboard Signal  │ ← use quality-v3.ts ONLY for
│    • scoreQualityV3()        │   quality-dashboard reporting
│    (non-blocking, enrichment)│   (not for ranking score)
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ 3. Diversity / Interleave   │ ← scorer.ts (checkDiversity,
│    • rankDiverse()           │   interleaveByProtocol)
│    • checkDiversity()        │   SINGLE copy in ranking/src/
│    • interleaveByProtocol()  │
└─────────────────────────────┘
    │
    ▼
  Ranked Feed
```

### 3.2 Module Responsibility

| Layer | Owner Package | Key Function | Consumer |
|-------|--------------|-------------|----------|
| **Base Quality** | `@degenfeed/feed-core` | `computeQualityScore()` (quality.ts) | Used by scoring engine |
| **Unified Scoring** | `@degenfeed/ranking` | `scorePost()` (unified-scorer.ts) | Direct API route consumption |
| **Protocol Quality** | `@degenfeed/feed-core` | `computeProtocolQuality()` (protocol-quality.ts) | Feed enricher/UI badges |
| **Quality Presets** | `@degenfeed/feed-core` | `resolvePreset()`, `applyQualityFilters()` (quality-presets.ts) | Pre-filtering |
| **Quality Dashboard** | `@degenfeed/feed-core` | `scoreQualityV3()` (quality-v3.ts) | Quality dashboard only |
| **Diversity/Ranking** | `@degenfeed/ranking` | `rankDiverse()`, `checkDiversity()` | Final feed assembly |
| **Video Scoring** | `@degenfeed/ranking` | `VideoScoreEngine` (video-scorer.ts) | Video feed |

---

## 4. What to Keep (Primary Engine)

**CHAMPION: `unified-scorer.ts` → `scorePost()`** in `@degenfeed/ranking`

**Reasons:**
1. **Designed as the replacement** — its header explicitly states it "merges three competing scoring systems into ONE function" and directs callers to "Use `scorePost()` instead of the old scoring functions."
2. **Already the production primary** — used by 4+ routes/workers (feed-scorer, feed-explainer, custom-feed, for-you)
3. **Most comprehensive** — 8-factor weighted system with mode presets, quality multiplier, dwell/feedback personalization, and full transparency output
4. **Extensible** — `ScorePostOptions` accepts all the context needed without requiring a separate pipeline

**KEEP from feed-core:**
- `quality.ts` (v2) — `computeQualityScore()` is the quality sub-system used by `scorePost()`
- `quality-v3.ts` — keep for quality dashboard reporting but mark as `@deprecated` for ranking
- `quality-presets.ts` — pre-filtering layer, not ranking
- `protocol-quality.ts` — protocol-specific quality badges, not ranking
- All helpers: `detectContentType`, `keywordRelevance`, `BOOST_TERMS`, etc.

---

## 5. What to Deprecate / Delete

### 5.1 Immediate Deletions (dead code)

| File | Lines | Reason |
|------|-------|--------|
| `packages/ranking/src/feed-algorithm-v2.ts` | 321 | Zero production imports. Only consumed by its own tests. |
| `packages/ranking/src/quality-v2.ts` | 501 | Only used by dead feed-algorithm-v2 |
| `packages/ranking/src/user-algo-v2.ts` | ~400 | Only used by dead feed-algorithm-v2 |
| `packages/ranking/src/protocol-algo.ts` | 443 | Only used by dead feed-algorithm-v2 |
| `packages/ranking/src/anti-gaming.ts` | 481 | Only used by dead feed-algorithm-v2 |
| `packages/ranking/src/transparency.ts` | 446 | Only used by dead feed-algorithm-v2 |
| `packages/feed-core/src/quality-v4.ts` | 340 | No production imports; only test file usage |

**Subtotal: ~7 files, ~2,932 lines**

### 5.2 De-duplication (merge, then delete)

| File | Action |
|------|--------|
| `packages/feed-core/src/ranking/index.ts` | **DELETE** after migrating feed-scorer.ts to use `@degenfeed/ranking`'s version |
| `packages/feed-core/src/ranking/scorer.ts` | **DELETE** after migrating feed-scorer.ts to use `@degenfeed/ranking`'s version |

**Subtotal: 2 files, ~655 lines**

### 5.3 Deprecation (keep but mark)

| File | Action |
|------|--------|
| `packages/feed-core/src/algorithm.ts` | Already deprecated; add explicit `@obsolete` + remove from barrel exports |
| `packages/feed-core/src/quality-v3.ts` | Keep for dashboard, add `@deprecated` note: "use scoreQualityV3 only for dashboard — do not use for ranking" |

### 5.4 Export Cleanup

Remove from `packages/feed-core/src/index.ts`:
- `FeedAlgorithm`, `AlgorithmAuditLog`, `globalAuditLog` — already deprecated
- `scoreRecency`, `scorePopularity`, `scoreNiche`, `scoreProtocol` — helper scorers for dead FeedAlgorithm
- `scoreQualityV4`, `sigmoidFreshness`, `sourceDiversity`, etc. — unused V4

Remove from `packages/ranking/src/index.ts`:
- The duplicate `scoreBreakdownV2()`, `rankV2()`, `rankDiverse()` — keep single source in `feed-core/ranking/` for now (that's the production one); actually, keep `rankDiverse` and delete the duplicate `scoreBreakdownV2`

---

## 6. Migration Path

### Phase 1: Clean Dead Code
1. Delete `feed-algorithm-v2.ts`, `quality-v2.ts`, `user-algo-v2.ts`, `protocol-algo.ts`, `anti-gaming.ts`, `transparency.ts` from `packages/ranking/src/`
2. Delete `quality-v4.ts` from `packages/feed-core/src/`
3. Remove dead exports from both barrel `index.ts` files
4. Update `packages/ranking/src/index.ts` to remove all V2 orchestrator exports

### Phase 2: De-duplicate Scoring
1. Move `feed-core/ranking/scorer.ts` consumers to `ranking/scorer.ts` (they're identical)
2. Update `feed-scorer.ts` to import `scoreBreakdownV2` and `rankDiverse` from `@degenfeed/ranking` instead of `@degenfeed/feed-core`
3. Delete `packages/feed-core/src/ranking/` directory

### Phase 3: Unify Scoring Pipeline
1. Replace `scoreBreakdownV2()` call in `feed-scorer.ts` with `scorePost()` — both produce a `ScoreBreakdown`, but only one true pipeline should exist
2. Migrate the ranking context construction to use `scorePost()` options
3. `rankDiverse()` can remain as the diversity ranker (it calls `scoreBreakdownV2` internally — update to call `scorePost` instead)

### Phase 4: Mark Deprecated
1. Add `@deprecated` to `algorithm.ts` (already done) and `quality-v3.ts` (for ranking use only)
2. Remove `FeedAlgorithm` class from barrel exports

---

## 7. File Count Summary

| Category | Files | Lines |
|----------|-------|-------|
| **Delete (dead code)** | 7 | ~2,932 |
| **Delete (duplicates)** | 2 | ~655 |
| **Mark deprecated** | 2 | ~1,477 (stay) |
| **Keep** | 8 | ~3,081 |
| **Total eliminated** | **9** | **~3,587** |

### Files Remaining After Consolidation

**`@degenfeed/ranking` package:**
- `unified-scorer.ts` (665 lines) — PRIMARY ENGINE
- `scorer.ts` (211 lines) — quality signals + diversity
- `video-scorer.ts` (~300 lines) — video scoring
- `index.ts` (reduced) — clean barrel

**`@degenfeed/feed-core` package (quality layer):**
- `quality.ts` (314 lines) — quality scoring v2
- `quality-v3.ts` (615 lines) — quality dashboard only
- `quality-presets.ts` (312 lines) — presets/filters
- `protocol-quality.ts` (359 lines) — protocol badges

---

## 8. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `scoreBreakdownV2()` and `scorePost()` produce slightly different scores | After Phase 3, `scorePost()` becomes the single source; A/B test in staging first |
| `rankDiverse()` depends on `scoreBreakdownV2()` | Update `rankDiverse()` to accept a user-supplied score function, or wrap `scorePost()` |
| Quality dashboard relies on V3 signals | Keep `quality-v3.ts`; it's a reporting concern not a ranking concern |
| Test files reference deleted modules | Move critical test assertions to remaining modules; delete the rest with the code |
