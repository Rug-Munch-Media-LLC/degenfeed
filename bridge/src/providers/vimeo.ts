/**
 * Vimeo Provider — Professional Video Platform
 *
 * Vimeo has a public API for accessing videos, channels, and categories.
 * 200M+ users. Not fully open-source but API-accessible.
 *
 * What it adds: High-quality curated videos (tech talks, creative, music videos)
 * API: Vimeo API (no auth for public data, higher rate limits with token)
 * Rate limit: 500 req/day (no auth), 10k req/day (with token)
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const VIMEO_API = process.env.VIMEO_API_URL || 'https://api.vimeo.com';
const VIMEO_TOKEN = process.env.VIMEO_ACCESS_TOKEN || '';

const VIMEO_CATEGORIES = [
  'tech',
  'music',
  'creative',
  'documentary',
  'experimental',
  'animation',
  'design',
  'talks',
];

interface VimeoVideo {
  uri: string;
  name: string;
  description: string;
  link: string;
  duration: number;
  width: number;
  height: number;
  created_time: string;
  modified_time: string;
  language: string;
  categories?: Array<{ name: string }>;
  pictures?: {
    sizes?: Array<{ link: string; width: number; height: number }>;
  };
  user?: {
    name: string;
    link: string;
    pictures?: { sizes?: Array<{ link: string }> };
  };
  stats?: {
    plays?: number;
    likes?: number;
    comments?: number;
  };
  tags?: Array<{ tag: string; canonical: string }>;
  embed?: {
    html?: string;
    badges?: { hdr?: boolean };
  };
}

interface VimeoResponse {
  data?: VimeoVideo[];
  total?: number;
}

const headers: Record<string, string> = {
  Accept: 'application/vnd.vimeo.*+json;version=3.4',
  'User-Agent': 'DegenFeed-Bridge/0.1',
};
if (VIMEO_TOKEN) headers.Authorization = `Bearer ${VIMEO_TOKEN}`;

async function fetchCategory(category: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${VIMEO_API}/categories/${category}/videos?per_page=${Math.min(limit, 20)}&sort=date&direction=desc`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await $fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const json: VimeoResponse = await res.json();
    const videos = json.data ?? [];
    const posts: UnifiedPost[] = [];

    for (const video of videos.slice(0, limit)) {
      const thumb =
        video.pictures?.sizes?.find((s) => s.width >= 640)?.link ??
        video.pictures?.sizes?.[video.pictures.sizes.length - 1]?.link ??
        '';
      const authorName = video.user?.name ?? 'Vimeo Creator';
      const authorLink = video.user?.link ?? '';
      const videoTags = [
        category,
        ...(video.categories?.map((c) => c.name.toLowerCase()) ?? []),
        ...(video.tags?.map((t) => t.tag.toLowerCase()) ?? []),
      ];

      posts.push({
        id: `vimeo-${
          video.uri?.replace('/videos/', '') ??
          Buffer.from(video.link ?? '')
            .toString('base64')
            .slice(0, 16)
        }`,
        protocol: 'vimeo',
        author: {
          id: `vimeo:${authorLink}`,
          primary: { protocol: 'vimeo', id: authorLink },
          handles: { vimeo: authorLink.split('/').pop() ?? authorName },
          displayName: authorName,
          bio: '',
          avatarUrl: video.user?.pictures?.sizes?.[0]?.link ?? '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `🎬 ${video.name}${video.description ? `\n${video.description.slice(0, 200)}` : ''}`,
        html: `<p>${video.description ?? ''}</p>`,
        embeds: [
          { kind: 'video' as const, url: video.link ?? '' },
          { kind: 'image' as const, url: thumb },
          ...(video.embed?.html ? [{ kind: 'link' as const, url: video.link }] : []),
        ],
        createdAt: new Date(video.created_time).getTime(),
        metrics: {
          likes: video.stats?.likes ?? 0,
          reposts: 0,
          replies: video.stats?.comments ?? 0,
          quotes: 0,
          views: video.stats?.plays ?? 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: {
            likes: video.stats?.likes ?? 0,
            reposts: 0,
            replies: video.stats?.comments ?? 0,
            quotes: 0,
          },
        },
        raw: video,
        niches: ['video', ...videoTags],
        contentType: 'video',
      });
    }
    return posts;
  } catch {
    return [];
  }
}

export async function fetchVimeoPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:vimeo';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  const perCategory = Math.max(3, Math.ceil(limit / VIMEO_CATEGORIES.length));
  const results = await Promise.allSettled(
    VIMEO_CATEGORIES.map((cat) => fetchCategory(cat, perCategory)),
  );

  const posts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }

  return posts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'vimeo',
  name: 'Vimeo',
  description: 'High-quality curated videos — tech talks, music, creative & documentaries',
  endpoint: '/api/feed/vimeo',
  requiresAuth: false,
  contentType: 'video',
};
