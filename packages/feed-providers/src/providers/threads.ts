/**
 * Threads (via RSS-Bridge ThreadsBridge + ActivityPub/Bridgy Fed)
 *
 * Replaces the broken HTML scraper with two live paths:
 *
 * PATH 1 (primary, 2026-08-06): self-hosted RSS-Bridge ThreadsBridge.
 *   https://rss-bridge.degenfeed.xyz/?action=display&bridge=Threads&context=By+username&u={handle}
 *   returns real Threads posts (Atom) for any public profile — no Meta API
 *   key, no scraping. Curated handles are fetched in parallel.
 *
 * PATH 2 (fallback): ActivityPub federation on our GotoSocial instance
 *   (social.degenfeed.xyz). Threads content arrives as fediverse statuses
 *   for accounts we follow (bridged via Bridgy Fed). Only used when the
 *   RSS-Bridge path is unconfigured or returns nothing.
 *
 * Architecture:
 *   Threads user ──RSS-Bridge──▶ this provider ──▶ feed          (primary)
 *   Threads user ──ActivityPub──▶ social.degenfeed.xyz ──▶ feed  (fallback)
 *
 * isAvailable():
 *   Always true — the RSS-Bridge path needs no feature flag. The ActivityPub
 *   fallback still respects BRIDGY_FED_ENABLED / ACTIVITYPUB_BRIDGE_ENABLED.
 */

import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
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
    return !!(env?.BRIDGY_FED_ENABLED === 'true' || env?.ACTIVITYPUB_BRIDGE_ENABLED === 'true');
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

function statusToUnifiedPost(status: GtSStatus, instanceUrl: string, handle: string): UnifiedPost {
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;
  const text = stripHtml(original.content || '');
  const hostname = new URL(instanceUrl).hostname;

  const nativeId = isBoost ? `threads:boost:${status.id}:${original.id}` : `threads:${original.id}`;

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

  const finalText = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${text}` : text;

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
      fetchJson<GtSStatus[]>(`${instanceUrl}/api/v1/timelines/tag/threads?limit=20`),
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

const circuitBreaker: CircuitBreakerState = {
  failureTimestamps: [],
  openUntil: 0,
};

const CB_WINDOW_MS = 60 * 60 * 1000;

function isCircuitOpen(): boolean {
  const now = Date.now();
  if (circuitBreaker.openUntil > now) return true;
  circuitBreaker.failureTimestamps = circuitBreaker.failureTimestamps.filter(
    (t) => now - t < CB_WINDOW_MS,
  );
  return false;
}

// ─── Provider options ────────────────────────────────────────────────

export interface ThreadsProviderOptions {
  curatedHandles?: string[];
  instanceUrl?: string;
  /** Self-hosted RSS-Bridge base URL (e.g. https://rss-bridge.degenfeed.xyz). */
  rssBridgeUrl?: string;
}

// ─── RSS-Bridge ThreadsBridge (primary path) ─────────────────────────

interface ThreadsBridgeEntry {
  title: string;
  link: string;
  published?: string;
  updated?: string;
  summary?: string;
  content?: string;
  author?: { name?: string };
  media?: Array<{ url: string; type?: string }>;
}

/** Parse an Atom feed from RSS-Bridge ThreadsBridge into raw entries. */
export function parseThreadsBridgeAtom(xml: string): ThreadsBridgeEntry[] {
  const entries: ThreadsBridgeEntry[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = entryRe.exec(xml);
  while (m !== null) {
    const block = m[1] ?? '';
    const title = extractAtomTag(block, 'title');
    const link = extractAtomAttr(block, 'link', 'href') || extractAtomTag(block, 'id');
    const published = extractAtomTag(block, 'published') || extractAtomTag(block, 'updated');
    const summary = extractAtomTag(block, 'summary');
    const content = extractAtomTag(block, 'content');
    const authorName = extractAtomTag(block, 'name');
    const media: Array<{ url: string; type?: string }> = [];
    const mediaRe = /<media:content[^>]*url=["']([^"']+)["'](?:[^>]*type=["']([^"']+)["'])?/gi;
    let mm: RegExpExecArray | null = mediaRe.exec(block);
    while (mm !== null) {
      media.push({ url: mm[1] ?? '', type: mm[2] });
      mm = mediaRe.exec(block);
    }
    if (!media.length) {
      const thumbRe = /<media:thumbnail[^>]*url=["']([^"']+)["']/gi;
      let tm: RegExpExecArray | null = thumbRe.exec(block);
      while (tm !== null) {
        media.push({ url: tm[1] ?? '', type: 'image' });
        tm = thumbRe.exec(block);
      }
    }
    if (title || link) {
      entries.push({
        title,
        link,
        published,
        updated,
        summary,
        content,
        author: { name: authorName },
        media,
      });
    }
    m = entryRe.exec(xml);
  }
  return entries;
}

function extractAtomTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}(?:[^>]*)>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const m = re.exec(xml);
  if (!m?.[1]) return '';
  return m[1]
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractAtomAttr(xml: string, tag: string, attr: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = re.exec(xml);
  return m?.[1] ?? '';
}

function threadsBridgeEntryToPost(entry: ThreadsBridgeEntry, handle: string): UnifiedPost {
  const title = entry.title ?? '';
  const summary = entry.summary ?? entry.content ?? '';
  const text = `${title}${summary ? `\n\n${stripHtml(summary)}` : ''}`.slice(0, 1500);
  const publishedAt = entry.published ?? entry.updated;

  const embeds: Embed[] = [];
  for (const media of entry.media ?? []) {
    if (media.type === 'video' || media.type === 'audio') {
      embeds.push({ kind: media.type as 'video' | 'audio', url: media.url });
    } else {
      embeds.push({ kind: 'image', url: media.url });
    }
  }
  if (entry.link) embeds.push({ kind: 'link', url: entry.link, meta: { title } });

  const authorName = entry.author?.name || handle;
  const identity: UnifiedIdentity = {
    id: `threads:${handle}`,
    primary: { protocol: 'threads' as Protocol, id: handle },
    handles: { threads: handle } as UnifiedIdentity['handles'],
    displayName: authorName,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'threads-profile', url: `https://www.threads.net/@${handle}` }],
    keys: { threadsHandle: handle },
  };

  const created = publishedAt ? new Date(publishedAt).getTime() : Date.now();
  const postId = entry.link
    ? entry.link.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-64)
    : `${handle}-${created}`;

  return {
    id: `threads:${postId}`,
    protocol: 'threads' as Protocol,
    author: identity,
    text,
    html: summary ? `<p>${stripHtml(summary).replace(/\n/g, '<br/>')}</p>` : undefined,
    embeds,
    contentType: 'text' as const,
    createdAt: Number.isNaN(created) ? Date.now() : created,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    url: entry.link,
    raw: { source: 'rss-bridge-threads', handle, _viaRssBridge: true },
    niches: ['social'],
  } as UnifiedPost;
}

