import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
  extractEmbeds,
} from '@degenfeed/feed-core';
import type { MediaAttachment, Protocol, UnifiedPost } from '@degenfeed/types';
import { isNostrEvent } from '../schemas';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  fetchWithFallbacks,
  withTimeout,
} from '../utils';

export const DEFAULT_RELAYS = [
  'ws://127.0.0.1:8085',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  // Expanded 2026-08-06 — popular public relays verified reachable.
  'wss://relay.nostr.net',
  'wss://offchain.pub',
  'wss://eden.nostr.land',
  'wss://relay.0xchat.com',
  'wss://nostr.mom',
  'wss://atlas.nostr.land',
  'wss://nostr.oxtr.dev',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.einundzwanzig.space',
  'wss://nostr.land',
  'wss://no.str.cr',
  'wss://yabu.me',
  'wss://relay.nostr.nu',
];

export const CRYPTO_HASHTAGS = [
  'bitcoin',
  'ethereum',
  'solana',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'altcoin',
];

export const POPULAR_HASHTAGS = [
  'bitcoin',
  'nostr',
  'crypto',
  'dev',
  'art',
  'music',
];

export const FALLBACK_HTTP_ENDPOINTS = [
  'https://api.nostr.band/v0/events.json',
  'https://relay.nostr.band',
];

/** nostr.band trending API — returns high-engagement notes network-wide. */
export const TRENDING_HTTP_ENDPOINTS = [
  'https://api.nostr.band/v0/trending/notes',
  'https://nostr.band/v0/trending/notes',
];

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * nostr.band trending response shape — a map of event id → detail.
 * The detail carries engagement data (reactions, reposts, zaps) that we
 * stamp into UnifiedPost metrics so the feed is engagement-rich.
 */
interface NostrBandTrendingResponse {
  notes?: Record<
    string,
    {
      event?: NostrEvent;
      reactions?: { total?: number };
      reposts?: { total?: number };
      zaps?: { total?: number };
      replies?: { total?: number };
    }
  >;
}

interface NostrEventWithEngagement extends NostrEvent {
  __reactions?: number;
  __reposts?: number;
  __replies?: number;
  __zaps?: number;
}

