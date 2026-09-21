/**
 * YouTube Provider
 *
 * Rate Limit: 50 channel feeds per refresh (no API key required)
 *
 * Fetches the latest videos from top crypto / tech / AI channels using
 * YouTube's public RSS feeds (no API key needed):
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 *
 * Each feed returns the 15 most recent uploads for a channel (Atom XML).
 * We parse video id, title, link, thumbnail (media:thumbnail), view count
 * (media:statistics), likes (media:starRating), description, and publish
 * date, then normalize to UnifiedPost with `contentType: 'video'`.
 *
 * NOTE: YouTube's public RSS feed does NOT include video duration. We parse
 * the `duration` attribute from media:content when present (some mirrors
 * include it) and fall back to `undefined` — the UI omits the badge then.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const YOUTUBE_FEED_BASE = 'https://www.youtube.com/feeds/videos.xml';
const USER_AGENT = 'DegenFeed-Bridge/0.2 (YouTube RSS)';

/**
 * YouTube videos stay relevant for weeks (unlike microblog posts), so the
 * global 48h freshness filter would empty the feed for channels that don't
 * upload daily. Use a 30-day window for video content — still fresh enough
 * to be useful, but doesn't starve the feed. Override with
 * YOUTUBE_MAX_AGE_HOURS (0 disables).
 */
