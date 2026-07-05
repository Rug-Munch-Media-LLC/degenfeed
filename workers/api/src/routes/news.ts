import { type Env, jsonResponse } from '../index';

export async function handleRmiNewsFeed(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit')) || 25;
  const sentiment = params.get('sentiment'); // bullish | bearish | neutral
  const source = params.get('source');
  const category = params.get('category'); // security | defi | regulation | market | protocol
  const tier = params.get('tier'); // 1-15

  try {
    // Proxy to the existing RMI Backend news API
    const apiUrl = new URL('http://127.0.0.1:8000/api/v1/news/feed');
    apiUrl.searchParams.set('limit', String(Math.min(limit, 200)));
    if (sentiment) apiUrl.searchParams.set('sentiment', sentiment);
    if (source) apiUrl.searchParams.set('source', source);
    if (category) apiUrl.searchParams.set('category', category);
    if (tier) apiUrl.searchParams.set('tier', tier);

    const res = await fetch(apiUrl.toString());
    if (!res.ok) {
      return jsonResponse({ error: 'RMI news feed error: ' + res.status }, 502);
    }
    const data = (await res.json()) as { articles?: Record<string, unknown>[] };
    const articles = data.articles ?? [];

    // Normalize to UnifiedPost
    const posts = articles.map((a) => ({
      id: 'rss:rmi-news:' + (a.id ?? a.url ?? 'unknown'),
      protocol: 'rss' as const,
      author: {
        id: 'rss:rmi-news:' + ((a.source as string) ?? 'unknown'),
        primary: { protocol: 'rss' as const, id: (a.source as string) ?? 'unknown' },
        handles: {
          nostr: null,
          farcaster: null,
          lens: null,
          bluesky: null,
          threads: null,
          rss: null,
          mastodon: null,
        },
        displayName: (a.source as string) ?? 'RMI News',
        bio: '',
        avatarUrl: '',
        verified: [],
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'source', url: (a.url as string) ?? '' }],
        keys: {},
      },
      text: ((a.description as string) ?? (a.title as string) ?? '').slice(0, 500),
      html: '<p>' + ((a.description as string) ?? (a.title as string) ?? '') + '</p>',
      embeds: a.image_url ? [{ kind: 'image' as const, url: a.image_url as string }] : [],
      createdAt: a.published_at ? new Date(a.published_at as string).getTime() : Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: a,
      niches: [(a.category as string) ?? 'crypto'].filter(Boolean),
    }));

    return jsonResponse({
      data: posts.slice(0, limit),
      meta: { total: posts.length, limit, source: 'rmi-news' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RMI news fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}

// ─── Publish handler ──────────────────────────────────────────────
