/**
 * @degenfeed/api-worker — Farcaster Frame Routes
 *
 * Complete Frame system matching Farcaster's exact spec for streams, spaces,
 * creator coins, and token-gated access.
 *
 * Implements:
 *   - Frames v1: fc:frame:image + buttons (standard Farcaster Frames)
 *   - Video Frames: fc:frame:video + fc:frame:video:type (HLS streaming)
 *   - Live Activity: fc:live=1 + manifest (FIP #269)
 *   - Frames v2 Ready: FC frame JSON + manifest at /.well-known/farcaster.json
 *   - Dynamic SVG badge images for frames
 *   - Token-gated stream frames with balance check
 *   - Post frame to Farcaster via Hubble
 * Routes:
 *   GET  /api/farcaster/frames/stream/:id         — Frame for a live stream
 *   GET  /api/farcaster/frames/stream/:id/gated   — Token-gated stream frame
 *   GET  /api/farcaster/frames/stream/:id/image   — Dynamic SVG badge for stream
 *   GET  /api/farcaster/frames/space/:id          — Frame for an audio space
 *   GET  /api/farcaster/frames/space/:id/image    — Dynamic SVG badge for space
 *   GET  /api/farcaster/frames/coin/:symbol       — Frame for a creator coin
 *   POST /api/farcaster/frames/post               — Post frame as a Farcaster cast
 *   POST /api/farcaster/frames/post-to-channel    — Post frame to a Farcaster channel
 *   POST /api/farcaster/frames/announce-stream    — Announce stream to channels
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  type FarcasterChannel,
  getRelevantChannels,
  postCastToFarcaster,
} from '../lib/farcaster-channel';
import { generateFrameHtml, type LiveActivityMeta } from '../lib/farcaster-live';
import { requireSession } from '../session';

// ─── Router ─────────────────────────────────────────────────────────────────

const frames = new Hono<{ Bindings: Env }>();

// ─── KV Helpers ─────────────────────────────────────────────────────────────

const STREAM_PREFIX = 'stream:record:';
const SPACE_PREFIX = 'spaces:';
const COIN_PREFIX = 'farcaster:coin:';

async function getStream(env: Env, id: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await env.CONTENT_STORE?.get(`${STREAM_PREFIX}${id}`);
    if (!raw) {
      // Try STREAMS KV
      const raw2 = await env.STREAMS?.get(`${STREAM_PREFIX}${id}`);
      if (!raw2) return null;
      return JSON.parse(raw2) as Record<string, unknown>;
    }
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getSpace(env: Env, id: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await env.SPACES?.get(`${SPACE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getCreatorCoin(env: Env, symbol: string): Promise<Record<string, unknown> | null> {
  try {
    // Search across all coin KV entries (FARCASTER_COINS)
    const key = `${COIN_PREFIX}${symbol.toLowerCase()}`;
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as Record<string, unknown>;

    // Also check FARCASTER_COINS KV
    const raw2 = await env.FARCASTER_COINS?.get(key);
    if (raw2) return JSON.parse(raw2) as Record<string, unknown>;

    return null;
  } catch {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════════════

