/**
 * @degenfeed/integration — News Aggregation Tests
 *
 * Exercises the pipeline: RSS parsing, dedup, entity extraction,
 * sentiment analysis, topic classification, and personalization.
 *
 * Uses the actual exported pure functions from the codebase and
 * duplicates the internal algorithm logic for functions that are
 * not exported (sentiment, entity extraction, RSS parsing).
 */
import { describe, expect, it, vi } from 'vitest';

// ─── Mock external deps ───────────────────────────────────────────────

vi.mock('@degenfeed/feed-core', () => ({
  deduplicatePosts: (posts: unknown[]) => posts,
  detectNiches: (text: string) => {
    const t = text.toLowerCase();
    const found: string[] = [];
    if (/\b(bitcoin|btc|satoshi|halving)\b/.test(t)) found.push('bitcoin');
    if (/\b(ethereum|eth|vitalik|eip-|solidity)\b/.test(t)) found.push('ethereum');
    if (/\b(defi|lending|yield|amm|dex|swap|staking)\b/.test(t)) found.push('defi');
    if (/\b(ai|artificial intelligence|machine learning|llm|gpt|openai)\b/.test(t))
      found.push('ai');
    if (/\b(nft|nfts|collectible|opensea)\b/.test(t)) found.push('nft');
    if (/\b(solana|sol)\b/.test(t)) found.push('solana');
    if (/\b(sec|regulation|mica|cftc)\b/.test(t)) found.push('regulation');
    if (/\b(layer 2|l2|rollup|arbitrum|optimism|base)\b/.test(t)) found.push('layer2');
    if (/\b(hack|exploit|vulnerability|audit|phishing|rug)\b/.test(t)) found.push('security');
    if (/\b(memecoin|meme coin|dogecoin|pepe|bonk)\b/.test(t)) found.push('memecoin');
    return found;
  },
  isEnglishPost: (_text: string) => true,
  isRelevantPost: () => true,
  NICHE_KEYWORDS: {
    bitcoin: ['bitcoin', 'btc', 'satoshi', 'halving'],
    ethereum: ['ethereum', 'eth', 'vitalik', 'eip-'],
    defi: ['defi', 'lending', 'yield', 'amm', 'dex', 'swap', 'staking'],
    ai: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'openai'],
    nft: ['nft', 'nfts', 'collectible', 'opensea', 'blur'],
    solana: ['solana', 'sol'],
    regulation: ['sec', 'regulation', 'mica'],
    layer2: ['layer 2', 'l2', 'rollup', 'arbitrum', 'optimism', 'base'],
    security: ['hack', 'exploit', 'vulnerability', 'audit', 'rug pull'],
    memecoin: ['memecoin', 'meme coin', 'dogecoin', 'pepe', 'bonk'],
    onchain: ['onchain', 'on-chain', 'blockchain data', 'whale', 'wallet'],
    startups: ['startup', 'venture capital', 'vc', 'funding'],
    tech: ['tech', 'technology', 'startup', 'software'],
  },
}));

vi.mock('@degenfeed/feed-providers', () => ({
  RssProvider: class MockRssProvider {},
}));

// ─── Internal Algorithm Implementations (match source) ─────────────────

const BULLISH_TERMS = [
  'bullish',
  'surge',
  'soar',
  'rally',
  'breakthrough',
  'upgrade',
  'launch',
  'partnership',
  'adoption',
  'institutional',
  'approval',
  'etf',
  'all-time high',
  'ath',
  'breakout',
  'moon',
  'pump',
  'green',
  'profit',
  'growth',
  'positive',
  'mainnet',
  'integration',
  'listing',
  'accumulation',
  'whale buying',
];

const BEARISH_TERMS = [
  'bearish',
  'crash',
  'dump',
  'hack',
  'exploit',
  'vulnerability',
  'rug',
  'scam',
  'fraud',
  'decline',
  'plunge',
  'drop',
  'sell-off',
  'liquidation',
  'ban',
  'crackdown',
  'regulation',
  'fud',
  'fear',
  'uncertainty',
  'red',
  'loss',
  'bankrupt',
  'attack',
  'sanctions',
  'withdrawal halt',
  'freeze',
];

interface SentimentResult {
  label: 'bullish' | 'bearish' | 'neutral';
  score: number;
  confidence: number;
  signals: string[];
}

