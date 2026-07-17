import type { MetadataRoute } from 'next';

const BASE_URL = 'https://app.degenfeed.xyz';

const staticRoutes: Array<{ path: string; changefreq: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = [
  { path: '', changefreq: 'hourly', priority: 1.0 },
  { path: '/feed', changefreq: 'always', priority: 0.9 },
  { path: '/news', changefreq: 'hourly', priority: 0.8 },
  { path: '/discover', changefreq: 'daily', priority: 0.7 },
  { path: '/docs', changefreq: 'weekly', priority: 0.6 },
  { path: '/about', changefreq: 'monthly', priority: 0.4 },
  { path: '/faq', changefreq: 'monthly', priority: 0.5 },
  { path: '/privacy', changefreq: 'monthly', priority: 0.3 },
  { path: '/terms', changefreq: 'monthly', priority: 0.3 },
  { path: '/community-guidelines', changefreq: 'monthly', priority: 0.3 },
  { path: '/acceptable-use', changefreq: 'monthly', priority: 0.3 },
  { path: '/legal', changefreq: 'monthly', priority: 0.3 },
  { path: '/status', changefreq: 'daily', priority: 0.5 },
  { path: '/premium', changefreq: 'weekly', priority: 0.5 },
  { path: '/newsletter', changefreq: 'weekly', priority: 0.5 },
  { path: '/videos', changefreq: 'daily', priority: 0.6 },
  { path: '/home', changefreq: 'always', priority: 0.9 },
  { path: '/home/funding', changefreq: 'hourly', priority: 0.7 },
];

const protocolSections = [
  'nostr', 'farcaster', 'lens', 'bluesky',
  'mastodon', 'threads', 'reddit', 'rss', 'lemmy',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages = staticRoutes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changefreq,
    priority: r.priority,
  } as MetadataRoute.Sitemap[number]));

  const protocolPages = protocolSections.map((section) => ({
    url: `${BASE_URL}/home/${section}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }));

  const nichePages = [
    'bitcoin', 'ethereum', 'solana', 'defi', 'ai',
    'nft', 'security', 'macro', 'layer2',
  ].map((niche) => ({
    url: `${BASE_URL}/home/all?niches=${niche}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...protocolPages, ...nichePages];
}
