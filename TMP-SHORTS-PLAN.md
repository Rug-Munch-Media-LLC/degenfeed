# Shorts Aggregation System — Implementation Plan

## Overview
Build a complete short-form vertical video aggregation system with TikTok-style UI. The codebase already has YouTube + PeerTube fetchers in `@degenfeed/shorts-provider`, a basic `/api/shorts` endpoint, and a full TikTok-style page with `ShortVideoCard`. We need to add TikTok & Instagram Reels sources, a class-based aggregator, more API routes, and modular frontend components.

## Files to Create/Modify

### Backend (4 files)
1. `packages/shorts-provider/src/index.ts` — **MODIFY**: Add TikTok RSS + Instagram oEmbed fetchers
2. `workers/api/src/feed/shorts-aggregator.ts` — **CREATE**: Class-based ShortsAggregator  
3. `workers/api/src/routes/shorts.ts` — **MODIFY**: Add trending, for-you, source-filtered, create routes
4. `workers/api/src/app.ts` — **MODIFY**: Register new shorts API routes

### Frontend (10 files)
5. `apps/web/src/components/shorts/ShortsFeed.tsx` — **CREATE**: Vertical swipe container with auto-play
6. `apps/web/src/components/shorts/ShortsOverlay.tsx` — **CREATE**: Overlay with title/creator/actions
7. `apps/web/src/components/shorts/ShortsSourceBadge.tsx` — **CREATE**: Color-coded source badge
8. `apps/web/src/components/shorts/ShortsCreatorInfo.tsx` — **CREATE**: Creator avatar + handle
9. `apps/web/src/components/shorts/ShortsActions.tsx` — **CREATE**: Like, comment, tip, share buttons
10. `apps/web/src/components/shorts/ShortsProgress.tsx` — **CREATE**: Video progress bar
11. `apps/web/src/components/shorts/CreateShortModal.tsx` — **CREATE**: Upload short via PeerTube
12. `apps/web/src/components/shorts/useShorts.ts` — **CREATE**: SWR + infinite scroll hook
13. `apps/web/src/app/shorts/page.tsx` — **MODIFY**: Use new component modules

## Execution Order
1. Batch 1 (parallel): Backend files — TikTok/IG sources, aggregator, routes
2. Batch 2 (parallel): Frontend components
3. Batch 3: Wire page.tsx to use new components
