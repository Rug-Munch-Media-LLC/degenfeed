/**
 * Creator coin launch gate.
 *
 * Single boolean that controls whether the creator-coin system is shown
 * as "live" or "coming soon" in the frontend. The backend trade/deploy/
 * onchain routes stay functional regardless of this flag — this only
 * controls the UI gate.
 *
 * HOW TO FLIP:
 *   Set NEXT_PUBLIC_CREATOR_COIN_ENABLED=true in apps/web/.env.local
 *   (or the deployment environment) and rebuild the web app.
 *   Defaults to false → users see a "Coming Soon" gate instead of the
 *   trade/deploy UI.
 *
 * NOTE: NEXT_PUBLIC_* env vars are inlined at build time by Next.js, so
 * the flag is a build-time constant. This is intentional — a flip is a
 * deliberate deploy-time decision.
 */
export const CREATOR_COIN_ENABLED: boolean =
  process.env.NEXT_PUBLIC_CREATOR_COIN_ENABLED === 'true';
