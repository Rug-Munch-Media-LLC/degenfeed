import { type Env, jsonResponse } from '../index';

interface FundingRound {
  id: string;
  project: string;
  description: string;
  amount: string;
  stage: string;
  investors: string[];
  chain?: string;
  category?: string;
  source: string;
  sourceUrl: string;
  announcedAt: number;
}

const FUNDING_SOURCES = [
  { name: 'The Block', url: 'https://www.theblockcrypto.com/rss.xml' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/crypto/feed/' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'Crypto Funding', url: 'https://cryptofunding.substack.com/feed' },
];

// Pattern: "raises $X million", "secured $X", "Series X", "led by Investor"
const _FUNDING_RE =
  /(\w[\w\s]+?)\s+(?:raises?|secured|lands|closes|announces?|gets)\s+[$$]\s*([\d,.]+)\s*(million|billion)?(?:\s+in\s+)?(seed|series\s+\w|strategic|private|public|pre-seed|angel|grant)?.*?(?:led\s+by\s+([\w\s,&]+))?/gi;

const STAGE_RE = /(seed|pre-seed|series\s+[abcd]|strategic|private|public\s+sale|angel|grant)/gi;
const AMOUNT_RE = /[$$]\s*([\d,.]+)\s*(million|billion|m|b)?/gi;
const INVESTOR_RE = /led\s+by\s+([\w\s,&.]+?)(?:\.|,|\sat\s|$)/gi;
const CHAIN_RE =
  /\b(ethereum|solana|polygon|avalanche|arbitrum|optimism|base|near|aptos|sui|bitcoin|multi-chain)\b/gi;

function extractFunding(text: string): Partial<FundingRound> | null {
  const lower = text.toLowerCase();

  // Check if this is likely a funding announcement
  const triggerWords = [
    'raises',
    'secured',
    'funding',
    'round',
    'series',
    'investors',
    'led by',
    'million',
    'billion',
  ];
  if (!triggerWords.some((w) => lower.includes(w))) return null;

  const result: Partial<FundingRound> = {};

  // Amount
  const amtMatch = lower.match(AMOUNT_RE);
  if (amtMatch) {
    const m = amtMatch[0].match(/[\d,.]+/)?.[0];
    const unit =
      amtMatch[0].toLowerCase().includes('billion') || amtMatch[0].includes('b') ? 'B' : 'M';
    result.amount = `$${m || ''}${unit}`;
  }

  // Stage
  const stageMatch = lower.match(STAGE_RE);
  if (stageMatch) result.stage = stageMatch[0].trim();

  // Investors
  const invMatch = lower.match(INVESTOR_RE);
  if (invMatch) {
    result.investors = invMatch[0]
      .replace(/led\s+by\s+/i, '')
      .split(/[,&]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Chain
  const chainMatch = lower.match(CHAIN_RE);
  if (chainMatch) result.chain = chainMatch[0];

  return Object.keys(result).length > 0 ? result : null;
}

export async function handleFundingFeed(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 25;
  const chainFilter = url.searchParams.get('chain') || '';
  const stageFilter = url.searchParams.get('stage') || '';

  const allRounds: FundingRound[] = [];

  const _results = await Promise.allSettled(
    FUNDING_SOURCES.slice(0, 6).map(async (src) => {
      try {
        // We don't have the RSS SDK imported statically, so use dynamic import
        const mod = await import('@degenfeed/rss-sdk');
        const source = await mod.GenericRssSource.fetch(src.url);
        const posts = mod.feedToUnifiedPosts(source);

        for (const post of posts.slice(0, 10)) {
          try {
            const extracted = extractFunding(post.text);
            if (extracted) {
              allRounds.push({
                id: `funding:${btoa(post.text.slice(0, 50)).slice(0, 20)}`,
                project: post.author.displayName || 'Unknown',
                description: post.text.slice(0, 300),
                amount: extracted.amount || 'Unknown',
                stage: extracted.stage || 'N/A',
                investors: extracted.investors || ['Undisclosed'],
                chain: extracted.chain || 'Multi-chain',
                category: 'General',
                source: src.name,
                sourceUrl: post.id || src.url,
                announcedAt: post.createdAt,
              });
            }
          } catch {}
        }
      } catch {}
    }),
  );

  // Filter
  let filtered = allRounds;
  if (chainFilter)
    filtered = filtered.filter((r) => r.chain?.toLowerCase().includes(chainFilter.toLowerCase()));
  if (stageFilter)
    filtered = filtered.filter((r) => r.stage?.toLowerCase().includes(stageFilter.toLowerCase()));

  // Sort by date, newest first
  filtered.sort((a, b) => b.announcedAt - a.announcedAt);

  return jsonResponse({
    data: filtered.slice(0, limit),
    meta: {
      total: filtered.length,
      sources: FUNDING_SOURCES.length,
      chainFilter: chainFilter || 'all',
      stageFilter: stageFilter || 'all',
      totalRaised: filtered.slice(0, limit).reduce((acc, r) => {
        const num = Number.parseFloat(r.amount.replace(/[$,]/g, ''));
        return acc + (Number.isNaN(num) ? 0 : num);
      }, 0),
    },
  });
}
