/**
 * @degenfeed/api-worker — PeerTube Utils
 */

import type { Env } from '../../index';
import type { PeerTubeVideo, PeerTubeChannel } from './types';
import { PEERTUBE_CATEGORIES } from './types';

export async function getPeerTubeClient(env: Env): Promise<{ instanceUrl: string; accessToken: string }> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
  const cached = await env.CACHE?.get('peertube:access_token_v2');
  if (cached) { const parsed = JSON.parse(cached) as { token: string; expiresAt: number }; if (parsed.expiresAt > Date.now()) return { instanceUrl, accessToken: parsed.token }; }
  const clientId = env.PEERTUBE_CLIENT_ID;
  const clientSecret = env.PEERTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) { const _errPE = new Error('PEERTUBE_CLIENT_ID and PEERTUBE_CLIENT_SECRET must be set'); throw _errPE; }
  const response = await fetch(`${instanceUrl}/api/v1/oauth/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials', scope: 'manage:videos manage:channels manage:live' }),
  });
  if (!response.ok) { const body = await response.text().catch(() => 'unknown'); const _errPT = new Error(`PeerTube OAuth failed: ${response.status} — ${body}`); throw _errPT; }
  const data = (await response.json()) as { access_token: string; expires_in?: number };
  const accessToken = data.access_token;
  const expiresIn = data.expires_in ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000 - 300000;
  await env.CACHE?.put('peertube:access_token_v2', JSON.stringify({ token: accessToken, expiresAt }), { expirationTtl: expiresIn });
  return { instanceUrl, accessToken };
}

export async function peertubeFetch(
  env: Env, path: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
): Promise<Response> {
  const { instanceUrl, accessToken } = await getPeerTubeClient(env);
  const base = instanceUrl.replace(/\/$/, '');
  let url = `${base}${path}`;
  if (options.params) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) { if (value !== undefined && value !== '') params.set(key, String(value)); }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  headers.set('user-agent', 'DegenFeed/1.0');
  if (options.body && typeof options.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(url, { ...options, headers });
}

export function getCategoryLabel(id: number | null | undefined): string {
  if (id == null) return 'Uncategorized';
  return PEERTUBE_CATEGORIES[id] ?? `Category ${id}`;
}

export function mapVideoForResponse(video: PeerTubeVideo, instanceUrl: string) {
  return {
    id: video.uuid || String(video.id),
    numericId: video.id,
    title: video.name,
    description: video.description ?? '',
    shortDescription: video.shortDescription ?? '',
    url: video.url,
    embedUrl: video.embedPath ? `${instanceUrl}${video.embedPath}` : `${instanceUrl}/videos/embed/${video.uuid}`,
    thumbnailUrl: video.thumbnailPath ? `${instanceUrl}${video.thumbnailPath}` : null,
    previewUrl: video.previewPath ? `${instanceUrl}${video.previewPath}` : null,
    duration: video.duration, views: video.views, likes: video.likes, dislikes: video.dislikes,
    isLive: video.isLive, nsfw: video.nsfw, publishedAt: video.publishedAt,
    category: video.category ?? null, categoryLabel: getCategoryLabel(video.category?.id),
    tags: video.tags ?? [],
    channel: video.channel ? { id: video.channel.id, name: video.channel.name, displayName: video.channel.displayName, url: video.channel.url, avatarUrl: video.channel.avatar?.path ? `${instanceUrl}${video.channel.avatar.path}` : null } : null,
    account: video.account ? { id: video.account.id, name: video.account.name, displayName: video.account.displayName, url: video.account.url, avatarUrl: video.account.avatar?.path ? `${instanceUrl}${video.account.avatar.path}` : null } : null,
    liveInfo: video.liveInfo ?? null,
    files: video.files?.map((f) => ({ resolution: f.resolution.label, size: f.size, fileUrl: f.fileUrl })) ?? [],
  };
}

export function mapChannelForResponse(channel: PeerTubeChannel, instanceUrl: string) {
  return {
    id: channel.id, name: channel.name, displayName: channel.displayName,
    description: channel.description, support: channel.support ?? '',
    url: channel.url, avatarUrl: channel.avatar?.path ? `${instanceUrl}${channel.avatar.path}` : null,
    videosCount: channel.videosCount, viewsCount: channel.viewsCount,
    followersCount: channel.followersCount, createdAt: channel.createdAt,
    owner: channel.ownerAccount ? { name: channel.ownerAccount.displayName, url: channel.ownerAccount.url } : null,
  };
}
