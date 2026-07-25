import type {
  RSSEntry,
  YouTubeChannel,
  VideoContentType,
  EngagementSignals,
  QualityScore,
} from './types';

export const QUALITY_FILTERS = {
  /** Max age in days — anything older is excluded */
  MAX_AGE_DAYS: 7,
  /** Shorts shorter than this (seconds) are filtered out */
  SHORTS_MAX_DURATION: 60,
  /** Minimum views threshold (requires Data API; RSS doesn't provide this) */
  MIN_VIEWS: 1000,
  /** Channels exempt from livestream filtering (high-value commentary) */
  LIVESTREAM_EXEMPT_CHANNELS: [
    'Bankless',
    'Coin Bureau',
    'a16z Crypto',
    'Andrei Jikh',
    'Benjamin Cowen',
    'InvestAnswers',
  ] as readonly string[],
  /** Engagement rate thresholds */
  MIN_ENGAGEMENT_RATE: 0.01, // 1% engagement (likes+comments)/views
  VIRAL_ENGAGEMENT_RATE: 0.15, // 15% = viral
  /** Growth velocity thresholds */
  VIRAL_VELOCITY: 10000, // 10k views per hour
  TRENDING_VELOCITY: 1000, // 1k views per hour
};

// ─── Category keywords mapping ───────────────────────────────────────

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  crypto: [
    'bitcoin', 'btc', 'crypto', 'ethereum', 'eth', 'blockchain', 'coin',
    'token', 'digital asset', 'bear market', 'bull run', 'altcoin',
    'cryptocurrency', 'halving', 'satoshi',
  ],
  defi: [
    'defi', 'decentralized finance', 'liquidity', 'yield', 'staking',
    'lending', 'borrowing', 'amm', 'dex', 'swap', 'pool', 'farm',
    'restaking', 'vault', 'curve', 'aave', 'compound', 'pendle',
  ],
  nft: [
    'nft', 'nfts', 'collectible', 'digital art', 'marketplace', 'blue chip',
    'ape', 'pixel', 'mint', 'metadata', 'opensea', 'blur', 'punk',
  ],
  tutorial: [
    'tutorial', 'guide', 'how to', 'learn', 'beginner', 'explained',
    'walkthrough', 'setup', 'step by step', 'getting started', 'crash course',
    '101', 'masterclass', 'workshop',
  ],
  news: [
    'news', 'update', 'latest', 'breaking', 'report', 'analysis', 'recap',
    'weekly', 'daily', 'roundup', 'headlines', 'this week in', 'today in',
  ],
  entertainment: [
    'entertainment', 'podcast', 'interview', 'discussion', 'debate', 'funny',
    'meme', 'reaction', 'vlog', 'comedy', 'skit', 'prank',
  ],
  trading: [
    'trade', 'trading', 'chart', 'technical analysis', 'support', 'resistance',
    'entry', 'exit', 'swing', 'scalp', 'futures', 'perpetual', 'leverage',
    'long', 'short', 'position',
  ],
  macro: [
    'macro', 'fed', 'federal reserve', 'inflation', 'interest rate', 'gdp',
    'recession', 'monetary policy', 'qe', 'dollar', 'fomc', 'cpi', 'ppc',
  ],
  ai: [
    'ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt',
    'openai', 'anthropic', 'claude', 'gemini', 'deepseek', 'neural network',
    'transformer', 'diffusion', 'agent', 'copilot', 'rag', 'fine tuning',
  ],
  tech: [
    'programming', 'developer', 'coding', 'github', 'open source', 'saas',
    'cloud', 'api', 'linux', 'rust', 'golang', 'python', 'typescript',
    'docker', 'kubernetes', 'devops', 'backend', 'frontend',
  ],
  science: [
    'science', 'research', 'discovery', 'nasa', 'space', 'physics',
    'biology', 'quantum', 'genetics', 'dna', 'climate', 'energy',
    'nuclear', 'fusion', 'particle',
  ],
  startups: [
    'startup', 'venture capital', 'vc', 'funding', 'seed', 'series a',
    'series b', 'ipo', 'unicorn', 'y combinator', 'accelerator', 'pitch',
    'founder', 'saas', 'scale',
  ],
};

// ─── Content type detection ───────────────────────────────────────────

