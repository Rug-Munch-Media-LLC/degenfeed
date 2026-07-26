/**
 * Friendica Bridge Provider
 *
 * Friendica is a federated social network that connects to the wider Fediverse
 * (Mastodon, Diaspora*, etc.). It exposes the Mastodon-compatible API.
 *
 * API: GET https://{instance}/api/v1/timelines/public?limit=N
 *
 * Friendica extends Mastodon API statuses with additional friendica-specific
 * fields for conversations and thread completions.
 */

import { guessNiches, stripHtml } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

interface FriendicaAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  followers_count: number;
  following_count: number;
}

interface FriendicaStatus {
  id: string;
  created_at: string;
  content: string;
  visibility: string;
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: Array<{ type: string; url: string }>;
  tags: Array<{ name: string }>;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  account: FriendicaAccount;
  reblog: FriendicaStatus | null;
  card: { url: string; title: string; description: string; image: string | null } | null;
  friendica?: {
    title: string;
    created: string;
    location: string;
  };
}

const FRIENDICA_INSTANCES = [
  'social.wildeboer.net',
  'friendi.ca',
  'friendica.mrpetovan.com',
  'friendica.nexxtpress.de',
  'social.tchncs.de',
];

function friendicaStatusToPost(s: FriendicaStatus, host: string): UnifiedPost {
  const acct = s.account;
  const original = s.reblog ?? s;
  const content = stripHtml(original.content || '');
  const text = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${content}` : content;
  const createdAt = new Date(original.created_at).getTime();
  const handle = acct.acct.includes('@') ? acct.acct : `${acct.acct}@${host}`;

  // Friendica often has article-style posts with titles
  const title = (original as any).friendica?.title || '';
  const fullText = title ? `${title}\n\n${text}` : text;

  return {
    id: `friendica:${original.id}@${host}`,
    protocol: 'friendica',
    author: {
      id: `friendica:${acct.id}@${host}`,
      primary: { protocol: 'friendica', id: acct.id },
      handles: { friendica: handle },
      displayName: acct.display_name || acct.username || 'Unknown',
      bio: stripHtml(acct.note || ''),
      avatarUrl: acct.avatar || '',
      followerCount: acct.followers_count || 0,
      followingCount: acct.following_count || 0,
      links: [],
      keys: {},
    },
    text: fullText.slice(0, 2000),
    html: original.content || '',
    embeds: [],
    contentType: original.media_attachments?.length > 0 ? 'image' : 'text',
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
    niches: guessNiches(fullText),
  } as UnifiedPost;
}

export async function fetchFriendicaPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / FRIENDICA_INSTANCES.length));
  const all: UnifiedPost[] = [];

  const fetches = FRIENDICA_INSTANCES.map(async (host) => {
    try {
      const res = await $fetch(
        `https://${host}/api/v1/timelines/public?local=true&limit=${perInstance}`,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Friendica)' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) return [];
      const raw = (await res.json()) as FriendicaStatus[];
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((s) => s.visibility === 'public')
        .map((s) => friendicaStatusToPost(s, host));
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

  console.log(
    `[bridge] Friendica: ${deduped.length} posts from ${FRIENDICA_INSTANCES.length} instances`,
  );
  return deduped;
}

export const schema: SchemaGuard = {
  id: 'friendica',
  name: 'Friendica',
  description: 'Federated social network — connects to Mastodon, Diaspora, and more',
  endpoint: '/api/feed/friendica',
  requiresAuth: false,
  contentType: 'mixed',
};

export const fetch = fetchFriendicaPosts;
