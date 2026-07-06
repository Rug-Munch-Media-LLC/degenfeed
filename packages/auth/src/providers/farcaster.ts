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