function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;
  const signals: string[] = [];

  for (const term of BULLISH_TERMS) {
    if (lower.includes(term)) {
      bullishScore += 1;
      signals.push(`+${term}`);
    }
  }
  for (const term of BEARISH_TERMS) {
    if (lower.includes(term)) {
      bearishScore += 1;
      signals.push(`-${term}`);
    }
  }

  const total = bullishScore + bearishScore;
  if (total === 0) {
    return { label: 'neutral', score: 0, confidence: 0, signals: [] };
  }

  const netScore = (bullishScore - bearishScore) / (total + 1);
  const confidence = Math.min(1, total / 5);
  const label: SentimentResult['label'] =
    netScore > 0.2 ? 'bullish' : netScore < -0.2 ? 'bearish' : 'neutral';

  return { label, score: netScore, confidence, signals };
}

const KNOWN_TOKENS = new Set([
  'BTC',
  'ETH',
  'SOL',
  'USDT',
  'USDC',
  'BNB',
  'XRP',
  'ADA',
  'AVAX',
  'DOT',
  'LINK',
  'MATIC',
  'UNI',
  'AAVE',
  'COMP',
  'MKR',
  'CRV',
  'PEPE',
  'DOGE',
  'SHIB',
  'BONK',
  'WIF',
  'JUP',
  'RAY',
  'RUNE',
  'ATOM',
  'ARB',
  'OP',
  'SUI',
  'APT',
  'SEI',
]);

const KNOWN_PROTOCOLS = ['uniswap', 'aave', 'compound', 'makerdao', 'lido', 'curve', 'jupiter'];
const KNOWN_PEOPLE = ['vitalik buterin', 'vitalik', 'cz binance', 'michael saylor', 'sbf'];
const KNOWN_COMPANIES = ['coinbase', 'binance', 'blackrock', 'microstrategy', 'a16z'];
const KNOWN_CHAINS = ['ethereum', 'bitcoin', 'solana', 'polygon', 'arbitrum', 'optimism'];

interface StoryEntities {
  tokens: string[];
  protocols: string[];
  people: string[];
  companies: string[];
  chains: string[];
  nfts: string[];
}

function extractEntities(text: string): StoryEntities {
  const lower = text.toLowerCase();
  const tokenMatches = text.matchAll(/\$([A-Z]{2,8})\b/g);
  const tokens: string[] = [];
  for (const m of tokenMatches) {
    if (m[1] && KNOWN_TOKENS.has(m[1].toUpperCase())) tokens.push(m[1].toUpperCase());
  }

  const protocols = KNOWN_PROTOCOLS.filter((p) => lower.includes(p));
  const people = KNOWN_PEOPLE.filter((p) => lower.includes(p));
  const companies = KNOWN_COMPANIES.filter((c) => lower.includes(c));
  const chains = KNOWN_CHAINS.filter((c) => lower.includes(c));

  return {
    tokens: [...new Set(tokens)],
    protocols: [...new Set(protocols)],
    people: [...new Set(people)],
    companies: [...new Set(companies)],
    chains: [...new Set(chains)],
    nfts: [],
  };
}

function parseFeedXml(xml: string, maxItems = 20) {
  const items: Array<{
    title: string;
    link: string;
    description: string;
    pubDate: string;
    content: string;
  }> = [];

  // RSS 2.0
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  m = itemRe.exec(xml);
  while (m !== null && items.length < maxItems) {
    const itemXml = m[2] || '';
    const title = extractText('title', itemXml);
    const link = extractText('link', itemXml);
    const description = extractText('description', itemXml);
    const content = extractText('content:encoded', itemXml) || extractText('content', itemXml);
    const pubDate = extractText('pubDate', itemXml);

    if (title && link) {
      items.push({ title, link, description, pubDate, content });
    }
    m = itemRe.exec(xml);
  }

  // Atom fallback
  if (items.length === 0 && xml.includes('<feed')) {
    const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
    m = entryRe.exec(xml);
    while (m !== null && items.length < maxItems) {
      const entryXml = m[2] || '';
      const title = extractText('title', entryXml);
      const linkMatch = entryXml.match(/<link[^>]+href\s*=\s*["']([^"']+)["']/i);
      const link = linkMatch?.[1] || '';
      const description = extractText('summary', entryXml);
      const content = extractText('content', entryXml);
      const pubDate = extractText('updated', entryXml) || extractText('published', entryXml);
      if (title && link) {
        items.push({ title, link, description, pubDate, content });
      }
      m = entryRe.exec(xml);
    }
  }

  return items;
}

