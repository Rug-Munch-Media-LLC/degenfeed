/**
 * @degenfeed/utils — RSS item parsing contract tests
 *
 * Parser is deliberately regex-based and lenient: missing tags become empty
 * strings rather than throwing, and values are returned RAW (entity decoding
 * is the caller's job via `decodeXmlEntities`). These tests pin that split.
 */

import { describe, expect, it } from 'vitest';
import { parseRssItems } from './rss';

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Hello World</title>
    <link>https://example.com/post/1</link>
    <guid>123</guid>
    <description>My first post</description>
    <author>alice</author>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Second</title>
    <link>https://example.com/post/2</link>
    <description><![CDATA[raw &amp; markup]]></description>
    <dc:creator>bob</dc:creator>
  </item>
</channel></rss>`;

describe('parseRssItems', () => {
  it('returns an empty array for a feed with no items', () => {
    expect(parseRssItems('')).toEqual([]);
    expect(parseRssItems('<rss><channel></channel></rss>')).toEqual([]);
  });

  it('parses every <item> in document order', () => {
    const items = parseRssItems(FEED);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title)).toEqual(['Hello World', 'Second']);
  });

  it('extracts each supported field', () => {
    const [first] = parseRssItems(FEED);
    expect(first).toEqual({
      title: 'Hello World',
      link: 'https://example.com/post/1',
      guid: '123',
      description: 'My first post',
      author: 'alice',
      pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
    });
  });

  it('falls back to <dc:creator> when <author> is absent', () => {
    expect(parseRssItems(FEED)[1]?.author).toBe('bob');
  });

  it('renders missing fields as empty strings, never undefined', () => {
    const second = parseRssItems(FEED)[1];
    expect(second?.guid).toBe('');
    expect(second?.pubDate).toBe('');
  });

  it('returns raw CDATA-wrapped values without decoding them', () => {
    // Decoding is decodeXmlEntities' job — the parser must not do it twice.
    expect(parseRssItems(FEED)[1]?.description).toBe('<![CDATA[raw &amp; markup]]>');
  });

  it('tolerates surrounding whitespace, newlines and tag attributes', () => {
    const items = parseRssItems(`<item>
      <title type="html">  Spaced  </title>
      <link>  https://a.test/x  </link>
    </item>`);
    expect(items[0]?.title).toBe('  Spaced  ');
    expect(items[0]?.link).toBe('  https://a.test/x  ');
  });

  it('is case-insensitive on tag names', () => {
    expect(parseRssItems('<ITEM><TITLE>Up</TITLE></ITEM>')[0]?.title).toBe('Up');
  });
});
