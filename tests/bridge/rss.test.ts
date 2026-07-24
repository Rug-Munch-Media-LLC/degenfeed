/**
 * @degenfeed/local-bridge — RSS & Newsletter Aggregator Tests
 *
 * Covers:
 * - stripHtml HTML/entity stripping
 * - extractFeaturedImage extraction from HTML
 * - extractMetadata parsing
 * - extractEnclosures from RSS items
 * - guessNiches with base niches + new patterns
 * - parseFeedXml Atom + RSS 2.0 parsing
 * - getFeedsByCategory filtering
 * - FEED_COUNT verification (149 sources)
 * - ALL_FEEDS source enumeration
 * - getNewsletterFeeds() returns newsletter sources
 * - fetchRssPosts error handling
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  stripHtml,
  guessNiches,
  extractFeaturedImage,
  extractMetadata,
  extractEnclosures,
  parseFeedXml,
  getFeedsByCategory,
  getNewsletterFeeds,
  getFeaturedFeeds,
  FEED_COUNT,
  ALL_FEEDS,
} from '../../bridge/src/providers/rss';

describe('RSS Provider — stripHtml', () => {
  it('should strip complex HTML', () => {
    expect(stripHtml('<div class="content"><p>Hello <em>world</em></p></div>')).toBe('Hello world');
  });

  it('should convert <br> to newlines', () => {
    expect(stripHtml('line1<br>line2<br />line3')).toBe('line1\nline2\nline3');
  });

  it('should decode HTML entities', () => {
    expect(stripHtml('&amp; &lt; &gt; &quot; &#39; &#x27; &#x2F; &nbsp;')).toBe('& < > " \' \' /');
  });

  it('should collapse multiple spaces', () => {
    expect(stripHtml('hello     world    test')).toBe('hello world test');
  });
});

describe('RSS Provider — guessNiches', () => {
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

  it('should detect memecoin from pepe mention', () => {
    expect(guessNiches('Pepe coin mooning hard', ['crypto'])).toContain('memecoin');
  });

  it('should detect layer2 from arbitrum mention', () => {
    expect(guessNiches('Arbitrum TVL hits new high', ['crypto'])).toContain('layer2');
  });

  it('should detect dao from governance mention', () => {
    expect(guessNiches('DAO treasury vote passed', ['crypto'])).toContain('dao');
  });

  it('should detect zero-knowledge from zk mention', () => {
    expect(guessNiches('ZK proof verification costs drop 90%', ['crypto'])).toContain('zero-knowledge');
  });

  it('should detect rwa from real-world mention', () => {
    expect(guessNiches('Real-world asset tokenization boom', ['crypto'])).toContain('rwa');
  });

  it('should detect stablecoin from usdc mention', () => {
    expect(guessNiches('USDC supply growing on Solana', ['crypto'])).toContain('stablecoin');
  });

  it('should detect nft from collectible mention', () => {
    expect(guessNiches('NFT collectible floor prices rising', ['crypto'])).toContain('nft');
  });

  it('should detect dex from swap mention', () => {
    expect(guessNiches('Uniswap v4 introduces new AMM architecture', ['crypto'])).toContain('dex');
  });

  it('should detect wallet from self-custody mention', () => {
    expect(guessNiches('Self-custody hardware wallet best practices', ['crypto'])).toContain('wallet');
  });

  it('should detect oracle from pyth mention', () => {
    expect(guessNiches('Pyth network oracle data now live', ['crypto'])).toContain('oracle');
  });

  it('should detect privacy from monero mention', () => {
    expect(guessNiches('Monero privacy features updated', ['crypto'])).toContain('privacy');
  });

  it('should detect mobile from telegram mention', () => {
    expect(guessNiches('Telegram crypto payments launch', ['crypto'])).toContain('mobile');
  });

  it('should detect interop from cosmos mention', () => {
    expect(guessNiches('Cosmos IBC interoperability upgrade', ['crypto'])).toContain('interop');
  });
});

describe('RSS Provider — extractFeaturedImage', () => {
  it('should extract image URL from img tag', () => {
    const html = '<p>Text</p><img src="https://example.com/image.jpg" alt="img"/>';
    expect(extractFeaturedImage(html)).toBe('https://example.com/image.jpg');
  });

  it('should return undefined for data URIs', () => {
    const html = '<img src="data:image/png;base64,abc123"/>';
    expect(extractFeaturedImage(html)).toBeUndefined();
  });

  it('should return undefined for empty html', () => {
    expect(extractFeaturedImage('')).toBeUndefined();
  });

  it('should return undefined for null html', () => {
    expect(extractFeaturedImage(undefined as unknown as string)).toBeUndefined();
  });

  it('should skip favicon URLs', () => {
    const html = '<img src="https://example.com/favicon.ico"/>';
    expect(extractFeaturedImage(html)).toBeUndefined();
  });
});

describe('RSS Provider — extractMetadata', () => {
  it('should extract description meta tag', () => {
    const html = '<meta name="description" content="A great article about crypto"/>';
    const meta = extractMetadata(html);
    expect(meta.description).toBe('A great article about crypto');
  });

  it('should extract author meta tag', () => {
    const html = '<meta name="author" content="Satoshi Nakamoto"/>';
    const meta = extractMetadata(html);
    expect(meta.authorName).toBe('Satoshi Nakamoto');
  });

  it('should extract keywords meta tag', () => {
    const html = '<meta name="keywords" content="bitcoin, crypto, defi"/>';
    const meta = extractMetadata(html);
    expect(meta.keywords).toEqual(['bitcoin', 'crypto', 'defi']);
  });

  it('should handle missing meta tags', () => {
    const meta = extractMetadata('<p>No meta here</p>');
    expect(meta.description).toBeUndefined();
    expect(meta.authorName).toBeUndefined();
    expect(meta.keywords).toBeUndefined();
  });
});

describe('RSS Provider — extractEnclosures', () => {
  it('should extract enclosure URL and type', () => {
    const e = '<enclosure url="https://example.com/podcast.mp3" type="audio/mpeg" length="12345"/>';
    const enclosures = extractEnclosures(e);
    expect(enclosures).toHaveLength(1);
    expect(enclosures[0]?.url).toBe('https://example.com/podcast.mp3');
    expect(enclosures[0]?.type).toBe('audio/mpeg');
  });

  it('should extract enclosure with no type', () => {
    const e = '<enclosure url="https://example.com/file.pdf"/>';
    const enclosures = extractEnclosures(e);
    expect(enclosures).toHaveLength(1);
    expect(enclosures[0]?.url).toBe('https://example.com/file.pdf');
    expect(enclosures[0]?.type).toBeUndefined();
  });

  it('should handle multiple enclosures', () => {
    const e = '<enclosure url="https://example.com/a.mp3" type="audio/mpeg"/><enclosure url="https://example.com/b.mp4" type="video/mp4"/>';
    const enclosures = extractEnclosures(e);
    expect(enclosures).toHaveLength(2);
  });

  it('should return empty array for no enclosures', () => {
    const enclosures = extractEnclosures('<p>No enclosures here</p>');
    expect(enclosures).toEqual([]);
  });
});

describe('RSS Provider — parseFeedXml', () => {
  it('should parse Atom entries with complete metadata', () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Crypto News Feed</title>
  <subtitle>Latest crypto news</subtitle>
  <link href="https://example.com/feed"/>
  <entry>
    <title>Bitcoin reaches $150k</title>
    <link href="https://example.com/btc-ath"/>
    <id>urn:uuid:12345</id>
    <published>2026-07-24T10:00:00Z</published>
    <updated>2026-07-24T11:00:00Z</updated>
    <summary>Bitcoin has reached a new all-time high of $150,000</summary>
    <content type="html"><![CDATA[<p>Big news today!</p>]]></content>
    <author>
      <name>John Writer</name>
      <uri>https://example.com/john</uri>
    </author>
    <category term="bitcoin"/>
    <category term="markets"/>
  </entry>
  <entry>
    <title>Ethereum L2 activity surges</title>
    <link href="https://example.com/eth-l2"/>
    <published>2026-07-24T09:00:00Z</published>
  </entry>
</feed>`;

    const result = parseFeedXml(xml);
    expect(result.title).toBe('Crypto News Feed');
    expect(result.description).toBe('Latest crypto news');
    expect(result.link).toBe('https://example.com/feed');
    expect(result.items).toHaveLength(2);

    const first = result.items[0]!;
    expect(first.title).toBe('Bitcoin reaches $150k');
    expect(first.link).toBe('https://example.com/btc-ath');
    expect(first.authorName).toBe('John Writer');
    expect(first.authorLink).toBe('https://example.com/john');
    expect(first.categories).toContain('bitcoin');
    expect(first.categories).toContain('markets');
    expect(first.id).toContain('12345');
    expect(first.publishedAt).toBeLessThan(first.updatedAt);
  });

  it('should fall back to RSS 2.0 items when no Atom entries', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <description>A test RSS feed</description>
    <item>
      <title>Bitcoin halving countdown</title>
      <link>https://example.com/halving</link>
      <guid>https://example.com/halving/guid</guid>
      <pubDate>Wed, 24 Jul 2026 12:00:00 GMT</pubDate>
      <author>news-team@example.com</author>
      <category>bitcoin</category>
      <category>mining</category>
      <description>Countdown to the next Bitcoin halving event</description>
    </item>
    <item>
      <title>Solana validators update</title>
      <link>https://example.com/sol-update</link>
    </item>
  </channel>
</rss>`;

    const result = parseFeedXml(xml);
    expect(result.title).toBe('Test Feed');
    expect(result.description).toBe('A test RSS feed');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.title).toBe('Bitcoin halving countdown');
    expect(result.items[0]?.categories).toContain('bitcoin');
    expect(result.items[0]?.categories).toContain('mining');
    expect(result.items[0]?.authorName).toBe('news-team@example.com');
    expect(result.items[1]?.title).toBe('Solana validators update');
  });

  it('should skip empty titles', () => {
    const xml = `<feed><entry><title></title></entry><entry><title>Valid Title</title></entry></feed>`;
    const result = parseFeedXml(xml);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('Valid Title');
  });

  it('should handle minimal RSS with no date', () => {
    const xml = `<rss version="2.0"><channel><title>Minimal</title><item><title>Just a title</title></item></channel></rss>`;
    const result = parseFeedXml(xml);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.publishedAt).toBeGreaterThan(0);
  });

  it('should handle Atom entry with no content', () => {
    const xml = `<feed><entry><title>No content entry</title><link href="https://example.com"/><published>2026-07-24T10:00:00Z</published></entry></feed>`;
    const result = parseFeedXml(xml);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.contentText).toBe('');
  });

  it('should handle dc:date in RSS items', () => {
    const xml = `<rss version="2.0"><channel><title>Test</title><item><title>DC Date</title><dc:date>2026-07-24T10:00:00Z</dc:date></item></channel></rss>`;
    const result = parseFeedXml(xml);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.publishedAt).toBeGreaterThan(0);
  });

  it('should handle CDATA-wrapped description', () => {
    const xml = `<rss version="2.0"><channel><title>CDATA Test</title><item><title>CDATA Item</title><description><![CDATA[<p>CDATA <strong>content</strong></p>]]></description></item></channel></rss>`;
    const result = parseFeedXml(xml);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.contentText).toContain('CDATA content');
  });
});

describe('RSS Provider — getFeedsByCategory', () => {
  it('should return feeds for a valid category', () => {
    const feeds = getFeedsByCategory('crypto-news');
    expect(feeds.length).toBeGreaterThan(15);
    for (const f of feeds) {
      expect(f.category).toBe('crypto-news');
    }
  });

  it('should return correct feeds for crypto-news category', () => {
    const cryptoFeeds = getFeedsByCategory('crypto-news');
    expect(cryptoFeeds.length).toBeGreaterThan(20);
  });

  it('should return feeds with bitcoin niches for bitcoin feeds', () => {
    const bitcoinFeeds = ALL_FEEDS.filter((f) => f.niches.includes('bitcoin'));
    expect(bitcoinFeeds.length).toBeGreaterThan(2);
    for (const f of bitcoinFeeds) {
      expect(f.niches).toContain('bitcoin');
    }
  });

  it('should return empty array for unknown category', () => {
    const feeds = getFeedsByCategory('unknown' as never);
    expect(feeds).toEqual([]);
  });
});

describe('RSS Provider — FEED_COUNT verification', () => {
  it('should have 100+ sources', () => {
    expect(FEED_COUNT).toBeGreaterThanOrEqual(100);
  });

  it('should have at least 140 sources', () => {
    expect(FEED_COUNT).toBeGreaterThanOrEqual(148);
  });
});

describe('RSS Provider — ALL_FEEDS structure', () => {
  it('every feed should have required fields', () => {
    for (const feed of ALL_FEEDS) {
      expect(feed.url).toBeTruthy();
      expect(feed.label).toBeTruthy();
      expect(feed.category).toBeTruthy();
      expect(feed.niches).toBeInstanceOf(Array);
      expect(feed.niches.length).toBeGreaterThan(0);
    }
  });

  it('every feed should have unique labels', () => {
    const labels = ALL_FEEDS.map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every feed should have unique URLs', () => {
    const urls = ALL_FEEDS.map((f) => f.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('RSS Provider — Newsletter feeds', () => {
  it('getNewsletterFeeds should return 20+ newsletter sources', () => {
    const feeds = getNewsletterFeeds();
    expect(feeds.length).toBeGreaterThan(20);

    const platforms = new Set(feeds.map((f) => f.platform));
    expect(platforms.has('substack')).toBe(true);
    expect(platforms.has('medium')).toBe(true);
    expect(platforms.has('paragraph')).toBe(true);
  });

  it('Substack feeds should use substack.com/feed URL pattern', () => {
    const substack = ALL_FEEDS.filter((f) => f.platform === 'substack');
    expect(substack.length).toBeGreaterThan(10);
    for (const f of substack) {
      expect(f.url).toContain('substack.com/feed');
    }
  });

  it('Medium feeds should use medium.com/feed URL pattern', () => {
    const medium = ALL_FEEDS.filter((f) => f.platform === 'medium');
    expect(medium.length).toBeGreaterThan(3);
    for (const f of medium) {
      expect(f.url).toContain('medium.com/feed');
    }
  });

  it('should have all 6 newsletter platforms represented', () => {
    const platforms = new Set(ALL_FEEDS.filter((f) => f.platform).map((f) => f.platform));
    expect(platforms.has('substack')).toBe(true);
    expect(platforms.has('medium')).toBe(true);
    expect(platforms.has('mirror')).toBe(true);
    expect(platforms.has('paragraph')).toBe(true);
    expect(platforms.has('ghost')).toBe(true);
    expect(platforms.has('beehiiv')).toBe(true);
  });
});

describe('RSS Provider — Featured feeds', () => {
  it('should have 5+ featured sources', () => {
    const featured = getFeaturedFeeds();
    expect(featured.length).toBeGreaterThan(5);
    for (const f of featured) {
      expect(f.featured).toBe(true);
    }
  });
});

describe('RSS Provider — Categories coverage', () => {
  it('should have all major categories present', () => {
    const categories = new Set(ALL_FEEDS.map((f) => f.category));
    expect(categories.has('crypto-news')).toBe(true);
    expect(categories.has('crypto-research')).toBe(true);
    expect(categories.has('vc-investment')).toBe(true);
    expect(categories.has('dev-technical')).toBe(true);
    expect(categories.has('security')).toBe(true);
    expect(categories.has('academic')).toBe(true);
    expect(categories.has('tech')).toBe(true);
    expect(categories.has('defi')).toBe(true);
    expect(categories.has('nft')).toBe(true);
    expect(categories.has('ai')).toBe(true);
    expect(categories.has('newsletter')).toBe(true);
    expect(categories.has('regulation')).toBe(true);
  });
});

describe('RSS Provider — fetchRssPosts (error handling)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle fetch failures gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchRssPosts } = await import('../../bridge/src/providers/rss');
    const posts = await fetchRssPosts(10);
    expect(posts).toEqual([]);
  });

  it('should handle HTTP errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '',
    });
    const { fetchRssPosts } = await import('../../bridge/src/providers/rss');
    const posts = await fetchRssPosts(10);
    expect(posts).toEqual([]);
  });

  it('should handle empty XML responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    const { fetchRssPosts } = await import('../../bridge/src/providers/rss');
    const posts = await fetchRssPosts(10);
    expect(posts).toEqual([]);
  });
});

describe('RSS Provider — fetchNewsletterPosts (error handling)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle fetch failures gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchNewsletterPosts } = await import('../../bridge/src/providers/rss');
    const posts = await fetchNewsletterPosts(10);
    expect(posts).toEqual([]);
  });
});
