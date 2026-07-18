import { buildUnifiedPost, detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_GTS_INSTANCE = 'https://social.degenfeed.xyz';

// ─── Software type detection ──────────────────────────────────────────
// Each instance URL is tagged with its fediverse software so we can
// render the correct badge and adapt API calls if needed.
export type FediverseSoftware = 'mastodon' | 'pleroma' | 'akkoma' | 'misskey' | 'firefish';

export interface FediverseInstance {
  url: string;
  weight: number;
  label: string;
  software: FediverseSoftware;
  /** Topics this instance is known for (for relevance scoring) */
  topics: string[];
}

/**
 * Expanded fediverse instance list (2026-07-18).
 * 45+ Mastodon + Pleroma/Akkoma + Misskey/Firefish instances.
 * All instances speak the Mastodon REST API for trending/timeline/hashtag
 * endpoints (Misskey/Firefish have a Mastodon-compat layer). If the
 * native endpoint fails we degrade gracefully.
 */
export const TRENDING_INSTANCES: FediverseInstance[] = [
  // ── Mastodon: General / Large ─────────────────────────────────
  {
    url: 'https://mastodon.social',
    weight: 0.8,
    label: 'Mastodon',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://mas.to',
    weight: 0.7,
    label: 'MasTo',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://mstdn.social',
    weight: 0.7,
    label: 'Mstdn',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.world',
    weight: 0.8,
    label: 'World',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.online',
    weight: 0.7,
    label: 'Online',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.cloud',
    weight: 0.7,
    label: 'Cloud',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://ohai.social',
    weight: 0.7,
    label: 'Ohai',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://universeodon.com',
    weight: 0.7,
    label: 'Universe',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.scot',
    weight: 0.6,
    label: 'Scot',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mastodon.au',
    weight: 0.6,
    label: 'AU',
    software: 'mastodon',
    topics: ['general'],
  },

  // ── Mastodon: Crypto / Bitcoin / Web3 ──────────────────────────
  {
    url: 'https://noagendasocial.com',
    weight: 0.8,
    label: 'NoAgenda',
    software: 'mastodon',
    topics: ['crypto', 'news'],
  },
  {
    url: 'https://satoshis.space',
    weight: 0.8,
    label: 'Sats',
    software: 'mastodon',
    topics: ['bitcoin', 'crypto'],
  },
  {
    url: 'https://sovereignfinance.social',
    weight: 0.7,
    label: 'Sovereign',
    software: 'mastodon',
    topics: ['bitcoin', 'finance'],
  },

  // ── Mastodon: Tech / FOSS / Engineering ────────────────────────
  {
    url: 'https://hachyderm.io',
    weight: 0.9,
    label: 'Hachyderm',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },
  {
    url: 'https://fosstodon.org',
    weight: 0.9,
    label: 'FOSStodon',
    software: 'mastodon',
    topics: ['foss', 'tech', 'linux'],
  },
  {
    url: 'https://techhub.social',
    weight: 0.9,
    label: 'TechHub',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },
  {
    url: 'https://social.linux.pizza',
    weight: 0.7,
    label: 'LinuxPizza',
    software: 'mastodon',
    topics: ['linux', 'foss'],
  },
  {
    url: 'https://merveilles.town',
    weight: 0.7,
    label: 'Merveilles',
    software: 'mastodon',
    topics: ['tech', 'art'],
  },
  {
    url: 'https://indieweb.social',
    weight: 0.7,
    label: 'IndieWeb',
    software: 'mastodon',
    topics: ['web', 'indie'],
  },
  {
    url: 'https://front-end.social',
    weight: 0.7,
    label: 'FrontEnd',
    software: 'mastodon',
    topics: ['web', 'dev'],
  },
  {
    url: 'https://awscommunity.social',
    weight: 0.6,
    label: 'AWS',
    software: 'mastodon',
    topics: ['cloud', 'dev'],
  },
  {
    url: 'https://phpc.social',
    weight: 0.6,
    label: 'PHPC',
    software: 'mastodon',
    topics: ['dev', 'php'],
  },
  {
    url: 'https://furry.engineer',
    weight: 0.6,
    label: 'FurryEng',
    software: 'mastodon',
    topics: ['tech', 'dev'],
  },

  // ── Mastodon: InfoSec / Privacy / Security ─────────────────────
  {
    url: 'https://infosec.exchange',
    weight: 1.0,
    label: 'InfoSec',
    software: 'mastodon',
    topics: ['security', 'infosec'],
  },
  {
    url: 'https://ioc.exchange',
    weight: 0.8,
    label: 'IOC',
    software: 'mastodon',
    topics: ['threatintel', 'security'],
  },
  {
    url: 'https://defcon.social',
    weight: 0.9,
    label: 'DEFCON',
    software: 'mastodon',
    topics: ['security', 'hacking'],
  },
  {
    url: 'https://infosec.town',
    weight: 0.8,
    label: 'InfoSecTown',
    software: 'mastodon',
    topics: ['security', 'infosec'],
  },
  {
    url: 'https://hackers.town',
    weight: 0.8,
    label: 'HackersTown',
    software: 'mastodon',
    topics: ['tech', 'hacking'],
  },
  {
    url: 'https://layer8.space',
    weight: 0.8,
    label: 'Layer8',
    software: 'mastodon',
    topics: ['security', 'tech'],
  },
  {
    url: 'https://cyberplace.social',
    weight: 0.7,
    label: 'Cyber',
    software: 'mastodon',
    topics: ['security', 'tech'],
  },
  {
    url: 'https://nurse.social',
    weight: 0.5,
    label: 'Nurse',
    software: 'mastodon',
    topics: ['health', 'general'],
  },

  // ── Mastodon: Science / Math / Academic ─────────────────────────
  {
    url: 'https://mathstodon.xyz',
    weight: 0.7,
    label: 'Mathstodon',
    software: 'mastodon',
    topics: ['math', 'science'],
  },
  {
    url: 'https://mastodon.energy',
    weight: 0.7,
    label: 'Energy',
    software: 'mastodon',
    topics: ['energy', 'climate'],
  },
  {
    url: 'https://scholar.social',
    weight: 0.7,
    label: 'Scholar',
    software: 'mastodon',
    topics: ['academic', 'science'],
  },
  {
    url: 'https://scicomm.xyz',
    weight: 0.6,
    label: 'SciComm',
    software: 'mastodon',
    topics: ['science', 'communication'],
  },
  {
    url: 'https://ecoevo.social',
    weight: 0.6,
    label: 'EcoEvo',
    software: 'mastodon',
    topics: ['science', 'ecology'],
  },
  {
    url: 'https://historically.exposed',
    weight: 0.5,
    label: 'History',
    software: 'mastodon',
    topics: ['history', 'research'],
  },

  // ── Mastodon: Art / Creative ───────────────────────────────────
  {
    url: 'https://mastodon.art',
    weight: 0.6,
    label: 'Art',
    software: 'mastodon',
    topics: ['art', 'creative'],
  },
  {
    url: 'https://photog.social',
    weight: 0.5,
    label: 'Photo',
    software: 'mastodon',
    topics: ['photography', 'art'],
  },
  {
    url: 'https://writing.exchange',
    weight: 0.6,
    label: 'Writing',
    software: 'mastodon',
    topics: ['writing', 'publishing'],
  },

  // ── Pleroma / Akkoma (Mastodon-API-compatible) ─────────────────
  {
    url: 'https://gleasonator.com',
    weight: 0.7,
    label: 'Gleason',
    software: 'pleroma',
    topics: ['tech', 'foss'],
  },
  {
    url: 'https://nicecrew.digital',
    weight: 0.6,
    label: 'NiceCrew',
    software: 'pleroma',
    topics: ['general', 'news'],
  },
  {
    url: 'https://bae.st',
    weight: 0.6,
    label: 'Bae',
    software: 'pleroma',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://shitpost.cloud',
    weight: 0.5,
    label: 'Shitpost',
    software: 'pleroma',
    topics: ['memes', 'general'],
  },
  {
    url: 'https://sleepiness.cc',
    weight: 0.5,
    label: 'Sleepy',
    software: 'pleroma',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://akko.bune.city',
    weight: 0.6,
    label: 'BuneCity',
    software: 'akkoma',
    topics: ['tech', 'general'],
  },
  {
    url: 'https://pub.solar',
    weight: 0.6,
    label: 'PubSolar',
    software: 'pleroma',
    topics: ['foss', 'tech'],
  },
  {
    url: 'https://tavern.antipope.info',
    weight: 0.5,
    label: 'Tavern',
    software: 'pleroma',
    topics: ['general', 'writing'],
  },
  // poa.st removed — 404
  // pleroma.site removed — timeout
];

/**
 * Flat list of fediverse instance URLs for fallback / public timeline
 * fetching. Auto-generated from TRENDING_INSTANCES with additional
 * niche instances that don't have trending API but are good content sources.
 */
export const PUBLIC_MASTODON_INSTANCES: string[] = [
  // Auto-extracted from TRENDING_INSTANCES
  ...TRENDING_INSTANCES.map((i) => i.url),
  // Additional instances (no trending API, good for public timeline)
  'https://macaw.social',
  'https://chaos.social',
  'https://mastodon.gamedev.place',
  'https://dice.camp',
  'https://tabletop.social',
  'https://assemblag.es',
  'https://mastodon.design',
  'https://mastodonapp.uk',
  'https://mastodon.xyz',
  'https://mastodon.nl',
  'https://mastodon.ie',
  'https://mastodon.se',
  'https://mastodon.de',
  'https://mastodon.uno',
  'https://mastodon.bida.im',
  'https://ravenation.club',
  'https://wandering.shop',
  'https://circumstances.run',
  'https://me.dm',
  'https://metalhead.club',
  'https://sciences.social',
];

// ─── Fediverse content relevance scoring ─────────────────────────────
// Posts are scored 0-1 for crypto/tech/web3 relevance. Low-scoring
// posts (personal updates, random memes, non-crypto/non-tech) are
// filtered out to keep the feed focused.

export const CRYPTO_KEYWORDS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'altcoin',
  'token',
  'coin',
  'mining',
  'halving',
  'lightning',
  'ordinal',
  'brc-20',
  'rune',
  'stablecoin',
  'usdc',
  'usdt',
  'dai',
  'dex',
  'amm',
  'liquidity',
  'yield',
  'staking',
  'restaking',
  'layer2',
  'rollup',
  'zk',
  'zero knowledge',
  'arbitrum',
  'optimism',
  'base',
  'polygon',
  'solana',
  'avalanche',
  'cosmos',
  'polkadot',
  'cardano',
  'memecoin',
  'pepe',
  'dogecoin',
  'shiba',
  'bonk',
  'wif',
  'jupiter',
  'raydium',
  'orca',
  'phantom',
  'metamask',
  'sec',
  'cftc',
  'regulation',
  'etf',
  'bitcoin etf',
  'ethereum etf',
  'macro',
  'federal reserve',
  'fed',
  'inflation',
  'interest rate',
  'onchain',
  'wallet',
  'smart contract',
  'dapp',
  'blink',
  'solana pay',
  'tip',
  'micropayment',
];

