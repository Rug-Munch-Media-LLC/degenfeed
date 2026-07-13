/**
 * @degenfeed/auth — Threads sign-in via Meta OAuth.
 *
 * Threads uses Meta's standard OAuth 2.0 flow (not AT Protocol).
 * The server-side exchange happens at /api/auth/threads/callback
 * to keep the app secret off the client.
 */

import { type StoredIdentity, saveIdentity } from '@degenfeed/storage';
import { buildIdentityRecord } from '../persistence';

export async function signInWithThreads(): Promise<StoredIdentity> {
  const res = await fetch('/api/auth/threads/authorize', { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Threads auth not available' }));
    throw new Error(err.error ?? 'Threads auth not available');
  }
  const data = (await res.json()) as { authorizeUrl: string; state: string };
  window.location.href = data.authorizeUrl;
  return null as unknown as StoredIdentity;
}

export async function handleThreadsCallback(code: string, state: string): Promise<StoredIdentity> {
  const res = await fetch('/api/auth/threads/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, state }),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Token exchange failed' }));
    throw new Error(err.error ?? 'Token exchange failed');
  }
  const data = (await res.json()) as {
    userId: string;
    username: string;
    name?: string;
    avatar?: string;
    accessToken: string;
    longLivedToken?: string;
  };
  const record = await buildIdentityRecord({
    protocol: 'threads',
    publicId: data.userId,
    handle: `threads/${data.username}`,
    displayName: data.name,
    avatarUrl: data.avatar,
    secret: JSON.stringify({
      userId: data.userId,
      accessToken: data.longLivedToken || data.accessToken,
    }),
  });
  await saveIdentity(record);
  return record;
}
