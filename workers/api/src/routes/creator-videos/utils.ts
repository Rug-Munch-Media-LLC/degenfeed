/**
 * @degenfeed/api-worker — Creator Video Utilities
 */

import type { Env } from '../../types';
import { broadcastToAll } from '../../ws-broadcast';
import { CHANNELS } from '../../ws-channels';
import type { CreatorVideoMeta } from './types';

const VIDEOS_PREFIX = 'creator:videos:';
const PROGRESS_PREFIX = 'creator:videos:progress:';
const ANALYTICS_PREFIX = 'creator:videos:analytics:';
const LOOKUP_PREFIX = 'creator:videos:lookup:';

export function videosKey(address: string): string {
  return `${VIDEOS_PREFIX}${address.toLowerCase()}`;
}

export function progressKey(uuid: string): string {
  return `${PROGRESS_PREFIX}${uuid}`;
}

export function analyticsKey(uuid: string): string {
  return `${ANALYTICS_PREFIX}${uuid}`;
}

export function lookupKey(uuid: string): string {
  return `${LOOKUP_PREFIX}${uuid}`;
}

export async function getVideos(env: Env, address: string): Promise<CreatorVideoMeta[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(videosKey(address));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveVideos(
  env: Env,
  address: string,
  videos: CreatorVideoMeta[],
): Promise<void> {
  await env.CONTENT_STORE?.put(videosKey(address), JSON.stringify(videos));
}

// ─── PeerTube access (OAuth client-credentials per instance) ────────────

export interface PeerTubeAccess {
  accessToken: string;
  instanceUrl: string;
}

/**
 * Obtain a PeerTube access token for video uploads via client credentials.
 * Falls back to the primary instance configured in env.
 */
export async function getPeerTubeAccess(env: Env): Promise<PeerTubeAccess> {
  const instanceUrl = (
    typeof env.PEERTUBE_INSTANCE_URL === 'string' && env.PEERTUBE_INSTANCE_URL
      ? env.PEERTUBE_INSTANCE_URL
      : 'https://tube.degenfeed.xyz'
  ).replace(/\/+$/, '');
  const clientId = typeof env.PEERTUBE_CLIENT_ID === 'string' ? env.PEERTUBE_CLIENT_ID : '';
  const clientSecret =
    typeof env.PEERTUBE_CLIENT_SECRET === 'string' ? env.PEERTUBE_CLIENT_SECRET : '';

  const res = await fetch(`${instanceUrl}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      response_type: 'code',
    }),
  });
  if (!res.ok) {
    throw new Error(`PeerTube auth failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('PeerTube auth returned no access_token');
  }
  return { accessToken: data.access_token, instanceUrl };
}

// ─── Cross-protocol announcement ────────────────────────────────────────

/**
 * Announce a newly published creator video on the realtime WS fanout.
 * Fire-and-forget by design — callers wrap in executionCtx.waitUntil.
 */
export async function announceNewVideo(
  _env: Env,
  creatorAddress: string,
  payload: {
    title: string;
    description?: string;
    url?: string;
    thumbnailUrl?: string;
  },
): Promise<void> {
  try {
    broadcastToAll(CHANNELS.VIDEO_PUBLISH, { creatorAddress, ...payload });
  } catch {
    // realtime worker may be unreachable — announcements are best-effort
  }
}