export const TECH_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'llm',
  'gpt',
  'openai',
  'claude',
  'gemini',
  'deepseek',
  'neural',
  'transformer',
  'copilot',
  'diffusion',
  'agent',
  'rag',
  'fine tuning',
  'programming',
  'coding',
  'software',
  'developer',
  'devops',
  'linux',
  'opensource',
  'foss',
  'selfhosted',
  'rust',
  'golang',
  'python',
  'typescript',
  'javascript',
  'privacy',
  'security',
  'infosec',
  'cybersecurity',
  'hacking',
  'penetration testing',
  'vulnerability',
  'cloud',
  'kubernetes',
  'docker',
  'aws',
  'infrastructure',
  'data science',
  'analytics',
  'database',
  'api',
  'startup',
  'saas',
  'product',
  'engineering',
];

export const CRYPTO_HASHTAGS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'altcoin',
  'memecoin',
  'bitcoinetf',
  'ethetf',
  'halving',
  'layer2',
  'rollup',
  'zksync',
  'arbitrum',
  'optimism',
  'base',
  'ordinals',
  'brc20',
  'runes',
  'stablecoin',
  'lightning',
  'lightningnetwork',
  'jupiter',
  'raydium',
  'phantom',
  'cryptotrading',
  'cryptomarkets',
  'token2049',
  'consensus',
];

