# Deepwork: Creator Coin Community Features

## Phases & Order

1. **Phase 1: Backend coin-reputation lib** — `workers/api/src/lib/coin-reputation.ts`
2. **Phase 2: Backend coin-activity route** — `workers/api/src/routes/coin-activity.ts`
3. **Phase 3: Backend coin-challenges route** — `workers/api/src/routes/coin-challenges.ts`
4. **Phase 4: Frontend CoinActivityFeed** — `apps/web/src/components/creator-coin/CoinActivityFeed.tsx`
5. **Phase 5: Frontend BondingCurveChart (interactive)** — Rewrite existing component
6. **Phase 6: Frontend TokenPerks** — `apps/web/src/components/creator-coin/TokenPerks.tsx`
7. **Phase 7: Integration** — Update coin detail page and community page

## Oracle Reviews
- After Phase 3 (all backend done)
- After Phase 6 (all frontend components done)
- After Phase 7 (integration complete)

## Files to Create
- workers/api/src/lib/coin-reputation.ts
- workers/api/src/routes/coin-activity.ts
- workers/api/src/routes/coin-challenges.ts
- apps/web/src/components/creator-coin/CoinActivityFeed.tsx
- apps/web/src/components/creator-coin/BondingCurveChart.tsx (rewrite)
- apps/web/src/components/creator-coin/TokenPerks.tsx

## Files to Modify
- workers/api/src/app.ts (register new routes)
- apps/web/src/app/coins/[symbol]/page.tsx (integrate new components)
- apps/web/src/app/coins/[symbol]/community/page.tsx (add reputation/leaderboard)
