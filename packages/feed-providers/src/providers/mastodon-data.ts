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
  // ── Mastodon: General / Large (EXPANDED 2026-08-06) ─────────
  {
    url: 'https://c.im',
    weight: 0.7,
    label: 'C.im',
    software: 'mastodon',
    topics: ['general', 'tech'],
  },
  {
    url: 'https://toot.community',
    weight: 0.6,
    label: 'TootCommunity',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://mstdn.party',
    weight: 0.6,
    label: 'MstdnParty',
    software: 'mastodon',
    topics: ['general'],
  },
  {
    url: 'https://tech.lgbt',
    weight: 0.7,
    label: 'TechLGBT',
    software: 'mastodon',
    topics: ['tech', 'general'],
  },
  {
    url: 'https://tapbots.social',
    weight: 0.6,
    label: 'Tapbots',
    software: 'mastodon',
    topics: ['general', 'tech'],
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