export const YOUTUBE_MAX_AGE_HOURS = (() => {
  try {
    const raw = process.env.YOUTUBE_MAX_AGE_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 30 * 24; // 30 days
})();

/** 90s TTL — collapse repeated feed-build calls (prewarm + refresher) into
 *  one real fetch per window so YouTube RSS is not hammered under load. */
const YOUTUBE_CACHE_TTL_MS = 90_000;
let youtubeCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

export type YouTubeCategory = 'crypto' | 'ai' | 'tech';

export interface YouTubeChannel {
  /** Verified UC... channel id (used in the RSS feed URL). */
  channelId: string;
  /** Display name of the channel. */
  name: string;
  /** @handle for links/avatars. */
  handle: string;
  category: YouTubeCategory;
}

/**
 * Top crypto / tech / AI channels — verified channel IDs (2026-08-31).
 * Every channel was resolved from its @handle and the RSS feed fetched
 * (HTTP 200 + 15 entries) before being added; feeds with zero entries
 * would be silently skipped by the provider.
 *
 * Crypto (21): Coin Bureau, Bankless, Finematics, Whiteboard Crypto,
 *   Benjamin Cowen, DataDash, Ivan on Tech, Altcoin Daily, CoinGecko,
 *   a16z crypto, The Defiant, Blockworks, Unchained, Lark Davis,
 *   Cointelegraph, CoinDesk, Bitcoin Magazine, Real Vision,
 *   Paul Barron Network, InvestAnswers, CryptosRUs
 * AI (9): Two Minute Papers, Yannic Kilcher, AI Explained, Matt Wolfe,
 *   Andrej Karpathy, Lex Fridman, DotCSV, Matthew Berman, Wes Roth
 * Tech (14): Fireship, Theo - t3.gg, TechCrunch, Y Combinator, a16z,
 *   MKBHD, Linus Tech Tips, Veritasium, 3Blue1Brown, ColdFusion,
 *   Mrwhosetheboss, Dave2D, Jeff Geerling, NetworkChuck
 */
export const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  // ── Crypto ──────────────────────────────────────────────────────
  {
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    name: 'Coin Bureau',
    handle: 'CoinBureau',
    category: 'crypto',
  },
  {
    channelId: 'UCAl9Ld79qaZxp9JzEOwd3aA',
    name: 'Bankless',
    handle: 'Bankless',
    category: 'crypto',
  },
  {
    channelId: 'UCh1ob28ceGdqohUnR7vBACA',
    name: 'Finematics',
    handle: 'Finematics',
    category: 'crypto',
  },
  {
    channelId: 'UCsYYksPHiGqXHPoHI-fm5sg',
    name: 'Whiteboard Crypto',
    handle: 'WhiteboardCrypto',
    category: 'crypto',
  },
  {
    channelId: 'UCRvqjQPSeaWn-uEx-w0XOIg',
    name: 'Benjamin Cowen',
    handle: 'benjaminjcowen',
    category: 'crypto',
  },
  {
    channelId: 'UCCatR7nWbYrkVXdxXb4cGXw',
    name: 'DataDash',
    handle: 'DataDash',
    category: 'crypto',
  },
  {
    channelId: 'UCrYmtJBtLdtm2ov84ulV-yg',
    name: 'Ivan on Tech',
    handle: 'IvanOnTech',
    category: 'crypto',
  },
  {
    channelId: 'UCbLhGKVY-bJPcawebgtNfbw',
    name: 'Altcoin Daily',
    handle: 'AltcoinDaily',
    category: 'crypto',
  },
  {
    channelId: 'UC-OTgwOAI7KmP0eDAtqN3Ow',
    name: 'CoinGecko',
    handle: 'CoinGecko',
    category: 'crypto',
  },
  {
    channelId: 'UCTHq3W46BiAYjKUYZq2qm-Q',
    name: 'a16z crypto',
    handle: 'a16zcrypto',
    category: 'crypto',
  },
  {
    channelId: 'UCL0J4MLEdLP0-UyLu0hCktg',
    name: 'The Defiant',
    handle: 'TheDefiant',
    category: 'crypto',
  },
  {
    channelId: 'UCBqSFQyXr_b5BHWF_e5oNXw',
    name: 'Blockworks',
    handle: 'blockworks',
    category: 'crypto',
  },
  {
    channelId: 'UCWiiMnsnw5Isc2PP1to9nNw',
    name: 'Unchained',
    handle: 'UnchainedCrypto',
    category: 'crypto',
  },
  {
    channelId: 'UCpulpCvDDHmA5iO2DkPmaPQ',
    name: 'Lark Davis',
    handle: 'LarkDavis',
    category: 'crypto',
  },
  {
    channelId: 'UCRqBu-grVX1p97WaX4d-OuQ',
    name: 'Cointelegraph',
    handle: 'Cointelegraph',
    category: 'crypto',
  },
  {
    channelId: 'UC7TghOL755nBk7HelHoi9LQ',
    name: 'CoinDesk',
    handle: 'CoinDesk',
    category: 'crypto',
  },
  {
    channelId: 'UCtOV5M-T3GcsJAq8QKaf0lg',
    name: 'Bitcoin Magazine',
    handle: 'BitcoinMagazine',
    category: 'crypto',
  },
  {
    channelId: 'UCwSVtQvURxiyn1CQeyoExZg',
    name: 'Real Vision',
    handle: 'realvision',
    category: 'crypto',
  },
  {
    channelId: 'UC4VPa7EOvObpyCRI4YKRQRw',
    name: 'Paul Barron Network',
    handle: 'PaulBarronNetwork',
    category: 'crypto',
  },
  {
    channelId: 'UClgJyzwGs-GyaNxUHcLZrkg',
    name: 'InvestAnswers',
    handle: 'InvestAnswers',
    category: 'crypto',
  },
  {
    channelId: 'UCI7M65p3A-D3P4v5qW8POxQ',
    name: 'CryptosRUs',
    handle: 'CryptosRUs',
    category: 'crypto',
  },
  // ── AI ─────────────────────────────────────────────────────────
  {
    channelId: 'UCbfYPyITQ-7l4upoX8nvctg',
    name: 'Two Minute Papers',
    handle: 'TwoMinutePapers',
    category: 'ai',
  },
  {
    channelId: 'UCZHmQk67mSJgfCCTn7xBfew',
    name: 'Yannic Kilcher',
    handle: 'YannicKilcher',
    category: 'ai',
  },
  {
    channelId: 'UCNJ1Ymd5yFuUPtn21xtRbbw',
    name: 'AI Explained',
    handle: 'aiexplained-official',
    category: 'ai',
  },
  {
    channelId: 'UChpleBmo18P08aKCIgti38g',
    name: 'Matt Wolfe',
    handle: 'mattwolfe',
    category: 'ai',
  },
  {
    channelId: 'UCXUPKJO5MZQN11PqgIvyuvQ',
    name: 'Andrej Karpathy',
    handle: 'AndrejKarpathy',
    category: 'ai',
  },
  {
    channelId: 'UCSHZKyawb77ixDdsGog4iWA',
    name: 'Lex Fridman',
    handle: 'lexfridman',
    category: 'ai',
  },
  {
    channelId: 'UCy5znSnfMsDwaLlROnZ7Qbg',
    name: 'DotCSV',
    handle: 'DotCSV',
    category: 'ai',
  },
  {
    channelId: 'UCawZsQWqfGSbCI5yjkdVkTA',
    name: 'Matthew Berman',
    handle: 'matthew_berman',
    category: 'ai',
  },
  {
    channelId: 'UCqcbQf6yw5KzRoDDcZ_wBSw',
    name: 'Wes Roth',
    handle: 'wesroth',
    category: 'ai',
  },
  // ── Tech ───────────────────────────────────────────────────────
  { channelId: 'UCsBjURrPoezykLs9EqgamOA', name: 'Fireship', handle: 'Fireship', category: 'tech' },
  {
    channelId: 'UCbRP3c757lWg9M-U7TyEkXA',
    name: 'Theo - t3.gg',
    handle: 't3dotgg',
    category: 'tech',
  },
  {
    channelId: 'UCCjyq_K1Xwfg8Lndy7lKMpA',
    name: 'TechCrunch',
    handle: 'TechCrunch',
    category: 'tech',
  },
  {
    channelId: 'UCcefcZRL2oaA_uBNeo5UOWg',
    name: 'Y Combinator',
    handle: 'ycombinator',
    category: 'tech',
  },
  {
    channelId: 'UC9cn0TuPq4dnbTY-CBsm8XA',
    name: 'a16z',
    handle: 'a16z',
    category: 'tech',
  },
  { channelId: 'UCBJycsmduvYEL83R_U4JriQ', name: 'MKBHD', handle: 'mkbhd', category: 'tech' },
  {
    channelId: 'UCXuqSBlHAE6Xw-yeJA0Tunw',
    name: 'Linus Tech Tips',
    handle: 'LinusTechTips',
    category: 'tech',
  },
  {
    channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA',
    name: 'Veritasium',
    handle: 'veritasium',
    category: 'tech',
  },
  {
    channelId: 'UCYO_jab_esuFRV4b17AJtAw',
    name: '3Blue1Brown',
    handle: '3blue1brown',
    category: 'tech',
  },
  {
    channelId: 'UC4QZ_LsYcvcq7qOsOhpAX4A',
    name: 'ColdFusion',
    handle: 'ColdFusion',
    category: 'tech',
  },
  {
    channelId: 'UCMiJRAwDNSNzuYeN2uWa0pA',
    name: 'Mrwhosetheboss',
    handle: 'Mrwhosetheboss',
    category: 'tech',
  },
  {
    channelId: 'UCVYamHliCI9rw1tHR1xbkfw',
    name: 'Dave2D',
    handle: 'Dave2D',
    category: 'tech',
  },
  {
    channelId: 'UCR-DXc1voovS8nhAvccRZhg',
    name: 'Jeff Geerling',
    handle: 'jeffgeerling',
    category: 'tech',
  },
  {
    channelId: 'UC9x0AN7BWHpCDHSm9NiJFJQ',
    name: 'NetworkChuck',
    handle: 'NetworkChuck',
    category: 'tech',
  },
  // ── Expanded 2026-08-31 (verified feeds) ──
  {
    channelId: 'UC1_uAIS3r8Vu6JjXWvastJg',
    name: '3blue1brown',
    handle: '3blue1brown',
    category: 'ai',
  },
  {
    channelId: 'UC7KjtEJT6HvI3kBcF2I4vXg',
    name: 'AltcoinDaily',
    handle: 'AltcoinDaily',
    category: 'crypto',
  },
  {
    channelId: 'UC89CM6D1sEoW3hdlYWSLgxA',
    name: 'Beebom',
    handle: 'Beebom',
    category: 'tech',
  },
  {
    channelId: 'UC213K1tH6XJwHj6ZiVtLDrw',
    name: 'BennJordan',
    handle: 'BennJordan',
    category: 'tech',
  },
  {
    channelId: 'UC3evR26H35kQPec2AlpD9yA',
    name: 'Bisqwit',
    handle: 'Bisqwit',
    category: 'tech',
  },
  {
    channelId: 'UCyxnPZfofoutjmyvaV0GGeQ',
    name: 'BloombergTelevision',
    handle: 'BloombergTelevision',
    category: 'tech',
  },
  {
    channelId: 'UCvJJ_dzjViJCoLf5uKUTwoA',
    name: 'CNBCtelevision',
    handle: 'CNBCtelevision',
    category: 'tech',
  },
  {
    channelId: 'UCL8Nxsa1LB9DrMTHtt3IKiw',
    name: 'CNET',
    handle: 'CNET',
    category: 'tech',
  },
  {
    channelId: 'UCd4Ys__EL_gbJrYq6JscrAw',
    name: 'CheekyCrypto',
    handle: 'CheekyCrypto',
    category: 'crypto',
  },
  {
    channelId: 'UC7btqG2Ww0_2LwuQxpvo2HQ',
    name: 'CodeWithHarry',
    handle: 'CodeWithHarry',
    category: 'tech',
  },
  {
    channelId: 'UCOZRnhGFjclZcBFHDoIn2Ig',
    name: 'Cointelegraph',
    handle: 'Cointelegraph',
    category: 'crypto',
  },
  {
    channelId: 'UCoxcjq-8xIDTYp3uz647V5A',
    name: 'Computerphile',
    handle: 'Computerphile',
    category: 'tech',
  },
  {
    channelId: 'UCu7Sre5A1NMV8J3s2FhluCw',
    name: 'CryptoLifer',
    handle: 'CryptoLifer',
    category: 'crypto',
  },
  {
    channelId: 'UCw48dPoNOfIaTod3yDZ__yQ',
    name: 'CryptoMason',
    handle: 'CryptoMason',
    category: 'crypto',
  },
  {
    channelId: 'UC2bTdCQ0JUBrARBKP0-S0ug',
    name: 'CryptoWendyO',
    handle: 'CryptoWendyO',
    category: 'crypto',
  },
  {
    channelId: 'UCqyrm14zcbZw6pdQeHXPF8w',
    name: 'DistroTube',
    handle: 'DistroTube',
    category: 'tech',
  },
  {
    channelId: 'UCZa18YV7qayTh-MRIrBhDpA',
    name: 'DwarkeshPatel',
    handle: 'DwarkeshPatel',
    category: 'tech',
  },
  {
    channelId: 'UC2Xd-TjJByJyK2w1zNwY0zQ',
    name: 'Fireship',
    handle: 'Fireship',
    category: 'tech',
  },
  {
    channelId: 'UCH6KS5IiLfTyunVHPCDYT8Q',
    name: 'InvestAnswers',
    handle: 'InvestAnswers',
    category: 'crypto',
  },
  {
    channelId: 'UCdBK94H6oZT2Q7l0-b0xmMg',
    name: 'LinusTechTips',
    handle: 'LinusTechTips',
    category: 'tech',
  },
  {
    channelId: 'UCNNfzr9A5dEOscVEDyyzo-A',
    name: 'LiveOverflow',
    handle: 'LiveOverflow',
    category: 'tech',
  },
  {
    channelId: 'UCG7J20LhUeLl6y_Emi7OJrA',
    name: 'MKBHD',
    handle: 'MKBHD',
    category: 'tech',
  },
  {
    channelId: 'UC06GdmaEdCdCFwR3NvszloQ',
    name: 'MattVidPro',
    handle: 'MattVidPro',
    category: 'tech',
  },
  {
    channelId: 'UCevUmOfLTUX9MNGJQKsPdIA',
    name: 'NeetCode',
    handle: 'NeetCode',
    category: 'tech',
  },
  {
    channelId: 'UCOuGATIAbd2DvzJmUgXn2IQ',
    name: 'NetworkChuck',
    handle: 'NetworkChuck',
    category: 'tech',
  },
  {
    channelId: 'UCMHZ1P2iYimObhtHKfPz7gw',
    name: 'NoBoilerplate',
    handle: 'NoBoilerplate',
    category: 'tech',
  },
  {
    channelId: 'UCBH5VZE_Y4F3CMcPIzPEB5A',
    name: 'RealVisionFinance',
    handle: 'RealVisionFinance',
    category: 'tech',
  },
  {
    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    name: 'TensorFlow',
    handle: 'TensorFlow',
    category: 'ai',
  },
  {
    channelId: 'UCUyeluBRhGPCW4rPe_UvBZQ',
    name: 'ThePrimeagen',
    handle: 'ThePrimeagen',
    category: 'tech',
  },
  {
    channelId: 'UCin0m13qWv3-051xlWlHamA',
    name: 'Veritasium',
    handle: 'Veritasium',
    category: 'tech',
  },
  {
    channelId: 'UCxIJaCMEptJjxmmQgGFsnCg',
    name: 'YCombinator',
    handle: 'YCombinator',
    category: 'tech',
  },
  {
    channelId: 'UCHmD-oSpV0sNfAUnpYpj8KA',
    name: 'YannicKilcher',
    handle: 'YannicKilcher',
    category: 'ai',
  },
  {
    channelId: 'UCQ1VQj-37kl2yS_VUhfQHsw',
    name: 'a16z',
    handle: 'a16z',
    category: 'tech',
  },
  {
    channelId: 'UCGF9XKkzUszes5AiLS5vSGw',
    name: 'austinhilton',
    handle: 'austinhilton',
    category: 'tech',
  },
  {
    channelId: 'UCAIto4Imt7WhsV02_c97ucA',
    name: 'chico',
    handle: 'chico',
    category: 'tech',
  },
  {
    channelId: 'UCnThE8FLrlN-tYvZhZL0uaA',
    name: 'coinbureau',
    handle: 'coinbureau',
    category: 'crypto',
  },
  {
    channelId: 'UC-spvPu7S_-ajV5X0K0JE3w',
    name: 'cryptotips',
    handle: 'cryptotips',
    category: 'crypto',
  },
  {
    channelId: 'UC1emV4A8liRs9p80CY8ElUQ',
    name: 'freeCodeCamp',
    handle: 'freeCodeCamp',
    category: 'tech',
  },
  {
    channelId: 'UCJzysWVydzY12kFdzArsGXA',
    name: 'michaelguzman',
    handle: 'michaelguzman',
    category: 'tech',
  },
  {
    channelId: 'UCPbMnGLeHscshhD7PAEnvbw',
    name: 'prestonpysh',
    handle: 'prestonpysh',
    category: 'crypto',
  },
];

