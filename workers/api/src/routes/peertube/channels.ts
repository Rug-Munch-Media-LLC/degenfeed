/**
 * @degenfeed/api-worker — PeerTube Channels & Federation
 *
 * Channel management, federation health, categories.
 */

import { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { getPeerTubeClient, peertubeFetch, mapChannelForResponse } from './utils';
import type { PeerTubeChannel, PeerTubeVideo, PaginatedResponse } from './types';
import { PEERTUBE_CATEGORIES } from './types';

export function registerChannelRoutes(router: Hono<{ Bindings: Env }>): void {

  router.get('/channels', async (c) => {
    try {
      const response = await peertubeFetch(c.env, '/api/v1/video-channels', {
        params: { start: c.req.query('start') ?? '1', count: c.req.query('count') ?? '20', sort: c.req.query('sort') ?? '-updatedAt' } as Record<string, string | number | boolean | undefined>,
      });
      const data = (await response.json()) as PaginatedResponse<PeerTubeChannel>;
      const { instanceUrl } = await getPeerTubeClient(c.env);
      return noCacheJsonResponse({ total: data.total, data: data.data.map((ch) => mapChannelForResponse(ch, instanceUrl)) });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to list channels: ${msg}` }, 500); }
  });

  router.post('/channels', async (c) => {
    try {
      const body = (await c.req.json()) as { name?: string; displayName?: string; description?: string; support?: string };
      if (!body.name || !body.displayName) return jsonResponse({ error: 'name and displayName are required' }, 400);
      const response = await peertubeFetch(c.env, '/api/v1/video-channels', {
        method: 'POST',
        body: JSON.stringify({ name: body.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32), displayName: body.displayName, description: body.description ?? '', support: body.support ?? '' }),
      });
      const channel = (await response.json()) as PeerTubeChannel;
      const { instanceUrl } = await getPeerTubeClient(c.env);
      return noCacheJsonResponse({ channel: mapChannelForResponse(channel, instanceUrl) }, 201);
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to create channel: ${msg}` }, 500); }
  });
}

export function registerFederationRoutes(router: Hono<{ Bindings: Env }>): void {

  router.get('/federation/following', async (c) => {
    try {
      const response = await peertubeFetch(c.env, '/api/v1/server/following', {
        params: { start: c.req.query('start') ?? '1', count: c.req.query('count') ?? '20', sort: '-createdAt', state: c.req.query('state') } as Record<string, string | number | boolean | undefined>,
      });
      const data = (await response.json()) as PaginatedResponse<{ id: number; following: { id: number; name: string; displayName: string; host: string; url: string; avatar: { path: string } | null }; state: 'pending' | 'accepted' | 'rejected'; createdAt: string }>;
      return noCacheJsonResponse({ total: data.total, data: data.data.map((f) => ({ id: f.id, instance: { name: f.following.displayName || f.following.name, host: f.following.host, url: f.following.url, avatarUrl: f.following.avatar?.path ? `https://${f.following.host}${f.following.avatar.path}` : null }, state: f.state, followedAt: f.createdAt })) });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to list following: ${msg}` }, 500); }
  });

  router.get('/federation/followers', async (c) => {
    try {
      const response = await peertubeFetch(c.env, '/api/v1/server/followers', {
        params: { start: c.req.query('start') ?? '1', count: c.req.query('count') ?? '20', sort: '-createdAt', state: c.req.query('state') } as Record<string, string | number | boolean | undefined>,
      });
      const data = (await response.json()) as PaginatedResponse<{ id: number; follower: { id: number; name: string; displayName: string; host: string; url: string; avatar: { path: string } | null }; state: 'pending' | 'accepted' | 'rejected'; createdAt: string }>;
      return noCacheJsonResponse({ total: data.total, data: data.data.map((f) => ({ id: f.id, instance: { name: f.follower.displayName || f.follower.name, host: f.follower.host, url: f.follower.url, avatarUrl: f.follower.avatar?.path ? `https://${f.follower.host}${f.follower.avatar.path}` : null }, state: f.state, followedAt: f.createdAt })) });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to list followers: ${msg}` }, 500); }
  });

  router.get('/federation/stats', async (c) => {
    try {
      const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);
      const start = performance.now();
      const errors: string[] = [];
      let following: Array<{ host: string; state: string }> = [];
      let followers: Array<{ host: string; state: string }> = [];
      let serverStats: { totalVideos?: number; totalLocalVideos?: number; totalViews?: number } | null = null;
      try {
        const [followingRes, followersRes, statsRes] = await Promise.all([
          fetch(`${instanceUrl}/api/v1/server/following?count=100`, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } }).then((r) => r.json() as Promise<PaginatedResponse<{ following: { host: string }; state: string }>>),
          fetch(`${instanceUrl}/api/v1/server/followers?count=100`, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } }).then((r) => r.json() as Promise<PaginatedResponse<{ follower: { host: string }; state: string }>>),
          fetch(`${instanceUrl}/api/v1/server/stats`, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } }).then((r) => r.json() as Promise<{ totalVideos?: number; totalLocalVideos?: number; totalViews?: number }>),
        ]);
        following = followingRes.data ?? [];
        followers = followersRes.data ?? [];
        serverStats = statsRes;
      } catch (err) { errors.push(`Failed to fetch federation data: ${err instanceof Error ? err.message : String(err)}`); }
      const uniqueHosts = [...new Set([...following.map((f) => f.host), ...followers.map((f) => f.host)].filter(Boolean))];
      let reachableCount = 0;
      if (uniqueHosts.length > 0) {
        const results = await Promise.allSettled(uniqueHosts.map((host) => fetch(`https://${host}/api/v1/config`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok).catch(() => false)));
        reachableCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
      }
      const latencyMs = Math.round(performance.now() - start);
      const instancesTotal = uniqueHosts.length;
      const reachablePercent = instancesTotal > 0 ? Math.round((reachableCount / instancesTotal) * 100) : 100;
      const reachabilityScore = reachablePercent;
      const pendingRatio = following.filter((f) => f.state === 'pending').length + followers.filter((f) => f.state === 'pending').length;
      const pendingScore = Math.max(0, 100 - pendingRatio * 10);
      const federationScore = Math.round(reachabilityScore * 0.7 + pendingScore * 0.3);
      const status = federationScore >= 80 ? 'up' : federationScore >= 50 ? 'degraded' : 'down';
      return noCacheJsonResponse({ status, healthScore: federationScore, following: { total: following.length, accepted: following.filter((f) => f.state === 'accepted').length, pending: following.filter((f) => f.state === 'pending').length }, followers: { total: followers.length, accepted: followers.filter((f) => f.state === 'accepted').length, pending: followers.filter((f) => f.state === 'pending').length }, instanceReachability: { totalExamined: instancesTotal, reachable: reachableCount, unreachable: instancesTotal - reachableCount, reachablePercent }, latencyMs, serverStats: serverStats ?? {}, errors: errors.length > 0 ? errors : undefined, lastChecked: Date.now() });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to get federation stats: ${msg}` }, 500); }
  });

  router.get('/categories', (_c) => {
    const categories = Object.entries(PEERTUBE_CATEGORIES).map(([id, label]) => ({ id: Number(id), label }));
    return noCacheJsonResponse({ categories });
  });
}
