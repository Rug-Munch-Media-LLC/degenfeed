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

// ─── 4. Bluesky sign-in ─────────────────────────────────────────────────

/**
 * Sign in with Bluesky using an app password.
 * The user creates an app password in their Bluesky settings.
 * We store the session JWT encrypted locally.
 */
export async function signInWithBluesky(
  identifier: string,
  appPassword: string,
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
    keys: { accessToken: session.accessJwt, refreshJwt: session.refreshJwt },
  });
  await saveIdentity(record);
  return record;
}

// ─── Session refresh ────────────────────────────────────────────────────

export async function refreshBlueskySession(
  refreshJwt: string,
): Promise<{ accessJwt: string; refreshJwt: string }> {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${refreshJwt}`,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(
      `Bluesky session refresh failed: ${err.message ?? err.error ?? res.statusText}`,
    );
  }
  const session = (await res.json()) as { accessJwt: string; refreshJwt: string };
  return { accessJwt: session.accessJwt, refreshJwt: session.refreshJwt };
}
