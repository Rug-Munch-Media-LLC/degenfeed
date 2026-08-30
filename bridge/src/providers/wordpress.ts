/**
 * WordPress + ActivityPub Provider
 *
 * WordPress powers 43% of all websites (835M+ sites). With the ActivityPub
 * plugin, any WordPress site becomes a federated social node.
 *
 * What it adds: Blog posts from the world's largest CMS, federated via
 * ActivityPub. Massive content source for the feed.
 *
 * API: WordPress REST API + ActivityPub outbox
 * Self-host: Fork a WP instance with the ActivityPub plugin
 * Rate limit: 30 req/min per instance
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;
const USER_AGENT = 'DegenFeed-Bridge/0.1 (WordPress/ActivityPub)';

const WORDPRESS_SITES: Array<{
  url: string;
  label: string;
  niches: string[];
  mode: 'rest' | 'wpcom';
}> = [
  // Self-hosted WordPress (REST API)
  {
    url: 'https://wordpress.org/news',
    label: 'WordPress News',
    niches: ['tech', 'cms'],
    mode: 'rest',
  },
  { url: 'https://ma.tt', label: 'Matt Mullenweg', niches: ['tech', 'blog'], mode: 'rest' },
  // WordPress.com (public-api REST)
  {
    url: 'https://public-api.wordpress.com/wp/v2/sites/en.blog.wordpress.com/posts',
    label: 'WordPress.com News',
    niches: ['tech', 'cms'],
    mode: 'wpcom',
  },
  {
    url: 'https://public-api.wordpress.com/wp/v2/sites/techcrunch.com/posts',
    label: 'TechCrunch',
    niches: ['tech', 'news'],
    mode: 'wpcom',
  },
  {
    url: 'https://public-api.wordpress.com/wp/v2/sites/engadget.com/posts',
    label: 'Engadget',
    niches: ['tech', 'news'],
    mode: 'wpcom',
  },
  // Self-hosted instance (if set up) — format: url|label|niche1,niche2
  ...(process.env.WORDPRESS_SITES?.split(',').map((s) => {
    const [url, label, ...niches] = s.split('|');
    return {
      url: url || '',
      label: label || url || '',
      niches: (niches.join(',') || 'blog').split(','),
      mode: 'rest' as const,
    };
  }) ?? []),
];

interface WPRESTPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  date: string;
  modified: string;
  slug: string;
  link: string;
  type: string;
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url: string;
      alt_text?: string;
      media_details?: { sizes?: Record<string, { source_url: string }> };
    }>;
    author?: Array<{
      name: string;
      avatar_urls?: Record<string, string>;
      link?: string;
    }>;
    'wp:term'?: Array<
      Array<{
        name: string;
        taxonomy: string;
      }>
    >;
  };
  categories?: string[];
  meta?: Record<string, unknown>;
}

interface WPRESTResponse {
  data?: WPRESTPost[];
}

async function fetchSitePosts(
  site: { url: string; label: string; niches: string[]; mode: 'rest' | 'wpcom' },
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    // Self-hosted: {site}/wp-json/wp/v2/posts. WordPress.com: the url already
    // points at the public-api REST endpoint.
    const restUrl =
      site.mode === 'wpcom'
        ? `${site.url}?per_page=${Math.min(limit, 20)}`
        : `${site.url.replace(/\/?$/, '')}/wp-json/wp/v2/posts?per_page=${Math.min(limit, 20)}&_embed=author,wp:featuredmedia,wp:term`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await $fetch(restUrl, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const json = await res.json();
    const posts: WPRESTPost[] = Array.isArray(json) ? json : ((json as WPRESTResponse).data ?? []);

    return posts.slice(0, limit).map((post) => {
      const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
      const imageUrl =
        featuredImage?.source_url ??
        featuredImage?.media_details?.sizes?.large?.source_url ??
        featuredImage?.media_details?.sizes?.full?.source_url ??
        '';
      const author = post._embedded?.author?.[0];
      const terms = post._embedded?.['wp:term']?.flat() ?? [];
      const categories = terms.filter((t) => t.taxonomy === 'category').map((t) => t.name);
      const tags = terms.filter((t) => t.taxonomy === 'post_tag').map((t) => t.name);
      const excerpt = post.excerpt?.rendered?.replace(/<[^>]*>/g, '').trim() ?? '';

      return {
        id: `wp-${post.id}-${site.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        protocol: 'wordpress',
        author: {
          id: `wordpress:${author?.link ?? site.url}`,
          primary: { protocol: 'wordpress', id: author?.link ?? site.url },
          handles: { wordpress: author?.name ?? site.label },
          displayName: author?.name ?? site.label,
          bio: '',
          avatarUrl: author?.avatar_urls?.['96'] ?? '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'Blog', url: site.url }],
          keys: {},
        },
        text: `📝 ${post.title?.rendered ?? ''}\n${excerpt.slice(0, 280)}`,
        html: post.content?.rendered ?? '',
        embeds: [
          ...(imageUrl ? [{ kind: 'image' as const, url: imageUrl }] : []),
          { kind: 'link' as const, url: post.link },
        ],
        createdAt: new Date(post.date).getTime(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: post,
        niches: [
          ...site.niches,
          ...categories.map((c) => c.toLowerCase()),
          ...tags.map((t) => t.toLowerCase()),
        ],
        contentType: 'article',
      };
    });
  } catch {
    return [];
  }
}

export async function fetchWordPressPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:wordpress';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  const perSite = Math.max(3, Math.ceil(limit / Math.max(1, WORDPRESS_SITES.length)));
  const results = await Promise.allSettled(
    WORDPRESS_SITES.map((site) => fetchSitePosts(site, perSite)),
  );

  const posts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }

  return posts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'wordpress',
  name: 'WordPress + ActivityPub',
  description: 'Blog posts from 43% of the web — federated via ActivityPub plugin',
  endpoint: '/api/feed/wordpress',
  requiresAuth: false,
  contentType: 'article',
};
