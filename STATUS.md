# DegenFeed Web — Status

> Last updated: 2026-07-07

## Summary
Follow-up cleanup: replaced `alert()` with a `ToastProvider` in `AuthProvider`, made the `/twitter` notification bell show for any signed-in user (not just wallet), wired the Mastodon → Nostr bridge into both the inline `TwitterComposer` and the global `ComposeModal` via a new `lib/nostr` helper that signs locally with the saved Nostr key, added a `/api/preferences` endpoint backed by KV so `hideLowQuality` persists across devices, and wrote unit tests for the preferences sanitizer.

`make ci` and `make security` pass.

## Current Sprint
Rebuild DegenFeed Web into a usable web3-first social aggregator (TODO.md #1–15).

## Completed This Session
- `apps/web/src/components/Toast.tsx` — toast provider + viewport (success/error/warning), auto-dismiss
- `apps/web/src/app/layout.tsx` — wired `ToastProvider` around `AuthProvider`
- `apps/web/src/components/AuthProvider.tsx` — replaced `alert()` with toast, added `signOut` toast, added `nostrPublicId` to context
- `apps/web/src/app/twitter/page.tsx` — bell+sign-out now gated on `hasSignedIn`, not `walletAddress`
- `apps/web/src/components/TwitterComposer.tsx` — added Mastodon→Nostr bridge toggle + state
- `apps/web/src/lib/nostr.ts` — new client-side Nostr publisher that reads saved nsec from `keys._secret` and publishes to relays
- `packages/ui/src/ComposeModal.tsx` — same bridge toggle; `nostrBridgePublicId` + `onNostrBridge` props
- `workers/api/src/routes/preferences.ts` — new GET/POST `/api/preferences` route, requires session
- `apps/web/src/app/twitter/page.tsx` — `hideLowQuality` toggle now persists to backend KV in addition to localStorage
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
