import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_07: RssFeedConfig[] = [
  cfg('https://www.piratewires.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'culture', 'policy'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ARXIV Research Feeds
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://arxiv.org/rss/cs.AI', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['ai', 'research', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.CL', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['nlp', 'research', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.CR', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['security', 'crypto', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.LG', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['ml', 'research', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/stat.ML', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['ml', 'statistics', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/q-fin.TR', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['trading', 'markets', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.CY', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['tech', 'society', 'papers'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Developer / Engineering Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://hnrss.org/frontpage?points=20', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'news', 'startup'],
    authority: 1,
  }),
  cfg('https://hnrss.org/newest?points=10', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'news'],
    authority: 1,
  }),
  // news.ycombinator.com/rss removed — doesn't serve RSS; hnrss.org alternatives are already listed
  cfg('https://lobste.rs/rss', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'programming'],
    authority: 1,
  }),
  cfg('https://dev.to/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['programming', 'webdev'],
    authority: 1,
  }),
  cfg('https://blog.rust-lang.org/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['rust', 'programming', 'dev'],
    authority: 1,
  }),
  cfg('https://go.dev/blog/feed.atom', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['golang', 'programming', 'dev'],
    authority: 1,
  }),
  cfg('https://github.blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['dev', 'github', 'programming'],
    authority: 1,
  }),
  cfg('https://stackoverflow.blog/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['programming', 'community'],
    authority: 1,
  }),
  cfg('https://blog.cloudflare.com/rss/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['security', 'infrastructure', 'networking'],
    authority: 1,
  }),

  cfg('https://martinfowler.com/feed.atom', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['architecture', 'programming'],
    authority: 1,
  }),
  cfg('https://engineering.fb.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['engineering', 'meta', 'infra'],
    authority: 1,
  }),
  cfg('https://netflixtechblog.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['engineering', 'infra'],
    authority: 1,
  }),
  cfg('https://aws.amazon.com/blogs/aws/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['aws', 'cloud', 'devops'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Social: Reddit
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.reddit.com/r/CryptoCurrency/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['crypto', 'discussion'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Bitcoin/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/ethereum/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['ethereum'],
    authority: 1,
  }),
];
