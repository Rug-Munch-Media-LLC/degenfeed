import { detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchRss,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_CRYPTO_FEEDS = [
  // ── Tier 1 — Major Crypto News ──────────────────────────────────
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://www.theblock.co/rss',
  'https://cryptoslate.com/feed/',
  'https://beincrypto.com/feed/',
  'https://bitcoinmagazine.com/.rss/full/',
  'https://www.newsbtc.com/feed/',
  'https://cryptopotato.com/feed/',
  'https://ambcrypto.com/feed/',
  'https://cryptobriefing.com/feed/',
  'https://dailyhodl.com/feed/',
  'https://zycrypto.com/feed/',
  'https://bitcoinist.com/feed/',
  'https://cryptonews.com/feed/',
  'https://blockworks.co/feed',
  'https://unchainedcrypto.com/feed/',
  // ── Tier 2 — Premium Newsletters (Substack, Mirror, Paragraph, Ghost) ──
  'https://newsletter.banklesshq.com/feed', // Bankless — daily crypto
  'https://banklesshq.substack.com/feed', // Bankless (alt feed)
  'https://thedefiant.io/feed', // The Defiant — DeFi news
  'https://milkroad.substack.com/feed', // Milk Road — daily digest
  'https://thedefiedge.substack.com/feed', // The DeFi Edge — research
  'https://messari.substack.com/feed', // Messari — crypto research
  'https://delphidigital.substack.com/feed', // Delphi Digital — macro crypto
  'https://variant.fund/feed', // Variant Fund (Mirror variant)
  'https://variantfund.substack.com/feed', // Variant (Substack)
  'https://multicoin.capital/feed', // Multicoin Capital
  'https://dune.com/blog/rss.xml', // Dune Analytics
  'https://blog.chainalysis.com/feed/', // Chainalysis — on-chain intel
  'https://nansen.substack.com/feed', // Nansen — on-chain analytics
  'https://nansen.ai/feed/', // Nansen (alt)
  'https://tokenterminal.com/feed', // Token Terminal
  'https://paragraph.xyz/@bitcoin/feed', // Bitcoin on Paragraph
  'https://paragraph.xyz/@crypto/feed', // Crypto on Paragraph
  'https://mirror.xyz/dashboard/feed', // Mirror (global)
  // ── Tier 3 — Protocol / Chain Blogs ──────────────────────────────
  'https://blog.ethereum.org/feed.xml', // Ethereum Foundation
  'https://solana.com/feed', // Solana
  'https://polkadot.network/blog/feed/', // Polkadot
  'https://blog.chain.link/feed/', // Chainlink
  'https://a16zcrypto.com/feed/', // a16z Crypto
  'https://vitalik.eth.limo/feed.xml', // Vitalik Buterin
  'https://www.paradigm.xyz/feed/atom', // Paradigm (research)
  'https://eips.ethereum.org/feed.xml', // Ethereum EIPs
  'https://weekinethereumnews.com/feed', // Week in Ethereum News
  'https://ethdaily.substack.com/feed', // ETH Daily
  'https://l2beat.com/feed/', // L2Beat
  'https://blog.arbitrum.io/feed.xml', // Arbitrum
  'https://optimism.mirror.xyz/feed/atom', // Optimism (Mirror)
  'https://base.mirror.xyz/feed/atom', // Base (Mirror)
  'https://starknet.io/feed.xml', // StarkNet
  'https://zksync.io/feed.xml', // zkSync
  // ── Tier 4 — AI x Crypto / Tech ──────────────────────────────────
  'https://www.interconnects.ai/feed/', // Interconnects (AI newsletter)
  'https://thesequence.substack.com/feed', // The Sequence (AI/ML)
  'https://jack-clark.net/feed/', // Import AI (Jack Clark / Anthropic)
  'https://stratechery.com/feed/', // Stratechery (Ben Thompson)
  'https://technically.substack.com/feed', // Technically (AI+economics)
  'https://www.semiconductor-digest.com/feed/', // SemiEngineering
  'https://techcrunch.com/feed/', // TechCrunch (general tech)
  'https://www.theverge.com/rss/index.xml', // The Verge
  'https://arstechnica.com/feed/', // Ars Technica
  'https://blog.google/technology/ai/rss/', // Google AI Blog
  'https://openai.com/blog/rss.xml', // OpenAI Blog
  'https://www.deepmind.com/blog/rss.xml', // DeepMind
  'https://ai.meta.com/blog/feed/', // Meta AI
  'https://research.facebook.com/feed/', // Meta Research
  'https://www.anthropic.com/feed/', // Anthropic
  // ── Tier 5 — Research / Data ────────────────────────────────────
  'https://messari.io/feed', // Messari
  'https://insights.glassnode.com/feed/', // Glassnode
  'https://blog.kaiko.com/feed', // Kaiko
  'https://defillama.com/feed', // DeFi Llama
  'https://www.coingecko.com/en/blog/rss', // CoinGecko
  'https://coinmarketcap.com/feed/', // CoinMarketCap
  'https://blog.coinbase.com/feed/', // Coinbase
  'https://www.gemini.com/feed.xml', // Gemini
  'https://blog.kraken.com/feed/', // Kraken
  'https://blog.binance.com/feed/', // Binance
  'https://www.galaxy.com/feed/', // Galaxy Digital
  'https://www.vanryun.com/feed/', // VanEck
  // ── Tier 6 — Security / Policy / Macro ──────────────────────────
  'https://rekt.news/feed.xml', // Rekt News
  'https://slowmist.medium.com/feed', // SlowMist (Medium)
  'https://immunefi.medium.com/feed', // Immunefi (Medium)
  'https://certik.medium.com/feed', // CertiK (Medium)
  'https://blog.trailofbits.com/feed/', // Trail of Bits
  'https://www.coincenter.org/feed/', // Coin Center (policy)
  'https://cointelegraph.com/tags/regulation/feed', // Regulation tag
  'https://www.sec.gov/news/pressreleases.rss', // SEC Press Releases
  'https://www.federalreserve.gov/feeds/press.xml', // Federal Reserve
  'https://www.imf.org/en/News/RSS', // IMF
  // ── Tier 7 — Web3 / NFT / Gaming ────────────────────────────────
  'https://opensea.io/blog/feed.xml', // OpenSea
  'https://blog.decentraland.org/feed/', // Decentraland
  'https://thetruthmatters.substack.com/feed', // Yuga Labs / BAYC news
  'https://www.nftnow.com/feed/', // NFT Now
  'https://axieinfinity.com/feed/', // Axie Infinity (gaming)
  'https://godsunchained.com/feed/', // Gods Unchained
  // ── Mastodon / Fediverse feeds ──────────────────────────────────
  'https://social.degenfeed.xyz/@admin.rss',
  // ── YouTube / Video ─────────────────────────────────────────────
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC7-gGJFlRPPSK4hBbbST6YA', // Whiteboard Crypto
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC57i8xkdqJm42AsVr_jgpBQ', // The Coin Bureau Club
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC6nSFpj9HTCZ5t-N3Ra3-HA', // TechLead
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPvezykHz9Qd0VBLg', // Joma Tech
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC8butISFwT-Wl7EV0hUK0BQ', // freeCodeCamp
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC9-y-6csu5WGm29I7JiwpnA', // Computerphile
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCznv7Vf9nBdXFXz2L9n7bLQ', // Altcoin Daily
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCvJJ_dziViPnd-hmwjM8k0w', // CoinDesk TV
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCsT0YIqwnpJCM-mx7-gSA4Q', // TEDx Talks
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA', // Veritasium
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCX6b17PVsYBQ0ip5gyeme-Q', // CrashCourse (tech/econ)
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqZQJzTlBvT5GpB1mqGzMxw', // Two Minute Papers (AI papers)
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA', // Bankless
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw', // Coin Bureau
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCcQ_2g7TDmI7Tpc4PqFFY_w', // Benjamin Cowen
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCVraXPw8VUQaGXAVBg-ZkyA', // DataDash
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC67TmGtqUPdHq9kFtnWZIKQ', // Into The Cryptoverse
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw', // 3Blue1Brown
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCr8UAVlECQNTpMEYfzt8nDQ', // Lex Fridman (AI/tech)
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCznv7Vf9nBdXFXz2L9n7bLQ', // Finematics (DeFi)
  // ── Reddit JSON hot posts (free, no auth) ───────────────────────
  'https://old.reddit.com/r/CryptoCurrency/hot.rss?limit=25',
  'https://old.reddit.com/r/Bitcoin/hot.rss?limit=25',
  'https://old.reddit.com/r/ethereum/hot.rss?limit=25',
  'https://old.reddit.com/r/solana/hot.rss?limit=25',
  'https://old.reddit.com/r/defi/hot.rss?limit=25', // Our own Mastodon instance
  'https://bitcoinops.org/en/feed.xml',
  'https://lightning.engineering/rss/',
  'https://unchainedcrypto.com/feed/',
  'https://blockworks.co/feed',
  'https://protos.com/feed/',
  'https://thecryptotimes.com/feed/',
  'https://cryptodaily.co.uk/feed/',
  'https://coinjournal.net/feed/',
  'https://www.trustnodes.com/feed',
  'https://www.cryptopolitan.com/feed/',
  'https://www.crypto-news-flash.com/feed/',
  'https://www.livebitcoinnews.com/feed/',
  'https://www.crypto-reporter.com/feed/',
  'https://coinpedia.org/feed/',
  'https://cryptoadventure.org/feed/',
  'https://coincodex.com/blog/feed/',
  // Substacks / creator newsletters
  'https://bankless.substack.com/feed',
  'https://thedefiedge.substack.com/feed',
  'https://milkroad.substack.com/feed',
  'https://ethdaily.substack.com/feed',
  'https://nansen.substack.com/feed',
  'https://weekinethereumnews.com/feed',
  // Medium / publications
  'https://medium.com/feed/immunefi',
  'https://slowmist.medium.com/feed',
  // Mirror / Paragraph creator feeds
  'https://mirror.xyz/feed',
  'https://paragraph.xyz/feed',
];

export interface RssProviderOptions {
  feeds?: string[];
}

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  creator?: string;
  categories?: string[];
  enclosure?: { url?: string; type?: string };
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

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRe = /\u003cimg[^\u003e]+src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((match = imgRe.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function parseRss(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const trimmed = xml.trim();
  if (trimmed.includes('\u003cfeed')) return parseAtom(trimmed);
  return parseRss2(trimmed);
}

function parseRss2(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const channelMatch = xml.match(/\u003cchannel\u003e([\s\S]*?)\u003c\/channel\u003e/i);
  const channelXml = channelMatch?.[1] ?? '';
  const extract = (tag: string, source: string) => {
    const re = new RegExp(`\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`, 'i');
    const m = source.match(re);
    return m ? stripHtml(m[1] ?? '') : '';
  };
  const feed = {
    title: extract('title', channelXml),
    link: extract('link', channelXml),
    description: extract('description', channelXml),
    items: [] as RssItem[],
  };

  const itemRe = /\u003citem([^\u003e]*)\u003e([\s\S]*?)\u003c\/item\u003e/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extract('title', itemXml);
    const link = extract('link', itemXml) || extract('guid', itemXml);
    if (title && link) {
      const desc = extract('description', itemXml) || extract('content:encoded', itemXml);
      const categories: string[] = [];
      const catRe = /\u003ccategory(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/category\u003e/gi;
      let cm: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
      while ((cm = catRe.exec(itemXml)) !== null) {
        if (cm[1]) categories.push(stripHtml(cm[1]));
      }
      const enclosureMatch = itemXml.match(/\u003cenclosure[^\u003e]+url\s*=\s*["']([^"']+)["']/i);
      feed.items.push({
        title,
        link,
        pubDate: extract('pubDate', itemXml),
        description: desc,
        content: extract('content:encoded', itemXml),
        creator: extract('dc:creator', itemXml) || extract('author', itemXml),
        categories,
        enclosure: enclosureMatch ? { url: enclosureMatch[1] } : undefined,
      });
    }
  }
  return feed;
}

function parseAtom(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const extract = (tag: string) => {
    const re = new RegExp(`\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`, 'i');
    const m = xml.match(re);
    return m ? stripHtml(m[1] ?? '') : '';
  };
  const linkMatch = xml.match(/\u003clink[^\u003e]+href\s*=\s*["']([^"']+)["']/i);
  const feed = {
    title: extract('title'),
    link: linkMatch?.[1] ?? '',
    description: extract('subtitle'),
    items: [] as RssItem[],
  };

  const entryRe = /\u003centry([^\u003e]*)\u003e([\s\S]*?)\u003c\/entry\u003e/gi;
  let em: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((em = entryRe.exec(xml)) !== null) {
    const entryXml = em[2] ?? '';
    const entryTitle = (() => {
      const re = /\u003ctitle(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/title\u003e/i;
      const match = entryXml.match(re);
      return match ? stripHtml(match[1] ?? '') : '';
    })();
    const entryLinkMatch = entryXml.match(/\u003clink[^\u003e]+href\s*=\s*["']([^"']+)["']/i);
    const entryLink = entryLinkMatch?.[1] ?? '';
    if (entryTitle && entryLink) {
      const summaryRe = /\u003csummary(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/summary\u003e/i;
      const contentRe = /\u003ccontent(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/content\u003e/i;
      const summary = entryXml.match(summaryRe)?.[1] ?? '';
      const content = entryXml.match(contentRe)?.[1] ?? '';
      const updatedRe = /\u003cupdated(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/updated\u003e/i;
      const publishedRe = /\u003cpublished(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/published\u003e/i;
      const date = entryXml.match(updatedRe)?.[1] ?? entryXml.match(publishedRe)?.[1] ?? '';
      const nameRe = /\u003cname(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/name\u003e/i;
      const categories: string[] = [];
      const catRe = /\u003ccategory(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/category\u003e/gi;
      let cm: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
      while ((cm = catRe.exec(entryXml)) !== null) {
        if (cm[1]) categories.push(stripHtml(cm[1]));
      }
      feed.items.push({
        title: entryTitle,
        link: entryLink,
        pubDate: date,
        description: summary,
        content,
        creator: entryXml.match(nameRe)?.[1] ?? '',
        categories,
      });
    }
  }
  return feed;
}

function feedToUnifiedPosts(feedUrl: string, feed: ReturnType<typeof parseRss>): UnifiedPost[] {
  const author: UnifiedIdentity = {
    id: `rss:${feedUrl}`,
    primary: { protocol: 'rss', id: feedUrl },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: feed.title || feedUrl,
    bio: feed.description?.slice(0, 300) ?? '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'source', url: feed.link || feedUrl }],
    keys: {},
  };

  return feed.items.map((item): UnifiedPost => {
    const html = item.content || item.description || '';
    const text = stripHtml(html).slice(0, 1000) || item.title || '';
    const embeds: Embed[] = [];
    if (item.enclosure?.url) {
      const type = item.enclosure.type ?? '';
      if (type.startsWith('image/')) embeds.push({ kind: 'image', url: item.enclosure.url });
      else if (type.startsWith('video/')) embeds.push({ kind: 'video', url: item.enclosure.url });
    }
    for (const url of extractImageUrls(html)) {
      embeds.push({ kind: 'image', url });
    }
    if (item.link) embeds.push({ kind: 'link', url: item.link });

    const niches = detectNiches(`${text} ${item.categories?.join(' ') ?? ''}`);

    return {
      id: `rss:${feedUrl}:${item.link?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? Date.now()}`,
      protocol: 'rss',
      author,
      text,
      html,
      embeds,
      createdAt: parseDate(item.pubDate),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: { item, feedUrl },
      niches: [...new Set([...niches, ...(item.categories ?? []).map((c) => c.toLowerCase())])],
    };
  });
}

export class RssProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly feeds: string[];

  constructor(options: RssProviderOptions = {}) {
    this.feeds = options.feeds ?? DEFAULT_CRYPTO_FEEDS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    if (this.feeds.length === 0) return { posts: [] };
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const concurrency = opts.concurrency ?? 4;
    const posts: UnifiedPost[] = [];

    const results = await withConcurrencyLimit(this.feeds, concurrency, async (feedUrl) => {
      try {
        const xml = await withTimeout(
          fetchRss(feedUrl, { headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers } }),
          timeoutMs,
          `rss:${feedUrl}`,
        );
        const feed = parseRss(xml);
        return feedToUnifiedPosts(feedUrl, feed);
      } catch {
        return [] as UnifiedPost[];
      }
    });
    for (const r of results) posts.push(...r);

    return { posts };
  }
}
