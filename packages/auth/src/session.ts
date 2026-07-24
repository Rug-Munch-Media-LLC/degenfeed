/**
 * @degenfeed/auth — Session management
 *
 * Unlock, lock, and forget saved identities.
 * Uses AES-GCM encrypted blobs stored via @degenfeed/storage.
 */

import {
  clearActiveSession,
  deleteIdentity,
  getActiveSession,
  getIdentity,
  saveIdentity,
  setActiveSession,
} from '@degenfeed/storage';
import { decryptSecret } from './crypto';

export async function unlockIdentity(identityId: string, passphrase: string): Promise<void> {
  const record = await getIdentity(identityId);
  if (!record) throw new Error(`Identity not found: ${identityId}`);

  const secret = await decryptSecret(
    { ciphertext: record.encryptedSecret ?? '', salt: record.salt, iv: record.iv },
    passphrase,
  );
  const parsed = JSON.parse(secret) as Record<string, string | undefined>;

  const session: Record<string, unknown> = {
    identityId: record.id,
    protocol: record.protocol,
    publicId: record.publicId ?? '',
    handle: record.handle,
    displayName: record.displayName,
    avatarUrl: record.avatarUrl,
    unlockedAt: Date.now(),
  };

  if (parsed.accessToken) session.accessToken = parsed.accessToken;
  if (parsed.refreshToken) session.refreshToken = parsed.refreshToken;
  if (parsed.did) session.did = parsed.did;
  if (parsed.accessJwt) session.accessJwt = parsed.accessJwt;
  if (parsed.refreshJwt) session.refreshJwt = parsed.refreshJwt;
  if (parsed.nsec) session.nsec = parsed.nsec;

  await setActiveSession(identityId, session as never);
}

export async function lockIdentity(identityId: string): Promise<void> {
  clearActiveSession(identityId);
}

export async function forgetIdentity(identityId: string): Promise<void> {
  clearActiveSession(identityId);
  await deleteIdentity(identityId);
}

// ─── JWT expiry helper ──────────────────────────────────────────────────

function getJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadPart = parts[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

// ─── Session refresh ─────────────────────────────────────────────────────

export async function refreshSessionIfNeeded(identityId: string): Promise<void> {
  const session = getActiveSession(identityId) as Record<string, unknown> | undefined;
  if (!session) return;

  const protocol = session.protocol as string;

  if (protocol === 'bluesky') {
    const refreshJwt = session.refreshJwt as string | undefined;
    const accessJwt = session.accessJwt as string | undefined;
    if (!refreshJwt) return;

    // Check if the access JWT is expiring within 5 minutes
    if (accessJwt) {
      const exp = getJwtExpiry(accessJwt);
      if (exp !== null) {
        const fiveMinFromNow = Math.floor(Date.now() / 1000) + 300;
        if (exp > fiveMinFromNow) return; // Still fresh
      }
    }

    const { refreshBlueskySession } = await import('./providers/bluesky');
    const tokens = await refreshBlueskySession(refreshJwt);
    session.accessJwt = tokens.accessJwt;
    session.refreshJwt = tokens.refreshJwt;
    setActiveSession(identityId, session as never);

    const identity = await getIdentity(identityId);
    if (identity) {
      identity.keys = {
        ...identity.keys,
        accessJwt: tokens.accessJwt,
        refreshJwt: tokens.refreshJwt,
      };
      if (identity.keys?._secret) {
        const secret = JSON.parse(identity.keys._secret) as Record<string, unknown>;
        secret.accessJwt = tokens.accessJwt;
        secret.refreshJwt = tokens.refreshJwt;
        identity.keys._secret = JSON.stringify(secret);
      }
      await saveIdentity(identity);
    }
    return;
  }

  if (protocol === 'lens') {
    const refreshToken = session.refreshToken as string | undefined;
    if (!refreshToken) return;

    const { refreshLensSession } = await import('./providers/lens');
    const tokens = await refreshLensSession(refreshToken);
    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;
    setActiveSession(identityId, session as never);

    const identity = await getIdentity(identityId);
    if (identity) {
      identity.keys = {
        ...identity.keys,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
      await saveIdentity(identity);
    }
  }
}
