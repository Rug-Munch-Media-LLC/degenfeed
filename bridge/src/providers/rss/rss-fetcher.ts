// ─── OpenGraph Image Cache ────────────────────────────────────────────
// Extracted article images are cached in-memory so the bridge doesn't
// re-fetch every article page on every 5-minute feed cycle. Positive hits
// live for 7 days (og:image rarely changes); misses are cached 1 hour so
// slow/broken article pages aren't hammered repeatedly.

const OG_IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const OG_IMAGE_NEGATIVE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ogImageCache = new Map<string, { url: string; expiresAt: number }>();
const ogImageInFlight = new Map<string, Promise<string | undefined>>();

function cacheOgImage(url: string, image: string | undefined): void {
  ogImageCache.set(url, {
    url: image ?? '',
    expiresAt: Date.now() + (image ? OG_IMAGE_CACHE_TTL_MS : OG_IMAGE_NEGATIVE_TTL_MS),
  });
}

/**
 * Fetch an article page and extract its OpenGraph image.
 * In-memory cached (positive 7d, negative 1h) and single-flight deduplicated
 * so concurrent enrichment passes never duplicate a request.
 */
export async function fetchOpenGraphImage(url: string): Promise<string | undefined> {
  if (!url?.startsWith('http')) return undefined;

  const cached = ogImageCache.get(url);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.url || undefined;
    ogImageCache.delete(url);
  }

  const inFlight = ogImageInFlight.get(url);
  if (inFlight) return inFlight;

  const promise = fetchOpenGraphImageInner(url).finally(() => ogImageInFlight.delete(url));
  ogImageInFlight.set(url, promise);
  return promise;
}

async function fetchOpenGraphImageInner(url: string): Promise<string | undefined> {
  try {
    const res = await globalThis.fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      cacheOgImage(url, undefined);
      return undefined;
    }
    // We only need <head> metadata — cap the body to bound memory on huge pages.
    // 300KB keeps room for og:image + the top-of-article hero <img> that the
    // readability-style fallback scores.
    const html = (await res.text()).slice(0, 300_000);
    // Priority: OpenGraph/Twitter meta → readability-style largest image →
    // first inline <img> (legacy). Each candidate is validated to skip
    // icons, badges and tracking pixels.
    const og = extractOpenGraphImage(html);
    const image = og || extractLargestImage(html) || extractFeaturedImage(html);
    cacheOgImage(url, image);
    return image;
  } catch {
    cacheOgImage(url, undefined);
    return undefined;
  }
}

/** Read the current best image for a post (raw.image, then image embed). */
export function getPostImage(post: UnifiedPost): string | undefined {
  const raw = post.raw as Record<string, unknown> | undefined;
  const rawImage = raw?.image as string | undefined;
  if (rawImage) return rawImage;
  return post.embeds.find((e) => e.kind === 'image')?.url;
}

/** Attach an image to a post: sets raw.image and the image embed. */
export function setPostImage(post: UnifiedPost, image: string): void {
  const raw = post.raw as Record<string, unknown>;
  raw.image = image;
  const idx = post.embeds.findIndex((e) => e.kind === 'image');
  if (idx >= 0) {
    post.embeds[idx] = { kind: 'image', url: image, meta: post.embeds[idx].meta };
  } else {
    post.embeds.push({ kind: 'image', url: image });
  }
}

/**
 * Enrich posts that lack an image by fetching og:image from the article
 * page. Bounded: concurrency-limited and hard time-budgeted so enrichment
 * can never stall the RSS provider past its provider timeout.
 */
export async function enrichPostImages(
  posts: UnifiedPost[],
  budgetMs = 3000,
  concurrency = 5,
): Promise<UnifiedPost[]> {
  const missing = posts.filter((p) => !getPostImage(p));
  if (missing.length === 0) return posts;

  const deadline = Date.now() + budgetMs;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < missing.length) {
      if (Date.now() >= deadline) return; // time budget exhausted — keep what we have
      const i = cursor++;
      const post = missing[i];
      if (!post) continue;
      const url = extractLinkUrl(post);
      if (!url) continue;
      const image = await fetchOpenGraphImage(url);
      if (image) setPostImage(post, image);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));
  return posts;
}

