/**
 * @degenfeed/local-bridge — RSS-Bridge Provider Tests
 *
 * Covers:
 * - stripHtml HTML/entity stripping
 * - guessNiches with base niches
 * - parseBridgeJson JSON parsing
 * - parseRssXml Atom + RSS 2.0 parsing
 * - fetchRssBridgePosts error handling
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  guessNiches,
  parseBridgeJson,
  parseRssXml,
  stripHtml,
} from '../../bridge/src/providers/rssbridge';

describe('RSS-Bridge Provider — stripHtml', () => {
  it('should strip complex HTML', () => {
    expect(stripHtml('<div class="content"><p>Hello <em>world</em></p></div>')).toBe('Hello world');
  });

  it('should convert <br> to newlines', () => {
    expect(stripHtml('line1<br>line2<br />line3')).toBe('line1\nline2\nline3');
  });

  it('should decode HTML entities', () => {
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe('& < > " \'  ');
  });

  it('should collapse multiple spaces', () => {
    expect(stripHtml('hello     world    test')).toBe('hello world test');
  });
});

describe('RSS-Bridge Provider — guessNiches', () => {
  it('should keep base niches and detect additional ones', () => {
    const niches = guessNiches('Bitcoin and Ethereum are both great', ['crypto']);
    expect(niches).toContain('crypto');
    expect(niches).toContain('bitcoin');
    expect(niches).toContain('ethereum');
  });

  it('should detect AI from text', () => {
    expect(guessNiches('New AI model released today', ['tech'])).toContain('ai');
  });

  it('should detect defi from text', () => {
    expect(guessNiches('DeFi lending protocols are growing', ['crypto'])).toContain('defi');
  });

  it('should detect security from text', () => {
    expect(guessNiches('Critical exploit in popular bridge', ['tech'])).toContain('security');
  });

  it('should add crypto as default when no niche matches', () => {
    expect(guessNiches('Weather forecast for tomorrow', [])).toEqual(['crypto']);
  });

  it('should detect regulation from etf mention', () => {
    expect(guessNiches('SEC approves spot Bitcoin ETF', ['finance'])).toContain('regulation');
  });
});

describe('RSS-Bridge Provider — parseBridgeJson', () => {
  it('should parse items into UnifiedPost shape', () => {
    const data = {
      title: 'CoinTelegraph',
      items: [
        {
          title: 'Bitcoin reaches new all-time high',
          url: 'https://cointelegraph.com/news/btc-ath',
          content_html: '<p>Bitcoin has reached a new all-time high of $150k</p>',
          date_modified: '2026-07-24T10:00:00Z',
        },
        {
          title: 'Ethereum L2s see record activity',
          url: 'https://cointelegraph.com/news/eth-l2',
          content_html:
            '<p>Ethereum layer 2 solutions are processing more transactions than ever</p>',
          date_modified: '2026-07-24T09:00:00Z',
        },
      ],
    };

    const posts = parseBridgeJson(data, 10);
    expect(posts).toHaveLength(2);
    expect(posts[0]?.protocol).toBe('rss');
    expect(posts[0]?.text).toBe('Bitcoin reaches new all-time high');
    expect(posts[0]?.author.displayName).toBe('CoinTelegraph');
    expect(posts[0]?.embeds[0]?.url).toBe('https://cointelegraph.com/news/btc-ath');
    expect(posts[0]?.niches).toContain('bitcoin');
    expect(posts[1]?.text).toBe('Ethereum L2s see record activity');
    expect(posts[1]?.niches).toContain('ethereum');
  });

  it('should handle empty items array', () => {
    const posts = parseBridgeJson({ title: 'Empty', items: [] }, 10);
    expect(posts).toEqual([]);
  });

  it('should handle missing items', () => {
    const posts = parseBridgeJson({ title: 'No items' }, 10);
    expect(posts).toEqual([]);
  });

  it('should fall back to content_html when title is empty', () => {
    const data = {
      title: 'Test',
      items: [
        {
          title: '',
          content_html: '<p>Bitcoin is the future of money</p>',
          url: 'https://example.com',
        },
      ],
    };
    const posts = parseBridgeJson(data, 10);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.text).toBe('Bitcoin is the future of money');
  });
});

describe('RSS-Bridge Provider — parseRssXml', () => {
  it('should parse Atom entries with proper IDs', () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Crypto News</title>
  <entry>
    <title>DeFi TVL reaches $100B</title>
    <link href="https://example.com/defi-tvl"/>
    <updated>2026-07-24T12:00:00Z</updated>
  </entry>
</feed>`;

    const posts = parseRssXml(xml, 'Decrypt', ['crypto'], 10);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.text).toBe('DeFi TVL reaches $100B');
    expect(posts[0]?.protocol).toBe('rss');
    expect(posts[0]?.author.displayName).toBe('Decrypt');
    expect(posts[0]?.niches).toContain('defi');
  });

  it('should fall back to RSS 2.0 items when no Atom entries', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Bitcoin halving countdown</title>
      <link>https://example.com/halving</link>
    </item>
  </channel>
</rss>`;

    const posts = parseRssXml(xml, 'Test', ['crypto'], 10);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.text).toBe('Bitcoin halving countdown');
  });

  it('should skip empty titles', () => {
    const xml = `<feed><entry><title></title></entry><entry><title>Valid Title</title></entry></feed>`;
    const posts = parseRssXml(xml, 'Test', ['crypto'], 10);
    expect(posts).toHaveLength(1);
  });
});

describe('RSS-Bridge Provider — fetchRssBridgePosts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchRssBridgePosts } = await import('../../bridge/src/providers/rssbridge');
    const posts = await fetchRssBridgePosts(10);
    expect(posts).toEqual([]);
  });
});
