/**
 * Misskey Bridge Provider
 *
 * Uses the Misskey API (notes/global-timeline) to fetch public posts
 * from known Misskey instances. Misskey has its own REST API format
 * distinct from Mastodon, but also supports MastoAPI on some instances.
 *
 * API: POST https://{instance}/api/notes/global-timeline
 * Body: { "limit": 20, "withFiles": false }
 * Returns: Array of Note objects with user, reactions, files
 */

import { guessNiches, stripHtml } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface MisskeyUser {
  id: string;
  name: string | null;
  username: string;
  host: string | null;
  avatarUrl: string | null;
  avatarBlurhash: string | null;
  isBot: boolean;
  isCat: boolean;
  emojis: Record<string, string>;
  onlineStatus: string;
}

interface MisskeyNote {
  id: string;
  createdAt: string;
  text: string | null;
  cw: string | null;
  userId: string;
  user: MisskeyUser;
  replyId: string | null;
  renoteId: string | null;
  renote: MisskeyNote | null;
  reply: MisskeyNote | null;
  visibility: 'public' | 'home' | 'followers' | 'specified';
  tags: string[];
  fileIds: string[];
  files: Array<{ id: string; name: string; url: string; type: string }>;
  reactions: Record<string, number>;
  reactionCount: number;
  renoteCount: number;
  repliesCount: number;
  uri: string | null;
  url: string | null;
}

const MISSKEY_INSTANCES = ['misskey.io', 'misskey.xyz', 'misskey.design', 'mi.nishikichi.moe'];

export async function fetchMisskeyPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / MISSKEY_INSTANCES.length));
  const all: UnifiedPost[] = [];

  const fetches = MISSKEY_INSTANCES.map(async (host) => {
    try {
      const res = await $fetch(`https://${host}/api/notes/global-timeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DegenFeed-Bridge/0.1 (Misskey)',
        },
        body: JSON.stringify({ limit: perInstance, withFiles: false }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const notes = (await res.json()) as MisskeyNote[];
      if (!Array.isArray(notes)) return [];

      return notes
        .filter((n) => n.visibility === 'public')
        .slice(0, perInstance)
        .map((note) => {
          const original = note.renote ?? note;
          const content = original.cw
            ? `[CW: ${original.cw}]\n\n${stripHtml(original.text || '')}`
            : stripHtml(original.text || '');

          return {
            id: `misskey:${original.id}@${host}`,
            protocol: 'misskey',
            author: {
              id: `misskey:${original.user.id}@${host}`,
              primary: { protocol: 'misskey', id: original.user.id },
              handles: { misskey: `@${original.user.username}@${host}` },
              displayName: original.user.name || original.user.username,
              bio: '',
              avatarUrl: original.user.avatarUrl || '',
              followerCount: 0,
              followingCount: 0,
              links: [],
              keys: {},
            },
            text: content.slice(0, 2000),
            embeds: (original.files || []).map((f) => ({
              kind: f.type.startsWith('image/') ? 'image' : 'file',
              url: f.url,
              meta: { name: f.name },
            })),
            contentType: original.files?.length ? 'image' : 'text',
            createdAt: new Date(original.createdAt).getTime(),
            metrics: {
              likes: original.reactionCount || 0,
              reposts: original.renoteCount || 0,
              replies: original.repliesCount || 0,
              quotes: 0,
            },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: {
                likes: original.reactionCount || 0,
                reposts: original.renoteCount || 0,
                replies: original.repliesCount || 0,
                quotes: 0,
              },
            },
            raw: original,
            niches: guessNiches(content, original.tags),
          } as UnifiedPost;
        }) as UnifiedPost[];
    } catch {
      return [] as UnifiedPost[];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
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

  //   console.log(
  //     `[bridge] Misskey: ${deduped.length} notes from ${MISSKEY_INSTANCES.length} instances`,
  //   );
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'misskey',
  name: 'Misskey',
  description: 'Open-source ActivityPub platform with rich media and reactions',
  endpoint: '/api/feed/misskey',
  requiresAuth: false,
  contentType: 'mixed',
};

export const fetch = fetchMisskeyPosts;
