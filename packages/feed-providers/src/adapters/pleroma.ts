/**
 * Pleroma Adapter
 *
 * Minimal adapter for Pleroma — lightweight ActivityPub server.
 * Uses Mastodon-compatible REST API.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const PLEROMA_INSTANCES = [
  'https://pleroma.site',
  'https://soykaf.com',
  'https://spinster.xyz',
];

type PleromaStatus = Record<string, unknown> & {
  id: string;
  content: string;
  created_at: string;
  account: Record<string, unknown> & { id: string; username: string; acct: string; display_name: string; note: string; avatar: string; followers_count: number };
  media_attachments?: Array<{ type: string; url: string; preview_url?: string }>;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  sensitive?: boolean;
  spoiler_text?: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function guessNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(btc|bitcoin|crypto|blockchain|web3|defi|nft|eth|solana)\b/.test(lower)) n.push('crypto');
  if (/\b(tech|programming|code|software|foss|linux|elixir)\b/.test(lower)) n.push('tech');
  if (/\b(privacy|surveillance|encryption|decentralized)\b/.test(lower)) n.push('privacy');
  if (/\b(pleroma|fediverse|activitypub|mastodon)\b/.test(lower)) n.push('fediverse');
  if (/\b(art|photography|photo|drawing|creative|music)\b/.test(lower)) n.push('art');
  if (n.length === 0) n.push('social');
  return n;
}

export async function fetchPleromaPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perInst = Math.max(2, Math.ceil(limit / PLEROMA_INSTANCES.length));

  for (const inst of PLEROMA_INSTANCES) {
    if (posts.length >= limit) break;
    try {
      const res = await $fetch(`${inst}/api/v1/timelines/public?local=true&limit=${perInst}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (Pleroma)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json() as PleromaStatus[];
      if (!Array.isArray(data)) continue;

      for (const s of data) {
        const text = s.spoiler_text
          ? `[CW: ${s.spoiler_text}]\n\n${stripHtml(s.content)}`
          : stripHtml(s.content);
        const acct = s.account;

        posts.push({
          id: `pleroma:${s.id}@${new URL(inst).hostname}`,
          protocol: 'pleroma' as Protocol,
          author: {
            id: `pleroma:${acct.id}@${new URL(inst).hostname}`,
            primary: { protocol: 'pleroma' as Protocol, id: acct.acct },
            handles: { pleroma: acct.acct },
            displayName: acct.display_name || acct.username,
            bio: stripHtml(acct.note || ''),
            avatarUrl: acct.avatar || '',
            followerCount: acct.followers_count || 0,
            followingCount: 0,
            verified: [],
            links: [],
            keys: {},
          },
          text,
          embeds: (s.media_attachments || []).map((m) => ({
            kind: (m.type === 'video' || m.type === 'gifv' ? 'video' : 'image') as 'image' | 'video',
            url: m.url,
            meta: { previewUrl: m.preview_url },
          })),
          createdAt: new Date(s.created_at).getTime(),
          metrics: { likes: s.favourites_count || 0, reposts: s.reblogs_count || 0, replies: s.replies_count || 0, quotes: 0 },
          engagement: {
            viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
            raw: { likes: s.favourites_count || 0, reposts: s.reblogs_count || 0, replies: s.replies_count || 0, quotes: 0 },
          },
          raw: s,
          niches: guessNiches(text),
        });
      }
    } catch {
      // skip
    }
  }
  return posts;
}
