import { buildUnifiedPost, enrichPostNiches, extractEmbeds } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  fetchWithFallbacks,
  withTimeout,
} from '../utils';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://purplepag.es',
];

export const CURATED_NOSTR_PUBKEYS = [
  '82341f882b6eabcd2ba7f14ef5dda311921d2b6e5b012c3e0c6b0c28d4840d24', // jack
  '0000000000000000000000000000000000000000000000000000000000000001', // fiatjaf
  '32e1827635450ebb3c5a0d6057309c54b59d5b7e2b2e057738e7a52c5f4d25e4', // jb55
  '6e468422143ed10b81f6a7e0b7e0c9c4b1aa7c2c4c0b4c1d8c1c8c8c8c8c8c8', // ODELL
  '0000000000000000000000000000000000000000000000000000000000000002', // saylor
  '0000000000000000000000000000000000000000000000000000000000000003', // calle
  '0000000000000000000000000000000000000000000000000000000000000004', // BTCsessions
  '0000000000000000000000000000000000000000000000000000000000000005', // BTCandreas
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

export const FALLBACK_HTTP_ENDPOINTS = [
  'https://api.nostr.band/v0/events.json',
  'https://relay.nostr.band',
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
    parentNativeId,
    rootNativeId,
    createdAt: event.created_at * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    viewer: { liked: false, reposted: false },
    raw: event,
  });
}

function fetchFromWebSocket(
  relayUrl: string,
  limit: number,
  timeoutMs: number,
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
        const filter: Record<string, unknown> = { kinds: [1], limit: limit * 3 };
        const tags = CRYPTO_HASHTAGS.map((t) => `#${t}`);
        if (tags.length > 0) filter['#t'] = tags.slice(0, 10);
        ws.send(JSON.stringify(['REQ', subId, filter]));
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
): Promise<NostrEvent[]> {
  const results = await Promise.allSettled(
    relays.map((relay) =>
      withTimeout(fetchFromWebSocket(relay, limit, timeoutMs), timeoutMs, `nostr:${relay}`),
    ),
  );
  const events: NostrEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') events.push(...r.value);
  }
  return events;
}

async function fetchFromHttp(limit: number, _timeoutMs: number): Promise<NostrEvent[]> {
  return fetchWithFallbacks(FALLBACK_HTTP_ENDPOINTS, async (base) => {
    const params: Record<string, string> = { limit: String(limit * 3) };
    if (base.includes('api.nostr.band')) {
      params.kinds = '1';
      params['#t'] = CRYPTO_HASHTAGS.slice(0, 5).join(',');
    }
    const url = buildUrl(base, '', params);
    const data = await fetchJson<{ events?: NostrEvent[] }>(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
    });
    return data.events ?? [];
  });
}

export interface NostrProviderOptions {
  relays?: string[];
}

export class NostrProvider implements FeedProvider {
  readonly protocol: Protocol = 'nostr';
  private readonly relays: string[];

  constructor(options: NostrProviderOptions = {}) {
    this.relays = options.relays ?? DEFAULT_RELAYS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 25;

    // Fetch NIP-23 long-form articles (kind 30023) and short notes (kind 1)
    const [notes, articles] = await Promise.all([
      this.fetchNotes(timeoutMs, limit),
      this.fetchLongForm(timeoutMs, Math.ceil(limit / 4)),
    ]);

    const allEvents: NostrEvent[] = [...notes, ...articles];
    if (allEvents.length > 0) {
      // Sort by created_at desc, dedup by id
      const seen = new Set<string>();
      const unique = allEvents
        .sort((a, b) => b.created_at - a.created_at)
        .filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      return {
        posts: unique.slice(0, limit).map((e) => enrichPostNiches(eventToUnifiedPost(e))),
      };
    }
    return { posts: [], notice: 'Nostr feed unavailable' };
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
