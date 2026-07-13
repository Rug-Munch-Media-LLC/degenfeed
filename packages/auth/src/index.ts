// ─── @degenfeed/auth — barrel exports ──────────────────────────

export type { ActiveSession, StoredIdentity } from '@degenfeed/storage';
export type { EncryptedBlob } from './crypto';
export { decryptSecret, encryptSecret } from './crypto';
export { buildIdentityRecord } from './persistence';
export { refreshBlueskySession, signInWithBluesky } from './providers/bluesky';
export { signInWithFarcaster, signInWithFarcasterSigner } from './providers/farcaster';
export { refreshLensSession, signInWithLens } from './providers/lens';
export { signInWithGtS } from './providers/mastodon';
export {
  signInWithNostrExtension,
  signInWithNostrNsec,
  signInWithNostrRemoteSigner,
} from './providers/nostr';
export { handleRedditCallback, signInWithReddit } from './providers/reddit';
export { handleThreadsCallback, signInWithThreads } from './providers/threads';
export type { WalletSession } from './providers/wallet';
export {
  buildSiweMessage,
  buildSolanaMessage,
  requestWalletNonce,
  verifyWalletSignature,
} from './providers/wallet';
export { forgetIdentity, lockIdentity, refreshSessionIfNeeded, unlockIdentity } from './session';
