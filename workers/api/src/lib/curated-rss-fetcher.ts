/**
 * @degenfeed/api-worker — Curated Podcast RSS Fetcher
 *
 * Fetches episode data from external podcast RSS feeds and normalizes
 * them into UnifiedPodcastEpisode format for storage in KV.
 *
 * KV schema:
 *   podcast:curated:{podcastId}         → CuratedPodcast metadata
 *   podcast:curated:episode:{episodeId} → UnifiedPodcastEpisode
 *   podcast:curated:index:all           → JSON array of all curated podcast IDs
 *   podcast:curated:index:crypto        → JSON array of crypto podcast IDs
 *   podcast:curated:index:tech          → JSON array of tech podcast IDs
 *   podcast:curated:index:ai            → JSON array of AI podcast IDs
 *   podcast:curated:latest              → Latest 100 episodes (sorted)
 *   podcast:curated:trending            → Trending episodes (sorted by plays)
 *   podcast:curated:last-fetch          → ISO timestamp
 */

import type { CuratedPodcast, UnifiedPodcastEpisode } from '../feed/podcast-curation';
import { ALL_CURATED_PODCASTS, CURATED_PODCASTS_BY_CATEGORY } from '../feed/podcast-curation';

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_EPISODES_PER_FETCH = 20;
const MAX_EPISODES_PER_PODCAST = 50;
const USER_AGENT = 'DegenFeed/1.0 CuratedPodcastAggregator';

// ─── KV Key Helpers ──────────────────────────────────────────────────────

export const curatedPodcastKey = (id: string) => `podcast:curated:${id}`;
export const curatedEpisodeKey = (id: string) => `podcast:curated:episode:${id}`;
export const CURATED_INDEX_KEY_ALL = 'podcast:curated:index:all';
export const CURATED_INDEX_KEY_CRYPTO = 'podcast:curated:index:crypto';
export const CURATED_INDEX_KEY_TECH = 'podcast:curated:index:tech';
export const CURATED_INDEX_KEY_AI = 'podcast:curated:index:ai';
export const CURATED_LATEST_KEY = 'podcast:curated:latest';
export const CURATED_TRENDING_KEY = 'podcast:curated:trending';
export const CURATED_LAST_FETCH_KEY = 'podcast:curated:last-fetch';

// ─── RSS Parsing ─────────────────────────────────────────────────────────

interface RawRssFeed {
  title?: string;
  description?: string;
  link?: string;
  image?: { url?: string };
  items: RawRssItem[];
}

interface RawRssItem {
  title?: string;
  description?: string;
  content?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  enclosure?: {
    url?: string;
    length?: string;
    type?: string;
  };
  'itunes:duration'?: string;
  'itunes:episode'?: string;
  'itunes:season'?: string;
  'itunes:image'?: { href?: string };
  'media:content'?: {
    url?: string;
    medium?: string;
  };
}

/**
 * Simple XML → RSS parser for the most common podcast RSS 2.0 format.
 * Uses regex-based extraction for Cloudflare Workers compatibility
 * (no DOM parser available).
 */
function parseRssXml(xml: string): RawRssFeed {
  const feed: RawRssFeed = { items: [] };

  // Extract channel title
  const titleMatch =
    xml.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/s) || xml.match(/<title>([^<]+)<\/title>/);
  if (titleMatch && titleMatch[1] !== undefined) feed.title = titleMatch[1].trim();

  // Extract channel description
  const descMatch =
    xml.match(/<description><!\[CDATA\[(.+?)\]\]><\/description>/s) ||
    xml.match(/<description>([^<]*)<\/description>/);
  if (descMatch && descMatch[1] !== undefined) feed.description = descMatch[1].trim();

  // Extract channel link
  const linkMatch = xml.match(/<link>([^<]+)<\/link>/);
  if (linkMatch && linkMatch[1] !== undefined) feed.link = linkMatch[1].trim();

  // Extract image
  const imgUrlMatch = xml.match(/<url>([^<]+)<\/url>/);
  if (imgUrlMatch && imgUrlMatch[1] !== undefined) feed.image = { url: imgUrlMatch[1].trim() };

  // Extract items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1] ?? '';
    const item = parseRssItem(itemXml);
    if (item.title || item.guid) {
      feed.items.push(item);
    }
  }

  return feed;
}

