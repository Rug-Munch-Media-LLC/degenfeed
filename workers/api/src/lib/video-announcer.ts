/**
 * @degenfeed/api-worker — Video Auto-Crosspost Announcer
 *
 * Part D of the Video Wrapper system. When a video is published (e.g. to
 * PeerTube via POST /api/peertube/upload), this module auto-announces it on
 * every supported protocol:
 *
 *   - Nostr      → NIP-71 video event (kind 34235/34236) with a Blossom URL
 *                  for shorts (<20MB) or the canonical file URL for VODs,
 *                  published to env.RELAY_URLS.
 *   - ActivityPub→ handled natively by PeerTube federation (no code; the
 *                  result records the expected native status).
 *   - RSS        → appends a Media RSS item (with <enclosure>) to the
 *                  KV-backed video announcement feed served by
 *                  GET /api/video/rss.xml.
 *
 * Fail-open: each protocol is independent; a failure never throws and never
 * blocks the caller (the PeerTube upload still succeeds).
 */

import { createVideoEvent, getPublicKey, publishVideoEvent } from '@degenfeed/nostr-sdk';
import { log } from '../logger';
import { type RssVideoItem, VIDEO_RSS_KV_KEY } from '../routes/video/embed';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AnnouncedVideo {
  /** Unique video id (e.g. PeerTube uuid) */
  id: string;
  /** Video title */
  title: string;
  /** Canonical watch URL (e.g. PeerTube /videos/watch/{uuid}) */
  url: string;
  /** Direct media file URL (mp4/webm) — used for NIP-71 url and RSS enclosure */
  fileUrl: string;
  /** MIME type of the direct file (default video/mp4) */
  mimeType?: string;
  /** File size in bytes (for NIP-71 size tag and RSS enclosure length) */
  sizeBytes?: number;
  /** Thumbnail URL (optional) */
  thumbnailUrl?: string;
  /** Short description / summary (optional) */
  description?: string;
  /** Duration in seconds (optional) */
  duration?: number;
  /** Content tags / hashtags (optional) */
  tags?: string[];
  /** Published timestamp (ms). Defaults to now. */
  publishedAt?: number;
}

export interface AnnounceResult {
  /** True if at least one protocol announcement succeeded. */
  ok: boolean;
  nostr?: {
    ok: boolean;
    eventId?: string;
    successful?: string[];
    failed?: string[];
    error?: string;
  };
  activitypub?: {
    ok: boolean;
    note: string;
  };
  rss?: {
    ok: boolean;
    error?: string;
  };
  announcedAt: number;
}

// ─── Default relays ─────────────────────────────────────────────────────

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
];

// ─── RSS feed helpers (shared with routes/video/embed.ts) ───────────────

/** Append a video announcement to the KV-backed Media RSS list (newest first). */
export async function appendAnnouncedVideo(env: Env, item: RssVideoItem): Promise<boolean> {
  try {
    const raw = await env.CACHE?.get(VIDEO_RSS_KV_KEY);
    let list: RssVideoItem[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RssVideoItem[];
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = [];
      }
    }
    // Dedupe by id, then prepend (newest first) and cap at 200.
    list = [item, ...list.filter((i) => i.id !== item.id)].slice(0, 200);
    await env.CACHE?.put(VIDEO_RSS_KV_KEY, JSON.stringify(list), {
      expirationTtl: 86400 * 365,
    });
    return true;
  } catch (err) {
    log('warn', '[video-announcer] RSS append failed', err);
    return false;
  }
}

// ─── Main announcer ─────────────────────────────────────────────────────

/**
 * Auto-announce a newly published video across all supported protocols.
 *
 * @param env - Worker env (RELAY_URLS, NOSTR_NSEC/NOSTR_PRIVATE_KEY, CACHE)
 * @param video - Canonical video metadata
 * @param opts - Optional overrides (e.g. useBlossom to prefer a Blossom URL)
 * @returns Per-protocol results. Never throws.
 */
