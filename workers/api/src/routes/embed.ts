/**
 * Embed system — embeddable post cards for external sites.
 *
 * Like Twitter embeds, let external sites embed DegenFeed posts.
 *
 * GET /api/embed/:dfUri    — Returns HTML <blockquote> with JSON-LD data
 * GET /api/embed/:dfUri.js — Returns JavaScript that dynamically loads the embed
 *
 * The existing /api/embed/resolve handler for link-preview enrichment
 * is preserved as handleEmbedResolve.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import {
  BlueskyProvider,
  FarcasterProvider,
  LensProvider,
  MastodonProvider,
  NostrProvider,
  RedditProvider,
  RmiDataBusProvider,
  RssProvider,
  ThreadsProvider,
} from '@degenfeed/feed-providers';
import type { UnifiedPost } from '@degenfeed/types';
import type { ProtocolSource } from '@degenfeed/utils';
import { decodeContentUri, formatTimeAgo, rmiUrl } from '@degenfeed/utils';
import { type Env, jsonResponse } from '../index';
import { isValidFetchUrl, safeFetch } from '../sanitize';

// ─── Existing: Link preview enrichment ─────────────────────────────────────

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

// ─── Embed: Post embed HTML + JS ──────────────────────────────────────────

/**
 * Parse the dfUri parameter from the URL path.
 * The path looks like: /api/embed/df%3A%2F%2Ffarcaster%3A0xabc123
 * or /api/embed/df%3A%2F%2Ffarcaster%3A0xabc123.js
 */
function parseDfUriFromPath(path: string): { dfUri: string; isJs: boolean } {
  const prefix = '/api/embed/';
  if (!path.startsWith(prefix)) return { dfUri: '', isJs: false };

  let raw = path.slice(prefix.length);
  const isJs = raw.endsWith('.js');
  if (isJs) raw = raw.slice(0, -3);

  return { dfUri: decodeURIComponent(raw), isJs };
}

function providerFor(protocol: ProtocolSource, env: Env) {
  switch (protocol) {
    case 'rss':
      return new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
    case 'reddit':
      return new RedditProvider();
    case 'nostr':
      return new NostrProvider({ relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean) });
    case 'farcaster':
      return new FarcasterProvider({ hubUrl: env.FARCASTER_HUB_URL });
    case 'lens':
      return new LensProvider({ apiUrl: env.LENS_API_URL });
    case 'bluesky':
      return new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
    case 'mastodon':
      return new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
    case 'threads':
      return new ThreadsProvider();
    default:
      return null;
  }
}

/**
 * Fetch a post by its canonical ID (protocol:id).
 * Checks KV cache first, then tries the native provider.
 */
async function fetchPostById(
  canonicalId: string,
  protocol: ProtocolSource,
  env: Env,
): Promise<UnifiedPost | null> {
  // 1. Check KV cache (populated by feed pipeline)
  try {
    const stored = await env.CACHE?.get(`post:${canonicalId}`);
    if (stored) {
      const post = JSON.parse(stored) as UnifiedPost;
      if (!isSpamPost(post)) return post;
    }
  } catch {
    /* ignore */
  }

  // 2. Try the native protocol provider
  const provider = providerFor(protocol, env);
  if (provider) {
    try {
      const result = await Promise.race([
        provider.fetchFeed({ timeoutMs: 4000 }),
        new Promise<{ posts: UnifiedPost[] }>((resolve) =>
          setTimeout(() => resolve({ posts: [] }), 4000),
        ),
      ]);
      if (result?.posts) {
        const found = result.posts.find((p) => p.id === canonicalId);
        if (found && !isSpamPost(found)) {
          const enriched = enrichPostNiches(found);
          enriched.dfUri = `df://${protocol}:${found.id.replace(`${protocol}:`, '')}`;
          return enriched;
        }
      }
    } catch {
      /* try next */
    }
  }

  // 3. Try RSS fallback
  try {
    const rss = new RssProvider({
      feeds: ['https://cointelegraph.com/rss', 'https://decrypt.co/feed'],
    });
    const r = await rss.fetchFeed({ timeoutMs: 4000 });
    const found = r.posts.find((p) => p.id === canonicalId);
    if (found && !isSpamPost(found)) {
      const enriched = enrichPostNiches(found);
      enriched.dfUri = `df://${protocol}:${found.id.replace(`${protocol}:`, '')}`;
      return enriched;
    }
  } catch {
    /* ignore */
  }

  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function buildEmbedHtml(post: UnifiedPost, origin: string): string {
  const postUrl = `${origin}/post/${encodeURIComponent(post.id)}`;
  const embedUrl = `${origin}/embed/${encodeURIComponent(post.dfUri || post.id)}`;
  const text = truncate(post.text, 280);
  const author = post.author.displayName || post.author.handles[post.protocol] || 'Unknown';
  const handle = post.author.handles[post.protocol] || '';
  const avatar =
    post.author.avatarUrl ||
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23333%22/%3E%3Ctext x=%2216%22 y=%2222%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2216%22%3E%40%3C/text%3E%3C/svg%3E';
  const image = post.embeds.find((e) => e.kind === 'image')?.url || '';
  const protocolLabel = post.protocol.charAt(0).toUpperCase() + post.protocol.slice(1);
  const timeAgo = formatTimeAgo(post.createdAt);

  // JSON-LD structured data
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: `${author} on ${protocolLabel}`,
    description: text,
    url: postUrl,
    author: {
      '@type': 'Person',
      name: author,
      url: handle ? `https://${post.protocol}.social/${handle}` : undefined,
    },
    datePublished: new Date(post.createdAt).toISOString(),
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: post.metrics.likes,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ShareAction',
        userInteractionCount: post.metrics.reposts,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: post.metrics.replies,
      },
    ],
  };

  if (image) {
    jsonLd.image = image;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(author)} on ${protocolLabel} — DegenFeed</title>
