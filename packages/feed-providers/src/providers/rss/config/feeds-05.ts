import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_05: RssFeedConfig[] = [
  cfg('https://paragraph.xyz/feed', {
    tier: 5,
    weight: 0.6,
    category: 'newsletter',
    tags: ['crypto', 'web3', 'publishing'],
    authority: 1,
    isPaid: false,
    schedule: 'irregular',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Long-tail Crypto News Outlets
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cryptonews.net/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://cryptonews.net/news/bitcoin/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://cryptodaily.co.uk/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://www.cryptopolitan.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://coinjournal.net/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://www.fxstreet.com/cryptocurrencies/news/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'markets', 'forex'],
    authority: 1,
  }),
  cfg('https://www.blocktempo.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'asia'],
    authority: 1,
  }),
  cfg('https://thecryptobasic.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://www.crypto-news-flash.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://coinpedia.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://www.trustnodes.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'ethereum'],
    authority: 1,
  }),
  cfg('https://www.livebitcoinnews.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://cryptoadventure.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://memeburn.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'tech'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // AI x Crypto / Tech News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.interconnects.ai/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'research'],
    authority: 1,
  }),
  cfg('https://thesequence.substack.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'ml', 'research'],
    authority: 1,
  }),
  cfg('https://jack-clark.net/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'research'],
    authority: 1,
  }),
  cfg('https://stratechery.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'strategy', 'analysis'],
    authority: 1,
  }),
  cfg('https://technically.substack.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'economics'],
    authority: 1,
  }),
  cfg('https://www.semiconductor-digest.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['hardware', 'semiconductor', 'tech'],
    authority: 1,
  }),
  cfg('https://techcrunch.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'startup', 'ai'],
    authority: 2,
  }),
  cfg('https://www.theverge.com/rss/index.xml', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'gadgets', 'science', 'ai'],
    authority: 2,
  }),
  cfg('https://arstechnica.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'science', 'security', 'ai'],
    authority: 2,
  }),
  cfg('https://www.wired.com/feed/rss', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'science', 'culture', 'ai'],
    authority: 2,
  }),
];
