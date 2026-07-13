/**
 * @degenfeed/auth
 *
 * All sign-in methods. Each method returns a StoredIdentity that the
 * caller persists via @degenfeed/storage. The auth layer is responsible
 * for encryption-at-rest (AES-GCM with PBKDF2 key derivation).
 *
 * Threat model summary:
 *   - Keys never leave the browser in plaintext.
 *   - The user chooses a passphrase; we never see it.
 *   - The passphrase is held in memory only.
 *   - Encrypted blobs go to IndexedDB via @degenfeed/storage.
 *   - The "active session" is also memory-only.
 */

import { type StoredIdentity, saveIdentity } from '@degenfeed/storage';
import { buildIdentityRecord } from '../persistence';

// ─── 1. Nostr sign-in ───────────────────────────────────────────────────

/**
 * Sign in with a Nostr nsec.
 */
export async function signInWithNostrNsec(nsec: string): Promise<StoredIdentity> {
  const { nsecDecode, getPublicKey, npubEncode } = await import('@degenfeed/nostr-sdk');
  const { hex: sk } = nsecDecode(nsec);
  const pk = getPublicKey(sk);
  const npub = npubEncode(pk);
  const record = await buildIdentityRecord({
    protocol: 'nostr',
    publicId: pk,
    handle: npub,
    displayName: `${npub.slice(0, 12)}…`,
    secret: sk,
    keys: { nsec },
  });
  await saveIdentity(record);
  return record;
}

/** Global NIP-07 extension interface. */
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: {
        kind: number;
        tags: string[][];
        content: string;
        created_at: number;
      }) => Promise<{ id: string; sig: string }>;
    };
  }
}

/**
 * Sign in using a NIP-07 browser extension.
 * The extension holds the key; we never see it.
 */
export async function signInWithNostrExtension(): Promise<StoredIdentity> {
  if (typeof window === 'undefined' || !window.nostr) {
    throw new Error('No Nostr extension detected. Install Alby, nos2x, or another NIP-07 wallet.');
  }
  const { npubEncode } = await import('@degenfeed/nostr-sdk');
  const pk = await window.nostr.getPublicKey();
  const npub = npubEncode(pk);
  const record = await buildIdentityRecord({
    protocol: 'nostr',
    publicId: pk,
    handle: npub,
    displayName: `${npub.slice(0, 12)}…`,
    secret: null, // extension-managed
  });
  await saveIdentity(record);
  return record;
}

/**
 * Sign in using a NIP-46 remote signer (Amber, nsecBunker).
 */
export async function signInWithNostrRemoteSigner(opts: {
  relayUrl: string;
  remotePubkey: string;
  showConnectUri: (uri: string) => Promise<void>;
}): Promise<StoredIdentity> {
  const { connectNostrConnect, npubEncode } = await import('@degenfeed/nostr-sdk');
  const session = await connectNostrConnect({
    relayUrl: opts.relayUrl,
    remotePubkey: opts.remotePubkey,
    showConnectUri: opts.showConnectUri,
  });
  const pk = await session.getPublicKey();
  const npub = npubEncode(pk);
  const record = await buildIdentityRecord({
    protocol: 'nostr',
    publicId: pk,
    handle: npub,
    displayName: `${npub.slice(0, 12)}…`,
    secret: null,
  });
  await saveIdentity(record);
  return record;
}
