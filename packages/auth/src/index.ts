// ─── @degenfeed/auth — barrel exports ──────────────────────────
export {
  signInWithNostrNsec,
  signInWithNostrExtension,
  signInWithNostrRemoteSigner,
} from './providers/nostr';
export { signInWithFarcaster, signInWithFarcasterSigner } from './providers/farcaster';
export { signInWithLens } from './providers/lens';
export { signInWithBluesky } from './providers/bluesky';
export { signInWithThreads } from './providers/threads';
export { signInWithGtS } from './providers/mastodon';
export { unlockIdentity, lockIdentity, forgetIdentity } from './session';
export { encryptSecret, decryptSecret } from './crypto';
export { buildIdentityRecord } from './persistence';
export {
  requestWalletNonce,
  buildSiweMessage,
  buildSolanaMessage,
  verifyWalletSignature,
} from './providers/wallet';
export type { WalletSession } from './providers/wallet';
export type { EncryptedBlob } from './crypto';
export type { StoredIdentity, ActiveSession } from '@degenfeed/storage';
