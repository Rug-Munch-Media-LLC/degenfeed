/**
 * @degenfeed/nostr-sdk — NIP-53: Live Events
 *
 * NIP-53 defines live event announcements via kind:30311 (Live Event)
 * and kind:30315 (Live Event Status / Chat Message).
 *
 * Live events have:
 *   - d tag: unique identifier
 *   - title: stream title
 *   - status: "live", "ended", or "planned"
 *   - starts: Unix timestamp for planned start
 *   - current_participants: viewer count (updated live)
 *   - relays: preferred relay URLs for chat
 *   - p tags: participants/publishers
 *   - "streaming" tag: URL to the actual stream
 *
 * Reference: https://github.com/nostr-protocol/nips/blob/master/53.md
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface NostrLiveEvent {
  /** Unique identifier (d tag) */
  id: string;
  /** Event pubkey (creator) */
  pubkey: string;
  /** Event kind (30311 or 30315) */
  kind: 30311 | 30315;
  /** Title of the live event */
  title: string;
  /** Status: 'live', 'ended', 'planned' */
  status: 'live' | 'ended' | 'planned';
  /** Unix timestamp when the stream started / is planned */
  startsAt?: number;
  /** Unix timestamp when the stream ended */
  endsAt?: number;
  /** Current viewer count */
  currentParticipants?: number;
  /** Max viewer count seen */
  maxParticipants?: number;
  /** Stream URL (from "streaming" tag) */
  streamUrl?: string;
  /** Streaming platform */
  platform?: string;
  /** Description / summary */
  summary?: string;
  /** Image / thumbnail URL */
  imageUrl?: string;
  /** Content warning */
  contentWarning?: string;
  /** Preferred relays for chat */
  relays: string[];
  /** Participant pubkeys */
  participants: string[];
  /** Host/creator pubkey */
  host?: string;
  /** Tags (hashtags/ topics) */
  tags: string[];
  /** When the event was created */
  createdAt: number;
  /** Raw event for further processing */
  rawEvent?: Record<string, unknown>;
}