export const TECH_HASHTAGS = [
  'ai',
  'artificialintelligence',
  'machinelearning',
  'llm',
  'openai',
  'chatgpt',
  'claude',
  'deepseek',
  'gemini',
  'programming',
  'coding',
  'softwareengineering',
  'linux',
  'opensource',
  'foss',
  'selfhosted',
  'rust',
  'golang',
  'python',
  'typescript',
  'javascript',
  'react',
  'vue',
  'nodejs',
  'webdev',
  'privacy',
  'security',
  'infosec',
  'cybersecurity',
  'hacking',
  'infosec',
  'penetrationtesting',
  'cloud',
  'kubernetes',
  'docker',
  'devops',
  'datascience',
  'machinelearning',
  'startup',
  'tech',
  'innovation',
];

export const FEDIVERSE_KEYWORDS = [
  'fediverse',
  'activitypub',
  'mastodon',
  'pleroma',
  'misskey',
  'firefish',
  'lemmy',
  'peertube',
];

/**
 * Score a post's content for crypto/tech/web3 relevance.
 * Returns 0-1 where >= RELEVANCE_THRESHOLD is considered on-topic.
 */
export function scoreFediverseRelevance(text: string, tags: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;

  // Strong signals: exact matches in crypto keywords
  for (const kw of CRYPTO_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.15;
    }
  }

  // Strong signals: tech keywords
  for (const kw of TECH_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.1;
    }
  }

  // Tag matches (very strong signal — user opted into these tags)
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (CRYPTO_HASHTAGS.includes(lowerTag)) score += 0.25;
    else if (TECH_HASHTAGS.includes(lowerTag)) score += 0.2;
    else if (FEDIVERSE_KEYWORDS.includes(lowerTag)) score += 0.15;
  }

  // Fediverse software discussion
  if (lower.includes('fediverse') || lower.includes('activitypub')) score += 0.1;

  // Negative signals: completely off-topic personal content
  if (
    /^\s*(happy|good morning|good night|i (just|love|hate|need|want|feel)|my (dog|cat|kid|mom|dad|wife|husband))/.test(
      lower,
    )
  ) {
    score -= 0.4;
  }

  return Math.max(0, Math.min(1, score));
}

