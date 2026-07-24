// ── God code split: moved to register/ directory ─────────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under register/:
//   types.ts       — RegistrationPlatform, PlatformRegistration, RegisterOptions
//   farcaster.ts   — registerFarcaster (Base contract)
//   lens.ts        — registerLens (Polygon via Lens API)
//   bluesky.ts     — registerBluesky (AT Protocol)
//   mastodon.ts    — registerMastodon (Fediverse instance)
//   nostr.ts       — registerNostr (local key generation)
//   kv.ts          — platformAccountKey, getPlatformAccounts, persistPlatformAccount
//   invite-pool.ts — acquireInviteCode, returnInviteCode, addInviteCodesToPool
//   register.ts    — registerOnPlatform (unified public API)

export type { TransactionRequest } from './evm-utils';
export { privateKeyToAddress, signTransaction } from './evm-utils';
export {
  acquireInviteCode,
  addInviteCodesToPool,
  getBlueskyInvitePoolStats,
  returnInviteCode,
} from './register/invite-pool';
export { getPlatformAccounts, platformAccountKey, platformAccountsIndexKey } from './register/kv';
export { registerOnPlatform } from './register/register';
export type {
  PlatformRegistration,
  RegisterOptions,
  RegistrationPlatform,
  RegistrationStatus,
} from './register/types';
