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

import {
  type StoredIdentity,
  clearActiveSession,
  deleteIdentity,
  getIdentity,
  saveIdentity,
  setActiveSession,
} from '@degenfeed/storage';
import type { Protocol } from '@degenfeed/types';

// ─── Encryption layer ───────────────────────────────────────────────────

/**
 * PBKDF2 parameters. Tuned for ~250ms on a 2024 device.
 */
const PBKDF2_PARAMS = {
  iterations: 600_000,
  hash: 'SHA-256' as const,
  keyLength: 32,
};

async function deriveKey(passphrase: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase).slice().slice(),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_PARAMS.iterations,
      hash: PBKDF2_PARAMS.hash,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedBlob {
  ciphertext: string; // base64
  salt: string; // base64
  iv: string; // base64
}

export async function encryptSecret(plaintext: string, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext).slice().slice(),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ct)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
  };
}

export async function decryptSecret(blob: EncryptedBlob, passphrase: string): Promise<string> {
  const salt = base64ToBytes(blob.salt);
  const iv = base64ToBytes(blob.iv);
  const ct = base64ToBytes(blob.ciphertext);
  const key = await deriveKey(passphrase, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(dec);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Identity persistence helpers ───────────────────────────────────────

async function buildIdentityRecord(args: {
  protocol: Protocol;
  publicId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  secret: string | null;
  passphrase: string;
  isPrimary?: boolean;
}): Promise<StoredIdentity> {
  let encryptedSecret: string | null = null;
  let salt = '';
  let iv = '';
  if (args.secret) {
    const blob = await encryptSecret(args.secret, args.passphrase);
    encryptedSecret = blob.ciphertext;
    salt = blob.salt;
    iv = blob.iv;
  }
  return {
    id: `${args.protocol}:${args.publicId}`,
    protocol: args.protocol,
    publicId: args.publicId,
    handle: args.handle,
    displayName: args.displayName,
    avatarUrl: args.avatarUrl,
    linkedAt: Date.now(),
    verified: false,
    encryptedSecret,
    salt,
    iv,
    isPrimary: args.isPrimary ?? false,
  };
}

// ─── 1. Nostr sign-in ───────────────────────────────────────────────────

/**
 * Sign in with a Nostr nsec.
 */
export async function signInWithNostrNsec(
  nsec: string,
  passphrase: string,
): Promise<StoredIdentity> {
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
    passphrase,
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
    passphrase: '',
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
    passphrase: '',
  });
  await saveIdentity(record);
  return record;
}

// ─── 2. Farcaster sign-in ───────────────────────────────────────────────

/**
 * Sign in with Farcaster via Warpcast Quick Auth.
 */
export async function signInWithFarcaster(opts: {
  authServerUrl?: string;
  promptUser: (deepLink: string) => Promise<string>;
}): Promise<StoredIdentity> {
  const authUrl = opts.authServerUrl ?? 'https://auth.farcaster.xyz';

  // 1. Get nonce
  const nonceRes = await fetch(`${authUrl}/v1/auth/nonce`, { method: 'POST' });
  if (!nonceRes.ok) throw new Error('Failed to get Farcaster auth nonce');
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  // 2. Prompt user to sign via Warpcast deep link
  const deepLink = `https://warpcast.com/~/sign-in?nonce=${encodeURIComponent(nonce)}`;
  const token = await opts.promptUser(deepLink);

  // 3. Verify token
  const verifyRes = await fetch(`${authUrl}/v1/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, nonce }),
  });
  if (!verifyRes.ok) throw new Error('Failed to verify Farcaster auth token');
  const { fid, username, displayName, avatarUrl } = (await verifyRes.json()) as {
    fid: number;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    custody: string;
  };

  const record = await buildIdentityRecord({
    protocol: 'farcaster',
    publicId: String(fid),
    handle: `@${username}`,
    displayName,
    avatarUrl,
    secret: null,
    passphrase: '',
  });
  await saveIdentity(record);
  return record;
}

/**
 * Sign in with a self-hosted Farcaster signer private key.
 */
export async function signInWithFarcasterSigner(
  signerKey: string,
  fid: number,
  username: string,
  passphrase: string,
): Promise<StoredIdentity> {
  const record = await buildIdentityRecord({
    protocol: 'farcaster',
    publicId: String(fid),
    handle: `@${username}`,
    secret: signerKey,
    passphrase,
  });
  await saveIdentity(record);
  return record;
}

// ─── 3. Lens sign-in ────────────────────────────────────────────────────

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Sign in with Lens via a connected wallet (EIP-1193).
 */
export async function signInWithLens(opts: {
  wallet: Eip1193Provider;
}): Promise<StoredIdentity> {
  // 1. Get wallet address
  const [address] = (await opts.wallet.request({
    method: 'eth_requestAccounts',
  })) as string[];

  // 2. Fetch Lens profiles for this address
  const profileRes = await fetch('https://api.lens.xyz/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        query Profiles($address: EthereumAddress!) {
          profiles(request: { ownedBy: [$address], limit: 1 }) {
            items { id handle metadata { displayName picture } }
          }
        }
      `,
      variables: { address },
    }),
  });
  if (!profileRes.ok) throw new Error('Failed to fetch Lens profiles');
  const { data: profileData } = (await profileRes.json()) as {
    data: {
      profiles: {
        items: {
          id: string;
          handle: string;
          metadata: { displayName: string | null; picture: string | null };
        }[];
      };
    };
  };
  const profile = profileData.profiles.items[0];
  if (!profile) throw new Error('No Lens profile found for this wallet');

  // 3. Request challenge
  const challengeRes = await fetch('https://api.lens.xyz/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation Challenge($profileId: ProfileId!) {
          challenge(request: { profileId: $profileId }) { text }
        }
      `,
      variables: { profileId: profile.id },
    }),
  });
  const { data: challengeData } = (await challengeRes.json()) as {
    data: { challenge: { text: string } };
  };

  // 4. Sign challenge with wallet
  const signature = (await opts.wallet.request({
    method: 'personal_sign',
    params: [challengeData.challenge.text, address],
  })) as string;

  // 5. Authenticate
  const authRes = await fetch('https://api.lens.xyz/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation Authenticate($profileId: ProfileId!, $address: EthereumAddress!, $signature: String!) {
          authenticate(request: { profileId: $profileId, address: $address, signature: $signature }) {
            accessToken refreshToken
          }
        }
      `,
      variables: { profileId: profile.id, address, signature },
    }),
  });
  if (!authRes.ok) throw new Error('Failed to authenticate with Lens');
  const { data: authData } = (await authRes.json()) as {
    data: { authenticate: { accessToken: string; refreshToken: string } };
  };

  // 6. Store encrypted tokens
  const tokensBlob = JSON.stringify({
    accessToken: authData.authenticate.accessToken,
    refreshToken: authData.authenticate.refreshToken,
    address,
  });
  const record = await buildIdentityRecord({
    protocol: 'lens',
    publicId: profile.id,
    handle: `lens/${profile.handle}`,
    displayName: profile.metadata.displayName ?? undefined,
    avatarUrl: profile.metadata.picture ?? undefined,
    secret: tokensBlob,
    passphrase: '',
  });
  await saveIdentity(record);
  return record;
}