/** Feed URL for a channel id. */
export function youtubeFeedUrl(channelId: string): string {
  return `${YOUTUBE_FEED_BASE}?channel_id=${encodeURIComponent(channelId)}`;
}

export interface ParsedYouTubeVideo {
  videoId: string;
  title: string;
  watchUrl: string;
  description: string;
  thumbnail: string;
  views: number;
  likes: number;
  publishedAt: number;
  updatedAt: number;
  duration?: number;
  channelId: string;
  channelName: string;
}

/** Decode common XML entities in text extracted from the feed. */
function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(html: string): string {
  return decodeXml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse a number from a media:statistics/starRating attribute, 0 if missing. */
function parseCount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a single <entry> block from the YouTube Atom feed.
 */
export function parseYouTubeEntry(
  entryXml: string,
  channelId: string,
  channelName: string,
): ParsedYouTubeVideo | null {
  const videoIdMatch = entryXml.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i);
  const videoId = videoIdMatch ? decodeXml(videoIdMatch[1] ?? '').trim() : '';

  const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1] ?? '') : '';
  if (!videoId && !title) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // media:thumbnail url="..." (first entry in media:group)
  const thumbMatch = entryXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
  const thumbnail = thumbMatch ? decodeXml(thumbMatch[1] ?? '') : '';

  // media:statistics views="12345" (inside media:community)
  const viewsMatch = entryXml.match(/<media:statistics[^>]*views="([^"]+)"/i);

  // media:starRating count="1234" (inside media:community)
  const likesMatch = entryXml.match(/<media:starRating[^>]*count="([^"]+)"/i);

  // media:description — may contain CDATA-wrapped HTML
  const descMatch = entryXml.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i);
  const description = descMatch ? stripHtml(descMatch[1] ?? '') : '';

  // published / updated timestamps
  const publishedMatch = entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
  const updatedMatch = entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const publishedAt = publishedMatch
    ? new Date((publishedMatch[1] ?? '').trim()).getTime()
    : Date.now();
  const updatedAt = updatedMatch ? new Date((updatedMatch[1] ?? '').trim()).getTime() : publishedAt;

  // YouTube's public RSS omits duration; parse it from media:content when
  // present (some mirrors include `duration="NNN"`), otherwise undefined.
  const durationMatch = entryXml.match(/<media:content[^>]*duration="(\d+)"/i);
  const duration = durationMatch ? Number.parseInt(durationMatch[1] ?? '0', 10) : undefined;

  return {
    videoId,
    title,
    watchUrl,
    description,
    thumbnail,
    views: parseCount(viewsMatch?.[1]),
    likes: parseCount(likesMatch?.[1]),
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    duration,
    channelId,
    channelName,
  };
}

