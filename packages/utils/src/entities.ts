/**
 * @degenfeed/utils — XML/HTML entity decoding
 *
 * The single source of truth for entity decoding in this package and for the
 * shared adapters outside it. Keeping the map here means a new entity is
 * added once, not per adapter.
 */

/** Named entities we decode. Numeric entities are handled separately. */
export const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Matches any key of {@link HTML_ENTITIES} — derived, never hand-listed. */
export const NAMED_ENTITY_RE = new RegExp(Object.keys(HTML_ENTITIES).join('|'), 'g');

/** Replace the named entities in {@link HTML_ENTITIES}; unknown input is kept. */
export function decodeNamedEntities(str: string): string {
  return str.replace(NAMED_ENTITY_RE, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * Decode XML/HTML entities and unwrap CDATA.
 *
 * Strips `<![CDATA[...]]>` wrappers, decodes the named entities in
 * {@link HTML_ENTITIES}, decodes decimal (`&#38;`) and hex (`&#x26;`)
 * numeric entities, then trims the result.
 */
export function decodeXmlEntities(str: string): string {
  const unwrapped = str.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
  return decodeNamedEntities(unwrapped)
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}