/** Detect content type from title, description, and metadata */
export function detectContentType(
  title: string,
  description?: string,
  duration?: number,
): VideoContentType {
  const text = `${title} ${description ?? ''}`.toLowerCase();

  // Short detection
  if (duration !== undefined && duration < 60) return 'short';
  if (/#shorts/i.test(title) || /#short/i.test(title)) return 'short';

  // Livestream detection
  if (/\blive\b/i.test(title) && !/live(?:d|room)/i.test(title)) return 'livestream';
  if (/\blivestream/i.test(title)) return 'livestream';

  // Tutorial/educational
  if (/\b(tutorial|guide|how\s+to|course|masterclass|workshop|learn\s+)\b/i.test(text)) {
    return 'tutorial';
  }
  if (/\b(explained|understanding|what\s+is|introduction\s+to)\b/i.test(text)) return 'educational';

  // Review
  if (/\b(review|rating|vs\.?\s+|comparison|best\s+|worst\s+)\b/i.test(text)) return 'review';

  // Interview
  if (/\b(interview|chat\s+with|conversation\s+with|fireside\s+chat|ama\b)\b/i.test(text)) {
    return 'interview';
  }

  // Podcast
  if (/\b(podcast|episode\s+\d+)\b/i.test(text)) return 'podcast';

  // News
  if (/\b(news|breaking|update|recap|headlines|weekly\s+roundup)\b/i.test(text)) return 'news';

  // Analysis/commentary
  if (/\b(analysis|deep\s+dive|research|report|case\s+study)\b/i.test(text)) return 'analysis';
  if (/\b(opinion|thoughts?\s+on|my\s+take|hot\s+take|unpopular\s+opinion)\b/i.test(text)) {
    return 'commentary';
  }

  // Unboxing
  if (/\b(unbox|unboxing|first\s+look|hands[-\s]?on)\b/i.test(text)) return 'unboxing';

  // Vlog
  if (/\b(vlog|day\s+in\s+(the\s+)?life|weekly\s+vlog|daily\s+vlog)\b/i.test(text)) return 'vlog';

  // Entertainment
  if (/\b(funny|comedy|meme|skit|prank|challenge|reaction)\b/i.test(text)) return 'entertainment';

  return 'unknown';
}

// ─── Engagement signal computation ────────────────────────────────────

/** Estimate engagement from available signals */
export function computeEngagementSignals(entry: RSSEntry): EngagementSignals | undefined {
  const views = entry.views;
  if (views === undefined || views < 100) return undefined;

  const likes = entry.likes ?? Math.round(views * 0.04); // estimate 4% like rate
  const comments = entry.comments ?? Math.round(views * 0.005); // estimate 0.5% comment rate
  const totalEngagement = likes + comments;
  const estimatedEngagementRate = views > 0 ? totalEngagement / views : 0;

  const publishedMs = new Date(entry.published).getTime();
  const hoursSincePublish = Math.max(1, (Date.now() - publishedMs) / 3600000);
  const growthVelocity = views / hoursSincePublish;

  let momentum: 'viral' | 'trending' | 'steady' | 'stale';
  if (growthVelocity >= QUALITY_FILTERS.VIRAL_VELOCITY || estimatedEngagementRate >= QUALITY_FILTERS.VIRAL_ENGAGEMENT_RATE) {
    momentum = 'viral';
  } else if (growthVelocity >= QUALITY_FILTERS.TRENDING_VELOCITY) {
    momentum = 'trending';
  } else if (growthVelocity >= 100) {
    momentum = 'steady';
  } else {
    momentum = 'stale';
  }

  return {
    viewCount: views,
    likeCount: likes,
    commentCount: comments,
    estimatedEngagementRate,
    growthVelocity,
    momentum,
  };
}

// ─── Quality scoring ─────────────────────────────────────────────────

/** Compute a quality score for a video entry */
export function computeQualityScore(
  entry: RSSEntry,
  channel: YouTubeChannel,
  engagement?: EngagementSignals,
): QualityScore {
  let productionQuality = 0.5; // default middle
  let engagementRateScore = 0.5;
  let clickbaitPenalty = 0;

  // Production quality signals
  if (entry.duration !== undefined && entry.duration > 300) productionQuality += 0.2; // >5min
  if (entry.description && entry.description.length > 100) productionQuality += 0.1;
  if (entry.description && entry.description.length > 500) productionQuality += 0.1;
  if (entry.thumbnail && !entry.thumbnail.includes('hqdefault')) productionQuality += 0.1;
  // Channel weight as quality signal
  productionQuality = Math.min(1, productionQuality + (channel.weight - 0.5) * 0.3);

  // Engagement rate scoring
  if (engagement) {
    const er = engagement.estimatedEngagementRate;
    if (er >= 0.10) engagementRateScore = 1.0;
    else if (er >= 0.05) engagementRateScore = 0.8;
    else if (er >= 0.02) engagementRateScore = 0.6;
    else if (er >= 0.01) engagementRateScore = 0.4;
    else engagementRateScore = 0.2;
  }

  // Clickbait detection
  const title = entry.title;
  if (title) {
    const clickbaitPatterns = [
      /you won't believe/i, /shocked?ing/i, /mind[ -]?blowing/i,
      /gone wrong/i, /gone sexual/i, /(one|1) trick/i, /doctors hate/i,
      /what happened next/i, /will surprise you/i, /this is why/i,
      /number \d+ will/i, /can't handle/i, /you need to see/i,
      /99%\s+of/i, /100%\s+/i, /😱|🤯|💥|🚀|💯|🔥/i,
      /\$[A-Z]{2,10}\s+(to|will|could|moon|pump)/i, // ticker price predictions
    ];
    for (const pattern of clickbaitPatterns) {
      if (pattern.test(title)) clickbaitPenalty += 0.15;
    }
    // ALL CAPS title = clickbait signal
    const capsRatio = [...title].filter((c) => c >= 'A' && c <= 'Z').length / Math.max(1, title.length);
    if (capsRatio > 0.6) clickbaitPenalty += 0.2;
    // Excessive exclamation marks
    const exclaimCount = (title.match(/!/g) || []).length;
    if (exclaimCount >= 3) clickbaitPenalty += 0.1;
    // Question in title (often clickbait-y)
    if (title.includes('?')) clickbaitPenalty += 0.05;
  }
  clickbaitPenalty = Math.min(1, clickbaitPenalty);

  // Recency score
  const publishedMs = new Date(entry.published).getTime();
  const ageHours = Math.max(0, (Date.now() - publishedMs) / 3600000);
  const recencyScore = Math.max(0, 1 - ageHours / (24 * QUALITY_FILTERS.MAX_AGE_DAYS));

  // Completeness
  let completeness = 0.3; // baseline: has title and id
  if (entry.description && entry.description.length > 50) completeness += 0.2;
  if (entry.description && entry.description.length > 200) completeness += 0.2;
  if (entry.duration !== undefined) completeness += 0.15;
  if (entry.thumbnail) completeness += 0.15;

  // Composite score (weighted)
  const overall = Math.min(1,
    productionQuality * 0.30 +
    engagementRateScore * 0.25 +
    recencyScore * 0.15 +
    completeness * 0.10 +
    (1 - clickbaitPenalty) * 0.20
  );

  return {
    overall,
    productionQuality: Math.round(productionQuality * 100) / 100,
    engagementRateScore: Math.round(engagementRateScore * 100) / 100,
    recencyScore: Math.round(recencyScore * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    clickbaitPenalty: Math.round(clickbaitPenalty * 100) / 100,
    confidence: 0.7, // moderate without full API data
  };
}

// ─── Quality filter ─────────────────────────────────────────────────

/**
 * Check if a video should be filtered out as low quality.
 * Now uses enhanced quality scoring.
 */
export function isLowQualityVideo(
  entry: RSSEntry,
  channel: YouTubeChannel,
  nowMs: number,
  maxAgeDays: number,
): boolean {
  // Age check — skip videos older than maxAgeDays
  const publishedMs = new Date(entry.published).getTime();
  const ageDays = (nowMs - publishedMs) / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) return true;

  // Very short duration = likely Short or irrelevant
  if (entry.duration !== undefined && entry.duration < 60) {
    const exempt = [
      'Bankless', 'Coin Bureau', 'a16z Crypto', 'Andrei Jikh',
      'Benjamin Cowen', 'InvestAnswers',
    ];
    if (!exempt.includes(channel.name)) {
      return true;
    }
  }

  // Quality score filter — reject very low quality
  const engagement = computeEngagementSignals(entry);
  const qs = computeQualityScore(entry, channel, engagement);
  if (qs.overall < 0.2 && channel.weight < 0.6) return true;

  return false;
}

// ─── Creator discovery ──────────────────────────────────────────────

/** Niche keywords for scoring discovered creators */
export const DISCOVERY_NICHE_KEYWORDS: Record<string, string[]> = {
  crypto: ['crypto', 'bitcoin', 'blockchain', 'defi', 'web3', 'nft', 'altcoin'],
  ai: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'deep learning'],
  tech: ['programming', 'software', 'developer', 'coding', 'startup'],
  trading: ['trading', 'investing', 'stock market', 'forex', 'day trading'],
  science: ['science', 'physics', 'biology', 'space', 'research'],
};

/** Score a creator's relevance to our niche interests */
export function scoreCreatorRelevance(
  channelName: string,
  channelDescription: string,
  recentVideoTitles: string[],
): number {
  const text = [channelName, channelDescription, ...recentVideoTitles]
    .join(' ')
    .toLowerCase();

  let score = 0;
  let matchedNiches = 0;

  for (const [, keywords] of Object.entries(DISCOVERY_NICHE_KEYWORDS)) {
    const hits = keywords.filter((kw) => text.includes(kw)).length;
    if (hits > 0) matchedNiches++;
    score += hits * 0.15;
  }

  // Bonus for covering multiple niches
  score += matchedNiches * 0.1;

  // Penalty for obviously irrelevant content
  const irrelevantPatterns = [/gaming\s*(?!(crypto|nft))/i, /minecraft/i, /fortnite/i, /asmr/i];
  for (const pattern of irrelevantPatterns) {
    if (pattern.test(text)) score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}
