/**
 * WriteFreely Adapter
 *
 * Minimal adapter for WriteFreely — decentralized ActivityPub blogging.
 * Fetches posts via REST API and RSS feed.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

const CURATED_BLOGS = [
  { alias: 'degen', instance: 'https://write.as' },
  { alias: 'freedog', instance: 'https://write.as' },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function guessNiches(text: string, title: string): string[] {
  const lower = `${text} ${title}`.toLowerCase();
  const n: string[] = [];
  if (/\b(btc|bitcoin|crypto|blockchain|web3|defi|nft|eth|solana|token)\b/.test(lower)) n.push('crypto');
  if (/\b(tech|programming|code|software|startup|saas|developer)\b/.test(lower)) n.push('tech');
  if (/\b(ai |artificial|intelligence|llm|machine learning|gpt|openai)\b/.test(lower)) n.push('ai');
  if (/\b(privacy|surveillance|encryption|security|decentralized|federation)\b/.test(lower)) n.push('privacy');
  if (/\b(writing|blog|publishing|writer|poetry|essay|journalism)\b/.test(lower)) n.push('writing');
  if (n.length === 0) n.push('article');
  return n;
}

function parseRssItems(xml: string): Array<{ title?: string; link?: string; guid?: string; description?: string; author?: string; pubDate?: string }> {
  const items: Array<Record<string, string>> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    if (!m[1]) continue;
    const e: string = m[1];
    items.push({
      title: (e.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '',
      link: (e.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '',
      guid: (e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || '',
      description: (e.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '',
      author: (e.match(/<author[^>]*>([\s\S]*?)<\/author>/i) || [])[1] || '',
      pubDate: (e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '',
    });
  }
  return items;
}

export async function fetchWriteFreelyPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const perBlog = Math.max(2, Math.ceil(limit / CURATED_BLOGS.length));

  for (const blog of CURATED_BLOGS) {
    if (posts.length >= limit) break;

    // Try REST API first
    try {
      const res = await $fetch(`${blog.instance}/api/collections/${blog.alias}/posts`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (WriteFreely)' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as { data?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> };
        const items = (data?.data || data?.items || []) as Array<Record<string, unknown>>;
        for (const item of items.slice(0, perBlog)) {
          const title = String(item.title || '');
          const body = String(item.body || item.content || '');
          const slug = String(item.slug || item.id || '');
          const text = title ? `${title}\n\n${stripHtml(body).slice(0, 500)}` : stripHtml(body).slice(0, 500);
          posts.push({
            id: `writefreely:${slug}@${blog.alias}`,
            protocol: 'writefreely' as Protocol,
            author: {
              id: `writefreely:${blog.alias}`,
              primary: { protocol: 'writefreely' as Protocol, id: blog.alias },
              handles: { writefreely: blog.alias },
              displayName: blog.alias,
              bio: '',
              avatarUrl: '',
              followerCount: 0,
              followingCount: 0,
              verified: [],
              links: [],
              keys: {},
            },
            text,
            contentType: 'article',
            embeds: [{ kind: 'link' as const, url: `${blog.instance}/${blog.alias}/${slug}` }],
            createdAt: item.created ? new Date(String(item.created)).getTime() : Date.now(),
            metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 } },
            raw: item,
            niches: guessNiches(text, title),
          });
        }
      }
    } catch {
      // RSS fallback
      try {
        const rssRes = await $fetch(`${blog.instance}/api/collections/${blog.alias}/feed.xml`, {
          headers: { 'User-Agent': 'DegenFeed/0.1 (WriteFreely)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!rssRes.ok) continue;
        const xml = await rssRes.text();
        const items = parseRssItems(xml);
        for (const item of items.slice(0, perBlog)) {
          const title = item.title || '';
          const text = stripHtml(item.description || title || '');
          if (!text) continue;
          posts.push({
            id: `writefreely:rss:${item.guid || item.link || text.slice(0, 40)}`,
            protocol: 'writefreely' as Protocol,
            author: {
              id: `writefreely:rss:${blog.alias}`,
              primary: { protocol: 'writefreely' as Protocol, id: blog.alias },
              handles: { writefreely: blog.alias },
              displayName: blog.alias,
              bio: '',
              avatarUrl: '',
              followerCount: 0,
              followingCount: 0,
              verified: [],
              links: [],
              keys: {},
            },
            text,
            contentType: 'article',
            embeds: item.link ? [{ kind: 'link' as const, url: item.link }] : [],
            createdAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
            metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 } },
            raw: item,
            niches: guessNiches(text, title),
          });
        }
      } catch {
        // skip
      }
    }
  }
  return posts;
}
