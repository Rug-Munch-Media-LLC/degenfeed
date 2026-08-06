/**
 * Nostr Groups provider — NIP-29 decentralized group chats/communities.
 *
 * NIP-29 group events:
 *   kind 39000 — group metadata (name, about, picture, members)
 *   kind 39001 — group note (chat/text post inside a group)
 *
 * Strategy:
 *   1. Query relays for kind 39000 (group metadata) → surfaced as
 *      "community" posts (group name, description, member count).
 *   2. Query relays for kind 39001 (group notes) → surfaced as content
 *      posts tagged with their group id.
 *   3. Fallback (most public relays do not store NIP-29 kinds): fetch
 *      popular Nostr community content — kind 1 notes via nostr.band's
 *      trending API and hashtag-filtered relay queries — so the feed
 *      NEVER returns empty.
 *
 * Both paths carry a circuit breaker + health check.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { isNostrEvent } from '../schemas';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, fetchWithFallbacks, withTimeout } from '../utils';

/** Relays that are known to carry NIP-29 group events (best effort). */
export const NIP29_GROUP_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://eden.nostr.land',
  'wss://relay.nostr.net',
];

export const NIP29_GROUP_METADATA_KIND = 39000;
export const NIP29_GROUP_NOTE_KIND = 39001;

const TRENDING_HTTP_ENDPOINTS = [
  'https://api.nostr.band/v0/trending/notes',
  'https://nostr.band/v0/trending/notes',
];

interface NostrGroupEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
  __reactions?: number;
  __reposts?: number;
  __replies?: number;
  __zaps?: number;
}

interface NostrBandTrendingResponse {
  notes?: Record<
    string,
    {
      event?: NostrGroupEvent;
      reactions?: { total?: number };
      reposts?: { total?: number };
      zaps?: { total?: number };
      replies?: { total?: number };
    }
  >;
}

function tagValue(tags: string[][], name: string): string {
  const t = tags.find((tag) => tag[0] === name);
  return t?.[1] ?? '';
}

/** Parse NIP-29 group metadata (kind 39000) content JSON for group info. */
function parseGroupMetadata(event: NostrGroupEvent): {
  name: string;
  about: string;
  picture: string;
} {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(event.content) as Record<string, unknown>;
  } catch {
    // content is plain text
  }
  return {
    name: String(parsed.name ?? tagValue(event.tags, 'name') ?? 'Nostr Group'),
    about: String(parsed.about ?? tagValue(event.tags, 'about') ?? ''),
    picture: String(parsed.picture ?? tagValue(event.tags, 'picture') ?? ''),
  };
}

/** Build a UnifiedPost representing a NIP-29 group (community). */
function groupMetadataToPost(event: NostrGroupEvent): UnifiedPost | null {
  const groupId = tagValue(event.tags, 'h') || event.id;
  const meta = parseGroupMetadata(event);
  if (!meta.name) return null;

  const memberTag = event.tags.find((t) => t[0] === 'member');
  const memberCount = memberTag ? Number.parseInt(memberTag[1] ?? '0', 10) : 0;

  const author: UnifiedIdentity = {
    id: `nostr-groups:${groupId}`,
    primary: { protocol: 'nostr-groups', id: groupId },
    handles: { 'nostr-groups': groupId } as UnifiedIdentity['handles'],
    displayName: meta.name,
    bio: meta.about.slice(0, 300),
    avatarUrl: meta.picture,
    verified: [],
    followerCount: Number.isFinite(memberCount) ? memberCount : 0,
    followingCount: 0,
    links: [
      {
        label: 'nostr-group',
        url: `nostr:${groupId}`,
      },
    ],
    keys: { nostrGroupId: groupId, nostrPubkey: event.pubkey },
  };

  const text = `${meta.name}${meta.about ? `\n\n${meta.about.slice(0, 500)}` : ''}`;
  const embeds: UnifiedPost['embeds'] = [];
  if (meta.picture) embeds.push({ kind: 'image', url: meta.picture });
  embeds.push({ kind: 'link', url: `nostr:${groupId}`, meta: { title: meta.name } });

  return {
    id: `nostr-groups:meta:${event.id}`,
    protocol: 'nostr-groups',
    author,
    text,
    html: meta.about ? `<p>${meta.about.slice(0, 900)}</p>` : undefined,
    embeds,
    contentType: 'community',
    createdAt: event.created_at * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    image: meta.picture,
    media: meta.picture,
    raw: { source: 'nostr-nip29-metadata', groupId, event },
    niches: [...new Set(detectNiches(`${meta.name} ${meta.about}`))],
  } as UnifiedPost;
}