export async function announceVideoPublished(
  env: Env,
  video: AnnouncedVideo,
  opts: { useBlossom?: boolean } = {},
): Promise<AnnounceResult> {
  const announcedAt = Date.now();
  const result: AnnounceResult = { ok: false, announcedAt };
  const relays = (env.RELAY_URLS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const resolvedRelays = relays.length > 0 ? relays : DEFAULT_RELAYS;

  // ─── 1. Nostr NIP-71 ─────────────────────────────────────────────
  const secretKey = env.NOSTR_NSEC || env.NOSTR_PRIVATE_KEY;
  if (secretKey) {
    try {
      const _pubkey = getPublicKey(secretKey);
      // For shorts (<20MB) we prefer the Blossom URL already on the event
      // (the upload path sets video.fileUrl to the Blossom blob). VODs use
      // the direct PeerTube file URL.
      const isShort = (video.duration ?? 0) <= 180 || opts.useBlossom === true;
      const event = createVideoEvent(
        {
          id: video.id,
          title: video.title.slice(0, 256),
          url: video.fileUrl || video.url,
          mimeType: video.mimeType ?? 'video/mp4',
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          size: video.sizeBytes,
          summary: video.description || undefined,
          isShort,
          publishedAt: video.publishedAt ?? announcedAt,
          tags: video.tags ?? [],
        },
        secretKey,
      );

      const publishResult = await publishVideoEvent(event, resolvedRelays, 10_000);
      result.nostr = {
        ok: publishResult.successful.length > 0,
        eventId: publishResult.eventId,
        successful: publishResult.successful,
        failed: publishResult.failed,
      };
      log('info', '[video-announcer] Nostr NIP-71 published', {
        eventId: publishResult.eventId,
        successful: publishResult.successful.length,
        failed: publishResult.failed.length,
      });
    } catch (err) {
      result.nostr = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      log('warn', '[video-announcer] Nostr publish failed', err);
    }
  } else {
    result.nostr = {
      ok: false,
      error: 'No NOSTR_NSEC/NOSTR_PRIVATE_KEY configured — NIP-71 announce skipped',
    };
  }

  // ─── 2. ActivityPub (native) ─────────────────────────────────────
  // PeerTube federates a Video object automatically on publish. Nothing to
  // send; record the expected status for observability.
  result.activitypub = {
    ok: true,
    note: 'PeerTube handles ActivityPub federation natively on publish',
  };

  // ─── 3. RSS Media enclosure ──────────────────────────────────────
  const rssItem: RssVideoItem = {
    id: video.id,
    title: video.title,
    url: video.url,
    enclosureUrl: video.fileUrl || video.url,
    enclosureType: video.mimeType ?? 'video/mp4',
    enclosureLength: video.sizeBytes,
    thumbnailUrl: video.thumbnailUrl,
    description: video.description,
    publishedAt: video.publishedAt ?? announcedAt,
  };
  const rssOk = await appendAnnouncedVideo(env, rssItem);
  result.rss = { ok: rssOk, error: rssOk ? undefined : 'KV append failed' };

  result.ok = !!(result.nostr?.ok || result.activitypub?.ok || result.rss?.ok);
  return result;
}

// ─── Convenience for the PeerTube upload handler ────────────────────────

/**
 * Build an AnnouncedVideo from a PeerTube upload response shape.
 * The upload route passes the PeerTube API's `result.video` object.
 */
export function announcedVideoFromPeerTube(params: {
  id: string;
  title: string;
  url: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbnailUrl?: string;
  description?: string;
  duration?: number;
  tags?: string[];
}): AnnouncedVideo {
  const {
    id,
    title,
    url,
    fileUrl,
    mimeType,
    sizeBytes,
    thumbnailUrl,
    description,
    duration,
    tags,
  } = params;
  return {
    id,
    title,
    url,
    fileUrl: fileUrl || url,
    mimeType,
    sizeBytes,
    thumbnailUrl,
    description,
    duration,
    tags,
    publishedAt: Date.now(),
  };
}