function parseRssItem(itemXml: string): RawRssItem {
  const item: RawRssItem = {};

  // Title
  const titleMatch =
    itemXml.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/s) ||
    itemXml.match(/<title>([^<]*)<\/title>/);
  if (titleMatch && titleMatch[1] !== undefined) item.title = titleMatch[1].trim();

  // Description
  const descMatch =
    itemXml.match(/<description><!\[CDATA\[(.+?)\]\]><\/description>/s) ||
    itemXml.match(/<description>([^<]*)<\/description>/);
  if (descMatch && descMatch[1] !== undefined) item.description = descMatch[1].trim();

  // Link
  const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/);
  if (linkMatch && linkMatch[1] !== undefined) item.link = linkMatch[1].trim();

  // GUID
  const guidMatch = itemXml.match(/<guid[^>]*>([^<]+)<\/guid>/);
  if (guidMatch && guidMatch[1] !== undefined) item.guid = guidMatch[1].trim();

  // PubDate
  const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/);
  if (pubDateMatch && pubDateMatch[1] !== undefined) item.pubDate = pubDateMatch[1].trim();

  // Enclosure
  const enclosureMatch = itemXml.match(/<enclosure\s+([^>]+)\/?>/);
  if (enclosureMatch && enclosureMatch[1] !== undefined) {
    const attrs = parseAttributes(enclosureMatch[1]);
    item.enclosure = {
      url: attrs.url,
      length: attrs.length,
      type: attrs.type,
    };
  }

  // iTunes duration
  const durationMatch = itemXml.match(/<itunes:duration>([^<]+)<\/itunes:duration>/);
  if (durationMatch && durationMatch[1] !== undefined)
    item['itunes:duration'] = durationMatch[1].trim();

  // iTunes episode number
  const episodeMatch = itemXml.match(/<itunes:episode>([^<]+)<\/itunes:episode>/);
  if (episodeMatch && episodeMatch[1] !== undefined)
    item['itunes:episode'] = episodeMatch[1].trim();

  // iTunes season number
  const seasonMatch = itemXml.match(/<itunes:season>([^<]+)<\/itunes:season>/);
  if (seasonMatch && seasonMatch[1] !== undefined) item['itunes:season'] = seasonMatch[1].trim();

  // iTunes image
  const imageMatch = itemXml.match(/<itunes:image\s+href="([^"]+)"/);
  if (imageMatch && imageMatch[1] !== undefined) item['itunes:image'] = { href: imageMatch[1] };

  return item;
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attrStr)) !== null) {
    const key = match[1];
    const val = match[2];
    if (key !== undefined && val !== undefined) {
      attrs[key.toLowerCase()] = val;
    }
  }
  return attrs;
}

function parseDuration(duration: string): number {
  // Supports "HH:MM:SS", "MM:SS", or plain seconds
  if (!duration) return 0;
  const trimmed = duration.trim();

  // Plain seconds
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  // HH:MM:SS or MM:SS
  const parts = trimmed.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    const s = parseInt(parts[2] ?? '0', 10);
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0] ?? '0', 10);
    const s = parseInt(parts[1] ?? '0', 10);
    return m * 60 + s;
  }
  return 0;
}

function parseDate(pubDate: string): number {
  if (!pubDate) return Date.now();
  const ts = Date.parse(pubDate);
  return Number.isNaN(ts) ? Date.now() : ts;
}

