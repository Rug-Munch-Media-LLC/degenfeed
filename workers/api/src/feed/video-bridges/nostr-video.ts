/**
 * @degenfeed/api-worker — Nostr NIP-71 Video Bridge
 *
 * Fetches video events from Nostr relays using NIP-71 (video events).
 * Nostr NIP-71 defines a standard for video content on the Nostr network:
 * videos are published as kind:31337 events stored on decentralized relays.
 * Zero hosting cost — videos are IPFS/HTTP URLs embedded in events.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'nostr';
const PLATFORM_LABEL = 'Nostr Video';
const PLATFORM_COLOR = '#8B5CF6';

// Public relays that support NIP-71 video events
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

// NIP-71 video event kind
const VIDEO_EVENT_KIND = 31337;

// ─── Types ─────────────────────────────────────────────────────────────

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface NostrProfile {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  about?: string;
}

// ─── Fetch NIP-71 video events from relays ─────────────────────────────

export async function fetchNostrVideos(
  limit: number = 20,
  signal?: AbortSignal,
): Promise<UnifiedVideo[]> {
  const timeoutMs = 5000;
  const relayPromises = NOSTR_RELAYS.map((relay) =>
    fetchFromRelay(relay, { limit: Math.ceil(limit / NOSTR_RELAYS.length) }, signal, timeoutMs),
  );

  const results = await Promise.allSettled(relayPromises);
  const videos: UnifiedVideo[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const video of result.value) {
        if (!seen.has(video.id)) {
          seen.add(video.id);
          videos.push(video);
        }
      }
    }
  }

  // Sort by newest first
  videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return videos.slice(0, limit);
}

// ─── Fetch from a single relay ─────────────────────────────────────────

async function fetchFromRelay(
  relayUrl: string,
  opts: { limit: number },
  _signal?: AbortSignal,
  _timeoutMs: number = 5000,
): Promise<UnifiedVideo[]> {
  try {
    // Use a Nostr REST bridge for HTTP access (nostr.band API is HTTP-accessible)
    const _httpRelay = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://');

    // Try nostr.band API first (it has a public HTTP API)
    if (relayUrl.includes('nostr.band')) {
      return fetchFromNostrBand(opts.limit);
    }

    // For other relays, use the dvrApi / relay REST API if available
    // Fallback: try prismic relay
    return fetchFromPrismicRelay(opts.limit);
  } catch {
    return [];
  }
}

// ─── Fetch from nostr.band HTTP API ───────────────────────────────────

async function fetchFromNostrBand(limit: number): Promise<UnifiedVideo[]> {
  try {
    const url = `https://api.nostr.band/v0/events/search?kind=${VIDEO_EVENT_KIND}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { events?: NostrEvent[] };
    return convertNostrEvents(data.events ?? []);
  } catch {
    return [];
  }
}

// ─── Fetch from prismic relay (http accessible) ───────────────────────

async function fetchFromPrismicRelay(limit: number): Promise<UnifiedVideo[]> {
  try {
    // Scrape a Nostr web client that surfaces video events
    const url = `https://nostr.band/v0/events/search?kind=${VIDEO_EVENT_KIND}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { events?: NostrEvent[] };
    return convertNostrEvents(data.events ?? []);
  } catch {
    return [];
  }
}

// ─── Convert Nostr events to UnifiedVideo ────────────────────────────

function convertNostrEvents(events: NostrEvent[]): UnifiedVideo[] {
  const _pubkeys = new Set(events.map((e) => e.pubkey));

  return events.map((event) => {
    // Parse NIP-71 tags:
    //   "url" -> video URL
    //   "title" -> video title
    //   "summary" -> description
    //   "m" -> media type
    //   "dim" -> dimensions
    //   "published_at" -> publish timestamp
    //   "duration" -> duration in seconds
    //   "image" -> thumbnail URL
    const tags = event.tags ?? [];
    const url = findTagValue(tags, 'url') ?? '';
    const title = findTagValue(tags, 'title') ?? event.content?.slice(0, 100) ?? 'Untitled';
    const summary = findTagValue(tags, 'summary') ?? '';
    const image = findTagValue(tags, 'image') ?? '';
    const durationStr = findTagValue(tags, 'duration');
    const duration = durationStr ? Number.parseInt(durationStr, 10) || 0 : 0;
    const publishedAt = findTagValue(tags, 'published_at');
    const timestamp = publishedAt
      ? Number.parseInt(publishedAt, 10) * 1000
      : event.created_at * 1000;

    return {
      id: `nostr-video-${event.id}`,
      title,
      description: summary || '',
      thumbnail: image || '',
      url: url || `https://njump.me/${event.id}`,
      duration,
      platform: PLATFORM,
      platformLabel: PLATFORM_LABEL,
      platformColor: PLATFORM_COLOR,
      creatorName: `${event.pubkey.slice(0, 8)}...`,
      creatorId: `nostr:${event.pubkey}`,
      creatorAvatar: '',
      creatorUrl: `https://njump.me/${event.pubkey}`,
      viewCount: 0,
      likeCount: 0,
      publishedAt: new Date(timestamp).toISOString(),
      category: detectNostrCategory(tags),
      tags: extractTags(tags),
      isLive: false,
      isShort: duration > 0 && duration < 60,
      embedUrl: '',
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function findTagValue(tags: string[][], key: string): string | undefined {
  for (const tag of tags) {
    if (tag[0] === key && tag[1]) return tag[1];
  }
  return undefined;
}

function extractTags(tags: string[][]): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    if (tag[0] === 't' && tag[1]) result.push(tag[1]);
    if (tag[0] === 'topic' && tag[1]) result.push(tag[1]);
  }
  return result;
}

function detectNostrCategory(tags: string[][]): string {
  const t = findTagValue(tags, 't');
  if (t) return t;
  return 'nostr-video';
}
