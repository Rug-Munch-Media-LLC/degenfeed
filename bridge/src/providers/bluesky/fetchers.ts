/**
 * Bluesky Fetchers
 *
 * Rate Limit: 3000 requests/5 minutes (public API - app.bsky.app)
 * Rate Limit: self-hosted PDS is local, effectively unlimited
 */

import { checkRateLimit } from '../../../rate-limiter';
import type { UnifiedPost } from '../../../server';
import { postToUnified } from './mapper';
import type { BskyFeedResponse, BskyPostView } from './types';

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

/** Extract a blob CID from various AT Protocol ref formats */
function extractBlobCid(blob: unknown): string {
  if (!blob || typeof blob !== 'object') return '';
  const b = blob as Record<string, unknown>;
  const ref = b.ref;
  if (ref && typeof ref === 'object') {
    const r = ref as Record<string, unknown>;
    if (typeof r.$link === 'string') return r.$link;
    if (typeof r.link === 'string') return r.link;
    if (typeof r['/'] === 'string') return r['/'];
  }
  if (typeof b.$link === 'string') return b.$link;
  if (typeof b.link === 'string') return b.link;
  if (typeof b.cid === 'string') return b.cid;
  return '';
}

async function fetchFromPds(limit: number): Promise<UnifiedPost[]> {
  try {
    // Step 1: List all repos on the local PDS
    const listUrl = `${PDS_BASE}/xrpc/com.atproto.sync.listRepos?limit=30`;
    const listRes = await $fetch(listUrl, { signal: AbortSignal.timeout(5000) });
    if (!listRes.ok) {
      console.log(`[bluesky] PDS listRepos: HTTP ${listRes.status}`);
      return [];
    }
    const listData = (await listRes.json()) as {
      repos?: Array<{ did: string; active?: boolean }>;
    };
    const repos = (listData.repos ?? []).filter((r) => r.active !== false);
    if (repos.length === 0) {
      console.log('[bluesky] PDS: no repos found');
      return [];
    }
    console.log(`[bluesky] PDS: ${repos.length} repos found`);

    // Step 2: Fetch posts from each repo (up to 15 repos, limit total)
    const perRepo = Math.max(1, Math.ceil(limit / Math.min(repos.length, 15)));
    const repoSlice = repos.slice(0, 15);

    const results = await Promise.allSettled(
      repoSlice.map(async (repo) => {
        // 2a. Resolve handle for this DID
        let handle: string = repo.did;
        try {
          const descUrl = `${PDS_BASE}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(repo.did)}`;
          const descRes = await $fetch(descUrl, {
            signal: AbortSignal.timeout(3000),
          });
          if (descRes.ok) {
            const descData = (await descRes.json()) as { handle?: string };
            if (descData.handle) handle = descData.handle;
          }
        } catch {
          // fall back to DID as handle
        }

        // 2b. Fetch posts for this repo
        const recordsUrl = `${PDS_BASE}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(repo.did)}&collection=app.bsky.feed.post&limit=${Math.min(perRepo, 100)}`;
        const recordsRes = await $fetch(recordsUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (!recordsRes.ok) return [] as UnifiedPost[];
        const recordsData = (await recordsRes.json()) as {
          records?: Array<{
            uri: string;
            cid: string;
            value: {
              text?: string;
              createdAt?: string;
              embed?: Record<string, unknown>;
              reply?: { parent: { uri: string }; root: { uri: string } };
              $type?: string;
            };
          }>;
        };
        const records = (recordsData.records ?? []).filter((r) => r.value?.text?.trim());
        if (records.length === 0) return [] as UnifiedPost[];

        // 2c. Transform raw records into BskyPostView-compatible objects
        return records.map((record) => {
          const rawEmbed = record.value.embed;
          let embedImages:
            | Array<{
                image: { ref: { link: string } };
                alt: string;
                aspectRatio?: { width: number; height: number };
              }>
            | undefined;
          let embedExternal: { uri: string; title?: string; description?: string } | undefined;

          if (rawEmbed && typeof rawEmbed === 'object') {
            const e = rawEmbed as Record<string, unknown>;
            const images = e.images;
            if (Array.isArray(images)) {
              embedImages = images.map((img: Record<string, unknown>) => ({
                image: {
                  ref: {
                    link: extractBlobCid(img.image),
                  },
                },
                alt: (img.alt as string) || '',
                aspectRatio: img.aspectRatio as { width: number; height: number } | undefined,
              }));
            }
            const external = e.external;
            if (external && typeof external === 'object') {
              embedExternal = external as {
                uri: string;
                title?: string;
                description?: string;
              };
            }
          }

          // Build a minimal BskyPostView-compatible object
          const postView: BskyPostView = {
            uri: record.uri,
            cid: record.cid,
            author: {
              did: repo.did,
              handle,
              displayName: handle,
            },
            record: {
              text: record.value.text || '',
              createdAt: record.value.createdAt || new Date().toISOString(),
              embed:
                embedImages || embedExternal
                  ? {
                      external: embedExternal,
                      images: embedImages,
                    }
                  : undefined,
              reply: record.value.reply,
            },
            likeCount: 0,
            repostCount: 0,
            replyCount: 0,
            indexedAt: record.value.createdAt || new Date().toISOString(),
          };

          return postToUnified(postView);
        });
      }),
    );

    const allPosts: UnifiedPost[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    console.log(`[bluesky] PDS: ${allPosts.length} posts from local PDS`);
    return allPosts.slice(0, limit);
  } catch (err) {
    console.log(`[bluesky] PDS error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchAuthorFeed(actor: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${Math.min(limit, 50)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
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
  // Rate limit: 3000 requests/5 minutes (public API)
  if (!checkRateLimit('bluesky', { maxRequests: 3000, windowMs: 300_000 })) {
    console.log('[bluesky] Rate limited, skipping fetch');
    return [];
  }
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
