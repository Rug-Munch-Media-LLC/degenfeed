/**
 * Misskey Adapter
 *
 * Minimal adapter for Misskey — decentralized microblogging platform.
 * Uses Misskey's custom REST API.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { guessNiches } from '@degenfeed/utils';

const $fetch = globalThis.fetch;

const MISSKEY_INSTANCES = ['https://misskey.io', 'https://misskey.cloud', 'https://sushi.ski'];

type MisskeyNote = Record<string, unknown> & {
  id: string;
  text: string | null;
  cw: string | null;
  userId: string;
  user: Record<string, unknown> & {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string;
    host: string | null;
    followersCount: number;
    followingCount: number;
    description: string | null;
  };
  files: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    thumbnailUrl: string;
    width?: number;
    height?: number;
  }>;
  tags: string[];
  createdAt: string;
  renoteCount: number;
  repliesCount: number;
  reactionCount: number;
};

async function fetchTimeline(
  inst: string,
  endpoint: string,
  limit: number,
): Promise<MisskeyNote[]> {
  try {
    const res = await $fetch(`${inst}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'DegenFeed/0.1 (Misskey)' },
      body: JSON.stringify({ limit: Math.min(limit, 30), withFiles: true, withRenotes: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()) as MisskeyNote[];
  } catch {
    return [];
  }
}

export async function fetchMisskeyPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(2, Math.ceil(limit / MISSKEY_INSTANCES.length));

  for (const inst of MISSKEY_INSTANCES) {
    if (posts.length >= limit) break;
    const [globalTL, featured] = await Promise.all([
      fetchTimeline(inst, 'notes/global-timeline', perInst),
      fetchTimeline(inst, 'notes/featured', Math.ceil(perInst / 2)),
    ]);

    const notes = [...globalTL, ...featured];
    for (const note of notes.slice(0, perInst)) {
      if (!note.text && (!note.files || note.files.length === 0)) continue;
      const text = note.cw ? `[CW: ${note.cw}]\n\n${note.text || ''}` : note.text || '';
      const user = note.user;

      posts.push({
        id: `misskey:${note.id}@${new URL(inst).hostname}`,
        protocol: 'misskey' as Protocol,
        author: {
          id: `misskey:${user.id}@${new URL(inst).hostname}`,
          primary: { protocol: 'misskey' as Protocol, id: user.username },
          handles: { misskey: user.username },
          displayName: user.name || user.username,
          bio: (user.description || '').replace(/<[^>]*>/g, ' ').trim(),
          avatarUrl: user.avatarUrl || '',
          followerCount: user.followersCount || 0,
          followingCount: user.followingCount || 0,
          verified: [],
          links: [],
          keys: {},
        },
        text,
        embeds: (note.files || []).map((f) => ({
          kind: (f.type?.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
          url: f.url,
          meta: { thumbnailUrl: f.thumbnailUrl, width: f.width, height: f.height },
        })),
        createdAt: new Date(note.createdAt).getTime(),
        metrics: {
          likes: note.reactionCount || 0,
          reposts: note.renoteCount || 0,
          replies: note.repliesCount || 0,
          quotes: 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: {
            likes: note.reactionCount || 0,
            reposts: note.renoteCount || 0,
            replies: note.repliesCount || 0,
            quotes: 0,
          },
        },
        raw: note,
        niches: guessNiches(text, (note.tags || []).join(' ')),
      });
    }
  }
  return posts;
}