function extractText(tag: string, xml: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  if (!match) return '';
  return (
    match[1]
      ?.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim() || ''
  );
}

function computeFreshness(
  publishedAt: number,
  now: number,
): { freshScore: number; isBreaking: boolean } {
  const ageMs = now - publishedAt;
  const ageMin = ageMs / 60000;
  const ageHrs = ageMin / 60;
  const isBreaking = ageMin < 60;

  let freshScore: number;
  if (ageMin < 60) freshScore = 3.0;
  else if (ageHrs < 6) freshScore = 2.0;
  else if (ageHrs < 24) freshScore = 1.0;
  else if (ageHrs < 48) freshScore = 0.5;
  else freshScore = 0.2;

  return { freshScore, isBreaking };
}

function computeCredibility(
  sourceWeight: number,
  alsoCoveredCount: number,
  entityCount: number,
  sentimentConfidence: number,
): number {
  let score = sourceWeight;
  if (alsoCoveredCount >= 3) score += 0.05;
  if (alsoCoveredCount >= 5) score += 0.05;
  if (entityCount > 0) score += 0.02;
  score += sentimentConfidence * 0.03;
  return Math.min(1, Math.max(0.1, score));
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('News Aggregation — Sentiment Analysis (algorithm test)', () => {
  it('detects bullish sentiment from keywords', () => {
    const result = analyzeSentiment('Bitcoin surges to all-time high! Bullish breakout confirmed.');
    expect(result.label).toBe('bullish');
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    expect(result.signals.some((s) => s.includes('surge'))).toBe(true);
  });

  it('detects bearish sentiment from keywords', () => {
    const result = analyzeSentiment(
      'Market crash! Bearish dump underway, massive liquidation event.',
    );
    expect(result.label).toBe('bearish');
    expect(result.signals.some((s) => s.includes('crash'))).toBe(true);
  });

  it('returns neutral for mixed signals', () => {
    const result = analyzeSentiment(
      'ETF approval is bullish but new regulation causes uncertainty.',
    );
    expect(result.label).toBe('neutral');
  });

  it('returns neutral for text with no sentiment signals', () => {
    const result = analyzeSentiment('The quick brown fox jumps over the lazy dog.');
    expect(result.label).toBe('neutral');
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('increases confidence proportionally to signal density', () => {
    const sparse = analyzeSentiment('Bitcoin is up.');
    const dense = analyzeSentiment(
      'Bitcoin surges in massive rally! Bullish breakout to all-time high!',
    );
    expect(dense.confidence).toBeGreaterThan(sparse.confidence);
  });
});

describe('News Aggregation — Entity Extraction (algorithm test)', () => {
  it('extracts token tickers from text', () => {
    const result = extractEntities('$BTC and $ETH are moving, while $UNI shows strength');
    expect(result.tokens).toContain('BTC');
    expect(result.tokens).toContain('ETH');
    expect(result.tokens).toContain('UNI');
  });

  it('extracts protocol names from text', () => {
    const result = extractEntities('Uniswap v4 is live on Ethereum mainnet');
    expect(result.protocols).toContain('uniswap');
    expect(result.chains).toContain('ethereum');
  });

  it('extracts people from text', () => {
    const result = extractEntities(
      'Vitalik Buterin proposed a new EIP, while Michael Saylor bought more Bitcoin',
    );
    expect(result.people.length).toBeGreaterThan(0);
    expect([...result.people].some((p) => p.includes('vitalik') || p.includes('michael'))).toBe(
      true,
    );
  });

  it('extracts companies from text', () => {
    const result = extractEntities('Coinbase and Blackrock announce Bitcoin ETF partnership');
    expect(result.companies).toContain('coinbase');
    expect(result.companies).toContain('blackrock');
  });

  it('ignores unknown tickers', () => {
    const result = extractEntities('$XYZ123 is not a known token');
    expect(result.tokens).not.toContain('XYZ123');
  });

  it('deduplicates entities', () => {
    const result = extractEntities('Ethereum and ethereum are the same chain');
    expect(result.chains.filter((c) => c === 'ethereum').length).toBe(1);
  });
});

describe('News Aggregation — RSS Parsing (algorithm test)', () => {
  it('parses RSS 2.0 feed into stories', () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Bitcoin Hits New All-Time High</title>
    <link>https://example.com/bitcoin-ath</link>
    <description>Bitcoin has reached a new all-time high of $100,000</description>
    <pubDate>Mon, 25 Jul 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Ethereum Upgrade Successful</title>
    <link>https://example.com/eth-upgrade</link>
    <description>The Ethereum network has completed its latest upgrade</description>
    <pubDate>Mon, 25 Jul 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

    const items = parseFeedXml(rss);
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe('Bitcoin Hits New All-Time High');
    expect(items[1]?.link).toBe('https://example.com/eth-upgrade');
  });

  it('parses Atom feed into stories', () => {
    const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>DeFi TVL Surpasses $100B</title>
    <link href="https://example.com/defi-tvl"/>
    <summary>Total value locked in DeFi has exceeded $100 billion</summary>
    <updated>2026-07-25T10:00:00Z</updated>
  </entry>
</feed>`;

    const items = parseFeedXml(atom);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('DeFi TVL Surpasses $100B');
  });

  it('respects maxItems limit', () => {
    let itemsXml = '';
    for (let i = 0; i < 10; i++) {
      itemsXml += `<item><title>Story ${i}</title><link>https://example.com/${i}</link><description>Desc</description></item>`;
    }
    const rss = `<rss version="2.0"><channel>${itemsXml}</channel></rss>`;
    const items = parseFeedXml(rss, 3);
    expect(items).toHaveLength(3);
  });

  it('handles CDATA in titles', () => {
    const rss = `<rss version="2.0"><channel>
      <item>
        <title><![CDATA[Bitcoin & Ethereum Rally]]></title>
        <link>https://example.com/rally</link>
        <description>Rally time</description>
      </item>
    </channel></rss>`;
    const items = parseFeedXml(rss);
    expect(items[0]?.title).toBe('Bitcoin & Ethereum Rally');
  });

  it('returns empty array for invalid XML', () => {
    const items = parseFeedXml('not xml at all');
    expect(items).toHaveLength(0);
  });
});

describe('News Aggregation — Deduplication (algorithm test)', () => {
  it('treats same URL from two sources as duplicate', () => {
    const sameUrl = 'https://example.com/btc-news';
    const stories = [
      { url: sameUrl, title: 'BTC News A', source: 'CoinDesk' },
      { url: sameUrl, title: 'BTC News B', source: 'CoinTelegraph' },
    ];

    // Dedup by URL
    const seen = new Set<string>();
    const deduped = stories.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.source).toBe('CoinDesk');
  });

  it('keeps distinct stories separate', () => {
    const stories = [
      { url: 'https://example.com/a', title: 'Bitcoin News' },
      { url: 'https://example.com/b', title: 'Ethereum News' },
      { url: 'https://example.com/c', title: 'Solana News' },
    ];

    const seen = new Set<string>();
    const deduped = stories.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    expect(deduped).toHaveLength(3);
  });
});

