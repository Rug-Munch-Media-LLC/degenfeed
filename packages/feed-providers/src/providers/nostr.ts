import { buildUnifiedPost, enrichPostNiches, extractEmbeds } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  buildUrl,
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
        ws.send(JSON.stringify(['REQ', subId, { kinds: [1], limit: limit * 3 }]));
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
    const url = buildUrl(base, '', { limit: String(limit * 3) });
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

    try {
      const events = await fetchFromRelays(this.relays, limit, timeoutMs);
      if (events.length > 0) {
        return {
          posts: events.slice(0, limit).map((e) => enrichPostNiches(eventToUnifiedPost(e))),
        };
      }
    } catch {
      /* fall through to HTTP */
    }

    try {
      const events = await withTimeout(fetchFromHttp(limit, timeoutMs), timeoutMs, 'nostr:http');
      return {
        posts: events.slice(0, limit).map((e) => enrichPostNiches(eventToUnifiedPost(e))),
      };
    } catch (err) {
      return {
        posts: [],
        notice: err instanceof Error ? err.message : 'Nostr feed unavailable',
      };
    }
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
