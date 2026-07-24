import type { UnifiedPost } from '../../../server';
import { postToUnified } from './mapper';
import type { BskyFeedResponse } from './types';
const $fetch = globalThis.fetch;

const PDS_BASE = 'http://127.0.0.1:3012';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

const CURATED_ACTORS = [
  'jay.bsky.social',
  'naval.bsky.social',
  'balajis.com',
  'vitalik.eth.xyz',
  'a16z.com',
  'coinbase.com',
  'solana.com',
  'defi.bsky.social',
  'pmarca.bsky.social',
  'cdixon.bsky.social',
  'tier10k.bsky.social',
  'autismcapital.bsky.social',
  'karbonbased.bsky.social',
  'crypto_birb.bsky.social',
];
const SEARCH_QUERIES = [
  'bitcoin OR btc',
  'ethereum OR eth',
  'solana',
  'crypto',
  'defi',
  'ai',
  'web3',
];
const TRENDING_QUERY = 'crypto OR bitcoin OR ethereum OR solana OR defi';

async function fetchFromPds(_limit: number): Promise<UnifiedPost[]> {
  try {
    const infoRes = await $fetch(`${PDS_BASE}/xrpc/com.atproto.server.describeServer`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!infoRes.ok) return [];
    const info = (await infoRes.json()) as { did?: string };
    if (!info.did) return [];
    const syncRes = await $fetch(
      `${PDS_BASE}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(info.did)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!syncRes.ok) return [];
    return [];
  } catch {
    return [];
  }
}

async function fetchAuthorFeed(actor: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${Math.min(limit, 50)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as BskyFeedResponse;
    return (
      data.feed
        ?.map((f) => f.post)
        .filter(Boolean)
        .slice(0, limit)
        .map(postToUnified) ?? []
    );
  } catch {
    return [];
  }
}

async function searchPosts(query: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}&sort=latest`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as BskyFeedResponse;
    return data.posts?.slice(0, limit).map(postToUnified) ?? [];
  } catch {
    return [];
  }
}

async function fetchAllCuratedPosts(limit: number): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const actorsToFetch = CURATED_ACTORS.slice(0, 8);
  const perActor = Math.max(3, Math.ceil(limit / actorsToFetch.length));
  const results = await Promise.allSettled(actorsToFetch.map((a) => fetchAuthorFeed(a, perActor)));
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  const seen = new Set<string>();
  return all
    .filter((p) => {
      const k = p.text.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

export async function fetchBlueskyImageFeed(limit = 30): Promise<UnifiedPost[]> {
  const all = await fetchAllCuratedPosts(Math.ceil(limit * 2));
  if (all.filter((p) => p.embeds.some((e) => e.kind === 'image')).length < limit) {
    const results = await Promise.allSettled(
      ['crypto crypto', 'bitcoin chart', 'nft art'].map((q) =>
        searchPosts(q, Math.ceil(limit / 2)),
      ),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }
  const filtered = all.filter((p) => p.embeds.some((e) => e.kind === 'image'));
  const seen = new Set<string>();
  const deduped = filtered
    .filter((p) => {
      const k = p.text.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
  console.log(`[bridge] Bluesky Image Feed: ${deduped.length} posts`);
  return deduped;
}

export async function fetchBlueskyVideoFeed(limit = 20): Promise<UnifiedPost[]> {
  const all = await fetchAllCuratedPosts(Math.ceil(limit * 2));
  const filtered = all.filter((p) => p.embeds.some((e) => e.kind === 'link' || e.kind === 'video'));
  const seen = new Set<string>();
  const deduped = filtered
    .filter((p) => {
      const k = p.text.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
  console.log(`[bridge] Bluesky Video Feed: ${deduped.length} posts`);
  return deduped;
}

export async function fetchBlueskyTrending(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const trending = await searchPosts(TRENDING_QUERY, Math.ceil(limit * 1.5));
  all.push(...trending);
  if (all.length < limit / 2) {
    const curated = await fetchAllCuratedPosts(Math.ceil(limit / 2));
    all.push(...curated);
  }
  const seen = new Set<string>();
  const deduped = all
    .filter((p) => {
      const k = p.text.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
  console.log(`[bridge] Bluesky Trending: ${deduped.length} posts`);
  return deduped;
}

export async function fetchBlueskyPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const pdsPosts = await fetchFromPds(Math.ceil(limit / 4));
  all.push(...pdsPosts);
  const actorsToFetch = CURATED_ACTORS.slice(0, 6);
  const results = await Promise.allSettled(
    actorsToFetch.map((a) =>
      fetchAuthorFeed(a, Math.max(2, Math.ceil(limit / actorsToFetch.length))),
    ),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  if (all.length < limit / 2) {
    const searchResults = await Promise.allSettled(
      SEARCH_QUERIES.slice(0, 4).map((q) => searchPosts(q, Math.max(3, Math.ceil(limit / 4)))),
    );
    for (const r of searchResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }
  const seen = new Set<string>();
  const deduped = all
    .filter((p) => {
      const k = p.text.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
  console.log(`[bridge] Bluesky: ${deduped.length} posts (PDS: ${pdsPosts.length})`);
  return deduped;
}

export const schema = {
  id: 'bluesky',
  name: 'Bluesky/PDS',
  description: 'AT Protocol social network \u2014 curated actors + search',
  endpoint: '/api/feed/bluesky',
  requiresAuth: false,
  contentType: 'mixed',
};
export const fetch = fetchBlueskyPosts;