/** Build a UnifiedPost from a NIP-29 group note (kind 39001). */
function groupNoteToPost(event: NostrGroupEvent): UnifiedPost | null {
  const groupId = tagValue(event.tags, 'h') || 'nostr-group';
  if (!event.content) return null;

  const author: UnifiedIdentity = {
    id: `nostr-groups:${event.pubkey}`,
    primary: { protocol: 'nostr-groups', id: event.pubkey },
    handles: { 'nostr-groups': groupId } as UnifiedIdentity['handles'],
    displayName: `Nostr member · ${groupId.slice(0, 12)}`,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'nostr-group', url: `nostr:${groupId}` }],
    keys: { nostrGroupId: groupId, nostrPubkey: event.pubkey },
  };

  const text = event.content;
  const embeds: UnifiedPost['embeds'] = [
    { kind: 'link', url: `nostr:${event.id}`, meta: { title: `Note in group ${groupId}` } },
  ];

  return {
    id: `nostr-groups:note:${event.id}`,
    protocol: 'nostr-groups',
    author,
    text,
    html: `<p>${text.slice(0, 1200).replace(/\n/g, '<br/>')}</p>`,
    embeds,
    contentType: 'text',
    createdAt: event.created_at * 1000,
    metrics: {
      likes: event.__reactions ?? 0,
      reposts: event.__reposts ?? 0,
      replies: event.__replies ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: event.__reactions ?? 0,
        reposts: event.__reposts ?? 0,
        replies: event.__replies ?? 0,
        quotes: 0,
      },
    },
    raw: { source: 'nostr-nip29-note', groupId, event },
    niches: [...new Set(detectNiches(text))],
  } as UnifiedPost;
}

/** Build a UnifiedPost from a fallback kind-1 note (popular Nostr community content). */
function fallbackNoteToPost(event: NostrGroupEvent): UnifiedPost | null {
  if (!event.content) return null;
  const author: UnifiedIdentity = {
    id: `nostr-groups:${event.pubkey}`,
    primary: { protocol: 'nostr-groups', id: event.pubkey },
    handles: { 'nostr-groups': '' } as UnifiedIdentity['handles'],
    displayName: event.pubkey.slice(0, 12),
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { nostrPubkey: event.pubkey },
  };
  return {
    id: `nostr-groups:note:${event.id}`,
    protocol: 'nostr-groups',
    author,
    text: event.content,
    html: `<p>${event.content.slice(0, 1200).replace(/\n/g, '<br/>')}</p>`,
    embeds: [],
    contentType: 'text',
    createdAt: event.created_at * 1000,
    metrics: {
      likes: event.__reactions ?? 0,
      reposts: event.__reposts ?? 0,
      replies: event.__replies ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: event.__reactions ?? 0,
        reposts: event.__reposts ?? 0,
        replies: event.__replies ?? 0,
        quotes: 0,
      },
    },
    raw: { source: 'nostr-groups-fallback', event },
    niches: [...new Set(detectNiches(event.content))],
  } as UnifiedPost;
}

