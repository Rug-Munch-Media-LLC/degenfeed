/**
 * @degenfeed/api-worker — Digest Generation
 *
 * Core digest assembly: post gathering, scoring, section building, editorial generation.
 */

import { computeTrendingTopics, deduplicatePosts, enrichPostNiches, isRelevantPost, isSpamPost } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { getProtocolColor, rmiUrl } from '@degenfeed/utils';
import { type Env, noCacheJsonResponse } from '../../index';
import { DEFAULT_PROTOCOLS, getProvider } from '../feed';
import { buildRichDigestHtml } from './templates';
import type { DigestResponse, DigestSection, DigestItem, DigestFormatType, MarketPrice } from './types';
import { DIGEST_CACHE_PREFIX, DIGEST_CACHE_TTL, DIGEST_ARCHIVE_TTL, MARKET_COINS, MARKET_CACHE_KEY, MARKET_CACHE_TTL, protocolEmoji, readTime, stripTags, _formatTime } from './types';

// ─── Market prices ─────────────────────────────────────────────────────────

async function fetchMarketPrices(env: Env): Promise<Record<string, MarketPrice>> {
  if (env.CACHE) {
    const cached = await env.CACHE.get(MARKET_CACHE_KEY);
    if (cached) return JSON.parse(cached) as Record<string, MarketPrice>;
  }
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${MARKET_COINS}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { accept: 'application/json' } },
    );
    if (!res.ok) { const _throwErr = new Error(`CoinGecko returned ${res.status}`); throw _throwErr; }
    const data = (await res.json()) as Record<string, MarketPrice>;
    if (env.CACHE) await env.CACHE.put(MARKET_CACHE_KEY, JSON.stringify(data), { expirationTtl: MARKET_CACHE_TTL });
    return data;
  } catch {
    return {};
  }
}

// ─── Editorial Content Generation ─────────────────────────────────────────