export interface NostrLiveFilter {
  /** Filter by status */
  status?: 'live' | 'ended' | 'planned';
  /** Filter by pubkey (creator) */
  authors?: string[];
  /** Filter by search term */
  search?: string;
  /** Max results */
  limit?: number;
  /** Only events since this timestamp */
  since?: number;
  /** Only events before this timestamp */
  until?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

export const LIVE_EVENT_KIND = 30311;
export const LIVE_CHAT_KIND = 30315;

// ─── Event Parsing ──────────────────────────────────────────────────────

/** Parse a kind:30311 or kind:30315 event into a NostrLiveEvent */
export function parseLiveEvent(event: {
  id?: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
  sig?: string;
}): NostrLiveEvent | null {
  if (event.kind !== LIVE_EVENT_KIND && event.kind !== LIVE_CHAT_KIND) {
    return null;
  }

  const tags = event.tags ?? [];
  const tagMap = new Map<string, string[]>();

  for (const tag of tags) {
    const key = tag[0];
    if (!key) continue;
    if (!tagMap.has(key)) tagMap.set(key, []);
    const existing = tagMap.get(key)!;
    if (tag[1]) existing.push(tag[1]);
  }

  const id = tagMap.get('d')?.[0] ?? event.id ?? `nostr-live-${event.created_at}`;
  const title = tagMap.get('title')?.[0] ?? event.content?.split('\n')[0] ?? 'Untitled Live Event';
  const status = (tagMap.get('status')?.[0] ?? 'live') as 'live' | 'ended' | 'planned';
  const startsAt = tagMap.get('starts')?.[0]
    ? parseInt(tagMap.get('starts')?.[0]!, 10) * 1000
    : undefined;
  const endsAt = tagMap.get('ends')?.[0]
    ? parseInt(tagMap.get('ends')?.[0]!, 10) * 1000
    : undefined;
  const currentParticipants = tagMap.get('current_participants')?.[0]
    ? parseInt(tagMap.get('current_participants')?.[0]!, 10)
    : undefined;
  const maxParticipants = tagMap.get('max_participants')?.[0]
    ? parseInt(tagMap.get('max_participants')?.[0]!, 10)
    : undefined;
  const streamUrl = tagMap.get('streaming')?.[0];
  const relays = tagMap.get('relays') ?? [];
  const participants = tagMap.get('p') ?? [];
  const host = tagMap.get('host')?.[0] ?? event.pubkey;
  const summary = event.content && event.content !== title ? event.content : undefined;
  const imageUrl = tagMap.get('image')?.[0];
  const contentWarning = tagMap.get('content-warning')?.[0];

  // Extract platform from streaming URL
  let platform: string | undefined;
  if (streamUrl) {
    if (/twitch/i.test(streamUrl)) platform = 'Twitch';
    else if (/youtube/i.test(streamUrl)) platform = 'YouTube';
    else if (/kick/i.test(streamUrl)) platform = 'Kick';
    else if (/peertube/i.test(streamUrl)) platform = 'PeerTube';
    else if (/livepeerr/i.test(streamUrl)) platform = 'Livepeer';
    else if (/odysee/i.test(streamUrl)) platform = 'Odysee';
    else if (/rumble/i.test(streamUrl)) platform = 'Rumble';
    else platform = 'Direct';
  }

  // Extract tags/hashtags
  const contentTags = (summary ?? title).match(/#\w+/g) ?? [];
  const hashtagTags = tagMap.get('t') ?? [];
  const allTags = [...new Set([...hashtagTags, ...contentTags.map((t) => t.slice(1))])];

  return {
    id,
    pubkey: event.pubkey,
    kind: event.kind as 30311 | 30315,
    title,
    status,
    startsAt,
    endsAt,
    currentParticipants,
    maxParticipants,
    streamUrl,
    platform,
    summary,
    imageUrl,
    contentWarning,
    relays,
    participants,
    host,
    tags: allTags,
    createdAt: event.created_at * 1000,
    rawEvent: event as unknown as Record<string, unknown>,
  };
}

/** Serialize a live event to Nostr-compatible tags */
export function serializeLiveEvent(opts: {
  id: string;
  title: string;
  status?: 'live' | 'ended' | 'planned';
  streamUrl?: string;
  summary?: string;
  startsAt?: number;
  imageUrl?: string;
  relays?: string[];
  participants?: string[];
  tags?: string[];
}): { kind: number; tags: string[][]; content: string } {
  const tags: string[][] = [
    ['d', opts.id],
    ['title', opts.title.slice(0, 256)],
    ['status', opts.status ?? 'live'],
  ];

  if (opts.startsAt) tags.push(['starts', String(Math.floor(opts.startsAt / 1000))]);
  if (opts.streamUrl) tags.push(['streaming', opts.streamUrl]);
  if (opts.imageUrl) tags.push(['image', opts.imageUrl]);
  if (opts.relays) {
    for (const relay of opts.relays) tags.push(['relays', relay]);
  }
  if (opts.participants) {
    for (const p of opts.participants) tags.push(['p', p]);
  }
  if (opts.tags) {
    for (const t of opts.tags) tags.push(['t', t]);
  }

  return {
    kind: LIVE_EVENT_KIND,
    tags,
    content: opts.summary ?? '',
  };
}

// ─── Feed Filtering ────────────────────────────────────────────────────

/** Filter live events by various criteria */
export function filterLiveEvents(
  events: NostrLiveEvent[],
  filter: NostrLiveFilter = {},
): NostrLiveEvent[] {
  let result = [...events];

  if (filter.status) {
    result = result.filter((e) => e.status === filter.status);
  }
  if (filter.authors?.length) {
    result = result.filter((e) => filter.authors?.includes(e.pubkey));
  }
  if (filter.search) {
    const lower = filter.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        e.summary?.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }
  if (filter.since) {
    result = result.filter((e) => e.createdAt >= filter.since!);
  }
  if (filter.until) {
    result = result.filter((e) => e.createdAt <= filter.until!);
  }

  // Sort: live first, then by startsAt, then by creation time
  result.sort((a, b) => {
    const statusOrder = { live: 0, planned: 1, ended: 2 };
    const aOrder = statusOrder[a.status] ?? 3;
    const bOrder = statusOrder[b.status] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.startsAt ?? b.createdAt) - (a.startsAt ?? a.createdAt);
  });

  if (filter.limit && result.length > filter.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

// ─── Normalization for Unified Feed ───────────────────────────────────

/** Normalize a Nostr live event into a format suitable for the unified live hub */
export function normalizeLiveEvent(event: NostrLiveEvent): {
  id: string;
  type: 'live' | 'scheduled' | 'ended';
  title: string;
  description: string;
  streamUrl?: string;
  platform: string;
  creatorId: string;
  creatorName: string;
  viewerCount: number;
  startedAt?: number;
  endedAt?: number;
  tags: string[];
  thumbnailUrl?: string;
} {
  const now = Date.now();
  const isLive = event.status === 'live';
  const isScheduled = event.status === 'planned' && (event.startsAt ?? 0) > now;
  const _isEnded = event.status === 'ended' || ((event.startsAt ?? 0) < now && !isLive);
  void _isEnded;

  return {
    id: `nostr:${event.id}`,
    type: isLive ? 'live' : isScheduled ? 'scheduled' : 'ended',
    title: event.title,
    description: event.summary ?? '',
    streamUrl: event.streamUrl,
    platform: event.platform ?? 'Nostr',
    creatorId: `nostr:${event.pubkey}`,
    creatorName: event.pubkey.slice(0, 12),
    viewerCount: event.currentParticipants ?? 0,
    startedAt: event.startsAt ?? event.createdAt,
    endedAt: event.endsAt,
    tags: event.tags,
    thumbnailUrl: event.imageUrl,
  };
}

/** Fetch live events from a set of Nostr relays */
export async function fetchNostrLiveEvents(
  relays: string[],
  filter: NostrLiveFilter = {},
  timeoutMs = 8000,
): Promise<NostrLiveEvent[]> {
  try {
    const { RelayPool } = await import('./relay');
    const pool = new RelayPool(relays, {
      connectTimeout: timeoutMs / 2,
      eoseTimeout: timeoutMs / 2,
    });

    const events: NostrLiveEvent[] = [];
    const subFilter: Record<string, unknown> = {
      kinds: [LIVE_EVENT_KIND],
      limit: filter.limit ?? 50,
    };
    if (filter.authors?.length) subFilter.authors = filter.authors;
    if (filter.since) subFilter.since = Math.floor(filter.since / 1000);
    if (filter.until) subFilter.until = Math.floor(filter.until / 1000);

    return new Promise<NostrLiveEvent[]>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(filterLiveEvents(events, filter));
      }, timeoutMs);

      pool.subscribe([{ ...subFilter }], {
        onEvent: (relayEvent) => {
          if (relayEvent.kind === 'event' && relayEvent.event) {
            const parsed = parseLiveEvent(relayEvent.event);
            if (parsed) events.push(parsed);
          }
          if (relayEvent.kind === 'eose') {
            clearTimeout(timeout);
            resolve(filterLiveEvents(events, filter));
          }
        },
      });

      // Clean up on resolve
      const originalResolve = resolve;
      return (events_list: NostrLiveEvent[]) => {
        clearTimeout(timeout);
        (pool as unknown as { close: () => void }).close?.();
        originalResolve(filterLiveEvents(events_list, filter));
      };
    });
  } catch {
    return [];
  }
}