/** Minimum relevance score for a post to appear in the feed. */
export const RELEVANCE_THRESHOLD = 0.25;

interface GtSAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  fields: { name: string; value: string; verified_at: string | null }[];
}

interface GtSCard {
  url: string;
  title: string;
  description: string;
  image: string | null;
}

interface GtSMediaAttachment {
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
}

interface GtSStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: GtSMediaAttachment[];
  tags: { name: string }[];
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  in_reply_to_id: string | null;
  reblog: GtSStatus | null;
  card: GtSCard | null;
  account: GtSAccount;
  favourited?: boolean;
  reblogged?: boolean;
}

function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function accountToIdentity(account: GtSAccount, instanceUrl: string): UnifiedIdentity {
  const hostname = new URL(instanceUrl).hostname;
  const handle = account.acct.includes('@') ? account.acct : `${account.acct}@${hostname}`;
  return {
    id: `mastodon:${account.id}@${hostname}`,
    primary: { protocol: 'mastodon', id: account.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: handle,
    },
    displayName: account.display_name || account.username,
    bio: stripHtml(account.note),
    avatarUrl: account.avatar,
    bannerUrl: account.header !== account.header_static ? account.header : undefined,
    verified: account.fields
      .filter((f) => f.verified_at)
      .map((f) => ({ protocol: 'mastodon' as Protocol, badge: f.name })),
    followerCount: account.followers_count,
    followingCount: account.following_count,
    links: account.fields.map((f) => ({ label: f.name, url: f.value })),
    keys: {},
  };
}

