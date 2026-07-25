import type { NewsSourceMeta } from "./news-types";

export const TIER_4_SOURCES: NewsSourceMeta[] = [
  //──Tier4:Tech/general──{
    id: 'techcrunch',
    name: 'TechCrunch',
    category: 'tech',
    tier: 4,
    credibility: 0.8,
    weight: 0.9,
    url: 'https://techcrunch.com/feed/',
    type: 'rss',
  },
  {
    id: 'theverge',
    name: 'The Verge',
    category: 'tech',
    tier: 4,
    credibility: 0.78,
    weight: 0.9,
    url: 'https://www.theverge.com/rss/index.xml',
    type: 'rss',
  },
];
