/**
 * Link preview enrichment — fetches OpenGraph metadata for URLs
 * and caches results in KV for 24h.
 *
 * GET /api/embed/resolve?url=https://...
 */

import { type Env, jsonResponse } from '../index';
import { isValidFetchUrl, safeFetch } from '../sanitize';

interface EmbedData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
  fetchedAt: number;
}

export async function handleEmbedResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return jsonResponse({ error: 'url required' }, 400);

  const cacheKey = `embed:${encodeURIComponent(url)}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* ignore */
  }

  if (!isValidFetchUrl(url)) return jsonResponse({ error: 'Invalid URL' }, 400);

  try {
    const res = await safeFetch(url, {
      headers: { 'user-agent': 'DegenFeed/0.1 (LinkPreview; +https://degenfeed.xyz)' },
    });
    if (!res.ok) return jsonResponse({ error: `fetch failed: ${res.status}` }, 502);

    const html = await res.text();
    const embed: EmbedData = { url, fetchedAt: Date.now() };

    const getMeta = (name: string) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
        'i',
      );
      const m = html.match(re);
      return m?.[1] ?? undefined;
    };

    embed.title = getMeta('og:title') || getMeta('twitter:title');
    embed.description = getMeta('og:description') || getMeta('twitter:description');
    embed.image = getMeta('og:image') || getMeta('twitter:image');
    embed.siteName = getMeta('og:site_name');

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!embed.title && titleTag) embed.title = titleTag[1]?.trim();

    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(embed), { expirationTtl: 86400 });
    } catch {
      /* ignore */
    }

    return jsonResponse(embed);
  } catch {
    return jsonResponse({ error: 'Failed to fetch URL' }, 502);
  }
}
