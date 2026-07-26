/**
 * @degenfeed/api-worker — Bluesky Feed Generator Route
 *
 * Serves the DegenFeed Live feed generator endpoint that Bluesky
 * calls to get the skeleton feed of live streams and audio spaces.
 *
 * Also provides a management route to register/update the feed
 * generator record on the Bluesky PDS.
 *
 * Routes:
 *   GET  /api/bluesky/feed/describe  — Describe the feed generator
 *   GET  /api/bluesky/feed/skeleton  — Get the feed skeleton (called by Bluesky)
 *   POST /api/bluesky/feed/register  — Register/update the feed generator on PDS
 *   GET  /api/bluesky/feed/streams   — List live streams for the feed
 */

import {
  DEGENFEED_FEED_DISPLAY_NAME,
  DEGENFEED_FEED_GENERATOR_DID,
  DEGENFEED_FEED_URI,
  FeedGenEndpoint,
  registerFeedGenerator,
  type StreamFeedEntry,
  skeletonFromStreams,
} from '@degenfeed/bluesky-sdk/feed-generator';
import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Router ─────────────────────────────────────────────────────────────

const blueskyFeedGen = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════
// GET /describe — Describe the feed generator
// ═══════════════════════════════════════════════════════════════════════
// Called by Bluesky to get feed generator metadata (DID, name, description).

blueskyFeedGen.get('/describe', async (_c) => {
  const endpoint = new FeedGenEndpoint();
  const description = endpoint.describeFeedGenerator();
  return jsonResponse(description);
});

// ═══════════════════════════════════════════════════════════════════════
// GET /skeleton — Get the current feed skeleton
// ═══════════════════════════════════════════════════════════════════════
// Called by Bluesky infrastructure to get the ordered list of live stream
// post URIs. Accepts optional cursor and limit parameters.

blueskyFeedGen.get('/skeleton', async (c) => {
  const _feed = c.req.query('feed') || DEGENFEED_FEED_URI;
  const cursor = c.req.query('cursor') ?? undefined;
  const _limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 50);

  try {
    // Fetch current live streams
    const liveStreams = await fetchLiveStreamsForFeed(c.env);

    // Convert to Bluesky skeleton format
    const skeleton = skeletonFromStreams(liveStreams, 'https://app.degenfeed.xyz', cursor);

    return noCacheJsonResponse(skeleton);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Feed skeleton fetch failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /streams — List live streams as feed entries
// ═══════════════════════════════════════════════════════════════════════
// Utility endpoint to see what streams are currently live and would
// appear in the Bluesky feed.

blueskyFeedGen.get('/streams', async (c) => {
  try {
    const streams = await fetchLiveStreamsForFeed(c.env);
    return noCacheJsonResponse({ streams, count: streams.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch live streams: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /register — Register the feed generator on Bluesky PDS
// ═══════════════════════════════════════════════════════════════════════
// Authenticates with the feed generator account and creates/updates the
// app.bsky.feed.generator record so Bluesky discovers the feed.

blueskyFeedGen.post('/register', async (c) => {
  let body: {
    password?: string;
    pdsUrl?: string;
    displayName?: string;
    description?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.password) {
    return jsonResponse({ error: 'Feed generator account password is required' }, 400);
  }

  try {
    const result = await registerFeedGenerator({
      did: DEGENFEED_FEED_GENERATOR_DID,
      password: body.password,
      pdsUrl: body.pdsUrl,
      displayName: body.displayName,
      description: body.description,
    });

    return jsonResponse(
      {
        ok: true,
        uri: result.uri,
        did: DEGENFEED_FEED_GENERATOR_DID,
        displayName: body.displayName || DEGENFEED_FEED_DISPLAY_NAME,
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Feed generator registration failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Internal: fetch live streams for the feed
// ═══════════════════════════════════════════════════════════════════════

async function fetchLiveStreamsForFeed(env: Env): Promise<StreamFeedEntry[]> {
  try {
    // Fetch from KV live index
    const raw = await env.CONTENT_STORE?.get('stream:live');
    if (!raw) return [];

    const ids: string[] = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length === 0) return [];

    // Fetch all live streams in parallel
    const streams = await Promise.all(
      ids.slice(0, 30).map(async (id) => {
        try {
          const record = await env.CONTENT_STORE?.get(`stream:${id}`);
          if (!record) return null;

          const parsed = JSON.parse(record) as Record<string, unknown>;
          if (!parsed.isLive) return null;

          return {
            id: parsed.id as string,
            title: (parsed.title as string) || 'Untitled Stream',
            creator: (parsed.creator as string) || '',
            creatorHandle:
              (parsed.creatorHandle as string) || (parsed.creator as string)?.slice(0, 10),
            thumbnail: parsed.thumbnail as string | undefined,
            streamUrl:
              (parsed.streamUrl as string) || `https://app.degenfeed.xyz/live/${parsed.id}`,
            isLive: true,
            viewerCount: (parsed.viewerCount as number) ?? 0,
            startedAt: (parsed.startedAt as number) ?? Date.now(),
            type: (parsed.type as StreamFeedEntry['type']) || 'solo',
          } as StreamFeedEntry;
        } catch {
          return null;
        }
      }),
    );

    // Filter out nulls and sort by startedAt descending
    const validStreams = streams.filter((s): s is NonNullable<typeof s> => s !== null);
    return validStreams.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export default blueskyFeedGen;
