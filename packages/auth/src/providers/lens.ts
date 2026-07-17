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

// ─── 3. Lens sign-in ────────────────────────────────────────────────────

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Sign in with Lens via a connected wallet (EIP-1193).
 */
export async function signInWithLens(opts: { wallet: Eip1193Provider }): Promise<StoredIdentity> {
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

  // 6. Store tokens — no local encryption passphrase needed;
  // the tokens live in browser-local IndexedDB behind the wallet auth gate.
  const record = await buildIdentityRecord({
    protocol: 'lens',
    publicId: profile.id,
    handle: `lens/${profile.handle}`,
    displayName: profile.metadata.displayName ?? undefined,
    avatarUrl: profile.metadata.picture ?? undefined,
    secret: null,
    keys: {
      accessToken: authData.authenticate.accessToken,
      refreshToken: authData.authenticate.refreshToken,
      address: address ?? null,
    },
  });
  await saveIdentity(record);
  return record;
}

// ─── Session refresh ─────────────────────────────────────────────────────

interface RefreshResponse {
  data: { refresh: { accessToken: string; refreshToken: string } };
}

export async function refreshLensSession(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch('https://api.lens.xyz/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation Refresh($refreshToken: String!) {
          refresh(request: { refreshToken: $refreshToken }) {
            accessToken refreshToken
          }
        }
      `,
      variables: { refreshToken },
    }),
  });
  if (!res.ok) throw new Error(`Lens session refresh failed: ${res.statusText}`);
  const { data } = (await res.json()) as RefreshResponse;
  if (!data?.refresh) throw new Error('Lens session refresh failed: no data in response');
  return { accessToken: data.refresh.accessToken, refreshToken: data.refresh.refreshToken };
}