function fetchFromWebSocket(
  relayUrl: string,
  timeoutMs: number,
  filters: Array<Record<string, unknown>>,
): Promise<NostrGroupEvent[]> {
  return new Promise((resolve) => {
    const events: NostrGroupEvent[] = [];
    const subId = `df-groups-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      cleanup();
      resolve(events);
    }, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl);
    } catch {
      clearTimeout(timer);
      resolve(events);
      return;
    }

    const cleanup = (): void => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify(['REQ', subId, ...filters]));
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
          if (isNostrEvent(ev)) events.push(ev as unknown as NostrGroupEvent);
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

async function fetchTrendingFallback(timeoutMs: number): Promise<NostrGroupEvent[]> {
  return fetchWithFallbacks(TRENDING_HTTP_ENDPOINTS, async (base) => {
    const url = `${base.replace(/\/$/, '')}?limit=60`;
    const data = await fetchJson<NostrBandTrendingResponse>(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
    });
    const notes = data.notes ?? {};
    const events: NostrGroupEvent[] = [];
    for (const detail of Object.values(notes)) {
      if (!detail?.event) continue;
      const ev = detail.event as NostrGroupEvent;
      ev.__reactions = detail.reactions?.total ?? 0;
      ev.__reposts = detail.reposts?.total ?? 0;
      ev.__replies = detail.replies?.total ?? 0;
      ev.__zaps = detail.zaps?.total ?? 0;
      events.push(ev);
    }
    return events;
  });
}

export interface NostrGroupsProviderOptions {
  relays?: string[];
  /** Disable the kind-1 trending fallback (metadata/notes only). */
  disableFallback?: boolean;
}

export class NostrGroupsProvider implements FeedProvider {
  readonly protocol: Protocol = 'nostr-groups';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly relays: string[];
  private readonly disableFallback: boolean;
  private readonly breaker = new CircuitBreaker('nostr-groups');

  constructor(options: NostrGroupsProviderOptions = {}) {
    this.relays = options.relays ?? NIP29_GROUP_RELAYS;
    this.disableFallback = options.disableFallback ?? false;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const limit = 80;

        // 1) NIP-29 group metadata (kind 39000) → community posts
        const metadataEvents = await this.fetchFromRelays(timeoutMs, [
          { kinds: [NIP29_GROUP_METADATA_KIND], limit },
        ]);

        // 2) NIP-29 group notes (kind 39001) → content posts
        const noteEvents = await this.fetchFromRelays(timeoutMs, [
          { kinds: [NIP29_GROUP_NOTE_KIND], limit: limit * 2 },
        ]);

        const posts: UnifiedPost[] = [];
        const seen = new Set<string>();
        const push = (p: UnifiedPost | null): void => {
          if (!p || seen.has(p.id)) return;
          seen.add(p.id);
          posts.push(p);
        };

        for (const ev of metadataEvents) push(groupMetadataToPost(ev));
        for (const ev of noteEvents) push(groupNoteToPost(ev));

        // 3) Fallback: popular Nostr community content (kind-1 trending) so
        //    the feed NEVER returns empty when relays lack NIP-29 events.
        if (posts.length < 10 && !this.disableFallback) {
          const trending = await withTimeout(
            fetchTrendingFallback(Math.min(timeoutMs, 6000)),
            Math.min(timeoutMs, 6000),
            'nostr-groups:trending',
          ).catch(() => [] as NostrGroupEvent[]);
          for (const ev of trending) push(fallbackNoteToPost(ev));
        }

        if (posts.length === 0) {
          return {
            posts: [],
            notice: 'Nostr groups: no NIP-29 events or fallback content available',
          };
        }

        const source =
          noteEvents.length + metadataEvents.length > 0
            ? `NIP-29: ${metadataEvents.length} groups, ${noteEvents.length} notes`
            : 'popular Nostr community content fallback';
        return { posts: posts.slice(0, 60), notice: `Nostr groups: ${posts.length} posts (${source})` };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Nostr groups: circuit breaker open — temporarily unavailable',
        };
      }
      return { posts: [], notice: 'Nostr groups feed unavailable' };
    }
  }

  private async fetchFromRelays(
    timeoutMs: number,
    filters: Array<Record<string, unknown>>,
  ): Promise<NostrGroupEvent[]> {
    const results = await Promise.allSettled(
      this.relays.map((relay) =>
        withTimeout(
          fetchFromWebSocket(relay, Math.min(timeoutMs, 4000), filters),
          Math.min(timeoutMs, 4000),
          `nostr-groups:${relay}`,
        ),
      ),
    );
    const byId = new Map<string, NostrGroupEvent>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const ev of r.value) {
        if (!byId.has(ev.id)) byId.set(ev.id, ev);
      }
    }
    return Array.from(byId.values());
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      const events = await this.fetchFromRelays(opts.timeoutMs ?? 5000, [
        { kinds: [NIP29_GROUP_METADATA_KIND, NIP29_GROUP_NOTE_KIND], limit: 5 },
      ]);
      // Fallback probe: trending endpoint still counts as healthy since the
      // feed can serve popular community content without NIP-29 relay support.
      if (events.length > 0) {
        return { healthy: true, latencyMs: Date.now() - start };
      }
      const trending = await withTimeout(
        fetchTrendingFallback(4000),
        4000,
        'nostr-groups:health',
      ).catch(() => [] as NostrGroupEvent[]);
      return {
        healthy: trending.length > 0,
        latencyMs: Date.now() - start,
        error: trending.length > 0 ? undefined : 'No NIP-29 events and trending fallback failed',
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}


