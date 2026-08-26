/**
 * Pleroma / Akkoma Bridge Provider
 *
 * Pleroma and Akkoma are lightweight ActivityPub microblogging servers
 * that expose the Mastodon-compatible REST API. We use the same public
 * timeline endpoint as Mastodon.
 *
 * Merged Akkoma support here (Akkoma is a Pleroma fork).
 *
 * API: GET https://{instance}/api/v1/timelines/public?local=true&limit=N
 */

import { guessNiches, stripHtml } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface PleromaAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  followers_count: number;
  following_count: number;
  source?: { note?: string };
}

interface PleromaStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: string;
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: Array<{ type: string; url: string; description?: string }>;
  tags: Array<{ name: string }>;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  account: PleromaAccount;
  reblog: PleromaStatus | null;
  card: { url: string; title: string; description: string; image: string | null } | null;
  pleroma: {
    emoji_reactions: Array<{ name: string; count: number }>;
  };
}

const PLEROMA_INSTANCES = [
  { host: 'pleroma.site', label: 'pleroma.site' },
  { host: 'fedi.underscorediscovery.com', label: 'fedi.underscorediscovery.com' },
  { host: 'sleepy.town', label: 'sleepy.town' },
  { host: 'kitty.town', label: 'kitty.town' },
  { host: 'bbs.booth.ee', label: 'bbs.booth.ee' },
  // Akkoma instances (fork of Pleroma)
  { host: 'akkoma.dev', label: 'akkoma.dev' },
  { host: 'akko.wtf', label: 'akko.wtf' },
];

function pleromaStatusToPost(s: PleromaStatus, host: string): UnifiedPost {
  const acct = s.account;
  const original = s.reblog ?? s;
  const content = stripHtml(original.content || '');
  const text = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${content}` : content;
  const createdAt = new Date(original.created_at).getTime();
  const handle = acct.acct.includes('@') ? acct.acct : `${acct.acct}@${host}`;

  return {
    id: `pleroma:${original.id}@${host}`,
    protocol: 'pleroma',
    author: {
      id: `pleroma:${acct.id}@${host}`,
      primary: { protocol: 'pleroma', id: acct.id },
      handles: { pleroma: handle },
      displayName: acct.display_name || acct.username || 'Unknown',
      bio: stripHtml(acct.note || ''),
      avatarUrl: acct.avatar || '',
      followerCount: acct.followers_count || 0,
      followingCount: acct.following_count || 0,
      links: [],
      keys: {},
    },
    text: text.slice(0, 2000),
    html: original.content || '',
    embeds: [],
    contentType:
      original.media_attachments?.length > 0 ? 'image' : original.card?.image ? 'link' : 'text',
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: original.favourites_count ?? 0,
        reposts: original.reblogs_count ?? 0,
        replies: original.replies_count ?? 0,
        quotes: 0,
      },
    },
    raw: s,
    niches: guessNiches(text),
  } as UnifiedPost;
}

export async function fetchPleromaPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / PLEROMA_INSTANCES.length));
  const all: UnifiedPost[] = [];

  const fetches = PLEROMA_INSTANCES.map(async ({ host, label }) => {
    try {
      const res = await $fetch(
        `https://${host}/api/v1/timelines/public?local=true&limit=${perInstance}`,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Pleroma)' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) return [];
      const raw = (await res.json()) as PleromaStatus[];
      if (!Array.isArray(raw)) return [];
      return raw.filter((s) => s.visibility === 'public').map((s) => pleromaStatusToPost(s, label));
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
  //     `[bridge] Pleroma/Akkoma: ${deduped.length} posts from ${PLEROMA_INSTANCES.length} instances`,
  //   );
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'pleroma',
  name: 'Pleroma / Akkoma',
  description: 'Lightweight ActivityPub microblogging with Mastodon API — includes Akkoma forks',
  endpoint: '/api/feed/pleroma',
  requiresAuth: false,
  contentType: 'mixed',
};

/** Pleroma fetch alias */
export const fetch = fetchPleromaPosts;