function statusToUnifiedPost(status: GtSStatus, instanceUrl: string): UnifiedPost {
  const identity = accountToIdentity(status.account, instanceUrl);
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;
  const html = original.content || '';
  const text = stripHtml(html);

  const embeds: Embed[] = [];
  for (const media of original.media_attachments) {
    if (media.type === 'image' || media.type === 'gifv')
      embeds.push({ kind: 'image', url: media.url });
    else if (media.type === 'video') embeds.push({ kind: 'video', url: media.url });
  }
  if (original.card) {
    embeds.push({
      kind: 'link',
      url: original.card.url,
      meta: {
        title: original.card.title,
        description: original.card.description,
        image: original.card.image,
      },
    });
  }

  const finalText = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${text}` : text;
  const _niches = detectNiches(`${finalText} ${original.tags.map((t) => t.name).join(' ')}`);
  const nativeId = isBoost ? `boost:${status.id}:${original.id}` : original.id;

  return buildUnifiedPost({
    protocol: 'mastodon',
    nativeId,
    author: identity,
    text: finalText,
    html,
    embeds,
    parentNativeId: original.in_reply_to_id ?? undefined,
    createdAt: new Date(original.created_at).getTime(),
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    viewer: { liked: original.favourited ?? false, reposted: original.reblogged ?? false },
    raw: status,
  });
}

async function fetchHashtagTimeline(
  instanceUrl: string,
  tag: string,
  limit: number,
): Promise<GtSStatus[]> {
  const url = buildUrl(instanceUrl, `/api/v1/timelines/tag/${encodeURIComponent(tag)}`, {
    limit: String(limit),
  });
  return fetchJson<GtSStatus[]>(url, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
}

async function fetchPublicTimeline(instanceUrl: string, limit: number): Promise<GtSStatus[]> {
  const url = buildUrl(instanceUrl, '/api/v1/timelines/public', {
    limit: String(limit),
    local: 'true',
  });
  return fetchJson<GtSStatus[]>(url, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
}

export interface MastodonProviderOptions {
  instanceUrl?: string;
  fallbackInstances?: string[];
}

// ─── Instance health scoring ─────────────────────────────────────────
// Tracks per-instance success/failure over the fetch window.
// Instances that respond quickly and return relevant content get
// higher weight in future fetches.

interface InstanceHealth {
  url: string;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  lastSuccess: number;
  lastFailure: number;
}

const instanceHealth = new Map<string, InstanceHealth>();

function recordInstanceSuccess(url: string, latencyMs: number): void {
  const existing = instanceHealth.get(url) ?? {
    url,
    successes: 0,
    failures: 0,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
  };
  existing.successes++;
  existing.avgLatencyMs =
    existing.successes === 1
      ? latencyMs
      : (existing.avgLatencyMs * (existing.successes - 1) + latencyMs) / existing.successes;
  existing.lastSuccess = Date.now();
  instanceHealth.set(url, existing);
}

function recordInstanceFailure(url: string): void {
  const existing = instanceHealth.get(url) ?? {
    url,
    successes: 0,
    failures: 0,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
  };
  existing.failures++;
  existing.lastFailure = Date.now();
  instanceHealth.set(url, existing);
}

function instanceHealthScore(url: string, defaultWeight: number): number {
  const h = instanceHealth.get(url);
  if (!h || h.successes + h.failures === 0) return defaultWeight;
  const successRate = h.successes / (h.successes + h.failures);
  // Penalize slow instances (>2s avg latency)
  const latencyPenalty = h.avgLatencyMs > 2000 ? 0.7 : h.avgLatencyMs > 1000 ? 0.85 : 1.0;
  return defaultWeight * successRate * latencyPenalty;
}

/** Return aggregated fediverse instance health for stats endpoints. */
export function getFediverseStats(): {
  instancesTracked: number;
  healthyInstances: number;
  totalRequests: number;
} {
  let totalRequests = 0;
  let healthyInstances = 0;
  for (const h of instanceHealth.values()) {
    totalRequests += h.successes + h.failures;
    if (h.successes > h.failures && h.avgLatencyMs < 3000) healthyInstances++;
  }
  return {
    instancesTracked: instanceHealth.size,
    healthyInstances,
    totalRequests,
  };
}

// ─── Misskey/Firefish API adapter ────────────────────────────────────
// Misskey has a limited Mastodon-compatible API. For richer access we
// call the native Misskey API (POST /api/notes/trending).
// Falls back gracefully to the Mastodon API if Misskey API is unavailable.

interface MisskeyNote {
  id: string;
  text: string | null;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  tags: string[];
  mentions: string[];
  files: Array<{ url: string; thumbnailUrl: string | null; type: string }>;
  renoteCount: number;
  repliesCount: number;
  reactionCount: number;
  uri: string | null;
  cw: string | null;
  visibility: 'public' | 'home' | 'followers' | 'specified';
}

interface MisskeyNotesResponse {
  notes: MisskeyNote[];
}

async function fetchMisskeyTrendingNotes(instanceUrl: string, limit: number): Promise<GtSStatus[]> {
  try {
    const res = await fetch(`${instanceUrl}/api/notes/trending`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({ limit: Math.min(limit, 30) }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MisskeyNotesResponse;
    const notes = data.notes ?? [];
    return notes.map(misskeyNoteToGtS);
  } catch {
    return [];
  }
}

async function fetchMisskeyLocalTimeline(instanceUrl: string, limit: number): Promise<GtSStatus[]> {
  try {
    const res = await fetch(`${instanceUrl}/api/notes/local-timeline`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({ limit: Math.min(limit, 30), withFiles: false }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MisskeyNote[];
    return data.map(misskeyNoteToGtS);
  } catch {
    return [];
  }
}

/** Convert a Misskey note to our internal GtSStatus shape. */
function misskeyNoteToGtS(note: MisskeyNote): GtSStatus {
  const tags: { name: string }[] = note.tags.map((t) => ({ name: t }));
  return {
    id: `misskey:${note.id}`,
    uri: note.uri ?? `https://misskey.io/notes/${note.id}`,
    created_at: note.createdAt,
    content: note.text ?? '',
    visibility: note.visibility as GtSStatus['visibility'],
    sensitive: note.cw !== null,
    spoiler_text: note.cw ?? '',
    media_attachments: note.files.map((f) => ({
      type: (f.type.startsWith('image/')
        ? 'image'
        : f.type.startsWith('video/')
          ? 'video'
          : 'unknown') as GtSMediaAttachment['type'],
      url: f.url,
    })),
    tags,
    reblogs_count: note.renoteCount,
    favourites_count: note.reactionCount,
    replies_count: note.repliesCount,
    url: note.uri ?? `https://misskey.io/notes/${note.id}`,
    in_reply_to_id: null,
    reblog: null,
    card: null,
    account: {
      id: note.user.id,
      username: note.user.username,
      acct: note.user.username,
      display_name: note.user.name ?? note.user.username,
      note: '',
      avatar: note.user.avatarUrl ?? '',
      header: '',
      header_static: '',
      followers_count: 0,
      following_count: 0,
      fields: [],
    },
    favourited: false,
    reblogged: false,
  };
}