/**
 * Detect niche categories from text content
 */
export function guessNiches(text: string, baseNiches: string[]): string[] {
  const niches = new Set(baseNiches);
  const lower = text.toLowerCase();

  // Crypto-specific
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.add('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra|eip|erc)\b/.test(lower)) niches.add('ethereum');
  if (/\b(sol|solana|spl|jupiter|pyth)\b/.test(lower)) niches.add('solana');
  if (/\b(defi|liquidity|yield|farm|lp|stake|apy)\b/.test(lower)) niches.add('defi');
  if (/\b(stak|validator|delegat|restak|eigenlayer|ssv|lido|jito)\b/.test(lower))
    niches.add('staking');
  if (/\b(mev|sandwich|front.?run|back.?run|extractable)\b/.test(lower)) niches.add('mev');
  if (/\b(bridge|bridging|wormhole|layerzero|axelar|ibc|interoperab)\b/.test(lower))
    niches.add('bridges');
  if (/\b(zero.?knowledge|zk.?proof|validity.?proof|zkp|zksync|starknet|circom)\b/.test(lower))
    niches.add('zero-knowledge');
  if (/\b(nft|art|collectible|punk|ens|soulbound)\b/.test(lower)) niches.add('nft');
  if (/\b(ai|artificial|intelligence|llm|agent|gpt|transformer|neural)\b/.test(lower))
    niches.add('ai');
  if (
    /\b(ai.?agent|ai.?crypto|decentralized.?ai|compute.?marketplace|bittensor|fetch\.?ai)\b/.test(
      lower,
    )
  )
    niches.add('aicrypto');
  if (/\b(storage|filecoin|arweave|ipfs|datacap|decentralized.?storage|storj)\b/.test(lower))
    niches.add('storage');
  if (
    /\b(identity|did|verifiable.?credential|soulbound|worldcoin|proof.?of.?personhood)\b/.test(
      lower,
    )
  )
    niches.add('identity');
  if (/\b(social|farcaster|lens|bluesky|socialfi|content|creator.?economy|deso)\b/.test(lower))
    niches.add('social');
  if (/\b(insurance|underwrit|coverage|nexus.?mutual|cover)\b/.test(lower)) niches.add('insurance');
  if (/\b(carbon|offset|verra|gold.?standard|regen|toucan|moss|ecosystem.?credit)\b/.test(lower))
    niches.add('carbon');
  if (
    /\b(payment|remittance|payments|crypto.?pay|lightning|visa|mastercard|paypal|stripe)\b/.test(
      lower,
    )
  )
    niches.add('payments');
  if (/\b(rwa|real.?world.?asset|tokeniz|tokenization|syndicate|centrifuge)\b/.test(lower))
    niches.add('rwa');
  if (/\b(sec|regulation|etf|compliance|sec|cfpb|finra|oig)\b/.test(lower))
    niches.add('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|mew)\b/.test(lower)) niches.add('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|scroll|zksync)\b/.test(lower)) niches.add('layer2');
  if (/\b(security|hack|exploit|audit|vulnerability|bug)\b/.test(lower)) niches.add('security');
  if (/\b(oracle|chainlink|pyth|api3)\b/.test(lower)) niches.add('oracle');
  if (/\b(dao|treasury|proposal|snapshot|delegate|quorum)\b/.test(lower)) niches.add('dao');
  if (/\b(governance|vote|voting|proposal|constitution|parameter.?change)\b/.test(lower))
    niches.add('governance');
  if (/\b(gaming|gamefi|play-to-earn|metaverse)\b/.test(lower)) niches.add('gaming');
  if (/\b(token|airdrop|listing|binance|coinbase)\b/.test(lower)) niches.add('token');
  if (/\b(mobile|telegram|ton|crypto\s*pay)\b/.test(lower)) niches.add('mobile');
  if (/\b(dex|swap|amm|order.?book|perpetual)\b/.test(lower)) niches.add('dex');
  if (/\b(custody|wallet|self.?custody|hardware)\b/.test(lower)) niches.add('wallet');
  if (/\b(stablecoin|usdc|usdt|dai|fdusd)\b/.test(lower)) niches.add('stablecoin');
  if (/\b(privacy|monero|tornado|anonymity)\b/.test(lower)) niches.add('privacy');
  if (/\b(mining|miner|hashrate|asic|pool|proof.?of.?work|difficulty)\b/.test(lower))
    niches.add('mining');

  // World / science / business topics (topic expansion)
  if (
    /\b(climate|physics|biology|genome|space|nasa|quantum|dna|vaccine|neutron|telescope)\b/.test(
      lower,
    )
  )
    niches.add('science');
  if (
    /\b(war|sanction|diplomacy|nato|election|foreign|policy|geopolitic|treaty|summit)\b/.test(lower)
  )
    niches.add('geopolitics');
  if (
    /\b(economy|recession|inflation|gdp|fed|interest rate|tariff|trade war|unemployment|central bank|pmi|cpi|rate cut|hike)\b/.test(
      lower,
    )
  ) {
    niches.add('business');
    niches.add('macro');
  }

  // Add crypto as default if nothing matched and no base niches
  if (niches.size === 0) niches.add('crypto');
  return [...niches];
}