function generateEpisodeId(podcastId: string, guid: string): string {
  // Create deterministic ID from podcast + guid
  const input = `${podcastId}:${guid}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = (hash >> (i * 4)) & 0xff;
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeEpisode(raw: RawRssItem, podcast: CuratedPodcast): UnifiedPodcastEpisode | null {
  if (!raw.title && !raw.guid) return null;

  const guid = raw.guid || raw.link || raw.title || '';
  const id = generateEpisodeId(podcast.id, guid);

  const enclosureUrl = raw.enclosure?.url;
  const mediaUrl = raw['media:content']?.url;
  const audioUrl = enclosureUrl || mediaUrl || '';

  if (!audioUrl) return null; // No audio to play

  return {
    id,
    podcastId: podcast.id,
    podcastTitle: podcast.title,
    category: podcast.category,
    title: raw.title || 'Untitled Episode',
    description: raw.description || '',
    audioUrl,
    audioMimeType: raw.enclosure?.type || raw['media:content']?.medium || 'audio/mpeg',
    audioSize: raw.enclosure?.length ? parseInt(raw.enclosure.length, 10) : 0,
    duration: parseDuration(raw['itunes:duration'] || ''),
    episodeNumber: raw['itunes:episode'] ? parseInt(raw['itunes:episode'], 10) : undefined,
    seasonNumber: raw['itunes:season'] ? parseInt(raw['itunes:season'], 10) : undefined,
    coverUrl: raw['itunes:image']?.href || podcast.coverUrl || undefined,
    publishedAt: parseDate(raw.pubDate || ''),
    link: raw.link || podcast.website || undefined,
    guid,
    plays: 0,
    source: 'curated',
  };
}

// ─── Fetching ────────────────────────────────────────────────────────────

async function fetchRssFeed(rssUrl: string): Promise<string | null> {
  try {
    const res = await fetch(rssUrl, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[curated-rss] HTTP ${res.status} fetching ${rssUrl}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[curated-rss] Fetch error for ${rssUrl}:`, String(err));
    return null;
  }
}

/**
 * Fetch latest episodes from a single curated podcast feed.
 */
export async function fetchPodcastEpisodes(
  podcast: CuratedPodcast,
): Promise<UnifiedPodcastEpisode[]> {
  const xml = await fetchRssFeed(podcast.rssUrl);
  if (!xml) return [];

  const feed = parseRssXml(xml);
  const episodes: UnifiedPodcastEpisode[] = [];

  for (const raw of feed.items.slice(0, MAX_EPISODES_PER_FETCH)) {
    const normalized = normalizeEpisode(raw, podcast);
    if (normalized?.audioUrl) {
      episodes.push(normalized);
    }
  }

  return episodes;
}

/**
 * Fetch latest episodes from ALL curated podcasts.
 * Respects per-podcast TTL to avoid hammering feeds.
 */
export async function fetchAllCuratedEpisodes(kv: KVNamespace): Promise<UnifiedPodcastEpisode[]> {
  const allEpisodes: UnifiedPodcastEpisode[] = [];
  const now = Date.now();
  const fetchIntervalMs = 10 * 60 * 1000; // 10 min between fetches per podcast

  for (const podcast of ALL_CURATED_PODCASTS) {
    // Check if we fetched recently
    const lastFetch = podcast.lastFetchAt || 0;
    if (now - lastFetch < fetchIntervalMs) continue;

    try {
      const episodes = await fetchPodcastEpisodes(podcast);
      allEpisodes.push(...episodes);

      // Store episodes and update podcast metadata
      await storeEpisodesInKv(kv, podcast, episodes);

      // Update last fetch timestamp
      podcast.lastFetchAt = now;
      await kv.put(curatedPodcastKey(podcast.id), JSON.stringify(podcast));
    } catch (err) {
      console.warn(`[curated-rss] Failed to fetch ${podcast.id}:`, String(err));
    }
  }

  return allEpisodes;
}

// ─── KV Storage ──────────────────────────────────────────────────────────

/**
 * Store podcast episodes in KV, maintaining per-podcast episode lists
 * and the global latest/trending indices.
 */
