import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/messages/',
          '/settings/',
          '/profile/',
          '/creator/',
          '/auth/',
          '/health',
          '/notifications/',
          '/offline',
        ],
      },
    ],
    sitemap: 'https://app.degenfeed.xyz/sitemap.xml',
  };
}