<meta property="og:title" content="${escapeHtml(author)} on ${protocolLabel}"/>
<meta property="og:description" content="${escapeHtml(text)}"/>
<meta property="og:image" content="${escapeHtml(image || 'https://app.degenfeed.xyz/og-image.png')}"/>
<meta property="og:url" content="${escapeHtml(embedUrl)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="DegenFeed"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(author)} on ${protocolLabel}"/>
<meta name="twitter:description" content="${escapeHtml(text)}"/>
<meta name="twitter:image" content="${escapeHtml(image || 'https://app.degenfeed.xyz/og-image.png')}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<blockquote class="degenfeed-post" data-post-uri="${escapeHtml(post.dfUri || `df://${post.protocol}:${post.id.replace(`${post.protocol}:`, '')}`)}" data-post-id="${escapeHtml(post.id)}">
  <div class="df-embed-header">
    <img class="df-embed-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(author)}" loading="lazy" />
    <div class="df-embed-author">
      <strong>${escapeHtml(author)}</strong>
      <span class="df-embed-handle">${escapeHtml(handle ? `@${handle}` : '')}</span>
    </div>
  </div>
  <p class="df-embed-text">${escapeHtml(text)}</p>
  <footer class="df-embed-footer">
    <span class="df-embed-time">${escapeHtml(timeAgo)} ago</span>
    <span class="df-embed-protocol">${escapeHtml(protocolLabel)}</span>
    <span class="df-embed-stats">
      ${post.metrics.likes > 0 ? `${post.metrics.likes} likes` : ''}
      ${post.metrics.reposts > 0 ? ` · ${post.metrics.reposts} reposts` : ''}
      ${post.metrics.replies > 0 ? ` · ${post.metrics.replies} replies` : ''}
    </span>
    — <cite><a href="${escapeHtml(postUrl)}">@${escapeHtml(author)} on DegenFeed</a></cite>
  </footer>
</blockquote>
<script async src="https://app.degenfeed.xyz/embed.js" charset="utf-8"></script>
</body>
</html>`;
}

export async function handleEmbedPost(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const { dfUri, isJs } = parseDfUriFromPath(path);

  if (!dfUri) {
    return new Response('Missing dfUri parameter', { status: 400 });
  }

  // If the request is for the JS file, return the embed script
  if (isJs) {
    // Redirect to the static embed.js on the app domain
    return new Response(null, {
      status: 302,
      headers: { location: 'https://app.degenfeed.xyz/embed.js' },
    });
  }

  // Resolve the df:// URI or direct post ID
  let protocol: ProtocolSource;
  let postId: string;

  const decoded = decodeContentUri(dfUri);
  if (decoded) {
    protocol = decoded.protocol;
    postId = decoded.id;
  } else {
    // Try as raw protocol:id format
    const colonIdx = dfUri.indexOf(':');
    if (colonIdx > 0) {
      protocol = dfUri.slice(0, colonIdx) as ProtocolSource;
      postId = dfUri.slice(colonIdx + 1);
    } else {
      return new Response('Invalid post identifier', { status: 400 });
    }
  }

  const canonicalId = `${protocol}:${postId}`;

  // Check KV cache for full embed HTML
  const htmlCacheKey = `embed:html:v1:${canonicalId}`;
  try {
    const cached = await env.CACHE?.get(htmlCacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }
  } catch {
    /* ignore */
  }

  // Fetch the post
  const post = await fetchPostById(canonicalId, protocol, env);
  if (!post) {
    // Return a minimal embed with just the link
    const postUrl = `https://app.degenfeed.xyz/post/${encodeURIComponent(canonicalId)}`;
    const minimal = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Post on DegenFeed</title></head>
<body>
<blockquote class="degenfeed-post" data-post-uri="${escapeHtml(dfUri)}">
  <p>View this post on DegenFeed</p>
  <footer>— <cite><a href="${escapeHtml(postUrl)}">DegenFeed</a></cite></footer>
</blockquote>
<script async src="https://app.degenfeed.xyz/embed.js" charset="utf-8"></script>
</body>
</html>`;
    return new Response(minimal, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }

  const origin = 'https://app.degenfeed.xyz';
  const html = buildEmbedHtml(post, origin);

  // Cache the generated HTML
  try {
    await env.CACHE?.put(htmlCacheKey, html, { expirationTtl: 300 });
  } catch {
    /* ignore */
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
