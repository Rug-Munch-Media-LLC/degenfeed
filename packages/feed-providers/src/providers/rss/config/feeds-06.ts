import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_06: RssFeedConfig[] = [
  cfg('https://www.theinformation.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'business', 'analysis'],
    authority: 1,
  }),
  cfg('https://restofworld.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'global'],
    authority: 1,
  }),
  // protocol.com/feed removed — site defunct
  cfg('https://www.platformer.news/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'policy', 'social'],
    authority: 1,
  }),
  cfg('https://venturebeat.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'ai', 'gaming', 'startup'],
    authority: 2,
  }),
  cfg('https://www.technologyreview.com/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'tech',
    tags: ['tech', 'ai', 'science', 'innovation'],
    authority: 3,
  }),
  cfg('https://www.zdnet.com/news/rss.xml', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'security'],
    authority: 1,
  }),
  cfg('https://spectrum.ieee.org/feeds/feed.rss', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'engineering', 'science'],
    authority: 1,
  }),
  cfg('https://www.quantamagazine.org/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'math', 'physics', 'research'],
    authority: 2,
  }),
  cfg('https://venturebeat.com/category/ai/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'ml', 'startup'],
    authority: 3,
  }),
  // theverge.com/ai-... removed — sub-category feed 404 (main feed works)
  cfg('https://techcrunch.com/category/artificial-intelligence/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'startup', 'tech'],
    authority: 3,
  }),
  cfg('https://www.technologyreview.com/topic/artificial-intelligence/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'ml', 'research'],
    authority: 3,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // AI Company Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://openai.com/blog/rss.xml', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'openai', 'gpt', 'research'],
    authority: 3,
  }),
  cfg('https://www.anthropic.com/feed/', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'anthropic', 'claude', 'research'],
    authority: 3,
  }),
  cfg('https://deepmind.google/blog/rss.xml', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'deepmind', 'google', 'research'],
    authority: 3,
  }),
  cfg('https://ai.meta.com/blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'meta', 'research'],
    authority: 1,
  }),
  cfg('https://blog.google/technology/ai/rss/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'google', 'research'],
    authority: 1,
  }),
  cfg('https://huggingface.co/blog/feed.xml', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'ml', 'opensource', 'research'],
    authority: 3,
  }),
  cfg('https://stability.ai/blog/feed', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'image', 'generative', 'research'],
    authority: 3,
  }),
  cfg('https://cohere.com/blog/rss', {
    tier: 5,
    weight: 0.6,
    category: 'ai',
    tags: ['ai', 'llm', 'nlp'],
    authority: 1,
  }),
  cfg('https://www.semianalysis.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'semiconductor', 'analysis'],
    authority: 1,
  }),
  cfg('https://www.ben-evans.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'strategy', 'analysis'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Tech / Startup Newsletters
  // ═══════════════════════════════════════════════════════════════════

  cfg('https://www.notboring.co/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'business', 'crypto'],
    authority: 1,
  }),
  cfg('https://lennysnewsletter.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'product', 'growth'],
    authority: 1,
  }),
  cfg('https://every.to/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'business', 'ideas'],
    authority: 1,
  }),
  cfg('https://www.bigtechnology.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'policy', 'analysis'],
    authority: 1,
  }),
];