// ─── 4. Bluesky sign-in ─────────────────────────────────────────────────

/**
 * Sign in with Bluesky using an app password.
 * The user creates an app password in their Bluesky settings.
 * We store the session JWT encrypted locally.
 */
export async function signInWithBluesky(
  identifier: string,
  appPassword: string,
  passphrase: string,
): Promise<StoredIdentity> {
  // 1. Create session via XRPC
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });
  if (!sessionRes.ok) {
    const err = (await sessionRes.json()) as { message?: string; error?: string };
    throw new Error(`Bluesky auth failed: ${err.message ?? err.error ?? sessionRes.statusText}`);
  }
  const session = (await sessionRes.json()) as {
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt: string;
  };

  // 2. Fetch profile for display info
  let displayName: string | undefined;
  let avatarUrl: string | undefined;
  try {
    const profileRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.did)}`,
    );
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as { displayName?: string; avatar?: string };
      displayName = profile.displayName;
      avatarUrl = profile.avatar;
    }
  } catch {
    // Non-fatal
  }

  // 3. Store JWT encrypted
  const jwtBlob = JSON.stringify({
    did: session.did,
    accessJwt: session.accessJwt,
    refreshJwt: session.refreshJwt,
  });
  const record = await buildIdentityRecord({
    protocol: 'bluesky',
    publicId: session.did,
    handle: `@${session.handle}`,
    displayName,
    avatarUrl,
    secret: jwtBlob,
    passphrase,
  });
  await saveIdentity(record);
  return record;
}

// ─── Session unlock ─────────────────────────────────────────────────────

/**
 * Unlock a previously-stored identity. Decrypts the secret into memory
 * and sets an active session. The secret is NEVER persisted to disk.
 */
export async function unlockIdentity(identityId: string, passphrase: string): Promise<void> {
  const record = await getIdentity(identityId);
  if (!record) throw new Error('Identity not found');

  if (!record.encryptedSecret) {
    // Extension/custody-managed identity; nothing to unlock
    setActiveSession(identityId, {
      identity: record,
      decryptedSecret: null,
      unlockedAt: Date.now(),
    });
    return;
  }

  const secret = await decryptSecret(
    {
      ciphertext: record.encryptedSecret,
      salt: record.salt,
      iv: record.iv,
    },
    passphrase,
  );

  setActiveSession(identityId, {
    identity: record,
    decryptedSecret: secret,
    unlockedAt: Date.now(),
  });
}

/**
 * Sign out: clear the in-memory session. The encrypted record remains
 * on disk for next time.
 */
export function lockIdentity(identityId: string): void {
  clearActiveSession(identityId);
}

/**
 * Forget an identity entirely: clear active session AND delete
 * the encrypted record from disk.
 */
export async function forgetIdentity(identityId: string): Promise<void> {
  lockIdentity(identityId);
  await deleteIdentity(identityId);
}

// ─── Re-exports ─────────────────────────────────────────────────────────

export {
  setActiveSession,
  getActiveSession,
  clearActiveSession,
  getIdentity,
  saveIdentity,
} from '@degenfeed/storage';
export type { StoredIdentity, ActiveSession } from '@degenfeed/storage';
