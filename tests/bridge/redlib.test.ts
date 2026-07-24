/**
 * @degenfeed/local-bridge — Redlib/Reddit Provider Tests
 *
 * Covers:
 * - stripHtml HTML/entity stripping
 * - guessNiches with subreddit context
 * - parseRssXml Atom + RSS 2.0 parsing
 * - fetchRedditPosts error handling
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { guessNiches, parseRssXml, stripHtml } from '../../bridge/src/providers/redlib';

describe('Redlib Provider — stripHtml', () => {
  it('should strip basic HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('should convert <br> to newlines', () => {
    expect(stripHtml('line1<br>line2<br/>line3')).toBe('line1\nline2\nline3');
  });

  it('should decode common HTML entities', () => {
    expect(stripHtml('AT&amp;T &lt;3 &quot;crypto&quot;')).toBe('AT&T <3 "crypto"');
  });

  it('should strip all tags and collapse whitespace', () => {
    expect(stripHtml('<div><p>hello    world</p></div>')).toBe('hello world');
  });
});

describe('Redlib Provider — guessNiches', () => {
  it('should detect bitcoin from subreddit name', () => {
    expect(guessNiches('Check out this great post', 'Bitcoin')).toContain('bitcoin');
  });

  it('should detect solana from text and subreddit', () => {
    const niches = guessNiches('Solana is fast and cheap', 'solana');
    expect(niches).toContain('solana');
  });

  it('should detect defi from text', () => {
    expect(guessNiches('Yield farming on Aave is profitable', 'CryptoCurrency')).toContain('defi');
  });

  it('should detect multiple niches', () => {
    const niches = guessNiches('AI agents on Ethereum L2s', 'technology');
    expect(niches).toContain('ai');
    expect(niches).toContain('ethereum');
    expect(niches).toContain('layer2');
  });

  it('should detect finance from investing subreddit', () => {
    expect(guessNiches('Market analysis for Q3', 'investing')).toContain('finance');
  });

  it('should detect science from space subreddit', () => {
    expect(guessNiches('New discovery about Mars', 'space')).toContain('science');
  });

  it('should default to crypto when no niche matches', () => {
    expect(guessNiches('Random life advice', 'AskReddit')).toEqual(['crypto']);
  });
});

describe('Redlib Provider — parseRssXml', () => {
  it('should parse Atom entries from XML', () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Bitcoin Subreddit</title>
  <entry>
    <title>Bitcoin is going to $100k</title>
    <link href="https://reddit.com/r/Bitcoin/post1"/>
    <updated>2026-07-24T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Ethereum merge analysis</title>
    <link href="https://reddit.com/r/ethereum/post2"/>
    <updated>2026-07-24T09:00:00Z</updated>
  </entry>
</feed>`;

    const posts = parseRssXml(xml, 'Bitcoin', 10);
    expect(posts).toHaveLength(2);
    expect(posts[0]?.text).toBe('Bitcoin is going to $100k');
    expect(posts[0]?.protocol).toBe('reddit');
    expect(posts[0]?.id).toContain('rss');
    expect(posts[0]?.author.displayName).toBe('r/Bitcoin');
    expect(posts[1]?.text).toBe('Ethereum merge analysis');
  });

  it('should fall back to RSS 2.0 items when Atom has no entries', () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Reddit RSS</title>
    <item>
      <title>Solana summer is here</title>
      <link>https://reddit.com/r/solana/post1</link>
    </item>
    <item>
      <title>DeFi TVL reaches新高</title>
      <link>https://reddit.com/r/defi/post2</link>
    </item>
  </channel>
</rss>`;

    const posts = parseRssXml(xml, 'solana', 10);
    expect(posts).toHaveLength(2);
    expect(posts[0]?.text).toBe('Solana summer is here');
    expect(posts[0]?.protocol).toBe('reddit');
  });

  it('should skip entries without titles', () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title></title>
    <link href="https://reddit.com/r/test/post1"/>
  </entry>
  <entry>
    <title>Valid post title</title>
    <link href="https://reddit.com/r/test/post2"/>
  </entry>
</feed>`;

    const posts = parseRssXml(xml, 'test', 10);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.text).toBe('Valid post title');
  });

  it('should respect the limit parameter', () => {
    const entries = Array.from(
      { length: 5 },
      (_, i) =>
        `<entry><title>Post ${i}</title><link href="https://reddit.com/r/test/p${i}"/><updated>2026-07-24T10:00:00Z</updated></entry>`,
    ).join('\n');
    const xml = `<feed>${entries}</feed>`;

    const posts = parseRssXml(xml, 'test', 3);
    expect(posts).toHaveLength(3);
  });

  it('should return empty array for empty XML', () => {
    const posts = parseRssXml('<xml></xml>', 'test', 10);
    expect(posts).toEqual([]);
  });
});

describe('Redlib Provider — fetchRedditPosts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchRedditPosts } = await import('../../bridge/src/providers/redlib');
    const posts = await fetchRedditPosts(10);
    expect(posts).toEqual([]);
  });

  it('should handle rate limiting gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    const { fetchRedditPosts } = await import('../../bridge/src/providers/redlib');
    const posts = await fetchRedditPosts(10);
    expect(posts).toEqual([]);
  });
});
