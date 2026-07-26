/**
 * news-rss-parser — RSS/Atom feed parser for the news pipeline.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * Parses RSS 2.0 and Atom feeds into ParsedRssItem objects.
 */

import type { Env } from '../types';
import { decodeXmlEntities, extractAll, extractText, stripTags } from './news-helpers';
import type { ParsedRssItem } from './news-types';

/**
 * Fetch an RSS/Atom feed URL and return raw XML text.
 */
export async function fetchRssFeed(url: string, timeoutMs = 8000): Promise<string | null> {

/**
 * Parse RSS 2.0 or Atom XML into ParsedRssItem array.
 */
export function parseFeedXml(xml: string, maxItems = 20): ParsedRssItem[] {

/**
 * Parse Atom XML feed format.
 */
function parseAtom(xml: string, maxItems = 20): ParsedRssItem[] {