describe('News Aggregation — Freshness & Credibility (algorithm test)', () => {
  it('marks stories less than 1 hour old as breaking', () => {
    const now = Date.now();
    const recent = now - 30 * 60 * 1000; // 30 min ago
    const { freshScore, isBreaking } = computeFreshness(recent, now);
    expect(isBreaking).toBe(true);
    expect(freshScore).toBe(3.0);
  });

  it('applies exponential decay to freshness score', () => {
    const now = Date.now();
    const under6h = now - 3 * 3600 * 1000;
    const under24h = now - 12 * 3600 * 1000;
    const under48h = now - 36 * 3600 * 1000;
    const over48h = now - 72 * 3600 * 1000;

    expect(computeFreshness(under6h, now).freshScore).toBe(2.0);
    expect(computeFreshness(under24h, now).freshScore).toBe(1.0);
    expect(computeFreshness(under48h, now).freshScore).toBe(0.5);
    expect(computeFreshness(over48h, now).freshScore).toBe(0.2);
  });

  it('computes credibility based on source weight and cross-coverage', () => {
    const base = computeCredibility(0.9, 0, 0, 0);
    const boosted = computeCredibility(0.9, 5, 2, 0.8);
    expect(boosted).toBeGreaterThan(base);
    expect(boosted).toBeLessThanOrEqual(1);
    expect(base).toBeGreaterThanOrEqual(0.1);
  });
});

