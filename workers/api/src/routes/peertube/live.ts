/**
 * @degenfeed/api-worker — PeerTube Live
 *
 * Live stream creation, listing, viewer counts, chat.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { getPeerTubeClient, peertubeFetch, mapVideoForResponse } from './utils';
import type { PeerTubeVideo, PaginatedResponse } from './types';

export function registerLiveRoutes(router: Hono<{ Bindings: Env }>): void {

  router.post('/live/create', async (c) => {
    try {
      const body = (await c.req.json()) as {
        channelId?: number; name?: string; description?: string; privacy?: number;
        category?: number; tags?: string[]; saveReplay?: boolean;
      };
      if (!body.channelId || !body.name) return jsonResponse({ error: 'channelId and name are required' }, 400);
      const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);
      const createBody = {
        channelId: body.channelId, name: body.name.trim().slice(0, 120),
        description: body.description ?? '', privacy: body.privacy ?? 1, category: body.category ?? 13,
        tags: [...(body.tags ?? []), 'degenfeed', 'live'].slice(0, 5),
        commentsEnabled: true, downloadEnabled: false, nsfw: false, saveReplay: body.saveReplay ?? true,
        pluginData: { degenfeed: { platform: 'degenfeed', version: '1.0', isLive: true } },
      };
      const response = await fetch(`${instanceUrl}/api/v1/videos/live-streams`, {
        method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', 'user-agent': 'DegenFeed/1.0' },
        body: JSON.stringify(createBody),
      });
      if (!response.ok) { const errBody = await response.text().catch(() => 'unknown'); return jsonResponse({ error: `PeerTube live create failed: ${response.status} — ${errBody}` }, response.status); }
      const result = (await response.json()) as { video: { id: number; uuid: string; shortUUID: string; name: string; url: string; embedPath: string }; liveSession?: { id: number; rtmpUrl?: string; streamKey?: string } };
      let streamKey: string | null = null;
      let rtmpUrl: string | null = null;
      if (result.liveSession?.streamKey) {
        streamKey = result.liveSession.streamKey;
        rtmpUrl = result.liveSession.rtmpUrl ?? `${instanceUrl}/live`;
      } else {
        try {
          const sessionResponse = await fetch(`${instanceUrl}/api/v1/videos/${result.video.id}/live-session`, {
            method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', 'user-agent': 'DegenFeed/1.0' },
            body: JSON.stringify({}),
          });
          if (sessionResponse.ok) { const session = (await sessionResponse.json()) as { rtmpUrl?: string; streamKey?: string }; streamKey = session.streamKey ?? null; rtmpUrl = session.rtmpUrl ?? `${instanceUrl}/live`; }
        } catch { /* best-effort */ }
      }
      return noCacheJsonResponse({ stream: { id: result.video.id, uuid: result.video.uuid, title: result.video.name, url: result.video.url, embedUrl: `${instanceUrl}${result.video.embedPath}`, embedCode: `<iframe width="560" height="315" src="${instanceUrl}${result.video.embedPath}" title="${result.video.name}" frameborder="0" allowfullscreen></iframe>`, streamKey, rtmpUrl, rtmpEndpoint: rtmpUrl ? `${rtmpUrl}/${streamKey}` : null } }, 201);
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to create live stream: ${msg}` }, 500); }
  });

  router.get('/live/active', async (c) => {
    try {
      const response = await peertubeFetch(c.env, '/api/v1/videos', {
        params: { isLive: 'true', start: c.req.query('start') ?? '1', count: c.req.query('count') ?? '20', sort: '-publishedAt' } as Record<string, string | number | boolean | undefined>,
      });
      const data = (await response.json()) as PaginatedResponse<PeerTubeVideo>;
      const { instanceUrl } = await getPeerTubeClient(c.env);
      return noCacheJsonResponse({ total: data.total, streams: data.data.map((v) => ({ ...mapVideoForResponse(v, instanceUrl), viewers: v.liveInfo?.viewerCount ?? 0, streamHealth: v.liveInfo?.health ?? 'unknown', streamState: v.liveInfo?.state ?? 'unknown' })) });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to list live streams: ${msg}` }, 500); }
  });

  router.get('/live/:id/viewers', async (c) => {
    try {
      const streamId = c.req.param('id');
      const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);
      let viewerCount = 0;
      let health: string | undefined;
      let state: string | undefined;
      try {
        const sessionResponse = await fetch(`${instanceUrl}/api/v1/videos/${streamId}/live-session`, {
          headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        });
        if (sessionResponse.ok) { const session = (await sessionResponse.json()) as { viewerCount?: number; health?: string; state?: string }; viewerCount = session.viewerCount ?? 0; health = session.health; state = session.state; }
      } catch { /* fallback */ }
      if (viewerCount === 0) {
        try {
          const videoResponse = await fetch(`${instanceUrl}/api/v1/videos/${streamId}`, {
            headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
          });
          if (videoResponse.ok) { const video = (await videoResponse.json()) as { liveInfo?: { viewerCount?: number; health?: string; state?: string } }; viewerCount = video.liveInfo?.viewerCount ?? 0; health ??= video.liveInfo?.health; state ??= video.liveInfo?.state; }
        } catch { /* best-effort */ }
      }
      return noCacheJsonResponse({ streamId, viewerCount, health: health ?? 'unknown', state: state ?? 'unknown' });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to get viewers: ${msg}` }, 500); }
  });

  router.post('/live/:id/chat', async (c) => {
    try {
      const streamId = c.req.param('id');
      const body = (await c.req.json()) as { message?: string };
      if (!body.message || body.message.trim().length === 0) return jsonResponse({ error: 'message is required' }, 400);
      await peertubeFetch(c.env, `/api/v1/videos/${streamId}/live-chat`, { method: 'POST', body: JSON.stringify({ message: body.message.slice(0, 500) }) });
      return jsonResponse({ ok: true });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to send chat message: ${msg}` }, 500); }
  });

  router.get('/live/:id/chat', async (c) => {
    try {
      const streamId = c.req.param('id');
      const cursor = c.req.query('cursor');
      const params: Record<string, string | number | boolean | undefined> = {};
      if (cursor) params.cursor = cursor;
      const response = await peertubeFetch(c.env, `/api/v1/videos/${streamId}/live-chat`, { params });
      const data = (await response.json()) as { data: Array<{ id: string; displayName: string; accountName: string; message: string; createdAt: string }>; total: number; cursor?: string };
      return noCacheJsonResponse({ messages: data.data.map((msg) => ({ id: msg.id, displayName: msg.displayName, accountName: msg.accountName, message: msg.message, createdAt: msg.createdAt })), total: data.total, nextCursor: data.cursor });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); return jsonResponse({ error: `Failed to get chat: ${msg}` }, 500); }
  });
}