export class MastodonProvider implements FeedProvider {
  readonly protocol: Protocol = 'mastodon';
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];

  constructor(options: MastodonProviderOptions = {}) {
    this.primaryUrl = options.instanceUrl || DEFAULT_GTS_INSTANCE;
    this.fallbackUrls =
      options.fallbackInstances ?? PUBLIC_MASTODON_INSTANCES.filter((u) => u !== this.primaryUrl);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;
    const endpoints = [this.primaryUrl, ...this.fallbackUrls];

    try {
      const allStatuses: GtSStatus[] = [];

      // 0. Trending API — free public endpoint with high-engagement posts.
      //    Expanded 2026-07-18: 45+ instances across Mastodon, Pleroma, Misskey.
      const trendingStart = performance.now();
      const trendingResults = await Promise.allSettled(
        TRENDING_INSTANCES.map((inst) => {
          const healthAdjWeight = instanceHealthScore(inst.url, inst.weight);
          // Skip instances that have proven unhealthy
          if (healthAdjWeight < 0.2) return Promise.resolve([] as GtSStatus[]);

          const isMisskey = inst.software === 'misskey' || inst.software === 'firefish';
          const fetcher = isMisskey
            ? fetchMisskeyTrendingNotes(inst.url, 10)
            : fetchJson<GtSStatus[]>(
                `${inst.url}/api/v1/trends/statuses?limit=${Math.ceil(10 * inst.weight)}`,
                { headers: { 'user-agent': DEFAULT_USER_AGENT } },
              );

          return withTimeout(fetcher, Math.min(timeoutMs, 4000), `fediverse:trending:${inst.label}`)
            .then((result) => {
              const latency = performance.now() - trendingStart;
              recordInstanceSuccess(inst.url, latency);
              return result;
            })
            .catch(() => {
              recordInstanceFailure(inst.url);
              return [] as GtSStatus[];
            });
        }),
      );
      for (const r of trendingResults) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allStatuses.push(...r.value);
        }
      }

      // 1. Misskey/Firefish instances: also try local timeline for fresh content
      const misskeyInstances = TRENDING_INSTANCES.filter(
        (i) => i.software === 'misskey' || i.software === 'firefish',
      );
      if (misskeyInstances.length > 0) {
        const misskeyTimelines = await Promise.allSettled(
          misskeyInstances.slice(0, 3).map(async (inst) => {
            try {
              return await withTimeout(
                fetchMisskeyLocalTimeline(inst.url, 10),
                4000,
                `fediverse:misskey:${inst.label}`,
              );
            } catch {
              return [] as GtSStatus[];
            }
          }),
        );
        for (const r of misskeyTimelines) {
          if (r.status === 'fulfilled') allStatuses.push(...r.value);
        }
      }

      // 2. Primary public timeline
      const primaryStart = performance.now();
      try {
        const primaryPublic = await withTimeout(
          fetchPublicTimeline(this.primaryUrl, Math.ceil(limit / 2)),
          timeoutMs,
          `fediverse:public:${this.primaryUrl}`,
        );
        recordInstanceSuccess(this.primaryUrl, performance.now() - primaryStart);
        allStatuses.push(...primaryPublic);
      } catch {
        recordInstanceFailure(this.primaryUrl);
      }

      // 3. Hashtag searches across top instances for crypto+tech topics
      //    Expanded from 5 tags to 15 for broader coverage.
      const allHashes = [...CRYPTO_HASHTAGS.slice(0, 8), ...TECH_HASHTAGS.slice(0, 7)];
      const hashtagTargets: Array<{ instanceUrl: string; tag: string }> = [];
      const topEndpoints = endpoints.slice(0, 5);
      for (const instanceUrl of topEndpoints) {
        for (const tag of allHashes) {
          hashtagTargets.push({ instanceUrl, tag });
        }
      }
      const tagResults = await withConcurrencyLimit(
        hashtagTargets,
        6,
        async ({ instanceUrl, tag }) => {
          try {
            return await withTimeout(
              fetchHashtagTimeline(instanceUrl, tag, 5),
              Math.min(timeoutMs, 3000),
              `fediverse:${new URL(instanceUrl).hostname}#${tag}`,
            );
          } catch {
            return [];
          }
        },
      );
      for (const r of tagResults) allStatuses.push(...r);

      // 4. Public timelines from top instances for variety
      const generalResults = await withConcurrencyLimit(
        endpoints.slice(0, 5),
        3,
        async (instanceUrl) => {
          try {
            const start = performance.now();
            const posts = await withTimeout(
              fetchPublicTimeline(instanceUrl, 8),
              Math.min(timeoutMs, 3000),
              `fediverse:${instanceUrl}`,
            );
            recordInstanceSuccess(instanceUrl, performance.now() - start);
            return posts;
          } catch {
            recordInstanceFailure(instanceUrl);
            return [] as GtSStatus[];
          }
        },
      );
      for (const r of generalResults) allStatuses.push(...r);

      if (allStatuses.length === 0) {
        return { posts: [], notice: 'Fediverse feed unavailable — all instances failed' };
      }

      // 5. Deduplicate by native ID
      const seen = new Set<string>();
      const unique = allStatuses.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // 6. Content relevance filtering — keep only crypto/tech/web3 posts
      const relevanceFiltered = unique.filter((s) => {
        const text = s.content ?? '';
        const tags = (s.tags ?? []).map((t) => t.name);
        const relevance = scoreFediverseRelevance(stripHtml(text), tags);
        // Stamp relevance score on raw metadata for downstream ranking
        (s as unknown as Record<string, unknown>)._fediverseRelevance = relevance;
        return relevance >= RELEVANCE_THRESHOLD;
      });

      // 7. Detect fediverse software for each instance for proper badge
      const instanceToSoftware = new Map<string, FediverseSoftware>();
      for (const inst of TRENDING_INSTANCES) {
        try {
          instanceToSoftware.set(new URL(inst.url).hostname, inst.software);
        } catch {
          /* ignore */
        }
      }

      // Pick a sensible instance URL for each status
      const instanceMap = new Map<string, string>();
      for (const u of endpoints) {
        try {
          instanceMap.set(new URL(u).hostname, u);
        } catch {
          /* ignore */
        }
      }
      const pickInstance = (acct: string): string => {
        if (acct.includes('@')) {
          const host = acct.split('@')[1];
          if (host && instanceMap.has(host)) return instanceMap.get(host) ?? this.primaryUrl;
        }
        return endpoints[0] ?? this.primaryUrl;
      };

      const posts = relevanceFiltered.map((s) => {
        const post = statusToUnifiedPost(s, pickInstance(s.account.acct));
        // Stamp fediverse software type on raw for badge rendering
        const hostname = pickInstance(s.account.acct);
        const software = instanceToSoftware.get(new URL(hostname).hostname) ?? 'mastodon';
        (post.raw as Record<string, unknown>)._fediverseSoftware = software;
        return post;
      });

      return {
        posts,
        notice: `Fediverse: ${posts.length} posts from ${instanceHealth.size} instances (${relevanceFiltered.length} after relevance filter)`,
      };
    } catch (err) {
      return {
        posts: [],
        notice: err instanceof Error ? err.message : 'Fediverse feed unavailable',
      };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(buildUrl(this.primaryUrl, '/api/v1/instance')),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'mastodon:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