async function storeEpisodesInKv(
  kv: KVNamespace,
  podcast: CuratedPodcast,
  newEpisodes: UnifiedPodcastEpisode[],
): Promise<void> {
  if (newEpisodes.length === 0) return;

  // Get existing episode IDs for this podcast
  const existingRaw = await kv.get(`podcast:curated:podcast:${podcast.id}:episodes`);
  const existingIds: string[] = existingRaw ? JSON.parse(existingRaw) : [];

  // Deduplicate by guid
  const existingGuids = new Set<string>();
  for (const id of existingIds) {
    const epRaw = await kv.get(curatedEpisodeKey(id));
    if (epRaw) {
      const ep = JSON.parse(epRaw) as UnifiedPodcastEpisode;
      existingGuids.add(ep.guid);
    }
  }

  // Filter out duplicates
  const unique = newEpisodes.filter((ep) => !existingGuids.has(ep.guid));

  if (unique.length === 0) return;

  // Store each episode
  const newIds: string[] = [];
  for (const ep of unique) {
    await kv.put(curatedEpisodeKey(ep.id), JSON.stringify(ep), { expirationTtl: 86400 * 90 });
    newIds.push(ep.id);
  }

  // Update per-podcast episode list
  const updatedIds = [...newIds, ...existingIds].slice(0, MAX_EPISODES_PER_PODCAST);
  await kv.put(`podcast:curated:podcast:${podcast.id}:episodes`, JSON.stringify(updatedIds));

  // Update podcast episode count
  podcast.episodeCount = updatedIds.length;

  // Update global latest episodes index
  await updateLatestIndex(kv, unique);

  // Update category-specific indices
  await updateCategoryIndex(kv, podcast.category, podcast.id);
}

async function updateLatestIndex(
  kv: KVNamespace,
  newEpisodes: UnifiedPodcastEpisode[],
): Promise<void> {
  const raw = await kv.get(CURATED_LATEST_KEY);
  const latest: UnifiedPodcastEpisode[] = raw ? JSON.parse(raw) : [];

  // Merge and sort by publishedAt descending
  const merged = [...newEpisodes, ...latest]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 100);

  await kv.put(CURATED_LATEST_KEY, JSON.stringify(merged), { expirationTtl: 86400 });
}

async function updateCategoryIndex(
  kv: KVNamespace,
  category: string,
  podcastId: string,
): Promise<void> {
  const indexKey = `podcast:curated:index:${category}`;
  const raw = await kv.get(indexKey);
  const ids: string[] = raw ? JSON.parse(raw) : [];

  if (!ids.includes(podcastId)) {
    ids.push(podcastId);
    await kv.put(indexKey, JSON.stringify(ids));
  }
}

// ─── KV Initialization ───────────────────────────────────────────────────

/**
 * Seed curated podcast metadata into KV (called on first deploy or refresh).
 */
export async function seedCuratedPodcasts(kv: KVNamespace): Promise<void> {
  const indexAll: string[] = [];

  for (const podcast of ALL_CURATED_PODCASTS) {
    await kv.put(curatedPodcastKey(podcast.id), JSON.stringify(podcast), {
      expirationTtl: 86400 * 365,
    });
    indexAll.push(podcast.id);
  }

  // Store all IDs index
  await kv.put(CURATED_INDEX_KEY_ALL, JSON.stringify(indexAll));

  // Store category indices
  for (const [category, podcasts] of Object.entries(CURATED_PODCASTS_BY_CATEGORY)) {
    await kv.put(`podcast:curated:index:${category}`, JSON.stringify(podcasts.map((p) => p.id)));
  }

  // console.log(`[curated-rss] Seeded ${indexAll.length} curated podcasts into KV`);
}

// ─── Trending Calculation ────────────────────────────────────────────────

/**
 * Recalculate trending episodes based on play count.
 */
export async function recalculateTrending(kv: KVNamespace): Promise<void> {
  const raw = await kv.get(CURATED_LATEST_KEY);
  if (!raw) return;

  const episodes: UnifiedPodcastEpisode[] = JSON.parse(raw);
  const trending = episodes.sort((a, b) => b.plays - a.plays).slice(0, 50);

  await kv.put(CURATED_TRENDING_KEY, JSON.stringify(trending), { expirationTtl: 86400 });
}

// ─── Utility ─────────────────────────────────────────────────────────────

/**
 * In-memory cache for the curated podcast catalog (avoids KV reads for static data).
 */
let _podcastCatalogCache: Record<string, CuratedPodcast> | null = null;

export function getCuratedPodcastCatalog(): Record<string, CuratedPodcast> {
  if (!_podcastCatalogCache) {
    _podcastCatalogCache = {};
    for (const p of ALL_CURATED_PODCASTS) {
      _podcastCatalogCache[p.id] = p;
    }
  }
  return _podcastCatalogCache;
}
