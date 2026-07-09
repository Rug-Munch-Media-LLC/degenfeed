# DegenFeed Web — Status

> Last audited: July 9, 2026 — see ROADMAP.md for current status
> Last updated: 2026-07-07

## Deployment

The app runs on **Talos:3100** (Next.js standalone, proxied by nginx). It is NOT deployed to Cloudflare Pages. The `workers/api` component (Cloudflare Worker) provides the `/api/` backend.

## Summary
Follow-up cleanup: replaced `alert()` with a `ToastProvider` in `AuthProvider`, made the `/feed` notification bell show for any signed-in user (not just wallet), wired the Mastodon → Nostr bridge into the inline `FeedComposer` via a new `lib/nostr` helper that signs locally with the saved Nostr key, added a `/api/preferences` endpoint backed by KV so `hideLowQuality` persists across devices, and wrote unit tests for the preferences sanitizer.

`ComposeModal.tsx` exists in `packages/ui/` but is NOT fully wired into the feed page — the feed uses `FeedComposer` as the inline composer. The global ComposeModal integration is pending.

`make ci` and `make security` pass.

## Current Sprint
Rebuild DegenFeed Web into a usable web3-first social aggregator (TODO.md #1–15).

## Completed This Session
- `apps/web/src/components/Toast.tsx` — toast provider + viewport (success/error/warning), auto-dismiss
- `apps/web/src/app/layout.tsx` — wired `ToastProvider` around `AuthProvider`
- `apps/web/src/components/AuthProvider.tsx` — replaced `alert()` with toast, added `signOut` toast, added `nostrPublicId` to context
- `apps/web/src/app/feed/page.tsx` — notification bell + sign-out gated on `hasSignedIn`, not `walletAddress`; landing page at `/` redirects to `/feed`
- `apps/web/src/components/FeedComposer.tsx` — added Mastodon→Nostr bridge toggle + state
- `apps/web/src/lib/nostr.ts` — new client-side Nostr publisher that decrypts saved nsec with `auto-unlock-passphrase` and publishes to relays
- `packages/ui/src/ComposeModal.tsx` — bridge toggle scaffolding; `nostrBridgePublicId` + `onNostrBridge` props (exists, NOT yet wired into the feed page)
- `workers/api/src/routes/preferences.ts` — new GET/POST `/api/preferences` route, requires session
- `apps/web/src/app/feed/page.tsx` — `hideLowQuality` toggle now persists to backend KV in addition to localStorage
- `workers/api/src/__tests__/preferences.test.ts` — 5 endpoint tests
- `workers/api/src/__tests__/preferences.sanitize.test.ts` — 6 unit tests for the sanitizer
- `workers/api/src/routes/preferences.ts` — sanitizer now lowercases+trims niches (caught by tests)

## Quality Gates
- `make check` ✅
- `make ci` ✅ (lint, typecheck, test, build)
- `make security` ✅ (gitleaks)

## Next
1. Mobile bottom-nav (#12) and search overlay (#14) — quick UI wins.
2. Status page (#13) — surface `/api/feed/health`.
3. Tune `hideLowQuality` threshold and relevance filter for non-crypto users.
4. Newsletter cron + email delivery (#15).

## Blocked
None.