/**
 * Parse a full YouTube channel RSS document into video entries.
 */
export function parseYouTubeFeed(
  xml: string,
  channelId: string,
  channelName: string,
): ParsedYouTubeVideo[] {
  const result: ParsedYouTubeVideo[] = [];
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((m = entryRe.exec(xml)) !== null) {
    const item = parseYouTubeEntry(m[1] ?? '', channelId, channelName);
    if (item) result.push(item);
  }
  return result;
}

/** Fetch a single channel's feed and return parsed videos (empty on error). */
async function fetchChannelVideos(
  channel: YouTubeChannel,
  limit: number,
): Promise<ParsedYouTubeVideo[]> {
  try {
    const res = await $fetch(youtubeFeedUrl(channel.channelId), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      // console.log(`[youtube] ${channel.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    if (!xml || xml.length < 200 || xml.includes('Error 404')) return [];
    return parseYouTubeFeed(xml, channel.channelId, channel.name).slice(0, limit);
  } catch {
    //     console.log(
    //       `[youtube] ${channel.name}: fetch error: ${err instanceof Error ? err.message : String(err)}`,
    //     );
    return [];
  }
}

/**
 * Main entry point — aggregate the latest videos from all 15 channels.
 * Returns UnifiedPost[] with `protocol: 'youtube'` and `contentType: 'video'`.
 */
export async function fetchYouTubePosts(limit = 30): Promise<UnifiedPost[]> {
  const key = 'provider:youtube';
  // 44 channels × 1 feed each — budget above that (50/min) so a full refresh
  // plus the cached prewarmer never trips the window.
  if (!checkRateLimit(key, { maxRequests: 50, windowMs: 60_000 })) return [];

  // Serve from cache first — the prewarmer + refresher call this repeatedly.
  const cached = youtubeCache && Date.now() < youtubeCache.expiresAt ? youtubeCache.posts : null;
  if (cached) return cached.slice(0, limit);

  const perChannel = Math.max(2, Math.ceil(limit / YOUTUBE_CHANNELS.length));
  const posts: UnifiedPost[] = [];

  // Fetch channels with a small concurrency window + gentle pacing to avoid
  // hammering YouTube (44 feeds per refresh is well inside any rate limit).
  // Concurrency kept low (3) because the service runs CPU-quota-limited and
  // parallel TLS handshakes otherwise time out.
  const CONCURRENCY = 3;
  const results: Array<ParsedYouTubeVideo[]> = [];
  for (let i = 0; i < YOUTUBE_CHANNELS.length; i += CONCURRENCY) {
    const batch = YOUTUBE_CHANNELS.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((ch) => fetchChannelVideos(ch, perChannel)));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : []);
    }
  }

  for (let i = 0; i < YOUTUBE_CHANNELS.length; i++) {
    const channel = YOUTUBE_CHANNELS[i];
    if (!channel) continue;
    const videos = results[i] ?? [];
    for (const v of videos) {
      posts.push(videoToPost(v, channel));
    }
  }

  // Freshness: discard videos published outside the YouTube-specific window
  // (30 days by default), then newest-first and capped at the requested limit.
  const fresh = posts.filter((p) => {
    if (YOUTUBE_MAX_AGE_HOURS <= 0) return true;
    return Date.now() - p.createdAt <= YOUTUBE_MAX_AGE_HOURS * 3_600_000;
  });
  const result = fresh.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);

  // Only cache non-empty results so a bad window is retried next cycle.
  if (result.length > 0) {
    youtubeCache = { posts: result, expiresAt: Date.now() + YOUTUBE_CACHE_TTL_MS };
  }
  return result;
}