// ─── Feed Fetcher ─────────────────────────────────────────────────────

async function fetchSingleFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await globalThis.fetch(feed.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.log(`[rss] ${feed.label}: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    if (!xml || xml.length < 50) return [];

    const parsed = parseFeedXml(xml);
    const items = parsed.items.slice(0, limit);

    return items.map((item, i) => {
      const allNiches = guessNiches(`${item.title} ${item.contentText}`, feed.niches);
      const embedUrl = item.link || feed.url;
      // Image priority: item content <img> → media:thumbnail/content → enclosure
      // → feed-level image (channel <image> / Atom <logo>).
      const featuredImage = item.featuredImage || parsed.image;
      // Sentiment runs locally on the headline + description (AFINN-based).
      const sentiment = analyzeNewsSentiment(`${item.title}. ${item.description || ''}`);

      const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [
        { kind: 'link', url: embedUrl },
      ];

      if (featuredImage) {
        embeds.push({
          kind: 'image',
          url: featuredImage,
          meta: { source: feed.label, caption: item.title },
        });
      }

      // Podcast feeds: promote the audio enclosure to a first-class audio
      // embed so clients can render an inline player. Falls back to the
      // first enclosure URL when no audio type is declared.
      const isPodcast = feed.category === 'podcast' || feed.platform === 'podcast';
      let audioUrl: string | undefined;
      if (isPodcast) {
        const audioEnclosure =
          item.enclosures.find(
            (en) =>
              en.url &&
              (en.type?.startsWith('audio/') ||
                /\.(mp3|m4a|ogg|wav|aac|opus|flac|webm)(\?|$)/i.test(en.url)),
          ) || item.enclosures.find((en) => en.url);
        audioUrl = audioEnclosure?.url;
        if (audioUrl) {
          embeds.push({
            kind: 'audio',
            url: audioUrl,
            meta: {
              duration: item.duration,
              podcast: feed.label,
              title: item.title,
            },
          });
        }
      }

      const platformLabel = feed.platform ? `${feed.label} (${feed.platform})` : feed.label;

      return {
        id: `rss:${feed.label}:${item.id || i}`,
        protocol: 'rss' as const,
        author: {
          id: `rss:${feed.label}`,
          primary: { protocol: 'rss', id: feed.label },
          handles: { rss: feed.label },
          displayName: item.authorName || platformLabel,
          bio: feed.category ? `${feed.category.replace(/-/g, ' ')} feed` : 'RSS feed',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: feed.url ? [{ label: 'source', url: feed.url }] : [],
          keys: {},
        },
        text: item.title,
        html: item.contentHtml,
        embeds,
        createdAt: item.publishedAt,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        // Top-level image/media fields: convenience for API consumers and
        // the frontend (og:image enrichment backfills via setPostImage).
        image: featuredImage,
        media: featuredImage,
        raw: {
          description: item.description,
          contentText: item.contentText.slice(0, 1000),
          categories: item.categories,
          feedLabel: feed.label,
          feedCategory: feed.category,
          feedUrl: feed.url,
          platform: feed.platform,
          image: featuredImage,
          sentiment,
          // Podcast episode metadata (present on podcast feeds)
          audioUrl,
          duration: isPodcast ? item.duration : undefined,
          podcastTitle: isPodcast ? feed.label : undefined,
          // Ground News-style ratings — free informational metadata
          bias: sourceBias(feed.label),
          factualRating: sourceFactuality(feed.label),
          // CryptoPanic-style price impact: which coins this article affects.
          priceImpact: extractPriceImpact(`${item.title} ${item.contentText}`),
        },
        niches: allNiches,
        contentType: isPodcast ? 'podcast' : 'link',
      };
    });
  } catch (err) {
    console.log(`[rss] ${feed.label}: error — ${err instanceof Error ? err.message : 'unknown'}`);
    return [];
  }
}

// ─── Newsletter Platform Fetchers ────────────────────────────────────

/**
 * Parse a Substack RSS feed. Substack uses standard RSS 2.0.
 */
async function fetchSubstackFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Parse Medium publication RSS. Medium uses Atom feeds.
 */
async function fetchMediumFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Fetch from Mirror.xyz writer feed (JSON API).
 */
async function fetchMirrorFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await globalThis.fetch(feed.url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.slice(0, limit).map((item, i) => {
      const itemAny = item as Record<string, unknown>;
      const title = (itemAny.title || 'Mirror post') as string;
      const body = (itemAny.body || itemAny.content || '') as string;
      const timestamp = itemAny.timestamp
        ? new Date(itemAny.timestamp as string).getTime()
        : Date.now() - i * 600000;

      const author = (itemAny.author as Record<string, string> | undefined) || {};

      return {
        id: `mirror:${feed.label}:${i}`,
        protocol: 'rss' as const,
        author: {
          id: `mirror:${feed.label}`,
          primary: { protocol: 'rss', id: feed.label },
          handles: { rss: feed.label, mirror: feed.label },
          displayName: author.displayName || feed.label,
          bio: '',
          avatarUrl: author.avatarUrl || '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'source', url: `https://mirror.xyz/${feed.label}` }],
          keys: {},
        },
        text: title,
        html: body as string,
        embeds: [
          {
            kind: 'link',
            url: `https://mirror.xyz/${feed.label}/${(itemAny.digest as string) || ''}`,
          },
        ],
        createdAt: timestamp,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: itemAny,
        niches: guessNiches(title, feed.niches),
        contentType: 'link',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetch from Paragraph.xyz (RSS format).
 */
async function fetchParagraphFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Fetch from Ghost blog (standard RSS).
 */
async function fetchGhostFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Fetch from Beehiiv publication (standard RSS).
 */
async function fetchBeehiivFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Route a feed to its appropriate fetcher based on platform.
 */
async function fetchFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  switch (feed.platform) {
    case 'substack':
      return fetchSubstackFeed(feed, limit);
    case 'medium':
      return fetchMediumFeed(feed, limit);
    case 'mirror':
      return fetchMirrorFeed(feed, limit);
    case 'paragraph':
      return fetchParagraphFeed(feed, limit);
    case 'ghost':
      return fetchGhostFeed(feed, limit);
    case 'beehiiv':
      return fetchBeehiivFeed(feed, limit);
    default:
      return fetchSingleFeed(feed, limit);
  }
}

