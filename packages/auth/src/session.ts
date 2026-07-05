/**
 * @degenfeed/auth — Session management
 *
 * Unlock, lock, and forget saved identities.
 * Uses AES-GCM encrypted blobs stored via @degenfeed/storage.
 */

import { decryptSecret } from './crypto';
import { getIdentity, deleteIdentity, setActiveSession, clearActiveSession } from '@degenfeed/storage';

export async function unlockIdentity(identityId: string, passphrase: string): Promise<void> {
  const record = await getIdentity(identityId);
  if (!record) throw new Error('Identity not found: ' + identityId);

  const secret = await decryptSecret(
    { ciphertext: record.encryptedSecret ?? "", salt: record.salt, iv: record.iv },
    passphrase,
  );
  const parsed = JSON.parse(secret) as Record<string, string | undefined>;

  const session: Record<string, unknown> = {
    identityId: record.id,
    protocol: record.protocol,
    publicId: record.publicId ?? "",
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