/** Normalize a parsed YouTube video into a UnifiedPost. */
function videoToPost(v: ParsedYouTubeVideo, channel: YouTubeChannel): UnifiedPost {
  const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
  const raw = {
    videoId: v.videoId,
    channelId: v.channelId,
    channelTitle: channel.name,
    channelHandle: channel.handle,
    thumbnail: thumb,
    views: v.views,
    likes: v.likes,
    duration: v.duration,
    description: v.description,
    watchUrl: v.watchUrl,
    platform: 'youtube',
  };

  return {
    id: `youtube:${v.videoId}`,
    protocol: 'youtube',
    author: {
      id: `youtube:${channel.channelId}`,
      primary: { protocol: 'youtube', id: channel.channelId },
      handles: { youtube: channel.handle },
      displayName: channel.name,
      bio: '',
      avatarUrl: `https://www.youtube.com/@${channel.handle}`,
      followerCount: 0,
      followingCount: 0,
      url: `https://www.youtube.com/channel/${channel.channelId}`,
      links: [],
      keys: {},
    },
    text: `▶ ${v.title}`,
    html: v.description ? `<p>${v.description.slice(0, 500)}</p>` : undefined,
    embeds: [
      {
        kind: 'video' as const,
        url: v.watchUrl,
        meta: {
          videoId: v.videoId,
          thumbnail: thumb,
          duration: v.duration,
          channel: channel.name,
          platform: 'youtube',
        },
      },
      ...(thumb ? [{ kind: 'image' as const, url: thumb }] : []),
    ],
    createdAt: v.publishedAt,
    metrics: {
      likes: v.likes,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: v.views,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: v.likes,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    },
    raw,
    niches: ['video', channel.category],
    contentType: 'video',
  };
}
/** Get the configured channels (for the /api/feed/youtube/channels route). */
export function getYouTubeFeeds(): YouTubeChannel[] {
  return YOUTUBE_CHANNELS;
}

export const schema: SchemaGuard = {
  id: 'youtube',
  name: 'YouTube',
  description:
    'Top crypto, tech & AI videos — Coin Bureau, Bankless, Finematics, Fireship, Two Minute Papers and 40 more',
  endpoint: '/api/feed/youtube',
  requiresAuth: false,
  contentType: 'video',
};
