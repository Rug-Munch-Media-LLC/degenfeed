/**
 * @degenfeed/api-worker — PeerTube Videos
 *
 * Video upload, listing, detail, and rating.
 */

import type { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import type { PaginatedResponse, PeerTubeVideo } from './types';
import { getPeerTubeClient, mapVideoForResponse, peertubeFetch } from './utils';

export function registerVideoRoutes(router: Hono<{ Bindings: Env }>): void {
  router.post('/upload', async (c) => {
    try {
      const formData = await c.req.formData();
      const videoFile = formData.get('videofile') as File | null;
      if (!videoFile) return jsonResponse({ error: 'videofile is required' }, 400);
      const name = (formData.get('name') as string)?.trim();
      if (!name) return jsonResponse({ error: 'name is required' }, 400);
      const { instanceUrl, accessToken } = await getPeerTubeClient(c.env);
      const ptForm = new FormData();
      ptForm.append('videofile', videoFile, videoFile.name);
      ptForm.append('name', name.slice(0, 120));
      ptForm.append('privacy', (formData.get('privacy') as string) ?? '1');
      ptForm.append('commentsEnabled', (formData.get('commentsEnabled') as string) ?? 'true');
      ptForm.append('downloadEnabled', (formData.get('downloadEnabled') as string) ?? 'false');
      ptForm.append('nsfw', (formData.get('nsfw') as string) ?? 'false');
      ptForm.append('waitTranscoding', 'true');
      const description = formData.get('description') as string;
      if (description) ptForm.append('description', description);
      const category = formData.get('category') as string;
      if (category) ptForm.append('category', category);
      const language = formData.get('language') as string;
      if (language) ptForm.append('language', language);
      const tags = formData.get('tags') as string;
      if (tags) {
        for (const tag of tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 5))
          ptForm.append('tags', tag);
      }
      ptForm.append('tags', 'degenfeed');
      const thumbnailFile = formData.get('thumbnailfile') as File | null;
      if (thumbnailFile) ptForm.append('thumbnailfile', thumbnailFile);
      ptForm.append(
        'pluginData',
        JSON.stringify({ degenfeed: { platform: 'degenfeed', version: '1.0' } }),
      );
      const channelId = formData.get('channelId') as string;
      ptForm.append('channelId', channelId ?? '1');
      const response = await fetch(`${instanceUrl}/api/v1/videos/upload`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'user-agent': 'DegenFeed/1.0' },
        body: ptForm,
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => 'unknown');
        return jsonResponse(
          { error: `PeerTube upload failed: ${response.status} — ${errBody}` },
          response.status,
        );
      }
      const result = (await response.json()) as {
        video: {
          id: number;
          uuid: string;
          shortUUID: string;
          name: string;
          url: string;
          embedPath: string;
        };
      };
      return noCacheJsonResponse(
        {
          video: {
            uuid: result.video.uuid,
            shortUUID: result.video.shortUUID,
            name: result.video.name,
            url: result.video.url,
            embedUrl: `${instanceUrl}${result.video.embedPath}`,
            embedCode: `<iframe width="560" height="315" src="${instanceUrl}${result.video.embedPath}" title="${result.video.name}" frameborder="0" allowfullscreen></iframe>`,
            id: result.video.id,
          },
        },
        201,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonResponse({ error: `Upload failed: ${msg}` }, 500);
    }
  });

  router.get('/videos', async (c) => {
    try {
      const response = await peertubeFetch(c.env, '/api/v1/videos', {
        params: {
          search: c.req.query('search'),
          categoryOneOf: c.req.query('category'),
          isLive: c.req.query('isLive'),
          sort: c.req.query('sort') ?? '-publishedAt',
          start: c.req.query('start') ?? '1',
          count: c.req.query('count') ?? '20',
          nsfw: c.req.query('nsfw'),
          tagsOneOf: c.req.query('tags'),
        } as Record<string, string | number | boolean | undefined>,
      });
      const data = (await response.json()) as PaginatedResponse<PeerTubeVideo>;
      const { instanceUrl } = await getPeerTubeClient(c.env);
      return noCacheJsonResponse({
        total: data.total,
        data: data.data.map((v) => mapVideoForResponse(v, instanceUrl)),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonResponse({ error: `Failed to list videos: ${msg}` }, 500);
    }
  });

  router.get('/videos/:id', async (c) => {
    try {
      const videoId = c.req.param('id');
      const response = await peertubeFetch(c.env, `/api/v1/videos/${videoId}`);
      const video = (await response.json()) as PeerTubeVideo;
      const { instanceUrl } = await getPeerTubeClient(c.env);
      return noCacheJsonResponse({ video: mapVideoForResponse(video, instanceUrl) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonResponse({ error: `Failed to get video: ${msg}` }, 500);
    }
  });

  router.post('/videos/:id/rate', async (c) => {
    try {
      const videoId = c.req.param('id');
      const body = (await c.req.json()) as { rating?: string };
      if (!body.rating || !['like', 'dislike'].includes(body.rating))
        return jsonResponse({ error: 'rating must be "like" or "dislike"' }, 400);
      await peertubeFetch(c.env, `/api/v1/videos/${videoId}/rate`, {
        method: 'PUT',
        body: JSON.stringify({ rating: body.rating }),
      });
      return jsonResponse({ ok: true, rating: body.rating });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonResponse({ error: `Failed to rate video: ${msg}` }, 500);
    }
  });
}
