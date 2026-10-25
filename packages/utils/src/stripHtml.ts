/**
 * @degenfeed/utils — Plain-text extraction from HTML
 *
 * Single responsibility: turn untrusted markup into a one-line plain-text
 * preview. Shared by the feed adapters that render third-party HTML.
 */

import { HTML_ENTITIES, NAMED_ENTITY_RE } from './entities';

/**
 * Strip HTML tags and decode common entities, collapsing whitespace.
 *
 * `<br>` becomes a line break, every other tag becomes a space, then all
 * whitespace runs collapse to a single space so the result is a one-line
 * preview. An empty input returns an empty string.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(NAMED_ENTITY_RE, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
