import type { MetadataRoute } from 'next';

const BASE_URL = 'https://app.degenfeed.xyz';

/**
 * Generate a complete sitemap covering every public route.
 *
 * Dynamic entries (communities, posts, tokens, protocol niches) are fetched from
 * the API so crawlers find content pages without JS rendering.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // == 1. Static high-value pages ======================================
  const staticRoutes: Array<{
    path: string;
    changefreq: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
  }> = [
    { path: '', changefreq: 'hourly', priority: 1.0 },
    { path: '/feed', changefreq: 'always', priority: 0.9 },
    { path: '/discover', changefreq: 'hourly', priority: 0.9 },
    { path: '/trending', changefreq: 'hourly', priority: 0.8 },
    { path: '/news', changefreq: 'hourly', priority: 0.8 },
    { path: '/videos', changefreq: 'daily', priority: 0.7 },
    { path: '/digest', changefreq: 'daily', priority: 0.7 },
    { path: '/leaderboard', changefreq: 'hourly', priority: 0.7 },
    { path: '/communities', changefreq: 'daily', priority: 0.7 },
    { path: '/spaces', changefreq: 'hourly', priority: 0.6 },
    { path: '/farcaster', changefreq: 'hourly', priority: 0.8 },
    { path: '/lens', changefreq: 'hourly', priority: 0.8 },
    { path: '/bluesky', changefreq: 'hourly', priority: 0.8 },
    { path: '/nostr', changefreq: 'hourly', priority: 0.8 },
    { path: '/mastodon', changefreq: 'hourly', priority: 0.8 },
    { path: '/about', changefreq: 'monthly', priority: 0.5 },
    { path: '/protocols', changefreq: 'monthly', priority: 0.5 },
    { path: '/faq', changefreq: 'monthly', priority: 0.5 },
    { path: '/docs', changefreq: 'monthly', priority: 0.5 },
    { path: '/docs/quickstart', changefreq: 'monthly', priority: 0.6 },
    { path: '/docs/user-guide', changefreq: 'monthly', priority: 0.6 },
    { path: '/docs/cross-posting', changefreq: 'monthly', priority: 0.6 },
    { path: '/docs/video', changefreq: 'monthly', priority: 0.6 },
    { path: '/docs/protocols', changefreq: 'monthly', priority: 0.6 },
    { path: '/docs/api', changefreq: 'monthly', priority: 0.6 },
    { path: '/docs/architecture', changefreq: 'monthly', priority: 0.4 },
    { path: '/docs/comparison', changefreq: 'monthly', priority: 0.4 },
    { path: '/docs/troubleshooting', changefreq: 'monthly', priority: 0.4 },
    { path: '/docs/contributing', changefreq: 'monthly', priority: 0.4 },
    { path: '/docs/changelog', changefreq: 'monthly', priority: 0.4 },
    { path: '/api-docs', changefreq: 'monthly', priority: 0.5 },
    { path: '/developers', changefreq: 'monthly', priority: 0.5 },
    { path: '/privacy', changefreq: 'monthly', priority: 0.3 },
    { path: '/terms', changefreq: 'monthly', priority: 0.3 },
    { path: '/community-guidelines', changefreq: 'monthly', priority: 0.3 },
    { path: '/acceptable-use', changefreq: 'monthly', priority: 0.3 },
    { path: '/legal', changefreq: 'monthly', priority: 0.3 },
    { path: '/status', changefreq: 'daily', priority: 0.5 },
    { path: '/premium', changefreq: 'weekly', priority: 0.5 },
    { path: '/newsletter', changefreq: 'weekly', priority: 0.5 },
    { path: '/shorts', changefreq: 'hourly', priority: 0.7 },
    { path: '/search', changefreq: 'always', priority: 0.5 },
    { path: '/feeds', changefreq: 'hourly', priority: 0.7 },
    { path: '/home', changefreq: 'always', priority: 0.9 },
    { path: '/home/funding', changefreq: 'hourly', priority: 0.7 },
    { path: '/coins', changefreq: 'hourly', priority: 0.7 },
    { path: '/events', changefreq: 'daily', priority: 0.6 },
    { path: '/live', changefreq: 'always', priority: 0.8 },
    { path: '/live-shorts', changefreq: 'hourly', priority: 0.7 },
    { path: '/rooms', changefreq: 'hourly', priority: 0.6 },
    { path: '/music', changefreq: 'daily', priority: 0.5 },
    { path: '/books', changefreq: 'daily', priority: 0.4 },
    { path: '/pricing', changefreq: 'weekly', priority: 0.5 },
    { path: '/features', changefreq: 'monthly', priority: 0.5 },
    { path: '/onboarding', changefreq: 'monthly', priority: 0.4 },
    { path: '/connect', changefreq: 'monthly', priority: 0.4 },
    { path: '/connect/subscribe', changefreq: 'monthly', priority: 0.3 },
    { path: '/waitlist', changefreq: 'daily', priority: 0.3 },
    { path: '/topics', changefreq: 'daily', priority: 0.6 },
    { path: '/social', changefreq: 'hourly', priority: 0.7 },
    { path: '/membership', changefreq: 'weekly', priority: 0.5 },
    { path: '/articles', changefreq: 'daily', priority: 0.6 },
  ];

  // == 2. Per-protocol home sections ===================================
  const protocolSections = [
    'nostr',
    'farcaster',
    'lens',
    'bluesky',
    'mastodon',
    'threads',
    'reddit',
    'rss',
    'lemmy',
    'atproto',
    'zora',
    'matrix',
    'live',
    'videos',
    'images',
    'media',
  ];

  // == 3. Niches (topic filter pages) ==================================
  const niches = [
    'bitcoin',
    'ethereum',
    'solana',
    'defi',
    'ai',
    'nft',
    'security',
    'macro',
    'layer2',
    'gaming',
    'privacy',
    'scalability',
    'metaverse',
    'rwa',
    'meme',
    'onchain',
    'stablecoin',
    'etf',
    'regulation',
    'memecoin',
  ];

  // == 4. Dynamic data from the API ====================================
  let dynamicCommunities: string[] = [];
  let dynamicTokens: string[] = [];

  try {
    const [commRes, tokenRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/api/communities?limit=200`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${BASE_URL}/api/tokens/trending?limit=100`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (commRes.status === 'fulfilled' && commRes.value.ok) {
      const body = (await commRes.value.json()) as { data?: Array<{ slug?: string }> };
      dynamicCommunities = (body.data ?? []).map((c) => c.slug).filter(Boolean) as string[];
    }
    if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
      const body = (await tokenRes.value.json()) as { data?: Array<{ address?: string }> };
      dynamicTokens = (body.data ?? []).map((t) => t.address).filter(Boolean) as string[];
    }
  } catch {
    // Non-critical — serve what we have
  }

  const protocolPages = protocolSections.map((section) => ({
    url: `${BASE_URL}/home/${section}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }));

  const nichePages = niches.map((niche) => ({
    url: `${BASE_URL}/home/all?niches=${niche}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.6,
  }));

  const communityPages = dynamicCommunities.map((slug) => ({
    url: `${BASE_URL}/c/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.6,
  }));

  const tokenPages = dynamicTokens.map((addr) => ({
    url: `${BASE_URL}/token/${encodeURIComponent(addr)}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.5,
  }));

  return [
    ...staticRoutes.map((r) => ({
      url: `${BASE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: r.changefreq,
      priority: r.priority,
    })),
    ...protocolPages,
    ...nichePages,
    ...communityPages,
    ...tokenPages,
  ];
}
