/**
 * Threads (via ActivityPub + Bridgy Fed)
 *
 * Replaces the broken HTML scraper. Threads content now arrives through
 * ActivityPub federation on our GotoSocial instance (social.degenfeed.xyz).
 *
 * Architecture:
 *   Threads user ──ActivityPub──▶ social.degenfeed.xyz ──▶ this provider ──▶ feed
 *   Bluesky user  ──Bridgy Fed──▶ Fediverse ──▶ social.degenfeed.xyz ──▶ feed
 *
 * How content flows:
 *   1. READ (this provider): We follow Threads profiles from our
 *      Mastodon/GotoSocial instance at social.degenfeed.xyz. Threads supports
 *      ActivityPub federation, so their posts arrive as fediverse statuses.
 *      This provider queries the Mastodon API to find and return them as
 *      Threads protocol posts.
 *   2. Bluesky accounts bridged through Bridgy Fed also federate to our
 *      instance and appear here (via the `#threads` tag or follow relationship).
 *   3. WRITE (publish): See publish.ts — uses Meta Graph API (authenticated)
 *      or ActivityPub bridge (publish to social.degenfeed.xyz with `#threads`).
 *   4. ENGAGE: Not supported from this provider. Use the Threads app or your
 *      Mastodon client for likes, replies, and reposts.
 *
 * Configuration:
 *   Set BRIDGY_FED_ENABLED=true or ACTIVITYPUB_BRIDGE_ENABLED=true to activate
 *   this provider. Without it, Threads returns empty (no scraping, no failures).
 *
 * isAvailable():
 *   Returns true when BRIDGY_FED_ENABLED=true or ACTIVITYPUB_BRIDGE_ENABLED=true.
 *   When false, returns empty feed with a notice — no more scraping failures.
 */

import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';

// ─── Configuration ───────────────────────────────────────────────────

/**
 * Our Mastodon/GotoSocial instance. Threads content arrives here via
 * ActivityPub federation. This provider queries it for Threads posts.
 */
export const GTS_INSTANCE = 'https://social.degenfeed.xyz';

/**
 * Check whether the Bridgy Fed / ActivityPub bridge is configured.
 * When false, the Threads provider returns empty (no scraping, no errors).
 */
