/**
 * @degenfeed/api-worker — Nostr NIP-71 Video Events Bridge
 *
 * Fetches video events from Nostr relays using NIP-71 specification.
 * NIP-71 defines kind 31388 for video events with `imeta` tags for
 * video URLs, dimensions, and metadata.
 *
 * Also falls back to kind 1 posts with video URLs.
 * Error recovery: individual relay failures never break the feed.
 */

import type { UnifiedVideo } from '../video-aggregator';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
];

export async function fetchNip71Videos(relayUrls: string[], limit = 20): Promise<UnifiedVideo[]> {
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  const results: UnifiedVideo[] = [];
  const seen = new Set<string>();

  for (const relay of relays.slice(0, 4)) {
    if (results.length >= limit) break;
    try {
      const restUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');

      // Try REST API first (some relays expose it)
      const res = await fetch(
        `${restUrl}/api/v1/events?kinds=31388&limit=${Math.ceil(limit / 4)}`,
        {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!res.ok) continue;

      const events = (await res.json()) as Array<{
        id: string;
        pubkey: string;
        content: string;
        created_at: number;
        tags: string[][];
      }>;

      for (const ev of Array.isArray(events) ? events : []) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);

        // NIP-71: Extract video info from imeta tags
        const imetaTag = ev.tags.find((t) => t[0] === 'imeta');
        const titleTag = ev.tags.find((t) => t[0] === 'title');
        const imageTag = ev.tags.find((t) => t[0] === 'image');
        const durationTag = ev.tags.find((t) => t[0] === 'duration');
        const _blurhashTag = ev.tags.find((t) => t[0] === 'blurhash');

        let videoUrl: string | undefined;
        let thumbnailUrl: string | undefined;
        let title: string | undefined;
        let duration = 0;

        // Parse imeta tag for url
        if (imetaTag) {
          for (const entry of imetaTag) {
            if (entry.startsWith('url ')) videoUrl = entry.slice(4);
            if (entry.startsWith('dim ') && duration === 0) {
              const dimParts = entry.slice(4).split('x');
              if (dimParts.length === 2) {
                // dim for video is width x height
              }
            }
          }
        }

        // Also check content for direct video URLs
        if (!videoUrl) {
          const urlMatch = ev.content.match(
            /(https?:\/\/[^\s]+\.(?:mp4|webm|mov|m3u8))(?:\?[^\s]*)?/i,
          );
          videoUrl = urlMatch?.[1] ?? undefined;
        }

        if (!videoUrl) continue;

        title = titleTag?.[1] ?? ev.content.slice(0, 100);
        thumbnailUrl = imageTag?.[1] ?? undefined;
        duration = durationTag?.[1] ? Number(durationTag[1]) : 0;

        // Get text content tags for description
        const textTags = ev.tags.filter((t) => t[0] === 'content' || t[0] === 'summary');
        const description = textTags.map((t) => t[1]).join(' ') || ev.content;

        results.push({
          id: `nip71:${ev.id}`,
          title: title ?? 'Nostr Video',
          description: description.slice(0, 500),
          thumbnail: thumbnailUrl ?? '',
          url: videoUrl,
          duration,
          platform: 'nostr' as const,
          platformLabel: 'Nostr Video',
          platformColor: '#8B5CF6',
          creatorName: `npub1${ev.pubkey.slice(0, 8)}...`,
          creatorId: ev.pubkey,
          creatorAvatar: '',
          creatorUrl: `https://snort.social/p/${ev.pubkey}`,
          viewCount: 0,
          likeCount: 0,
          publishedAt: new Date(ev.created_at * 1000).toISOString(),
          publishedMs: ev.created_at * 1000,
          category: 'entertainment',
          tags: ev.tags
            .filter((t) => t[0] === 't')
            .map((t) => t[1])
            .filter(Boolean),
          isShort: duration > 0 && duration <= 120,
          isLive: false,
          qualityScore: 30,
        });
      }
    } catch {}
  }

  return results;
}

export async function searchNip71Videos(
  _relayUrls: string[],
  _query: string,
): Promise<UnifiedVideo[]> {
  // NIP-71 doesn't have a search mechanism over relays directly.
  // This would use NIP-50 search or a relay that supports search.
  // For now, return empty — real search requires NIP-50 support.
  return [];
}

/**
 * Fetch kind 1 posts that contain video URLs (fallback for NIP-71).
 * Used when NIP-71 events are sparse.
 */
export async function fetchKind1Videos(relayUrls: string[], limit = 10): Promise<UnifiedVideo[]> {
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  const results: UnifiedVideo[] = [];

  for (const relay of relays.slice(0, 2)) {
    try {
      const restUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');
      const res = await fetch(`${restUrl}/api/v1/events?kinds=1&limit=${limit}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;

      const events = (await res.json()) as Array<{
        id: string;
        pubkey: string;
        content: string;
        created_at: number;
        tags: string[][];
      }>;

      for (const ev of Array.isArray(events) ? events : []) {
        const videoUrl = ev.content.match(
          /(https?:\/\/[^\s]+\.(?:mp4|webm|mov|m3u8))(?:\?[^\s]*)?/i,
        )?.[1];
        if (!videoUrl) continue;

        results.push({
          id: `nostr-video:${ev.id}`,
          title: ev.content.slice(0, 100),
          description: ev.content.slice(0, 500),
          thumbnail: '',
          url: videoUrl,
          duration: 0,
          platform: 'nostr' as const,
          platformLabel: 'Nostr',
          platformColor: '#8B5CF6',
          creatorName: `npub1${ev.pubkey.slice(0, 8)}...`,
          creatorId: ev.pubkey,
          creatorAvatar: '',
          creatorUrl: `https://snort.social/p/${ev.pubkey}`,
          viewCount: 0,
          likeCount: 0,
          publishedAt: new Date(ev.created_at * 1000).toISOString(),
          publishedMs: ev.created_at * 1000,
          category: 'entertainment',
          tags: ev.tags
            .filter((t) => t[0] === 't')
            .map((t) => t[1])
            .filter(Boolean),
          isShort: true,
          isLive: false,
          qualityScore: 20,
        });
      }
    } catch {}
  }

  return results;
}
