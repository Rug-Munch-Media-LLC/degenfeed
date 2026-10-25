/**
 * @degenfeed/utils — entity decoding and HTML stripping
 *
 * `stripHtml` and `decodeXmlEntities` used to keep independent copies of the
 * entity map. These tests pin the shared behaviour so the dedupe cannot drift.
 */

import { describe, expect, it } from 'vitest';
import { decodeXmlEntities, HTML_ENTITIES } from './entities';
import { stripHtml } from './stripHtml';

describe('decodeXmlEntities', () => {
  it('unwraps CDATA', () => {
    expect(decodeXmlEntities('<![CDATA[hello]]>')).toBe('hello');
  });

  it('decodes named entities from the shared map', () => {
    // The trailing `&nbsp;` decodes to a space which the final trim removes.
    expect(decodeXmlEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&#39; f&nbsp;')).toBe(
      'a & b <c> "d" \'e\' f',
    );
  });

  it('decodes decimal and hex numeric entities', () => {
    expect(decodeXmlEntities('&#65;&#x42;&#x1F600;')).toBe('AB\u{1F600}');
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeXmlEntities('&unknown; &#xZZ;')).toBe('&unknown; &#xZZ;');
  });

  it('trims surrounding whitespace and tolerates empty input', () => {
    expect(decodeXmlEntities('  x  ')).toBe('x');
    expect(decodeXmlEntities('')).toBe('');
  });
});

describe('stripHtml', () => {
  it('returns an empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('removes nested tags and collapses whitespace', () => {
    expect(stripHtml('<div><span>nested</span></div>')).toBe('nested');
    expect(stripHtml('<p>a</p>\n\n<p>b</p>')).toBe('a b');
  });

  it('turns any <br> variant into a separator', () => {
    expect(stripHtml('line1<br>line2')).toBe('line1 line2');
    expect(stripHtml('line1<br/>line2')).toBe('line1 line2');
    expect(stripHtml('line1<BR />line2')).toBe('line1 line2');
  });

  it('decodes the same entity set as decodeXmlEntities', () => {
    for (const entity of Object.keys(HTML_ENTITIES)) {
      const decoded = stripHtml(`x${entity}y`);
      expect(decoded).toBe(`x${HTML_ENTITIES[entity]}y`);
    }
  });

  it('does not decode numeric entities (tags-only contract)', () => {
    expect(stripHtml('&#65;')).toBe('&#65;');
  });
});
