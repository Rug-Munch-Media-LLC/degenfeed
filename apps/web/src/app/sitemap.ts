import type { MetadataRoute } from 'next';

export const runtime = 'edge';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://app.degenfeed.xyz';

  const staticPaths = [
    { url: `${base}/feed`, priority: 1.0, changeFrequency: 'always' as const },
    { url: `${base}/home`, priority: 0.9, changeFrequency: 'daily' as const },
    { url: `${base}/news`, priority: 0.8, changeFrequency: 'hourly' as const },
    { url: `${base}/newsletter`, priority: 0.7, changeFrequency: 'daily' as const },
    { url: `${base}/status`, priority: 0.5, changeFrequency: 'hourly' as const },
    { url: `${base}/premium`, priority: 0.4, changeFrequency: 'weekly' as const },
    { url: `${base}/profile`, priority: 0.4, changeFrequency: 'weekly' as const },
    { url: `${base}/privacy`, priority: 0.2, changeFrequency: 'monthly' as const },
    { url: `${base}/terms`, priority: 0.2, changeFrequency: 'monthly' as const },
  ];

  return staticPaths.map((p) => ({
    url: p.url,
    lastModified: new Date(),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
