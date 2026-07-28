/**
 * @degenfeed/youtube-provider — Parser Tests
 *
 * Tests the YouTube RSS feed parser, XML extraction helpers,
 * and channel feed fetching with error handling.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchChannelFeed } from '../youtube/parser';
import type { YouTubeChannel } from '../youtube/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const sampleChannel: YouTubeChannel = {
  name: 'Test Channel',
  channelId: 'UCtest1234',
  category: 'market_analysis',
  subcategory: 'daily-news',
  weight: 1.0,
  niches: ['crypto', 'defi'],
};

// Sample YouTube RSS feed XML
const SAMPLE_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UCtest1234</yt:channelId>
    <title>Bitcoin Price Analysis March 2024</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2024-03-15T10:00:00+00:00</published>
    <updated>2024-03-15T10:00:00+00:00</updated>
    <media:group>
      <media:title>Bitcoin Price Analysis March 2024</media:title>
      <media:description>In-depth analysis of Bitcoin price action and market trends.</media:description>
      <media:thumbnail url="https://i.ytimg.com/vi/abc123/default.jpg" width="120" height="90"/>
      <media:content url="https://www.youtube.com/v/abc123?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
      <media:statistics views="15000" likes="1200"/>
    </media:group>
    <yt:duration seconds="600"/>
  </entry>
  <entry>
    <id>yt:video:def456</id>
    <yt:videoId>def456</yt:videoId>
    <yt:channelId>UCtest1234</yt:channelId>
    <title>Altcoin Season Analysis 2024</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=def456"/>
    <published>2024-03-14T08:00:00+00:00</published>
    <updated>2024-03-14T08:00:00+00:00</updated>
    <media:group>
      <media:title>Altcoin Season Analysis 2024</media:title>
      <media:description>Altcoins are showing strength against Bitcoin.</media:description>
      <media:thumbnail url="https://i.ytimg.com/vi/def456/default.jpg" width="120" height="90"/>
      <media:statistics views="8500"/>
    </media:group>
    <yt:duration seconds="420"/>
  </entry>
</feed>`;

// ─── fetchChannelFeed ──────────────────────────────────────────────────────

describe('YouTube Parser: fetchChannelFeed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and parses RSS feed returning entries', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS_XML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.videoId).toBe('abc123');
    expect(entries[0]!.title).toBe('Bitcoin Price Analysis March 2024');
    expect(entries[0]!.views).toBe(15000);
    expect(entries[0]!.duration).toBe(600);
    expect(entries[0]!.channelName).toBe('Test Channel');
  });

  it('parses video metadata correctly for all entries', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS_XML),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries).toHaveLength(2);

    // First entry
    expect(entries[0]!.videoId).toBe('abc123');
    expect(entries[0]!.title).toBe('Bitcoin Price Analysis March 2024');
    expect(entries[0]!.views).toBe(15000);
    expect(entries[0]!.duration).toBe(600);
    expect(entries[0]!.link).toBe('https://www.youtube.com/watch?v=abc123');
    expect(entries[0]!.thumbnail).toBe('https://i.ytimg.com/vi/abc123/default.jpg');

    // Second entry
    expect(entries[1]!.videoId).toBe('def456');
    expect(entries[1]!.title).toBe('Altcoin Season Analysis 2024');
    expect(entries[1]!.views).toBe(8500);
    expect(entries[1]!.duration).toBe(420);
  });

  it('returns empty array on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries).toHaveLength(0);
  });

  it('returns empty array on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries).toHaveLength(0);
  });

  it('returns empty array on abort signal', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries).toHaveLength(0);
  });

  it('returns empty array for very short XML', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<short/>'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries).toHaveLength(0);
  });

  it('uses channel feed URL if provided', async () => {
    const customFeedChannel: YouTubeChannel = {
      ...sampleChannel,
      feed: 'https://custom.feed.url/videos.xml',
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS_XML),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchChannelFeed(customFeedChannel);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom.feed.url/videos.xml',
      expect.any(Object),
    );
  });

  it('uses channel_id URL when feed is not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS_XML),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchChannelFeed(sampleChannel);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest1234',
      expect.any(Object),
    );
  });

  it('includes proper User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS_XML),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchChannelFeed(sampleChannel);
    const options = mockFetch.mock.calls[0]![1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('DegenFeed');
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────

describe('YouTube Parser: Edge Cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles malformed XML entries gracefully', async () => {
    const malformedXml = `<?xml version="1.0"?>
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>yt:video:valid</id>
        <yt:videoId>valid</yt:videoId>
        <title>Valid Video</title>
        <published>2024-03-15T10:00:00+00:00</published>
      </entry>
      <entry>
        <id>bad</id>
        <!-- missing required fields -->
      </entry>
    </feed>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(malformedXml),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    // At least the valid entry should be parsed
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const validEntry = entries.find((e) => e.videoId === 'valid');
    expect(validEntry).toBeDefined();
    expect(validEntry!.title).toBe('Valid Video');
  });

  it('handles XML with HTML entities in titles', async () => {
    const xmlWithEntities = `<?xml version="1.0"?>
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <yt:videoId>entity123</yt:videoId>
        <title>Bitcoin &amp; Ethereum: The Ultimate Showdown</title>
        <published>2024-03-15T10:00:00+00:00</published>
        <media:group>
          <media:description>Comparing BTC &amp; ETH.</media:description>
          <media:statistics views="1000"/>
        </media:group>
      </entry>
    </feed>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(xmlWithEntities),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries[0]!.title).toContain('&');
    expect(entries[0]!.description).toContain('&');
  });

  it('handles entries with CDATA sections', async () => {
    const xmlWithCDATA = `<?xml version="1.0"?>
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <yt:videoId>cdata123</yt:videoId>
        <title><![CDATA[Hot Crypto Tips 🔥]]></title>
        <published>2024-03-15T10:00:00+00:00</published>
        <media:group>
          <media:description><![CDATA[Get the <b>best</b> crypto tips here!]]></media:description>
          <media:statistics views="2000"/>
        </media:group>
      </entry>
    </feed>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(xmlWithCDATA),
    });
    vi.stubGlobal('fetch', mockFetch);

    const entries = await fetchChannelFeed(sampleChannel);
    expect(entries[0]!.title).toBe('Hot Crypto Tips 🔥');
    expect(entries[0]!.description).toBe('Get the <b>best</b> crypto tips here!');
  });
});