function eventToUnifiedPost(event: NostrEvent): UnifiedPost {
  let parentNativeId: string | undefined;
  let rootNativeId: string | undefined;
  let embeds: { kind: 'quote'; url: string; meta?: Record<string, unknown> }[] = [];

  for (const tag of event.tags) {
    if (tag[0] === 'e' && tag[3] === 'root') rootNativeId = tag[1];
    else if (tag[0] === 'e' && tag[3] === 'reply') parentNativeId = tag[1];
  }
  if (!parentNativeId && !rootNativeId) {
    const firstE = event.tags.find((t) => t[0] === 'e');
    if (firstE) rootNativeId = firstE[1];
  }

  let text = event.content;
  if (event.kind === 6) {
    try {
      const originalEvent = JSON.parse(event.content) as NostrEvent;
      text = originalEvent.content;
      embeds = [{ kind: 'quote', url: `nostr:${originalEvent.id}`, meta: { originalEvent } }];
    } catch {
      // keep original
    }
  }

  // ── Media extraction from tags + content ─────────────────────────
  // Nostr events attach media via ["imeta", "url <u>", "dim <w>x<h>", ...]
  // or legacy ["picture", "<url>"] tags. Some clients also leave image
  // URLs directly in the content — extract those too as a fallback.
  const media: MediaAttachment[] = [];
  const mediaSeen = new Set<string>();
  const pushMedia = (url: string | undefined, type = 'image'): void => {
    if (!url) return;
    if (mediaSeen.has(url)) return;
    mediaSeen.add(url);
    media.push({ type, url });
  };
  for (const tag of event.tags) {
    if (!Array.isArray(tag)) continue;
    if (tag[0] === 'imeta') {
      let url = '';
      let dim = '';
      for (const part of tag) {
        if (typeof part !== 'string') continue;
        if (part.startsWith('url ')) url = part.slice(4).trim();
        else if (part.startsWith('dim ')) dim = part.slice(4).trim();
      }
      const [w, h] = dim.split('x').map((n) => Number.parseInt(n, 10));
      if (url) {
        const type = /\.(?:mp4|webm|mov|m4v)(?:\?|$)/i.test(url) ? 'video' : 'image';
        media.push({
          type,
          url,
          width: Number.isFinite(w) ? w : undefined,
          height: Number.isFinite(h) ? h : undefined,
        });
        mediaSeen.add(url);
      }
    } else if (tag[0] === 'picture' && typeof tag[1] === 'string') {
      pushMedia(tag[1]);
    }
  }
  // Fallback: scan content for image/video URLs
  const contentUrlRe = /https?:\/\/[^\s<>"']+/gi;
  for (const u of text.match(contentUrlRe) ?? []) {
    if (/\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?|$)/i.test(u)) pushMedia(u);
    else if (/\.(?:mp4|webm|mov)(?:\?|$)/i.test(u)) pushMedia(u, 'video');
  }

  return buildUnifiedPost({
    protocol: 'nostr',
    nativeId: event.id,
    author: {
      id: `nostr:${event.pubkey}`,
      primary: { protocol: 'nostr', id: event.pubkey },
      handles: {
        nostr: event.pubkey.slice(0, 12),
        farcaster: null,
        lens: null,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: event.pubkey.slice(0, 12),
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { nostrPubkey: event.pubkey },
    },
    text,
    html: text,
    embeds: extractEmbeds(text, embeds),
    media,
    parentNativeId,
    rootNativeId,
    createdAt: event.created_at * 1000,
    metrics: {
      likes: (event as NostrEventWithEngagement).__reactions ?? 0,
      reposts: (event as NostrEventWithEngagement).__reposts ?? 0,
      replies: (event as NostrEventWithEngagement).__replies ?? 0,
      quotes: 0,
    },
    viewer: { liked: false, reposted: false },
    raw: event,
  });
}

function fetchFromWebSocket(
  relayUrl: string,
  limit: number,
  timeoutMs: number,
  filters?: Array<Record<string, unknown>>,
): Promise<NostrEvent[]> {
  return new Promise((resolve, reject) => {
    const events: NostrEvent[] = [];
    const subId = `df-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      cleanup();
      resolve(events);
    }, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }

    const cleanup = () => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    ws.onopen = () => {
      try {
        const filters_ =
          filters && filters.length > 0
            ? filters
            : [
                {
                  kinds: [1],
                  limit: limit * 3,
                  // NIP-01 tag filters: the '#t' key matches the 't' tag
                  // and the array holds the tag VALUES — no '#' prefix.
                  '#t': [...CRYPTO_HASHTAGS.slice(0, 10), ...POPULAR_HASHTAGS],
                },
              ];
        ws.send(JSON.stringify(['REQ', subId, ...filters_]));
      } catch {
        cleanup();
        resolve(events);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as unknown[];
        if (Array.isArray(data) && data[0] === 'EVENT' && data[2]) {
          const ev = data[2] as unknown;
          if (!isNostrEvent(ev)) {
            console.warn('[nostr] malformed event received, skipping', typeof ev);
            return;
          }
          events.push(ev as NostrEvent);
        } else if (Array.isArray(data) && data[0] === 'EOSE') {
          cleanup();
          resolve(events);
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => {
      cleanup();
      resolve(events);
    };

    ws.onclose = () => {
      clearTimeout(timer);
      resolve(events);
    };
  });
}

async function fetchFromRelays(
  relays: string[],
  limit: number,
  timeoutMs: number,
  filters?: Array<Record<string, unknown>>,
): Promise<NostrEvent[]> {
  const results = await Promise.allSettled(
    relays.map((relay) =>
      withTimeout(
        fetchFromWebSocket(relay, limit, timeoutMs, filters),
        timeoutMs,
        `nostr:${relay}`,
      ),
    ),
  );
  // Merge across relays: keep the first copy of each event and count
  // how many relays delivered it (multi-relay = quality signal).
  const byId = new Map<string, NostrEvent & { __relayCount?: number }>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value) {
      const existing = byId.get(ev.id);
      if (existing) {
        existing.__relayCount = (existing.__relayCount ?? 1) + 1;
      } else {
        byId.set(ev.id, { ...ev, __relayCount: 1 });
      }
    }
  }
  return Array.from(byId.values());
}

async function fetchFromHttp(limit: number, _timeoutMs: number): Promise<NostrEvent[]> {
  return fetchWithFallbacks(FALLBACK_HTTP_ENDPOINTS, async (base) => {
    const params: Record<string, string> = { limit: String(limit * 3) };
    if (base.includes('api.nostr.band')) {
      params.kinds = '1';
      params['#t'] = [...CRYPTO_HASHTAGS.slice(0, 5), ...POPULAR_HASHTAGS.slice(0, 3)].join(',');
    }
    const url = buildUrl(base, '', params);
    const data = await fetchJson<{ events?: NostrEvent[] }>(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
    });
    return data.events ?? [];
  });
}

/**
 * Fetch trending notes from nostr.band's trending API. Returns notes
 * with real engagement data (reactions/reposts/zaps) stamped on each
 * event so the feed surfaces the most popular content network-wide.
 */
async function fetchTrendingNotes(_timeoutMs: number): Promise<NostrEventWithEngagement[]> {
  return fetchWithFallbacks(TRENDING_HTTP_ENDPOINTS, async (base) => {
    const url = `${base.replace(/\/$/, '')}?limit=60`;
    const data = await fetchJson<NostrBandTrendingResponse>(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
    });
    const notes = data.notes ?? {};
    const events: NostrEventWithEngagement[] = [];
    for (const detail of Object.values(notes)) {
      if (!detail?.event) continue;
      const ev = detail.event as NostrEventWithEngagement;
      ev.__reactions = detail.reactions?.total ?? 0;
      ev.__reposts = detail.reposts?.total ?? 0;
      ev.__replies = detail.replies?.total ?? 0;
      ev.__zaps = detail.zaps?.total ?? 0;
      events.push(ev);
    }
    return events;
  });
}

export interface NostrProviderOptions {
  relays?: string[];
}

export class NostrProvider implements FeedProvider {
  readonly protocol: Protocol = 'nostr';

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly relays: string[];

  private readonly breaker = new CircuitBreaker('nostr');

  constructor(options: NostrProviderOptions = {}) {
    this.relays = options.relays ?? DEFAULT_RELAYS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const limit = 100;

        const [notes, articles, trending] = await Promise.allSettled([
          this.fetchNotes(timeoutMs, limit),
          this.fetchLongForm(timeoutMs, Math.ceil(limit / 4)),
          // Best-effort trending — never blocks the main feed.
          withTimeout(fetchTrendingNotes(Math.min(timeoutMs, 6000)), Math.min(timeoutMs, 6000), 'nostr:trending').catch(
            () => [] as NostrEventWithEngagement[],
          ),
        ]);

        const allEvents: NostrEvent[] = [
          ...(notes.status === 'fulfilled' ? notes.value : []),
          ...(articles.status === 'fulfilled' ? articles.value : []),
          ...(trending.status === 'fulfilled' ? trending.value : []),
        ];
        if (allEvents.length > 0) {
          // Prioritize trending (high engagement) above raw relay notes.
          const seen = new Set<string>();
          const unique = allEvents
            .sort((a, b) => {
              const engA =
                ((a as NostrEventWithEngagement).__reactions ?? 0) +
                ((a as NostrEventWithEngagement).__reposts ?? 0) * 2 +
                ((a as NostrEventWithEngagement).__replies ?? 0);
              const engB =
                ((b as NostrEventWithEngagement).__reactions ?? 0) +
                ((b as NostrEventWithEngagement).__reposts ?? 0) * 2 +
                ((b as NostrEventWithEngagement).__replies ?? 0);
              return engB - engA;
            })
            .filter((e) => {
              if (seen.has(e.id)) return false;
              seen.add(e.id);
              return true;
            })
            .slice(0, limit);

          const posts = unique.map((e) => enrichPostNiches(eventToUnifiedPost(e)));

          // Resolve profiles: fetch kind 0 metadata for unique pubkeys
          const pubkeys = [...new Set(unique.map((e) => e.pubkey))];
          const profiles = await this.resolveProfiles(pubkeys, timeoutMs);

          for (const post of posts) {
            const pk = post.author.keys?.nostrPubkey as string;
            const profile = pk ? profiles.get(pk) : undefined;
            if (profile) {
              post.author.displayName = profile.displayName || post.author.displayName;
              post.author.avatarUrl = profile.avatarUrl || post.author.avatarUrl;
              post.author.bio = profile.bio || post.author.bio;
              if (profile.nip05) post.author.handles.nostr = profile.nip05;
            }
          }

          return { posts };
        }
        return { posts: [], notice: 'Nostr feed unavailable' };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Nostr: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Nostr feed unavailable' };
    }
  }

  private async resolveProfiles(
    pubkeys: string[],
    timeoutMs: number,
  ): Promise<
    Map<string, { displayName?: string; avatarUrl?: string; bio?: string; nip05?: string }>
  > {
    const profiles = new Map<
      string,
      { displayName?: string; avatarUrl?: string; bio?: string; nip05?: string }
    >();
    if (pubkeys.length === 0) return profiles;

    try {
      const filters = pubkeys.map((pk) => ({ kinds: [0], authors: [pk], limit: 1 }));
      const events = await fetchFromRelays(
        this.relays.slice(0, 3),
        50,
        Math.min(timeoutMs, 4000),
        filters,
      );
      for (const ev of events) {
        if (ev.kind !== 0) continue;
        try {
          const content = JSON.parse(ev.content) as {
            name?: string;
            display_name?: string;
            displayName?: string;
            picture?: string;
            about?: string;
            nip05?: string;
          };
          profiles.set(ev.pubkey, {
            displayName: content.display_name || content.displayName || content.name,
            avatarUrl: content.picture,
            bio: content.about,
            nip05: content.nip05,
          });
        } catch {
          /* skip malformed */
        }
      }
    } catch {
      /* profile resolution is best-effort */
    }

    return profiles;
  }

  private async fetchNotes(timeoutMs: number, limit: number): Promise<NostrEvent[]> {
    try {
      const events = await fetchFromRelays(this.relays, limit, timeoutMs);
      if (events.length > 0) return events;
    } catch {
      /* fall through to HTTP fallback */
    }
    try {
      return await withTimeout(fetchFromHttp(limit, timeoutMs), timeoutMs, 'nostr:http');
    } catch {
      return [];
    }
  }

  /** Fetch NIP-23 long-form articles (kind 30023) from relays. */
  private async fetchLongForm(timeoutMs: number, limit: number): Promise<NostrEvent[]> {
    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      const timer = setTimeout(() => resolve(events), timeoutMs);
      const targetRelay = this.relays[0];
      if (!targetRelay) {
        clearTimeout(timer);
        resolve(events);
        return;
      }
      let ws: WebSocket;
      try {
        ws = new WebSocket(targetRelay);
      } catch {
        clearTimeout(timer);
        resolve(events);
        return;
      }
      const subId = `longform-${Date.now()}`;
      const cleanup = () => {
        clearTimeout(timer);
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
      ws.onopen = () => {
        try {
          ws.send(JSON.stringify(['REQ', subId, { kinds: [30023], limit }]));
        } catch {
          cleanup();
          resolve(events);
        }
      };
      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as unknown[];
          if (Array.isArray(data) && data[0] === 'EVENT' && data[2]) {
            events.push(data[2] as NostrEvent);
          } else if (Array.isArray(data) && data[0] === 'EOSE') {
            cleanup();
            resolve(events);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        cleanup();
        resolve(events);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        resolve(events);
      };
    });
  }
  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchFromWebSocket(
          this.relays[0] ?? DEFAULT_RELAYS[0] ?? '',
          1,
          opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        ),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'nostr:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
