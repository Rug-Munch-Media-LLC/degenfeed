/**
 * Reddit OAuth provider for real engagement (voting, commenting, posting).
 *
 * Setup: Register a Reddit app at https://www.reddit.com/prefs/apps
 * Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in wrangler secrets.
 */
import type { StoredIdentity } from '@degenfeed/storage';
import { buildIdentityRecord } from '../persistence';

export async function signInWithReddit(clientId: string): Promise<StoredIdentity> {
  const state = crypto.randomUUID();
  localStorage.setItem('reddit_oauth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: `${window.location.origin}/auth/callback?provider=reddit`,
    duration: 'permanent',
    scope: 'identity read vote submit',
  });
  window.location.href = `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  throw new Error('Redirecting...');
}

export async function handleRedditCallback(code: string, state: string): Promise<StoredIdentity> {
  const savedState = localStorage.getItem('reddit_oauth_state');
  localStorage.removeItem('reddit_oauth_state');
  if (!savedState || state !== savedState) throw new Error('OAuth state mismatch');

  const res = await fetch('/api/auth/reddit/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error('Reddit auth failed');
  const d = (await res.json()) as Record<string, unknown>;
  const data = d as unknown as {
    id: string;
    name: string;
    icon_img?: string;
    accessToken: string;
    refreshToken?: string;
  };

  const record = await buildIdentityRecord({
    protocol: 'reddit',
    publicId: data.id,
    handle: `u/${data.name}`,
    displayName: data.name,
    avatarUrl: data.icon_img,
    secret: data.accessToken,
    keys: { accessToken: data.accessToken, refreshToken: data.refreshToken ?? '' },
  });
  const { saveIdentity } = await import('@degenfeed/storage');
  await saveIdentity(record);
  return record;
}
