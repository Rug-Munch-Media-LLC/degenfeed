/**
 * OG share embed — returns HTML with OpenGraph meta tags for a post.
 * When pasted into Discord/Twitter/Telegram, shows a rich preview card.
 *
 * GET /api/feed/post/:id?format=og
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../index';

const JSON_HEADERS = { 'content-type': 'application/json' as const };

export async function handlePostOg(_request: Request, env: Env, postId: string): Promise<Response> {
  const decoded = decodeURIComponent(postId);

  let post: UnifiedPost | null = null;
  try {
    const stored = await env.CACHE?.get(`post:${decoded}`);
    if (stored) post = JSON.parse(stored) as UnifiedPost;
  } catch {
    /* empty -- error deliberately ignored */
  }

  if (!post) {
    return new Response('<html><body><p>Post not found</p></body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    });
  }

  const text = post.text.slice(0, 200);
  const image =
    post.embeds.find((e) => e.kind === 'image')?.url ||
    post.author.avatarUrl ||
    'https://app.degenfeed.xyz/api/media/gateway/ipfs/og-image-v1';
  const author = post.author.displayName;
  const protocol = post.protocol;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta property="og:title" content="${escapeHtml(author)} on ${protocol}"/>
<meta property="og:description" content="${escapeHtml(text)}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>
<meta property="og:url" content="https://degenfeed.xyz/post/${encodeURIComponent(post.id)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="DegenFeed"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(author)} on ${protocol}"/>
<meta name="twitter:description" content="${escapeHtml(text)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
</head>
<body><p>${escapeHtml(author)}: ${escapeHtml(text)}</p></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET /api/og?url=...
 * Fetches OpenGraph metadata for any URL.
 * Returns JSON: { url, title, description?, image?, favicon?, siteName? }
 */
export async function handleOgFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: JSON_HEADERS });
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers: JSON_HEADERS });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'user-agent': 'DegenFeed/0.1 LinkPreview (+https://degenfeed.xyz)',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ url: targetUrl, title: targetUrl }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const html = await res.text();

    // Extract OG metadata with regex (fast, no parser dependency)
    const ogTitle =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["'][^>]*\/?>/i) ||
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:title["'][^>]*\/?>/i);
    const title = ogTitle?.[1] || html.match(/<title>([^<]*)<\/title>/i)?.[1] || targetUrl;

    const ogDesc =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["'][^>]*\/?>/i) ||
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:description["'][^>]*\/?>/i);
    const description = ogDesc?.[1];

    const ogImage =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["'][^>]*\/?>/i) ||
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:image["'][^>]*\/?>/i);
    let image = ogImage?.[1];

    // Resolve relative image URL
    if (image?.startsWith('/')) {
      image = `${parsed.origin}${image}`;
    }

    const ogSiteName =
      html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["'](.*?)["'][^>]*\/?>/i) ||
      html.match(/<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:site_name["'][^>]*\/?>/i);
    const siteName = ogSiteName?.[1];

    // Favicon
    const faviconLink = html.match(
      /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["'](.*?)["'][^>]*\/?>/i,
    );
    let favicon = faviconLink?.[1];
    if (favicon?.startsWith('/')) {
      favicon = `${parsed.origin}${favicon}`;
    }
    if (!favicon) {
      favicon = `${parsed.origin}/favicon.ico`;
    }

    const result = {
      url: targetUrl,
      title: title?.slice(0, 200) ?? targetUrl,
      description: description?.slice(0, 400),
      image: image ?? null,
      favicon: favicon ?? null,
      siteName: siteName ?? null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ url: targetUrl, title: targetUrl }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
}
