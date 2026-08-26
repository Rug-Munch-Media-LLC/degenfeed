/**
 * MediaGoblin Provider
 *
 * Fetches media from MediaGoblin — GNU's free and federated media hosting platform.
 * Supports images, video, and audio with ActivityPub federation.
 *
 * API: REST at public MediaGoblin instances
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const GOBLIN_INSTANCES = ['https://mediagoblin.org', 'https://goblin.hell.sh'];

// ─── Types ─────────────────────────────────────────────────────────────

interface GoblinMediaEntry {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  author_url?: string;
  license?: string;
  created: string;
  media_type: string;
  media_files?: {
    original?: string;
    medium?: string;
    thumb?: string;
  };
  tags_raw?: string[];
  likes?: number;
  comments_enabled?: boolean;
  state?: string; // 'published' etc
}

interface GoblinFeedResponse {
  media_entries?: GoblinMediaEntry[];
  entries?: GoblinMediaEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();
  const niches: string[] = [];
  if (/\b(photo|image|picture|photography|art|illustration|design)\b/.test(lower))
    niches.push('art');
  if (/\b(video|film|movie|cinema|animation)\b/.test(lower)) niches.push('video');
  if (/\b(music|audio|song|sound|recording)\b/.test(lower)) niches.push('music');
  if (/\b(creative|commons|free culture|open source|gnu|fsf)\b/.test(lower)) niches.push('culture');
  if (/\b(tech|technology|software|programming|3d|modeling)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('art');
  return niches;
}

async function fetchFromInstance(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${instance}/api/entries/?limit=${Math.min(limit, 20)}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GoblinFeedResponse;
    const entries = data.media_entries || data.entries || [];
    if (!Array.isArray(entries)) return [];

    return entries
      .filter((e) => e.state !== 'disabled')
      .slice(0, limit)
      .map((entry) => {
        const text = entry.title
          ? `${entry.title}\n\n${entry.description || ''}`.trim()
          : entry.description || '';
        const mediaUrl = entry.media_files?.original || entry.media_files?.medium || '';
        const thumbUrl = entry.media_files?.thumb || entry.media_files?.medium || '';
        const isVideo = entry.media_type?.startsWith('video') || false;
        const isImage = entry.media_type?.startsWith('image') || false;

        return {
          id: `mediagoblin:${entry.id}`,
          protocol: 'mediagoblin',
          author: {
            id: `mediagoblin:${entry.author}`,
            primary: { protocol: 'mediagoblin', id: entry.author },
            handles: { mediagoblin: entry.author },
            displayName: entry.author,
            bio: '',
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text,
          embeds: [
            ...(mediaUrl
              ? [{ kind: (isVideo ? 'video' : 'image') as 'image' | 'video', url: mediaUrl }]
              : []),
            ...(thumbUrl && thumbUrl !== mediaUrl
              ? [{ kind: 'image' as const, url: thumbUrl }]
              : []),
          ],
          contentType: isVideo ? 'video' : isImage ? 'image' : 'text',
          createdAt: new Date(entry.created).getTime(),
          metrics: { likes: entry.likes || 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: entry.likes || 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: entry,
          niches: guessNiches(text, entry.tags_raw),
        };
      });
  } catch (err) {
    // console.log(`[bridge] MediaGoblin error (${instance}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'mediagoblin',
  name: 'MediaGoblin',
  description: 'GNU federated media hosting (images, video, audio)',
  endpoint: '/api/feed/mediagoblin',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchMediaGoblinPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(5, Math.ceil(limit / GOBLIN_INSTANCES.length));

  const results = await Promise.allSettled(
    GOBLIN_INSTANCES.map((inst) => fetchFromInstance(inst, perInstance)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] MediaGoblin: ${deduped.length} entries`);
  return deduped;
}

/** @alias */
export const fetch = fetchMediaGoblinPosts;
