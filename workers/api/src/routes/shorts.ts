/**
 * @routes/shorts — Short-form video feed endpoint
 *
 * Returns ranked short-form videos from PeerTube and YouTube,
 * deduplicated and scored by user interest signals.
 *
 * GET /api/shorts?limit=20&topics=defi,nft&cursor=...
 */

import type { ShortVideoItem } from '@degenfeed/shorts-provider';
import { fetchShortsFeed } from '@degenfeed/shorts-provider';
import { rankShorts } from '@degenfeed/shorts-provider/scorer';
import type { Env } from '../index';
import { jsonResponse } from '../index';

// ─── Response types ───────────────────────────────────────────────────────

interface ShortsResponse {
  videos: ShortVideoItem[];
  sources: {
    peertube: number;
    youtube: number;
  };
  cursor: string | null;
  hasMore: boolean;
}

export interface UserInterestProfile {
  topics: Record<string, number>;
  wallet?: string;
}

// ─── Default user profile for unauthenticated requests ────────────────────

const DEFAULT_USER_PROFILE: UserInterestProfile = {
  topics: {
    crypto: 0.8,
    defi: 0.7,
    bitcoin: 0.7,
    ethereum: 0.6,
    trading: 0.6,
    nft: 0.5,
    memecoin: 0.4,
    ai: 0.5,
    security: 0.4,
    macro: 0.5,
    layer2: 0.5,
    onchain: 0.6,
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────

/**
 * Handle GET /api/shorts
 *
 * Query params:
 *   - limit  (number, default 20)  — max videos to return
 *   - cursor (string)              — pagination cursor (last video ID)
 *   - topics (string, comma-sep)   — topic filter (e.g. "defi,nft,trading")
 */
export async function handleShortsFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;
  const topicsParam = url.searchParams.get('topics') || '';
  const topicFilter = topicsParam ? topicsParam.split(',').filter(Boolean) : [];

  // Fetch from all sources in parallel
  const feed = await fetchShortsFeed({ limit: limit * 2 });

  let videos = feed.videos;

  // Apply cursor-based pagination (skip up to cursor)
  if (cursor) {
    const cursorIdx = videos.findIndex((v) => v.id === cursor);
    if (cursorIdx >= 0) {
      videos = videos.slice(cursorIdx + 1);
    }
  }

  // Apply topic filter if specified
  if (topicFilter.length > 0) {
    videos = videos.filter((v) => v.topics.some((t) => topicFilter.includes(t)));
  }

  // Build user profile — from KV/wallet in future, default for now
  const userProfile = await loadUserProfile(request, env);

  // Build seen IDs from request context (cookie, header, etc.)
  const seenIds = parseSeenIds(request);

  // Rank by user interests
  const ranked = rankShorts(videos, userProfile, seenIds, limit);

  const response: ShortsResponse = {
    videos: ranked,
    sources: feed.sources,
    cursor: ranked.length > 0 ? (ranked[ranked.length - 1]?.id ?? null) : null,
    hasMore: videos.length > limit,
  };

  return jsonResponse(response);
}

// ─── User profile loading ─────────────────────────────────────────────────

/**
 * Load user interest profile from session or KV storage.
 * Falls back to default profile for anonymous requests.
 */
async function loadUserProfile(_request: Request, _env: Env): Promise<UserInterestProfile> {
  // TODO: Load from KV-based user preferences when session is available
  // const session = await requireSession(request, env);
  // if (session) { load from env.CACHE or env.PREFERENCES }
  return DEFAULT_USER_PROFILE;
}

// ─── Seen IDs parsing ─────────────────────────────────────────────────────

/**
 * Parse already-seen video IDs from request headers or cookies.
 * Clients send seen IDs as a comma-separated header or cookie.
 */
function parseSeenIds(request: Request): Set<string> {
  const seen = new Set<string>();

  // Check for X-Shorts-Seen header
  const header = request.headers.get('x-shorts-seen');
  if (header) {
    for (const id of header.split(',')) {
      const trimmed = id.trim();
      if (trimmed) seen.add(trimmed);
    }
  }

  // Check for shorts-seen cookie
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/shorts-seen=([^;]+)/);
  if (match?.[1]) {
    try {
      const decoded = decodeURIComponent(match[1]);
      for (const id of decoded.split(',')) {
        const trimmed = id.trim();
        if (trimmed) seen.add(trimmed);
      }
    } catch {
      // Malformed cookie — ignore
    }
  }

  return seen;
}
