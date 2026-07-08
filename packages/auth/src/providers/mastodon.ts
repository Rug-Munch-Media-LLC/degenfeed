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

// ─── 6. GotoSocial / ActivityPub sign-in ───────────────────────────────

/**
 * Sign in with a GotoSocial (or Mastodon-compatible) server using OAuth2.
 *
 * This uses the app registration + token flow:
 *   1. Register this app with the instance (get client_id + client_secret)
 *   2. Redirect user to authorize URL
 *   3. Exchange code for access token
 *
 * For simplicity, this also supports a pre-obtained access token
 * (e.g. from the instance's Settings > Development > New Application).
 */
export async function signInWithGtS(
  instanceUrl: string,
  accessToken: string,
): Promise<StoredIdentity> {
  // Verify the token by fetching the authenticated user's profile
  const { GtSClient } = await import('@degenfeed/mastodon-sdk');
  const client = new GtSClient(instanceUrl, accessToken);
  const account = await client.verifyCredentials();

  const record = await buildIdentityRecord({
    protocol: 'mastodon',
    publicId: account.id,
    handle: account.acct.includes('@')
      ? account.acct
      : `${account.acct}@${new URL(instanceUrl).hostname}`,
    displayName: account.display_name || account.username,
    avatarUrl: account.avatar,
    secret: accessToken,
    keys: { accessToken },
  });
  await saveIdentity(record);
  return record;
}
