import type { NewsSourceMeta } from "./news-types";

export const NEWSLETTER_TIER_3: NewsSourceMeta[] = [
  {
    id: 'nansen-nl',
    name: 'Nansen',
    category: 'onchain',
    tier: 3,
    credibility: 0.83,
    weight: 1.0,
    url: 'https://nansen.substack.com/feed',
    type: 'rss',
  },
  {
    id: 'tokenterminal-nl',
    name: 'Token Terminal',
    category: 'crypto',
    tier: 3,
    credibility: 0.84,
    weight: 1.0,
    url: 'https://tokenterminal.com/feed',
    type: 'rss',
  },
  {
    id: 'rekt-nl',
    name: 'Rekt News',
    category: 'security',
    tier: 3,
    credibility: 0.82,
    weight: 1.2,
    url: 'https://rekt.news/feed.xml',
    type: 'rss',
  },
];