function generateEditorial(
  sections: DigestSection[],
  marketPrices: Record<string, MarketPrice>,
  date: string,
  format: DigestFormatType,
): { subject: string; opening: string; marketOverview?: string; closing: string } {
  const topStories = sections.find((s) => s.type === 'top-stories');
  const trendingSection = sections.find((s) => s.type === 'trending');

  let subject: string;
  if (format === 'daily-brief') {
    const topItem = topStories?.items?.[0];
    subject = topItem
      ? `${topItem.title.slice(0, 60)} — ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : `DegenFeed Daily Brief — ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
  } else if (format === 'weekly-deep-dive') {
    subject = `🔬 Deep Dive: ${topStories?.items?.slice(0, 3).map((i) => i.title.split(' ').slice(0, 3).join(' ')).join(', ') || 'This Week in Web3'}`;
  } else if (format === 'topic-digest') {
    const niches = topStories?.items?.flatMap((i) => i.niches) ?? [];
    const topNiche = [...new Set(niches)].slice(0, 2).join(' & ') || 'Crypto';
    subject = `📬 ${topNiche} Weekly — ${new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  } else {
    subject = `📡 Protocol Report — ${new Date(date).toDateString()}`;
  }

  let marketOverview: string | undefined;
  if (marketPrices && Object.keys(marketPrices).length > 0) {
    const entries = Object.entries(marketPrices);
    const best = entries.sort((a, b) => (b[1].usd_24h_change ?? 0) - (a[1].usd_24h_change ?? 0))[0];
    const worst = entries.sort((a, b) => (a[1].usd_24h_change ?? 0) - (b[1].usd_24h_change ?? 0))[0];
    if (best && worst) {
      marketOverview = `${best[0].charAt(0).toUpperCase() + best[0].slice(1)} leads the market at ${best[1].usd_24h_change >= 0 ? '+' : ''}${best[1].usd_24h_change?.toFixed(1)}%, while ${worst[0]} trails at ${worst[1].usd_24h_change?.toFixed(1)}%.`;
    } else {
      marketOverview = 'Markets are mixed — no clear directional bias across the top assets.';
    }
  }

  const opening = format === 'daily-brief'
    ? `GM. ${new Date(date).toLocaleDateString('en-US', { weekday: 'long' })} is here, and we've surfaced the ${topStories?.items?.length ?? 'top'} stories shaping crypto, web3, and AI. No fluff, no shills — just the signal from ${(trendingSection?.items?.length ?? 3) > 5 ? 'over 200 ' : ''}sources across RSS, protocols, and on-chain data.`
    : format === 'weekly-deep-dive'
      ? `Another week in web3 — and it was anything but quiet. We've analyzed ${topStories?.items?.length ?? 'dozens of'} stories to bring you the developments that actually matter. From protocol upgrades to market shifts, here's what you need to know.`
      : `Curated intelligence for the ${format === 'topic-digest' ? 'topics you care about' : 'protocols you follow'}. This edition covers the stories, data, and signals that defined the period.`;

  const closing = `That's your ${format === 'daily-brief' ? 'daily' : format === 'weekly-deep-dive' ? 'weekly' : 'curated'} briefing. Stay sharp, stay degen. — The DegenFeed Team`;
  return { subject, opening, marketOverview, closing };
}

// ─── Post gathering ──────────────────────────────────────────────────────

async function gatherDigestPosts(env: Env, protocols: Protocol[], niches: string[], _limit = 100): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const timeoutMs = 5000;

  try {
    const rmiUrlValue = rmiUrl(env);
    const rmiConfigured = rmiUrlValue && !rmiUrlValue.includes('127.0.0.1') && !rmiUrlValue.includes('localhost');
    if (rmiConfigured) {
      const { RmiDataBusProvider } = await import('@degenfeed/feed-providers');
      const rmi = new RmiDataBusProvider({ backendUrl: rmiUrlValue });
      const r = await rmi.fetchFeed({ timeoutMs });
      if (r.posts.length > 0) all.push(...r.posts);
    }
  } catch { /* RMI unavailable */ }

  const providerResults = await Promise.allSettled(
    protocols.filter((p) => p !== 'rss').map(async (protocol) => {
      try { const provider = getProvider(protocol, env); const result = await provider.fetchFeed({ timeoutMs, concurrency: 4 }); return result.posts; }
      catch { return [] as UnifiedPost[]; }
    }),
  );
  for (const r of providerResults) { if (r.status === 'fulfilled') all.push(...r.value); }

  if (protocols.includes('rss')) {
    const { RssProvider } = await import('@degenfeed/feed-providers');
    const fastFeeds = ['https://cointelegraph.com/rss', 'https://decrypt.co/feed', 'https://bitcoinmagazine.com/.rss/full/', 'https://blog.ethereum.org/feed.xml', 'https://bankless.substack.com/feed', 'https://weekinethereumnews.com/feed'];
    const results = await Promise.allSettled(fastFeeds.map(async (url) => {
      try { const rss = new RssProvider({ feeds: [url] }); const r = await rss.fetchFeed({ timeoutMs: 3000 }); return r.posts; }
      catch { return [] as UnifiedPost[]; }
    }));
    for (const r of results) { if (r.status === 'fulfilled') all.push(...r.value); }
  }

  try { const { fetchYouTubeVideos } = await import('../../feed/unified-fetchers'); const { posts: ytPosts } = await fetchYouTubeVideos(10); all.push(...ytPosts.map((p) => ({ ...p, protocol: 'youtube' as Protocol }))); } catch { /* YouTube unavailable */ }
  try { const { fetchPeerTubeVideos } = await import('../../feed/unified-fetchers'); const ptPosts = await fetchPeerTubeVideos(10); all.push(...ptPosts.map((p) => ({ ...p, protocol: 'peertube' as Protocol }))); } catch { /* PeerTube unavailable */ }

  let filtered = all.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
  if (niches.length > 0) filtered = filtered.filter((p) => p.niches.some((n) => niches.includes(n)));
  return deduplicatePosts(filtered).filter(isRelevantPost);
}

// ─── Section building ─────────────────────────────────────────────────────

