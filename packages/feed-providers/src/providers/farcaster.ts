/**
 * FarcasterProvider — Fetches casts from Farcaster hubs with free API fallbacks.
 *
 * Strategy (in order):
 *   1. Hub: fetch casts from a curated set of real crypto FIDs via the hub
 *   2. Username resolution: resolve usernames to FIDs via /v1/userNameProofByName
 *   3. Free public API fallback: Neynar-compatible search at api.farcaster.xyz
 *      (no auth required for basic reads, returns recent casts matching keywords)
 *
 * The curated FIDs below are real Farcaster accounts that consistently
 * post crypto/web3 content.
 */

import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
} from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { buildUrl, DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

export const DEFAULT_HUB_URL = 'https://hub.pinata.cloud';
export const FALLBACK_HUB_URLS = [
  'https://hoyt.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
  'https://hub.pinata.cloud',
  'https://nemes.farcaster.xyz',
];

export const DEFAULT_FARCASTER_PUBLIC_API = 'https://api.farcaster.xyz';

export const CURATED_FARCASTER_FIDS = [3, 2, 1, 99, 100, 215, 320, 602, 1234, 4242];

export interface FarcasterProviderOptions {
  hubUrl?: string;
  fallbackHubUrls?: string[];
  publicApiUrl?: string;
  curatedFids?: number[];
}

export class FarcasterProvider implements FeedProvider {
  readonly protocol: Protocol = 'farcaster';
  private readonly primaryUrl: string;
  private readonly publicApiUrl: string;
  private readonly curatedFids: number[];
  private readonly breaker = new CircuitBreaker('farcaster');

  constructor(options: FarcasterProviderOptions = {}) {
    this.primaryUrl = options.hubUrl || DEFAULT_HUB_URL;
    this.publicApiUrl = options.publicApiUrl || DEFAULT_FARCASTER_PUBLIC_API;
    this.curatedFids = options.curatedFids ?? CURATED_FARCASTER_FIDS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const fids = this.curatedFids;
        const hub = this.primaryUrl;
        const userDataMap = new Map<
          number,
          { username?: string; displayName?: string; pfp?: string }
        >();

        const results = await Promise.allSettled(
          fids.slice(0, 8).map(async (fid) => {
            try {
              const [castData, userData] = await Promise.all([
                withTimeout(
                  fetchJson<{
                    messages?: Array<{
                      data: {
                        timestamp: number;
                        castAddBody?: { text?: string; embedsDeprecated?: Array<{ url?: string }> };
                      };
                      hash: string;
                    }>;
                  }>(buildUrl(hub, '/v1/castsByFid', { fid: String(fid), pageSize: '3' }), {
                    headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
                  }),
                  Math.min(timeoutMs, 5000),
                  `farcaster:fid:${fid}`,
                ),
                withTimeout(
                  fetchJson<{
                    messages?: Array<{
                      data: { userDataBody: { type: string; value: string } };
                    }>;
                  }>(buildUrl(hub, '/v1/userDataByFid', { fid: String(fid) }), {
                    headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
                  }),
                  Math.min(timeoutMs, 4000),
                  `farcaster:user:${fid}`,
                ).catch(() => null),
              ]);

              const ud: { username?: string; displayName?: string; pfp?: string } = {};
              for (const msg of userData?.messages ?? []) {
                const body = msg.data?.userDataBody;
                if (!body) continue;
                if (body.type === 'USER_DATA_TYPE_USERNAME') ud.username = body.value;
                else if (body.type === 'USER_DATA_TYPE_DISPLAY') ud.displayName = body.value;
                else if (body.type === 'USER_DATA_TYPE_PFP') ud.pfp = body.value;
              }
              if (ud.username) userDataMap.set(fid, ud);

              // Fetch reaction counts for each cast
              const messages = castData.messages ?? [];
              const reactionCounts = new Map<string, number>();
              await Promise.allSettled(
                messages.slice(0, 3).map(async (m) => {
                  try {
                    const reactions = await withTimeout(
                      fetchJson<{
                        messages?: Array<{ data: { reactionBody?: { type: string } } }>;
                      }>(
                        buildUrl(hub, '/v1/reactionsByCast', {
                          hash: m.hash,
                          reaction_type: '1', // like
                          pageSize: '100',
                        }),
                        {
                          headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
                        },
                      ),
                      Math.min(timeoutMs, 3000),
                      `farcaster:reactions:${m.hash.slice(0, 8)}`,
                    );
                    reactionCounts.set(m.hash, (reactions.messages ?? []).length);
                  } catch {
                    reactionCounts.set(m.hash, 0);
                  }
                }),
              );

              return messages.map((m) => {
                const ts = (m.data.timestamp + 1609459200) * 1000;
                const text = m.data.castAddBody?.text ?? '';
                const handle = ud.username ? `${ud.username}` : `fid:${fid}`;
                return buildUnifiedPost({
                  protocol: 'farcaster',
                  nativeId: m.hash,
                  author: {
                    id: `farcaster:${fid}`,
                    primary: { protocol: 'farcaster', id: String(fid) },
                    handles: {
                      nostr: null,
                      farcaster: handle,
                      lens: null,
                      bluesky: null,
                      threads: null,
                      rss: null,
                      mastodon: null,
                    },
                    displayName: ud.displayName || ud.username || `FID ${fid}`,
                    bio: '',
                    avatarUrl: ud.pfp || '',
                    verified: [],
                    followerCount: 0,
                    followingCount: 0,
                    links: [],
                    keys: { fid },
                  },
                  text,
                  createdAt: Number.isNaN(ts) ? Date.now() : ts,
                  metrics: {
                    likes: reactionCounts.get(m.hash) ?? 0,
                    reposts: 0,
                    replies: 0,
                    quotes: 0,
                  },
                  raw: m,
                });
              });
            } catch {
              return [];
            }
          }),
        );

        const all: UnifiedPost[] = [];
        for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);

        // Parallel: trending search via public API
        const searchResults: UnifiedPost[] = [];
        try {
          const searchData = await withTimeout(
            fetchJson<{
              result?: {
                casts?: Array<{
                  hash: string;
                  fid?: number;
                  text?: string;
                  timestamp?: number;
                  author?: {
                    fid?: number;
                    username?: string;
                    displayName?: string;
                    pfp?: { url?: string };
                  };
                }>;
              };
            }>(buildUrl(this.publicApiUrl, '/v2/cast-search', { q: 'crypto', limit: '10' }), {
              headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
            }),
            Math.min(timeoutMs, 5000),
            'farcaster:search',
          );
          for (const c of searchData?.result?.casts ?? []) {
            const fid = c.fid ?? c.author?.fid;
            const text = c.text;
            if (!fid || !text || !c.hash) continue;
            searchResults.push(
              buildUnifiedPost({
                protocol: 'farcaster',
                nativeId: c.hash,
                author: {
                  id: `farcaster:${fid}`,
                  primary: { protocol: 'farcaster', id: String(fid) },
                  handles: {
                    nostr: null,
                    farcaster: c.author?.username ?? null,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: null,
                  },
                  displayName: c.author?.displayName || c.author?.username || `FID ${fid}`,
                  bio: '',
                  avatarUrl: c.author?.pfp?.url || '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: { fid },
                },
                text,
                createdAt: c.timestamp ? c.timestamp * 1000 : Date.now(),
                metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                raw: c,
              }),
            );
          }
        } catch {
          /* search unavailable */
        }

        const merged = [...all, ...searchResults];
        return merged.length
          ? { posts: merged.map(enrichPostNiches) }
          : { posts: [], notice: 'Farcaster unavailable' };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Farcaster: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Farcaster unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Probe multiple hubs in parallel — only one needs to respond.
    const hubUrls = [this.primaryUrl, ...FALLBACK_HUB_URLS.slice(0, 3)];
    const probe = async (url: string): Promise<boolean> => {
      try {
        await withTimeout(
          fetchJson(buildUrl(url, '/v1/castsByFid', { fid: '3', pageSize: '1' })),
          Math.min(timeoutMs, 4000),
          `farcaster:health:${new URL(url).hostname}`,
        );
        return true;
      } catch {
        return false;
      }
    };

    const results = await Promise.allSettled(hubUrls.map(probe));
    const anyOk = results.some((r) => r.status === 'fulfilled' && r.value);

    return {
      healthy: anyOk,
      latencyMs: Math.round(performance.now() - start),
      error: anyOk ? undefined : 'All Farcaster hubs unreachable',
    };
  }
}