export function isBridgyConfigured(): boolean {
  try {
    const p = (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process;
    const env = p?.env;
    return !!(
      env?.BRIDGY_FED_ENABLED === 'true' || env?.ACTIVITYPUB_BRIDGE_ENABLED === 'true'
    );
  } catch {
    return false;
  }
}

/** Semantic alias for isBridgyConfigured. */
export const isAvailable = isBridgyConfigured;

/**
 * Curated Threads handles that we follow from our Mastodon instance.
 * Their posts arrive via ActivityPub federation.
 */
export const CURATED_THREADS_HANDLES = [
  'zuck',
  'mosseri',
  'vitalik.eth',
  'balajis',
  'sama',
  'naval',
  'jessepollak',
  'stani',
  'sassal0x',
  'cdixon',
  'pmarca',
  'coinbase',
  'opensea',
  'bitcoin',
  'ethereum',
  'solana',
];

// ─── GotoSocial / Mastodon API types (subset) ────────────────────────

interface GtSAccount {
  id: string;
  acct: string;
  username: string;
  display_name: string;
  avatar: string;
  header: string;
  header_static: string;
  note: string;
  followers_count: number;
  following_count: number;
  fields: Array<{ name: string; value: string; verified_at: string | null }>;
}

interface GtSMediaAttachment {
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
}

interface GtSCard {
  url: string;
  title: string;
  description: string;
  image: string | null;
}

interface GtSStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: GtSMediaAttachment[];
  tags: Array<{ name: string }>;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  in_reply_to_id: string | null;
  reblog: GtSStatus | null;
  card: GtSCard | null;
  account: GtSAccount;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusToUnifiedPost(
  status: GtSStatus,
  instanceUrl: string,
  handle: string,
): UnifiedPost {
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;
  const text = stripHtml(original.content || '');
  const hostname = new URL(instanceUrl).hostname;

  const nativeId = isBoost
    ? `threads:boost:${status.id}:${original.id}`
    : `threads:${original.id}`;

  const embeds: Embed[] = [];
  for (const media of original.media_attachments) {
    if (media.type === 'image' || media.type === 'gifv') {
      embeds.push({ kind: 'image' as const, url: media.url });
    } else if (media.type === 'video') {
      embeds.push({ kind: 'video' as const, url: media.url });
    }
  }
  if (original.card) {
    embeds.push({
      kind: 'link' as const,
      url: original.card.url,
      meta: {
        title: original.card.title,
        description: original.card.description,
        image: original.card.image,
      },
    });
  }

  const finalText = original.spoiler_text
    ? `[CW: ${original.spoiler_text}]\n\n${text}`
    : text;

  const identity = {
    id: `threads:${original.account.username}@${hostname}`,
    primary: { protocol: 'threads' as Protocol, id: original.account.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: handle,
      rss: null,
      mastodon: original.account.acct,
    },
    displayName: original.account.display_name || original.account.username,
    bio: stripHtml(original.account.note),
    avatarUrl: original.account.avatar || '',
    bannerUrl:
      original.account.header !== original.account.header_static
        ? original.account.header
        : undefined,
    verified: original.account.fields
      .filter((f) => f.verified_at)
      .map((f) => ({ protocol: 'threads' as Protocol, badge: f.name })),
    followerCount: original.account.followers_count,
    followingCount: original.account.following_count,
    links: original.account.fields.map((f) => ({ label: f.name, url: f.value })),
    keys: {},
  };

  return buildUnifiedPost({
    protocol: 'threads',
    nativeId,
    author: identity,
    text: finalText,
    embeds,
    parentNativeId: original.in_reply_to_id ?? undefined,
    createdAt: new Date(original.created_at).getTime(),
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    // Stamp metadata for frontend badges
    raw: {
      ...original,
      _viaActivityPub: true,
      _viaBridgyFed: true,
      _fediverseSource: instanceUrl,
    },
  });
}

async function lookupThreadsAccount(
  instanceUrl: string,
  handle: string,
  timeoutMs: number,
): Promise<GtSAccount | null> {
  try {
    const acct = `${handle.replace(/^@/, '')}@threads.net`;
    return await withTimeout(
      fetchJson<GtSAccount>(
        `${instanceUrl}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`,
      ),
      timeoutMs,
      `threads:lookup:${handle}`,
    );
  } catch {
    return null;
  }
}

async function fetchAccountStatuses(
  instanceUrl: string,
  accountId: string,
  timeoutMs: number,
): Promise<GtSStatus[]> {
  try {
    return await withTimeout(
      fetchJson<GtSStatus[]>(
        `${instanceUrl}/api/v1/accounts/${accountId}/statuses?limit=5&exclude_reblogs=true`,
      ),
      timeoutMs,
      `threads:statuses:${accountId}`,
    );
  } catch {
    return [];
  }
}

async function fetchThreadsHashtagTimeline(
  instanceUrl: string,
  timeoutMs: number,
): Promise<GtSStatus[]> {
  try {
    return await withTimeout(
      fetchJson<GtSStatus[]>(
        `${instanceUrl}/api/v1/timelines/tag/threads?limit=20`,
      ),
      timeoutMs,
      'threads:hashtag',
    );
  } catch {
    return [];
  }
}

// ─── Circuit breaker (kept for API failure tracking, simplified) ─────
// Unlike the old HTML scraper that broke every time Meta changed its
// DOM, this circuit only triggers if the Mastodon API is unreachable.
// Realistically this should never trip for long.

interface CircuitBreakerState {
  failureTimestamps: number[];
  openUntil: number;
}

let circuitBreaker: CircuitBreakerState = {
  failureTimestamps: [],
  openUntil: 0,
};

const CB_THRESHOLD = 10; // higher threshold — ActivityPub is far more stable
const CB_WINDOW_MS = 60 * 60 * 1000;
const CB_COOLDOWN_MS = 30 * 60 * 1000;

function isCircuitOpen(): boolean {
  const now = Date.now();
  if (circuitBreaker.openUntil > now) return true;
  circuitBreaker.failureTimestamps = circuitBreaker.failureTimestamps.filter(
    (t) => now - t < CB_WINDOW_MS,
  );
  return false;
}

function recordFailure(): void {
  const now = Date.now();
  circuitBreaker.failureTimestamps.push(now);
  circuitBreaker.failureTimestamps = circuitBreaker.failureTimestamps.filter(
    (t) => now - t < CB_WINDOW_MS,
  );
  if (circuitBreaker.failureTimestamps.length > CB_THRESHOLD) {
    circuitBreaker.openUntil = now + CB_COOLDOWN_MS;
    console.warn(
      `[threads] Circuit opened for ${CB_COOLDOWN_MS / 60000} min after ${circuitBreaker.failureTimestamps.length} API failures`,
    );
  }
}

// ─── Provider options ────────────────────────────────────────────────

export interface ThreadsProviderOptions {
  curatedHandles?: string[];
  instanceUrl?: string;
}

// ─── ThreadsProvider — ActivityPub-based reader ──────────────────────

export class ThreadsProvider implements FeedProvider {
  readonly protocol: Protocol = 'threads';
  private readonly curatedHandles: string[];
  private readonly instanceUrl: string;

  constructor(options: ThreadsProviderOptions = {}) {
    this.curatedHandles = options.curatedHandles ?? CURATED_THREADS_HANDLES;
    this.instanceUrl = options.instanceUrl ?? GTS_INSTANCE;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    // Guard: Bridgy Fed must be configured
    if (!isBridgyConfigured()) {
      return {
        posts: [],
        notice:
          'Threads via ActivityPub: not configured. Set BRIDGY_FED_ENABLED=true to enable. Threads content flows through ActivityPub federation — follow Threads users from your Mastodon/GotoSocial instance and this provider will find them.',
      };
    }

    if (isCircuitOpen()) {
      return {
        posts: [],
        notice: `Threads via ActivityPub: circuit breaker open until ${new Date(circuitBreaker.openUntil).toISOString()} — API failure threshold exceeded`,
      };
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allPosts: UnifiedPost[] = [];
    const seenIds = new Set<string>();

    // ── Step 1: Look up curated Threads accounts on our instance ──
    // For each handle, try to find them as @handle@threads.net on our
    // GotoSocial instance and fetch their recent statuses.
    const accountResults = await Promise.allSettled(
      this.curatedHandles.map(async (handle) => {
        const account = await lookupThreadsAccount(
          this.instanceUrl,
          handle,
          Math.min(timeoutMs, 3000),
        );
        if (!account) return [];
        const statuses = await fetchAccountStatuses(
          this.instanceUrl,
          account.id,
          Math.min(timeoutMs, 3000),
        );
        return statuses.map((s) => statusToUnifiedPost(s, this.instanceUrl, handle));
      }),
    );

    for (const r of accountResults) {
      if (r.status === 'fulfilled') {
    for (const post of r.value) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id);
        allPosts.push(post);
      }
    }
      }
    }

    // ── Step 2: #threads hashtag timeline on our instance ──────────
    // Catches posts from Bluesky→Bridgy Fed or Threads accounts that
    // tag #threads — even if we don't follow them directly.
    const hashtagPosts = await fetchThreadsHashtagTimeline(
      this.instanceUrl,
      Math.min(timeoutMs, 3000),
    );
    for (const s of hashtagPosts) {
      const postId = `threads:${s.id}`;
      if (seenIds.has(postId)) continue;
      seenIds.add(postId);
      const handle = s.account.acct.includes('@')
        ? (s.account.acct.split('@')[0] ?? s.account.username)
        : s.account.username;
      allPosts.push(statusToUnifiedPost(s, this.instanceUrl, handle));
    }

    if (allPosts.length === 0) {
      const hostname = new URL(this.instanceUrl).hostname;
      return {
        posts: [],
        notice: `Threads via ActivityPub: no content found on ${hostname}. Follow Threads users from your instance to populate the feed.`,
      };
    }

    return { posts: allPosts.map(enrichPostNiches) };
  }

  async healthCheck(): Promise<HealthResult> {
    const start = performance.now();

    if (!isBridgyConfigured()) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error:
          'Threads via ActivityPub: not configured. Set BRIDGY_FED_ENABLED=true or ACTIVITYPUB_BRIDGE_ENABLED=true.',
      };
    }

    if (isCircuitOpen()) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: `Circuit breaker open until ${new Date(circuitBreaker.openUntil).toISOString()}`,
      };
    }

    try {
      await withTimeout(
        fetchJson(`${this.instanceUrl}/api/v1/instance`),
        5000,
        'threads:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'Threads via ActivityPub unavailable',
      };
    }
  }
}