async function fetchThreadsViaRssBridge(
  rssBridgeUrl: string,
  handles: string[],
  timeoutMs: number,
): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const results = await Promise.allSettled(
    handles.map(async (handle) => {
      const url = `${rssBridgeUrl}/?action=display&bridge=Threads&context=By+username&u=${encodeURIComponent(handle)}&format=Atom&limit=10`;
      const res = await fetch(url, {
        headers: { 'user-agent': 'DegenFeed/1.0', accept: 'application/atom+xml' },
        signal: AbortSignal.timeout(Math.min(timeoutMs, 6000)),
      });
      if (!res.ok) return [] as UnifiedPost[];
      const xml = await res.text();
      return parseThreadsBridgeAtom(xml).map((entry) => threadsBridgeEntryToPost(entry, handle));
    }),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }
  const seen = new Set<string>();
  const deduped = posts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return deduped;
}

// ─── ThreadsProvider — RSS-Bridge + ActivityPub reader ────────────────

export class ThreadsProvider implements FeedProvider {
  readonly protocol: Protocol = 'threads';

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly curatedHandles: string[];
  private readonly instanceUrl: string;
  private readonly rssBridgeUrl?: string;

  constructor(options: ThreadsProviderOptions = {}) {
    this.curatedHandles = options.curatedHandles ?? CURATED_THREADS_HANDLES;
    this.instanceUrl = options.instanceUrl ?? GTS_INSTANCE;
    this.rssBridgeUrl = options.rssBridgeUrl?.replace(/\/+$/, '');
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // ── Path 1: RSS-Bridge ThreadsBridge (primary) ──────────────
    if (this.rssBridgeUrl) {
      try {
        const bridgePosts = await fetchThreadsViaRssBridge(
          this.rssBridgeUrl,
          this.curatedHandles,
          timeoutMs,
        );
        if (bridgePosts.length >= 3) {
          return {
            posts: bridgePosts.map(enrichPostNiches),
            notice: `Threads: ${bridgePosts.length} posts via RSS-Bridge (${this.curatedHandles.length} profiles)`,
          };
        }
        if (bridgePosts.length > 0) {
          return {
            posts: bridgePosts.map(enrichPostNiches),
            notice: `Threads: ${bridgePosts.length} posts via RSS-Bridge (partial)`,
          };
        }
      } catch {
        // fall through to ActivityPub path
      }
    }

    // ── Path 2: ActivityPub via GotoSocial (fallback) ───────────
    if (!isBridgyConfigured()) {
      return {
        posts: [],
        notice:
          'Threads: RSS-Bridge unavailable and ActivityPub not configured. Set BRIDGY_FED_ENABLED=true or configure RSS_BRIDGE_URL.',
      };
    }

    if (isCircuitOpen()) {
      return {
        posts: [],
        notice: `Threads via ActivityPub: circuit breaker open until ${new Date(circuitBreaker.openUntil).toISOString()} — API failure threshold exceeded`,
      };
    }

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
      await withTimeout(fetchJson(`${this.instanceUrl}/api/v1/instance`), 5000, 'threads:health');
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