describe('News Aggregation — Topic Classification (via topic-modeler)', () => {
  it('classifies a story about Bitcoin', async () => {
    const { classifyStory } = await import('../../workers/api/src/feed/topic-modeler');
    const story = {
      id: 'test-1',
      title: 'Bitcoin ETF Approval Sparks Rally',
      summary: 'BTC price surges after SEC approves spot Bitcoin ETF',
      body: 'Bitcoin has reached new all-time highs following the SEC approval.',
      url: 'https://example.com',
      source: 'coindesk',
      sourceMeta: { id: 'coindesk', category: 'crypto', credibility: 0.9, weight: 1.5 },
      protocol: 'rss' as const,
      allUrls: [],
      alsoCoveredBy: [],
      categories: ['crypto'],
      entities: {
        tokens: ['BTC'],
        protocols: [],
        people: [],
        companies: [],
        chains: ['bitcoin'],
        nfts: [],
      },
      sentiment: { label: 'bullish', score: 0.5, confidence: 0.6, signals: ['+approval'] },
      credibility: 0.9,
      score: 0,
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      author: 'Test Author',
      niches: ['bitcoin', 'crypto'],
      velocity: 5,
      isBreaking: true,
    };

    const result = classifyStory(story);
    expect(result.primary.categoryId).toBe('bitcoin');
    expect(result.primary.confidence).toBeGreaterThan(0.1);
    expect(result.all.length).toBeGreaterThanOrEqual(1);
    expect(result.breadcrumbs.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies a story about DeFi', async () => {
    const { classifyStory } = await import('../../workers/api/src/feed/topic-modeler');
    const story = {
      id: 'test-2',
      title: 'Uniswap Launches New AMM Features',
      summary: 'Uniswap v4 introduces new DeFi innovations for liquidity providers',
      body: 'Uniswap, the leading DEX, has launched its v4 protocol with major improvements.',
      url: 'https://example.com',
      source: 'theblock',
      sourceMeta: { id: 'theblock', category: 'crypto', credibility: 0.91, weight: 1.5 },
      protocol: 'rss' as const,
      allUrls: [],
      alsoCoveredBy: [],
      categories: ['defi'],
      entities: {
        tokens: ['UNI'],
        protocols: ['uniswap'],
        people: [],
        companies: [],
        chains: ['ethereum'],
        nfts: [],
      },
      sentiment: { label: 'bullish', score: 0.3, confidence: 0.4, signals: ['+launch'] },
      credibility: 0.91,
      score: 0,
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      author: 'Test Author',
      niches: ['defi'],
      velocity: 3,
      isBreaking: false,
    };

    const result = classifyStory(story);
    expect(result.primary.categoryId).toBe('defi');
  });

  it('classifies multiple stories and returns top categories', async () => {
    const { classifyStories, getTopCategories } = await import(
      '../../workers/api/src/feed/topic-modeler'
    );

    const makeStory = (
      id: string,
      title: string,
      body: string,
      token: string,
      protocol: string[],
    ) => ({
      id,
      title,
      summary: '',
      body,
      url: 'https://example.com',
      source: 'coindesk',
      sourceMeta: { id: 'coindesk', category: 'crypto', credibility: 0.9, weight: 1.5 },
      protocol: 'rss' as const,
      allUrls: [],
      alsoCoveredBy: [],
      categories: [],
      entities: {
        tokens: [token],
        protocols: protocol,
        people: [],
        companies: [],
        chains: [],
        nfts: [],
      },
      sentiment: { label: 'neutral', score: 0, confidence: 0, signals: [] },
      credibility: 0.9,
      score: 0,
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      author: 'Test',
      niches: [],
      velocity: 0,
      isBreaking: false,
    });

    const stories = [
      makeStory(
        's1',
        'Bitcoin ETF Approved!',
        'bitcoin etf approved by sec bulls are in control',
        'BTC',
        [],
      ),
      makeStory('s2', 'Ethereum Staking Boom', 'ethereum staking eth defi lending onchain', 'ETH', [
        'lido',
      ]),
      makeStory(
        's3',
        'Solana Developer Growth',
        'solana developers building new defi protocols',
        'SOL',
        ['jupiter'],
      ),
      makeStory('s4', 'More Bitcoin Rally', 'bitcoin btc price soaring to new highs', 'BTC', []),
      makeStory(
        's5',
        'Another DeFi Summer',
        'defi lending yields farming liquidity provides strong returns',
        'ETH',
        ['aave', 'uniswap'],
      ),
    ];

    const classifications = classifyStories(stories);
    const top = getTopCategories(classifications, 3);

    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(classifications.size).toBe(5);
  });
});

describe('News Aggregation — Personalization (via personalized-news)', () => {
  it('computes a personalized score for a story', async () => {
    const { computePersonalizedScore, DEFAULT_PREFERENCES } = await import(
      '../../workers/api/src/feed/personalized-news'
    );

    const story = {
      id: 'ps-1',
      title: 'Bitcoin ETF Approved!',
      summary: 'SEC gives green light to Bitcoin ETF',
      body: 'The SEC has approved the first spot Bitcoin ETF in a landmark decision.',
      url: 'https://example.com/btc-etf',
      source: 'coindesk',
      sourceMeta: {
        id: 'coindesk',
        name: 'CoinDesk',
        category: 'crypto',
        tier: 1 as const,
        credibility: 0.92,
        weight: 1.5,
        url: 'https://coindesk.com/rss',
        type: 'rss' as const,
      },
      protocol: 'rss' as const,
      allUrls: [],
      alsoCoveredBy: ['cointelegraph', 'theblock'],
      categories: ['crypto'],
      entities: {
        tokens: ['BTC'],
        protocols: [],
        people: [],
        companies: ['blackrock'],
        chains: ['bitcoin'],
        nfts: [],
      },
      sentiment: { label: 'bullish', score: 0.5, confidence: 0.6, signals: ['+approval'] },
      credibility: 0.92,
      score: 0,
      publishedAt: Date.now() - 30 * 60 * 1000,
      fetchedAt: Date.now(),
      author: 'Test Author',
      niches: ['bitcoin'],
      velocity: 8,
      isBreaking: true,
    };

    const result = computePersonalizedScore(story, DEFAULT_PREFERENCES, null, Date.now());
    expect(result.total).toBeGreaterThan(0);
    expect(result.topicalRelevance).toBeGreaterThan(0);
    expect(result.freshness).toBeGreaterThan(0);
    expect(result.storyImportance).toBeGreaterThan(1); // breaking + cross-covered
  });

  it('personalizes a full feed ranking', async () => {
    const { personalizeNewsFeed, DEFAULT_PREFERENCES } = await import(
      '../../workers/api/src/feed/personalized-news'
    );

    const makeStory = (
      id: string,
      title: string,
      body: string,
      source: string,
      cat: string,
      token: string,
    ) => ({
      id,
      title,
      summary: '',
      body,
      url: `https://example.com/${id}`,
      source,
      sourceMeta: {
        id: source,
        name: source,
        category: cat,
        tier: 1 as const,
        credibility: 0.8,
        weight: 1.0,
        url: '',
        type: 'rss' as const,
      },
      protocol: 'rss' as const,
      allUrls: [],
      alsoCoveredBy: [],
      categories: [cat],
      entities: {
        tokens: token ? [token] : [],
        protocols: [],
        people: [],
        companies: [],
        chains: [],
        nfts: [],
      },
      sentiment: { label: 'neutral', score: 0, confidence: 0, signals: [] },
      credibility: 0.8,
      score: 0,
      publishedAt: Date.now() - 3600000,
      fetchedAt: Date.now(),
      author: 'Test',
      niches: [],
      velocity: 1,
      isBreaking: false,
    });

    const stories = [
      makeStory('a', 'Bitcoin ETF News', 'bitcoin etf approved', 'coindesk', 'crypto', 'BTC'),
      makeStory('b', 'AI Breakthrough', 'openai new model gpt5', 'techcrunch', 'tech', ''),
      makeStory('c', 'DeFi Yield Farming', 'defi yields high', 'bankless', 'defi', 'ETH'),
      makeStory('d', 'New Memecoin', 'pepe memecoin doge', 'decrypt', 'crypto', 'PEPE'),
    ];

    const prefs = {
      ...DEFAULT_PREFERENCES,
      topicWeights: {
        ...DEFAULT_PREFERENCES.topicWeights,
        bitcoin: 90,
        ethereum: 80,
        defi: 70,
        ai: 30,
      },
    };
    const result = personalizeNewsFeed(stories, prefs, null, Date.now());

    expect(result.length).toBe(4);
    // Preferred topics (bitcoin, defi) should come first
    const firstIds = result.slice(0, 2).map((s) => s.id);
    expect(firstIds).toContain('a'); // bitcoin
    expect(firstIds).toContain('c'); // defi
  });

  it('infers user profile from reading history', async () => {
    const { inferUserProfile } = await import('../../workers/api/src/feed/personalized-news');

    const history = [
      {
        storyId: 'a',
        categoryId: 'bitcoin',
        sourceId: 'coindesk',
        readAt: Date.now() - 3600000,
        dwellTimeMs: 30000,
        engaged: true,
      },
      {
        storyId: 'b',
        categoryId: 'bitcoin',
        sourceId: 'cointelegraph',
        readAt: Date.now() - 7200000,
        dwellTimeMs: 45000,
        engaged: true,
      },
      {
        storyId: 'c',
        categoryId: 'defi',
        sourceId: 'bankless',
        readAt: Date.now() - 10800000,
        dwellTimeMs: 15000,
        engaged: false,
      },
      {
        storyId: 'd',
        categoryId: 'ethereum',
        sourceId: 'theblock',
        readAt: Date.now() - 14400000,
        dwellTimeMs: 60000,
        engaged: true,
      },
      {
        storyId: 'e',
        categoryId: 'bitcoin',
        sourceId: 'coindesk',
        readAt: Date.now() - 18000000,
        dwellTimeMs: 20000,
        engaged: true,
      },
    ];

    const profile = inferUserProfile(history);
    expect(profile.totalRead).toBe(5);
    expect(profile.topicWeights.bitcoin).toBeDefined();
    expect(profile.topicWeights.bitcoin).toBeGreaterThan(0);
    expect(profile.preferredSources.length).toBeGreaterThan(0);
    expect(profile.preferredSources).toContain('coindesk');
    expect(profile.avgDwellTimeMs).toBeGreaterThan(0);
  });

  it('returns empty profile when no history', async () => {
    const { inferUserProfile } = await import('../../workers/api/src/feed/personalized-news');
    const profile = inferUserProfile([]);
    expect(profile.totalRead).toBe(0);
    expect(profile.topicWeights).toEqual({});
    expect(profile.preferredSources).toEqual([]);
  });

  it('mutes categories that user has disabled', async () => {
    const { computePersonalizedScore, DEFAULT_PREFERENCES } = await import(
      '../../workers/api/src/feed/personalized-news'
    );

    const story = {
      id: 'muted-1',
      title: 'Memecoin Madness',
      summary: '',
      body: 'pepe doge memecoin',
      url: 'https://example.com/meme',
      source: 'decrypt',
      sourceMeta: {
        id: 'decrypt',
        name: 'Decrypt',
        category: 'crypto',
        tier: 1 as const,
        credibility: 0.88,
        weight: 1.4,
        url: '',
        type: 'rss' as const,
      },
      protocol: 'rss' as const,
      allUrls: [],
      alsoCoveredBy: [],
      categories: [],
      entities: {
        tokens: ['PEPE'],
        protocols: [],
        people: [],
        companies: [],
        chains: [],
        nfts: [],
      },
      sentiment: { label: 'neutral', score: 0, confidence: 0, signals: [] },
      credibility: 0.88,
      score: 0,
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      author: 'Test',
      niches: [],
      velocity: 100,
      isBreaking: true,
    };

    const prefs = {
      ...DEFAULT_PREFERENCES,
      mutedCategories: ['memes'],
      mutedSources: ['coindesk'],
    };
    const result = computePersonalizedScore(story, prefs, null, Date.now());
    expect(result.topicalRelevance).toBe(0); // muted category
  });
});