function buildDigestSections(
  posts: UnifiedPost[], _niches: string[], followed: Set<string>,
  _engagedCreators: Set<string>, preferredNiches: Set<string>,
  marketPrices: Record<string, MarketPrice>,
): DigestSection[] {
  const sections: DigestSection[] = [];
  const now = Date.now();

  const scored = posts.map((p) => {
    const ageHours = (now - p.createdAt) / 3600000;
    const recency = Math.max(0, 1 - ageHours / 48);
    const likes = p.metrics.likes ?? 0;
    const reposts = p.metrics.reposts ?? 0;
    const replies = p.metrics.replies ?? 0;
    const engagementScore = likes * 1 + reposts * 2 + replies * 3;
    const nicheBoost = p.niches.some((n) => preferredNiches.has(n.toLowerCase())) ? 3 : 0;
    return { post: p, score: Math.round((recency * 3 + engagementScore + nicheBoost) * 10) / 10 };
  });
  scored.sort((a, b) => b.score - a.score);

  // Top Stories
  const topStories = scored.slice(0, 15).filter((s) => {
    const nicheMatch = s.post.niches.some((n) => preferredNiches.has(n.toLowerCase()));
    return nicheMatch || (s.post.author && followed.has(s.post.author.id)) || s.score > 5;
  });
  const topItems = topStories.slice(0, 5).map(toDigestItem);
  if (topItems.length > 0) sections.push({ type: 'top-stories', title: '📰 Top Stories', items: topItems });

  // Videos
  const videos = scored.filter((s) => s.post.protocol === 'youtube' || s.post.protocol === 'peertube')
    .sort((a, b) => b.score - a.score).slice(0, 3);
  const videoItems = videos.map(toDigestItem);
  if (videoItems.length > 0) sections.push({ type: 'videos', title: '🎬 Top Videos', items: videoItems });

  // Trending Topics
  const trending = computeTrendingTopics(posts, Date.now(), 12, 24 * 3600000);
  const trendingItems: DigestItem[] = trending.slice(0, 5).map((t) => ({
    id: `trending:${t.topic}`, protocol: 'trending', protocolColor: '#10b981',
    protocolEmoji: '🔥', author: { displayName: 'Trending Topic' },
    title: `#${t.topic}`, excerpt: `${t.count} posts in the last 24h`,
    url: `/search?q=${encodeURIComponent(t.topic)}`, niches: [t.topic],
    createdAt: now, metrics: { likes: 0, reposts: 0, replies: 0 }, readTime: 1, score: t.score,
  }));
  if (trendingItems.length > 0) sections.push({ type: 'trending', title: '🔥 Trending Topics', items: trendingItems });

  // Market Summary
  const marketItems: DigestItem[] = Object.entries(marketPrices).map(([coin, price]) => {
    const symbol = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' }[coin] ?? coin.toUpperCase();
    const change = price.usd_24h_change ?? 0;
    return {
      id: `market:${coin}`, protocol: 'market', protocolColor: change >= 0 ? '#22c55e' : '#ef4444',
      protocolEmoji: change >= 0 ? '📈' : '📉', author: { displayName: symbol },
      title: `$${price.usd.toLocaleString()}`, excerpt: `24h change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      url: `/search?q=${coin}`, niches: [coin], createdAt: now,
      metrics: { likes: 0, reposts: 0, replies: 0 }, readTime: 1, score: price.usd,
    };
  });
  if (marketItems.length > 0) sections.push({ type: 'market', title: '💹 Market Summary', items: marketItems });

  // For You
  const forYou = scored.filter((s) => {
    const nicheMatch = s.post.niches.some((n) => preferredNiches.has(n.toLowerCase()));
    return nicheMatch && !(s.post.author && followed.has(s.post.author.id)) && s.score > 3;
  }).slice(0, 3);
  const forYouItems = forYou.map(toDigestItem);
  if (forYouItems.length > 0) sections.push({ type: 'for-you', title: '🎯 For You', items: forYouItems });

  // Catch Up
  const catchUp = scored.filter((s) => s.post.author && followed.has(s.post.author.id)).slice(0, 7);
  const catchUpItems = catchUp.map(toDigestItem);
  if (catchUpItems.length > 0) sections.push({ type: 'catch-up', title: '👋 Catch Up', items: catchUpItems });

  return sections;
}

function toDigestItem(s: { post: UnifiedPost; score: number }): DigestItem {
  const p = s.post;
  const link = p.embeds?.find((e) => e.kind === 'link')?.url || `https://degenfeed.xyz/post/${encodeURIComponent(p.id)}`;
  const title = p.text.slice(0, 140).replace(/\s+/g, ' ').trim() || `Post by ${p.author?.displayName ?? 'unknown'}`;
  const desc = stripTags(p.html || p.text).slice(0, 200);
  const img = p.embeds?.find((e) => e.kind === 'image')?.url;
  return {
    id: p.id, protocol: p.protocol, protocolColor: getProtocolColor(p.protocol),
    protocolEmoji: protocolEmoji(p.protocol as Protocol),
    author: { displayName: p.author?.displayName ?? 'unknown', avatarUrl: p.author?.avatarUrl },
    title, excerpt: desc, url: link, image: img, niches: p.niches ?? [], createdAt: p.createdAt,
    metrics: { likes: p.metrics?.likes ?? 0, reposts: p.metrics?.reposts ?? 0, replies: p.metrics?.replies ?? 0 },
    readTime: readTime(p.text), score: s.score,
  };
}

// ─── Full Digest Builder ──────────────────────────────────────────────────

async function buildDigestResponse(
  env: Env, wallet: string | null, niches: string[], protocols: Protocol[],
  preferredNiches: Set<string>, followed: Set<string>, engagedCreators: Set<string>,
  format: DigestFormatType = 'daily-brief',
): Promise<DigestResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const posts = await gatherDigestPosts(env, protocols, Array.from(preferredNiches), 150);
  const marketPrices = await fetchMarketPrices(env);
  const sections = buildDigestSections(posts, niches, followed, engagedCreators, preferredNiches, marketPrices);
  const editorial = generateEditorial(sections, marketPrices, today, format);

  const marketSummary: DigestResponse['marketSummary'] = {
    coins: Object.entries(marketPrices).map(([coin, price]) => ({
      symbol: { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' }[coin] ?? coin.toUpperCase(),
      price: price.usd, change24h: price.usd_24h_change ?? 0,
      sentiment: (price.usd_24h_change ?? 0) >= 1 ? 'bullish' : (price.usd_24h_change ?? 0) <= -1 ? 'bearish' : 'neutral',
    })),
  };

  const allScored = posts.map((p) => {
    const ageHours = (Date.now() - p.createdAt) / 3600000;
    return { post: p, score: Math.max(0, 1 - ageHours / 48) * 3 + (p.metrics.likes * 1 + p.metrics.reposts * 2 + p.metrics.replies * 3) };
  });
  allScored.sort((a, b) => b.score - a.score);
  const featured = allScored[0] ? toDigestItem(allScored[0]) : null;

  const totalWords = sections.reduce((sum, s) => sum + s.items.reduce((s2, i) => s2 + i.excerpt.split(/\s+/).length, 0), 0);
  const readTimeMinutes = Math.max(1, Math.ceil(totalWords / 200));

  const trendingTopics = sections.find((s) => s.type === 'trending')?.items.map((i) => ({
    topic: i.title, count: Number(i.excerpt.match(/\d+/)?.[0] ?? 0),
  })) ?? [];

  const shareParams = new URLSearchParams();
  if (wallet) shareParams.set('wallet', wallet);
  for (const niche of niches) shareParams.append('niches', niche);
  const shareUrl = `https://degenfeed.xyz/news/digest/${encodeURIComponent(today)}?${shareParams.toString()}`;

  return {
    date: today, wallet, sections, subject: editorial.subject, featured, format, shareUrl,
    editorial: { opening: editorial.opening, marketOverview: editorial.marketOverview, closing: editorial.closing },
    marketSummary,
    meta: { totalPosts: posts.length, totalSections: sections.length, fetchedAt: Date.now(), readTimeMinutes, trendingTopics },
  };
}

// ─── KV caching ───────────────────────────────────────────────────────────

export async function getCachedDigest(env: Env, date: string, wallet: string): Promise<DigestResponse | null> {
  if (!env.CACHE || !wallet) return null;
  try { const raw = await env.CACHE.get(`${DIGEST_CACHE_PREFIX}${date}:${wallet.toLowerCase()}`); return raw ? JSON.parse(raw) as DigestResponse : null; }
  catch { return null; }
}

export async function setCachedDigest(env: Env, date: string, wallet: string, digest: DigestResponse): Promise<void> {
  if (!env.CACHE || !wallet) return;
  try {
    const key = `${DIGEST_CACHE_PREFIX}${date}:${wallet.toLowerCase()}`;
    await env.CACHE.put(key, JSON.stringify(digest), { expirationTtl: DIGEST_CACHE_TTL });
    await env.CACHE.put(`${DIGEST_CACHE_PREFIX}archive:${date}:${wallet.toLowerCase()}`, JSON.stringify(digest), { expirationTtl: DIGEST_ARCHIVE_TTL });
  } catch { /* non-critical */ }
}

// ─── Route Handlers ────────────────────────────────────────────────────────

export async function handleDigestToday(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  const cookies = request.headers.get('cookie') ?? '';

  let resolvedWallet = wallet;
  if (!resolvedWallet) {
    const cookieMatch = cookies.split(';').map((s) => s.trim()).find((s) => s.startsWith('__Host-dfid='));
    if (cookieMatch) {
      try {
        const { verifySessionCookie } = await import('../../session');
        const payload = await verifySessionCookie(cookieMatch.slice('__Host-dfid='.length), env.AUTH_SECRET ?? '');
        resolvedWallet = payload?.address ?? null;
      } catch { /* session verify failed */ }
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  if (resolvedWallet) {
    const cached = await getCachedDigest(env, today, resolvedWallet);
    if (cached) return noCacheJsonResponse({ ...cached, meta: { ...cached.meta, cachedAt: cached.meta.fetchedAt } });
  }

  const formatParam = (url.searchParams.get('format') || 'daily-brief') as DigestFormatType;
  const validFormats: DigestFormatType[] = ['daily-brief', 'weekly-deep-dive', 'topic-digest', 'protocol-digest'];
  const format = validFormats.includes(formatParam) ? formatParam : 'daily-brief';

  const nichesParam = url.searchParams.get('niches') ?? '';
  const protocolsParam = url.searchParams.get('protocols') ?? '';
  const niches = nichesParam ? nichesParam.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean) : [];
  const protocols: Protocol[] = protocolsParam
    ? protocolsParam.split(',').map((p) => p.trim()).filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
    : DEFAULT_PROTOCOLS;

  let followed = new Set<string>();
  let engagedCreators = new Set<string>();
  const preferredNiches = new Set(niches);
  if (resolvedWallet && env.CACHE) {
    try {
      const [followsRaw, prefsRaw, creatorsRaw] = await Promise.all([
        env.CACHE.get(`user:follows:${resolvedWallet.toLowerCase()}`),
        env.CACHE.get(`user:prefs:${resolvedWallet.toLowerCase()}`),
        env.CACHE.get(`user:engaged_creators:${resolvedWallet.toLowerCase()}`),
      ]);
      if (followsRaw) followed = new Set(JSON.parse(followsRaw) as string[]);
      if (creatorsRaw) engagedCreators = new Set(JSON.parse(creatorsRaw) as string[]);
      if (prefsRaw) {
        const prefs = JSON.parse(prefsRaw) as { preferredNiches?: string[] };
        if (prefs.preferredNiches?.length) { for (const n of prefs.preferredNiches) preferredNiches.add(n.toLowerCase()); }
      }
    } catch { /* non-critical */ }
  }

  const digest = await buildDigestResponse(env, resolvedWallet, niches, protocols, preferredNiches, followed, engagedCreators, format);
  if (resolvedWallet) void setCachedDigest(env, today, resolvedWallet, digest);

  const htmlOutput = url.searchParams.get('html') === 'true';
  if (htmlOutput) {
    const html = buildRichDigestHtml(digest);
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, must-revalidate' } });
  }
  return noCacheJsonResponse(digest);
}

export async function handleDigestFormat(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const formatParam = (url.searchParams.get('type') || 'daily-brief') as DigestFormatType;
  const validFormats: DigestFormatType[] = ['daily-brief', 'weekly-deep-dive', 'topic-digest', 'protocol-digest'];
  const format = validFormats.includes(formatParam) ? formatParam : 'daily-brief';
  const wallet = url.searchParams.get('wallet') || null;
  const nichesParam = url.searchParams.get('niches') ?? '';
  const niches = nichesParam ? nichesParam.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean) : [];
  const protocolsParam = url.searchParams.get('protocols') ?? '';
  const protocols: Protocol[] = protocolsParam
    ? protocolsParam.split(',').map((p) => p.trim()).filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
    : DEFAULT_PROTOCOLS;
  const preferredNiches = new Set(niches);
  const digest = await buildDigestResponse(env, wallet, niches, protocols, preferredNiches, new Set(), new Set(), format);
  const htmlOutput = url.searchParams.get('html') === 'true';
  if (htmlOutput) {
    const html = buildRichDigestHtml(digest);
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, must-revalidate' } });
  }
  return noCacheJsonResponse(digest);
}

export async function handleDigestYesterday(request: Request, env: Env): Promise<Response> {
  const wallet = new URL(request.url).searchParams.get('wallet');
  if (!wallet || !env.CACHE) return noCacheJsonResponse({ error: 'Wallet required' }, 400);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const cached = await getCachedDigest(env, yesterday, wallet);
  if (!cached) return noCacheJsonResponse({ error: 'No digest available for yesterday', date: yesterday }, 404);
  return noCacheJsonResponse(cached);
}
