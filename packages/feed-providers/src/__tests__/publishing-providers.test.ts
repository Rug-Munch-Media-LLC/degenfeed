/**
 * Publishing provider tests — Substack, Medium, Paragraph, Mirror.
 *
 * Covers:
 *   - shared article image extraction (img/enclosure/media/og/twitter)
 *   - Substack RSS parsing + image surfacing
 *   - Medium RSS parsing + Cloudflare challenge fallback to FlareSolverr
 *   - Paragraph bridge wiring + native RSS fallback
 *   - Mirror Arweave GraphQL native fetch + bridge fallback
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractImagesFromHtml,
  extractImagesFromItemXml,
  firstImage,
  stripArticleHtml,
} from '../providers/article-media';
import { isChallengePage, MediumProvider, parseMediumRss } from '../providers/medium';
import { parseSubstackRss, SubstackProvider } from '../providers/substack';
import {
  bridgePostToPost,
  ParagraphProvider,
  parseParagraphRss,
} from '../providers/paragraph';
import {
  extractMarkdownImages,
  mirrorArticleToPost,
  MirrorProvider,
} from '../providers/mirror';

function mockTextResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/rss+xml' }),
    redirected: false,
    type: 'basic',
    url: '',
    body: null,
    bodyUsed: false,
    clone: () => mockTextResponse(text),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    json: async () => ({}),
    text: async () => text,
  } as Response;
}

function mockJsonResponse(json: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic',
    url: '',
    body: null,
    bodyUsed: false,
    clone: () => mockJsonResponse(json),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as Response;
}

const SUBSTACK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <title><![CDATA[Milk Road]]></title>
    <link>https://milkroad.substack.com</link>
    <description><![CDATA[Daily crypto newsletter]]></description>
    <image><url>https://substackcdn.com/logo.png</url></image>
    <item>
      <title><![CDATA[Bitcoin hits new all-time high]]></title>
      <link>https://milkroad.substack.com/p/bitcoin-aths</link>
      <guid>https://milkroad.substack.com/p/bitcoin-aths</guid>
      <pubDate>Wed, 05 Aug 2026 12:00:00 GMT</pubDate>
      <author>milkroad@substack.com</author>
      <dc:creator><![CDATA[Milk Road]]></dc:creator>
      <description><![CDATA[<img src="https://substackcdn.com/image/ath.png" alt="ATH"><p>Bitcoin is printing new highs.</p>]]></description>
      <content:encoded><![CDATA[<img src="https://substackcdn.com/image/ath.png" alt="ATH"><p>Bitcoin is printing new highs with institutional inflows.</p>]]></content:encoded>
      <enclosure url="https://substackcdn.com/audio/episode.mp3" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

const MEDIUM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <title>Medium: cryptocurrency</title>
    <link>https://medium.com/tag/cryptocurrency</link>
    <description>Stories about cryptocurrency</description>
    <item>
      <title>Why Ethereum is scaling</title>
      <link>https://medium.com/@author/why-ethereum-is-scaling-abc123</link>
      <guid>https://medium.com/@author/why-ethereum-is-scaling-abc123</guid>
      <pubDate>Tue, 04 Aug 2026 08:00:00 GMT</pubDate>
      <dc:creator><![CDATA[Jane Doe]]></dc:creator>
      <description><![CDATA[<img src="https://miro.medium.com/eth-scaling.png"><p>Layer 2s are winning.</p>]]></description>
      <content:encoded><![CDATA[<img src="https://miro.medium.com/eth-scaling.png" width="700"><p>Layer 2s are winning with cheaper fees.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

describe('article-media image extraction', () => {
  it('extracts <img> src URLs from HTML', () => {
    const urls = extractImagesFromHtml(
      '<p>hello <img src="https://cdn.example.com/a.png" alt="x"> world</p>',
    );
    expect(urls).toEqual(['https://cdn.example.com/a.png']);
  });

  it('extracts og:image and twitter:image meta tags', () => {
    const urls = extractImagesFromHtml(
      '<meta property="og:image" content="https://cdn.example.com/og.png">' +
        '<meta name="twitter:image" content="https://cdn.example.com/tw.png">',
    );
    expect(urls).toContain('https://cdn.example.com/og.png');
    expect(urls).toContain('https://cdn.example.com/tw.png');
  });

  it('extracts enclosure, media:content and media:thumbnail', () => {
    const urls = extractImagesFromHtml(
      '<enclosure url="https://cdn.example.com/pod.mp3" type="audio/mpeg"/>' +
        '<media:content url="https://cdn.example.com/full.jpg" medium="image"/>' +
        '<media:thumbnail url="https://cdn.example.com/thumb.jpg" width="100"/>',
    );
    expect(urls).toContain('https://cdn.example.com/full.jpg');
    expect(urls).toContain('https://cdn.example.com/thumb.jpg');
    expect(urls).toContain('https://cdn.example.com/pod.mp3');
  });

  it('extracts from a full RSS item block (CDATA-wrapped content)', () => {
    const urls = extractImagesFromItemXml(
      '<item><title>x</title>' +
        '<description><![CDATA[<img src="https://cdn.example.com/inline.jpg">]]></description>' +
        '<media:thumbnail url="https://cdn.example.com/thumb.jpg"/></item>',
    );
    expect(urls).toContain('https://cdn.example.com/inline.jpg');
    expect(urls).toContain('https://cdn.example.com/thumb.jpg');
  });

  it('resolves relative URLs against a base', () => {
    const urls = extractImagesFromHtml('<img src="/img/hero.png">', 'https://site.example.com');
    expect(urls[0]).toBe('https://site.example.com/img/hero.png');
  });

  it('deduplicates repeated image URLs', () => {
    const urls = extractImagesFromHtml(
      '<img src="https://cdn.example.com/a.png"><img src="https://cdn.example.com/a.png">',
    );
    expect(urls).toHaveLength(1);
  });

  it('firstImage returns the first usable candidate', () => {
    expect(firstImage(undefined, [], 'https://cdn.example.com/b.png')).toBe(
      'https://cdn.example.com/b.png',
    );
    expect(firstImage(undefined, [])).toBeUndefined();
  });

  it('stripArticleHtml converts <br> to newlines and strips tags', () => {
    const text = stripArticleHtml('<p>Hello<br>World &amp; friends</p>');
    expect(text).toContain('Hello');
    expect(text).toContain('World');
    expect(text).toContain('&');
  });

  it('extractMarkdownImages pulls ![alt](url) and raw image links', () => {
    const urls = extractMarkdownImages(
      '![cover](https://arweave.net/abc.png)\n\ntext\nhttps://arweave.net/xyz.jpg',
    );
    expect(urls).toContain('https://arweave.net/abc.png');
    expect(urls).toContain('https://arweave.net/xyz.jpg');
  });
});

describe('SubstackProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('parses a Substack RSS feed into article posts with images', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockTextResponse(SUBSTACK_XML));
    const provider = new SubstackProvider({
      sources: [{ slug: 'milkroad', name: 'Milk Road' }],
    });
    const result = await provider.fetchFeed({ timeoutMs: 500 });

    expect(result.posts.length).toBe(1);
    const post = result.posts[0];
    expect(post?.protocol).toBe('substack');
    expect(post?.contentType).toBe('article');
    expect(post?.id).toContain('substack:milkroad:');
    expect(post?.author.displayName).toBe('Milk Road');
    expect(post?.text).toContain('Bitcoin hits new all-time high');
    expect(post?.embeds.some((e) => e.kind === 'image')).toBe(true);
    expect(post?.embeds.some((e) => e.kind === 'link')).toBe(true);
  });

  it('surfaces the first image in post.media and image fields', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockTextResponse(SUBSTACK_XML));
    const provider = new SubstackProvider({ sources: [{ slug: 'milkroad' }] });
    const result = await provider.fetchFeed({ timeoutMs: 500 });
    const post = result.posts[0];
    expect(post?.image).toBe('https://substackcdn.com/image/ath.png');
    expect(post?.media).toBe('https://substackcdn.com/image/ath.png');
  });

  it('tolerates a failing publication without killing the whole feed', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('good')) return mockTextResponse(SUBSTACK_XML);
      throw new Error('404');
    });
    const provider = new SubstackProvider({
      sources: [
        { slug: 'bad', name: 'Bad' },
        { slug: 'good', name: 'Good' },
      ],
      feedUrlFor: (slug) => `https://${slug}.substack.com/feed`,
    });
    const result = await provider.fetchFeed({ timeoutMs: 500 });
    expect(result.posts.length).toBeGreaterThan(0);
    expect(result.notice).toContain('1/2');
  });

  it('health check reports unhealthy when the feed is unreachable', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
    const provider = new SubstackProvider({ sources: [{ slug: 'milkroad' }] });
    const health = await provider.healthCheck({ timeoutMs: 100 });
    expect(health.healthy).toBe(false);
  });

  it('parseSubstackRss extracts author from dc:creator', () => {
    const feed = parseSubstackRss(SUBSTACK_XML, 'https://milkroad.substack.com/feed');
    expect(feed.title).toBe('Milk Road');
    expect(feed.items[0]?.title).toBe('Bitcoin hits new all-time high');
    expect(feed.items[0]?.author).toBe('Milk Road');
    expect(feed.items[0]?.images.length).toBeGreaterThan(0);
  });
});

describe('MediumProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('parses a Medium tag RSS feed into article posts', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockTextResponse(MEDIUM_XML));
    const provider = new MediumProvider({ tags: ['cryptocurrency'] });
    const result = await provider.fetchFeed({ timeoutMs: 500 });

    expect(result.posts.length).toBe(1);
    const post = result.posts[0];
    expect(post?.protocol).toBe('medium');
    expect(post?.contentType).toBe('article');
    expect(post?.author.displayName).toBe('Medium: cryptocurrency');
    expect(post?.text).toContain('Why Ethereum is scaling');
    expect(post?.image).toBe('https://miro.medium.com/eth-scaling.png');
    expect(post?.embeds.some((e) => e.kind === 'image')).toBe(true);
  });

  it('falls back to FlareSolverr when direct fetch returns a Cloudflare challenge', async () => {
    const challengePage =
      '<!DOCTYPE html><html><head><title>Just a moment...</title>' +
      '<script src="/challenges.cloudflare.com/cdn-cgi/challenge-platform/scripts/main.js"></script>' +
      '</head><body>Checking your browser before accessing medium.com.</body></html>';
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (String(init?.body ?? '').includes('request.get')) {
        return mockJsonResponse({ status: 'ok', solution: { response: MEDIUM_XML } });
      }
      return mockTextResponse(challengePage);
    });
    const provider = new MediumProvider({
      tags: ['cryptocurrency'],
      flareSolverrUrl: 'http://127.0.0.1:8192',
    });
    const result = await provider.fetchFeed({ timeoutMs: 1000 });
    expect(result.posts.length).toBe(1);
    expect(result.posts[0]?.protocol).toBe('medium');
  });

  it('isChallengePage detects Cloudflare challenge pages', () => {
    expect(isChallengePage('<html><title>Just a moment...</title></html>')).toBe(true);
    expect(isChallengePage('<html><title>Attention Required!</title></html>')).toBe(true);
    expect(isChallengePage('<?xml version="1.0"?><rss version="2.0"><channel/></rss>')).toBe(false);
  });

  it('returns empty when all sources fail', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const provider = new MediumProvider({ tags: ['cryptocurrency'] });
    const result = await provider.fetchFeed({ timeoutMs: 200 });
    expect(result.posts).toEqual([]);
    expect(result.notice).toBeDefined();
  });

  it('parseMediumRss extracts author + images', () => {
    const feed = parseMediumRss(MEDIUM_XML, 'https://medium.com/feed/tag/cryptocurrency');
    expect(feed.items[0]?.author).toBe('Jane Doe');
    expect(feed.items[0]?.images[0]).toBe('https://miro.medium.com/eth-scaling.png');
  });
});

describe('ParagraphProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('wires through the bridge response into article posts', async () => {
    const bridgeResponse = {
      source: 'paragraph-bridge',
      posts: [
        {
          id: 'abc123',
          title: 'The State of Web3 Publishing',
          link: 'https://paragraph.xyz/@bankless/state-of-web3',
          pubDate: 'Wed, 05 Aug 2026 10:00:00 GMT',
          description: '<img src="https://cdn.paragraph.xyz/cover.png"><p>Deep dive</p>',
          publication: 'Bankless',
          slug: 'bankless',
        },
      ],
      total: 1,
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockJsonResponse(bridgeResponse));
    const provider = new ParagraphProvider({ bridgeUrl: 'http://127.0.0.1:8241' });
    const result = await provider.fetchFeed({ timeoutMs: 500 });

    expect(result.posts.length).toBe(1);
    const post = result.posts[0];
    expect(post?.protocol).toBe('paragraph');
    expect(post?.contentType).toBe('article');
    expect(post?.author.displayName).toBe('Bankless');
    expect(post?.id).toContain('paragraph:abc123');
    expect(post?.image).toBe('https://cdn.paragraph.xyz/cover.png');
  });

  it('falls back to native RSS when the bridge is unavailable', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/paragraph/posts')) throw new Error('bridge down');
      return mockTextResponse(SUBSTACK_XML); // reuse generic RSS shape
    });
    const provider = new ParagraphProvider({
      bridgeUrl: 'http://127.0.0.1:8241',
      publications: [{ slug: 'bankless', name: 'Bankless' }],
    });
    const result = await provider.fetchFeed({ timeoutMs: 500 });
    expect(result.notice).toContain('native RSS fallback');
    expect(result.posts.length).toBeGreaterThan(0);
  });

  it('bridgePostToPost builds an article with link embed', () => {
    const post = bridgePostToPost({
      id: 'p1',
      title: 'Title',
      link: 'https://paragraph.xyz/@a16z/title',
      publication: 'a16z Crypto',
      slug: 'a16z',
    });
    expect(post.protocol).toBe('paragraph');
    expect(post.contentType).toBe('article');
    expect(post.embeds.some((e) => e.kind === 'link')).toBe(true);
  });

  it('health check reports unhealthy when bridge is down', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
    const provider = new ParagraphProvider({ bridgeUrl: 'http://127.0.0.1:8241' });
    const health = await provider.healthCheck({ timeoutMs: 100 });
    expect(health.healthy).toBe(false);
  });

  it('parseParagraphRss extracts posts from a paragraph RSS feed', () => {
    const posts = parseParagraphRss(SUBSTACK_XML, { slug: 'bankless', name: 'Bankless' }, 'https://paragraph.xyz/api/feeds/rss/@bankless');
    expect(posts.length).toBe(1);
    expect(posts[0]?.protocol).toBe('paragraph');
    expect(posts[0]?.contentType).toBe('article');
  });
});

describe('MirrorProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('fetches articles natively via Arweave GraphQL + permaweb content', async () => {
    const graphqlResponse = {
      data: {
        transactions: {
          edges: [
            {
              node: {
                id: 'tx123',
                tags: [{ name: 'App-Name', value: 'MirrorXYZ' }],
                block: { timestamp: 1784192338 },
              },
            },
          ],
        },
      },
    };
    const contentEnvelope = {
      content: {
        title: 'Constellation Log #003',
        body: '![cover](https://arweave.net/cover.png)\n\nOn a Monday in late June...',
        digest: 'digest-abc',
        contributor: '0x6b0980a64b662cf08c9b07b734aaff117263cf82',
        coverImage: 'https://arweave.net/cover.png',
        timestamp: 1784192338,
      },
    };
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('graphql')) return mockJsonResponse(graphqlResponse);
      return mockJsonResponse(contentEnvelope);
    });
    const provider = new MirrorProvider({});
    const result = await provider.fetchFeed({ timeoutMs: 1000 });

    expect(result.posts.length).toBe(1);
    const post = result.posts[0];
    expect(post?.protocol).toBe('mirror');
    expect(post?.contentType).toBe('article');
    expect(post?.text).toContain('Constellation Log #003');
    expect(post?.id).toContain('mirror:digest-abc');
    expect(post?.image).toBe('https://arweave.net/cover.png');
    expect(post?.embeds.some((e) => e.kind === 'image')).toBe(true);
  });

  it('falls back to the mirror bridge when native GraphQL fails', async () => {
    const bridgeResponse = {
      source: 'mirror-bridge',
      articles: [
        {
          arweaveTxId: 'txbridge1',
          title: 'Bridge Article',
          body: 'Body from bridge.',
          publishedAt: '2026-07-16T08:58:58.000Z',
          contributor: '0xabc',
          digest: 'digest-bridge',
        },
      ],
      articleCount: 1,
    };
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/mirror/articles')) return mockJsonResponse(bridgeResponse);
      throw new Error('native down');
    });
    const provider = new MirrorProvider({ bridgeUrl: 'http://127.0.0.1:8240' });
    const result = await provider.fetchFeed({ timeoutMs: 1000 });
    expect(result.notice).toContain('bridge fallback');
    expect(result.posts.length).toBe(1);
    expect(result.posts[0]?.protocol).toBe('mirror');
  });

  it('mirrorArticleToPost returns null for empty articles', () => {
    expect(mirrorArticleToPost({ title: '', body: '' })).toBeNull();
  });

  it('mirrorArticleToPost builds a valid post from a raw article', () => {
    const post = mirrorArticleToPost({
      title: 'Test',
      body: 'Hello world',
      digest: 'd1',
      contributor: '0x6b0980a64b662cf08c9b07b734aaff117263cf82',
    });
    expect(post).not.toBeNull();
    expect(post?.protocol).toBe('mirror');
    expect(post?.contentType).toBe('article');
    expect(post?.id).toBe('mirror:d1');
  });
});
