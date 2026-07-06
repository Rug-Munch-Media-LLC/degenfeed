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

// ─── 5. Threads sign-in ──────────────────────────────────────────────────

/**
 * Sign in with Threads using an AT Protocol app password.
 * Threads runs on AT Protocol (same as Bluesky), so auth works the same way.
 * The user creates an app password in their Threads settings.
 */
export async function signInWithThreads(
  identifier: string,
  appPassword: string,
  passphrase: string,
): Promise<StoredIdentity> {
  // 1. Create session via XRPC (AT Protocol same as Bluesky)
  const sessionRes = await fetch('https://threads.net/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });
  if (!sessionRes.ok) {
    const err = (await sessionRes.json()) as { message?: string; error?: string };
    throw new Error(`Threads auth failed: ${err.message ?? err.error ?? sessionRes.statusText}`);
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
      `https://public.threads.net/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.did)}`,
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
    protocol: 'threads',
    publicId: session.did,
    handle: `threads/${session.handle}`,
    displayName,
    avatarUrl,
    secret: jwtBlob,
    passphrase,
  });
  await saveIdentity(record);
  return record;
}
