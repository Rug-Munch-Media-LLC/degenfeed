/**
 * Smoke Signal (AT Protocol) Events Provider
 *
 * Fetches events from Smoke Signal via the AT Protocol firehose
 * (events.smokesignal.event collection). Smoke Signal is an event
 * planning/discovery app on the AT Protocol — the decentralized
 * Meetup/Eventbrite alternative.
 *
 * Sources:
 *   - DegenFeed PDS: collections/events.smokesignal.event
 *   - Public PDS (bsky.social): same collection
 *   - Smoke Signal public API: https://smokesignal.events
 *
 * Normalizes events into UnifiedEvent format for cross-protocol discovery.
 */

import type { SchemaGuard, UnifiedEvent } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const PDS_URLS = [
  process.env.ATPROTO_PDS_URL || 'https://pds.degenfeed.xyz',
  'https://bsky.social',
];

const SMOKE_SIGNAL_API = 'https://smokesignal.events/api';

/** Badge color for Smoke Signal events */
export const SMOKE_SIGNAL_BADGE = '#F59E0B';

// ─── Smoke Signal API Types ───────────────────────────────────────────

interface SmokeSignalAPIEvent {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  url?: string;
  image?: { url: string; alt?: string };
  maxParticipants?: number;
  rsvpCount?: number;
  status: 'active' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt?: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
}

interface SmokeSignalAPIResponse {
  events?: SmokeSignalAPIEvent[];
  cursor?: string;
  total?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessEventCategories(title: string, desc: string, tags: string[] = []): string[] {
  const lower = `${title} ${desc} ${tags.join(' ')}`.toLowerCase();
  const cats: string[] = [];
  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi|nft|token)\b/.test(lower))
    cats.push('crypto');
  if (/\b(ai|artificial|intelligence|llm|machine.learning|deep.learning)\b/.test(lower))
    cats.push('ai');
  if (/\b(tech|technology|programming|code|developer|hackathon|software)\b/.test(lower))
    cats.push('tech');
  if (/\b(meetup|conference|workshop|talk|lecture|seminar|panel)\b/.test(lower))
    cats.push('conference');
  if (/\b(music|concert|festival|performance|dj|live|band)\b/.test(lower)) cats.push('music');
  if (/\b(art|exhibition|gallery|culture|museum|photography)\b/.test(lower)) cats.push('art');
  if (/\b(dao|community|governance|vote|proposal|fundraising)\b/.test(lower)) cats.push('dao');
  if (/\b(social|party|networking|happy.hour|mixer)\b/.test(lower)) cats.push('social');
  if (/\b(sport|game|gaming|esport|tournament|competition)\b/.test(lower)) cats.push('gaming');
  if (/\b(health|wellness|yoga|meditation|fitness)\b/.test(lower)) cats.push('wellness');
  if (/\b(education|workshop|learn|teaching|course|training)\b/.test(lower)) cats.push('education');
  if (cats.length === 0) cats.push('general');
  return cats;
}

// ─── AT Protocol PDS Query Types ─────────────────────────────────────

interface PDSRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

interface PDSListResponse {
  records?: PDSRecord[];
}

/**
 * Query the AT Protocol PDS for Smoke Signal events directly.
 */
async function fetchRecordsFromPDS(
  pdsUrl: string,
  collection: string,
  limit: number,
): Promise<PDSRecord[]> {
  try {
    const params = new URLSearchParams({
      collection,
      limit: String(Math.min(limit, 100)),
    });
    const res = await $fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed-Bridge/0.1 (SmokeSignal)',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as PDSListResponse;
    return data.records || [];
  } catch {
    return [];
  }
}

// ─── Normalization ────────────────────────────────────────────────────

/**
 * Normalize a Smoke Signal AT Protocol record (events.smokesignal.event)
 * to UnifiedEvent.
 */
function pdsRecordToUnifiedEvent(record: PDSRecord, pdsUrl: string): UnifiedEvent | null {
  try {
    const value = record.value;
    const uriParts = record.uri.split('/');
    const rkey = uriParts[uriParts.length - 1] || '';
    const authorDid = uriParts[2] || '';

    const name = (value.name as string) || (value.title as string) || 'Untitled Event';
    const description = (value.description as string) || '';
    const startsAt = (value.startsAt as string) || (value.startDate as string) || '';
    const endsAt = (value.endsAt as string) || (value.endDate as string) || undefined;
    const location = (value.location as string) || undefined;
    const imageUrl =
      (value.image as { url?: string } | undefined)?.url || (value.imageUrl as string) || undefined;
    const url = (value.url as string) || undefined;
    const maxParticipants = (value.maxParticipants as number) || undefined;
    const rsvpCount = (value.rsvpCount as number) || 0;
    const status = (value.status as string) || 'active';
    const tags = (value.tags as string[]) || (value.hashtags as string[]) || [];
    const createdAt = (value.createdAt as string) || new Date().toISOString();

    if (!name || !startsAt) return null;

    let address: string | undefined;
    let lat: number | undefined;
    let lng: number | undefined;
    if (location) {
      // Location can be a string "City, Place" or an object with address/lat/lng
      if (typeof location === 'string') {
        address = location;
      }
    }

    return {
      id: `smokesignal:${rkey}@${authorDid.slice(0, 12)}`,
      protocol: 'smokesignal',
      title: name.slice(0, 200),
      description: description.slice(0, 2000),
      beginsOn: startsAt,
      endsOn: endsAt,
      location: address ? { name: address, address } : undefined,
      onlineAddress: url || undefined,
      isOnline: !location && !address,
      organizer: {
        id: `atproto:${authorDid}`,
        primary: { protocol: 'atproto', id: authorDid },
        handles: { atproto: authorDid.slice(0, 12) },
        displayName: (value.creatorName as string) || authorDid.slice(0, 12),
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'profile', url: `https://bsky.app/profile/${authorDid}` }],
        keys: { atprotoDid: authorDid },
      },
      tags,
      picture: imageUrl ? { url: imageUrl } : undefined,
      url: url || `https://smokesignal.events/e/${rkey}`,
      rsvpCount,
      maxAttendees: maxParticipants,
      status: status === 'cancelled' ? 'cancelled' : 'confirmed',
      visibility: 'public',
      categories: guessEventCategories(name, description, tags),
      createdAt: new Date(createdAt).getTime(),
      raw: record,
    };
  } catch {
    return null;
  }
}

/**
 * Normalize Smoke Signal API event to UnifiedEvent.
 */
function apiEventToUnifiedEvent(apiEvent: SmokeSignalAPIEvent): UnifiedEvent | null {
  try {
    const description = apiEvent.description ? stripHtml(apiEvent.description) : '';
    const locationParts: string[] = [];
    if (apiEvent.location) locationParts.push(apiEvent.location);

    return {
      id: `smokesignal:${apiEvent.id}`,
      protocol: 'smokesignal',
      title: apiEvent.name,
      description: description.slice(0, 2000),
      beginsOn: apiEvent.startsAt,
      endsOn: apiEvent.endsAt,
      location: apiEvent.location
        ? { name: apiEvent.location, address: apiEvent.location }
        : undefined,
      onlineAddress: apiEvent.url || undefined,
      isOnline: !apiEvent.location,
      organizer: {
        id: `atproto:${apiEvent.author.did}`,
        primary: { protocol: 'atproto', id: apiEvent.author.did },
        handles: { atproto: apiEvent.author.handle, smokesignal: apiEvent.author.handle },
        displayName: apiEvent.author.displayName || apiEvent.author.handle,
        bio: '',
        avatarUrl: apiEvent.author.avatar || '',
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'profile', url: `https://bsky.app/profile/${apiEvent.author.did}` }],
        keys: { atprotoDid: apiEvent.author.did },
      },
      tags: [],
      picture: apiEvent.image ? { url: apiEvent.image.url, name: apiEvent.image.alt } : undefined,
      url: `https://smokesignal.events/e/${apiEvent.id}`,
      rsvpCount: apiEvent.rsvpCount || 0,
      maxAttendees: apiEvent.maxParticipants || undefined,
      status: apiEvent.status === 'cancelled' ? 'cancelled' : 'confirmed',
      visibility: 'public',
      categories: guessEventCategories(apiEvent.name, description),
      createdAt: new Date(apiEvent.createdAt).getTime(),
      raw: apiEvent,
    };
  } catch {
    return null;
  }
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

/**
 * Fetch Smoke Signal events from the AT Protocol PDS via direct XRPC calls.
 */
async function fetchFromPDS(limit: number): Promise<UnifiedEvent[]> {
  try {
    const collection = 'events.smokesignal.event';
    const records = await fetchRecordsFromPDS(PDS_URLS[0], collection, limit);

    const events: UnifiedEvent[] = [];
    for (const record of records) {
      const event = pdsRecordToUnifiedEvent(record, PDS_URLS[0]);
      if (event) {
        events.push(event);
        if (events.length >= limit) break;
      }
    }

    console.log(`[smokesignal] PDS: ${events.length} events`);
    return events;
  } catch (err) {
    console.log(`[smokesignal] PDS fetch error: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetch Smoke Signal events from the direct API.
 */
async function fetchFromAPI(limit: number): Promise<UnifiedEvent[]> {
  try {
    const res = await $fetch(`${SMOKE_SIGNAL_API}/events?limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1 (SmokeSignal)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.log(`[smokesignal] API: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as SmokeSignalAPIResponse;
    const apiEvents = data.events || [];

    const events: UnifiedEvent[] = [];
    for (const apiEvent of apiEvents) {
      const event = apiEventToUnifiedEvent(apiEvent);
      if (event && (apiEvent.status === 'active' || !apiEvent.status)) {
        events.push(event);
        if (events.length >= limit) break;
      }
    }

    console.log(`[smokesignal] API: ${events.length} events`);
    return events;
  } catch (err) {
    console.log(`[smokesignal] API fetch error: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetch Smoke Signal events from multiple PDS endpoints.
 */
async function fetchFromMultiPDS(limit: number): Promise<UnifiedEvent[]> {
  const perPDS = Math.max(5, Math.ceil(limit / PDS_URLS.length));
  const results = await Promise.allSettled(
    PDS_URLS.map(async (pdsUrl) => {
      try {
        const records = await fetchRecordsFromPDS(pdsUrl, 'events.smokesignal.event', perPDS);
        return records
          .map((r) => pdsRecordToUnifiedEvent(r, pdsUrl))
          .filter(Boolean) as UnifiedEvent[];
      } catch {
        return [] as UnifiedEvent[];
      }
    }),
  );

  const all: UnifiedEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  return all;
}

// ─── Provider Schema ─────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'smokesignal',
  name: 'Smoke Signal (AT Protocol Events)',
  description: 'Event planning on AT Protocol — create, RSVP, and discover events via Smoke Signal',
  endpoint: '/api/events/atproto',
  requiresAuth: false,
  contentType: 'event',
};

// ─── Main Fetch ──────────────────────────────────────────────────────

/**
 * Fetch Smoke Signal events from all available sources.
 * Primary: AT Protocol PDS (events.smokesignal.event collection)
 * Fallback: Smoke Signal public API
 */
export async function fetchSmokeSignalEvents(limit = 20): Promise<UnifiedEvent[]> {
  // Try PDS first (fastest, most complete)
  let events = await fetchFromMultiPDS(Math.ceil(limit * 1.5));

  // Fall back to API if PDS returns nothing
  if (events.length === 0) {
    events = await fetchFromAPI(limit);
  }

  // Deduplicate by title + beginsOn
  const seen = new Set<string>();
  const deduped: UnifiedEvent[] = [];
  for (const e of events) {
    const key = `${e.title}|${e.beginsOn}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
      if (deduped.length >= limit) break;
    }
  }

  console.log(`[smokesignal] Total: ${deduped.length} events`);
  return deduped;
}

// ─── RSVP via AT Protocol ────────────────────────────────────────────

/**
 * RSVP to a Smoke Signal event via the AT Protocol.
 * Creates an events.smokesignal.rsvp record on the user's PDS.
 */
export async function rsvpToEvent(
  eventId: string,
  response: 'yes' | 'no' | 'maybe',
  authToken: string,
  pdsUrl = 'https://pds.degenfeed.xyz',
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Resolve event DID from event ID
    const res = await $fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        collection: 'events.smokesignal.rsvp',
        record: {
          eventId,
          response,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Create a Smoke Signal event via the AT Protocol.
 * Creates an events.smokesignal.event record on the user's PDS.
 */
export async function createSmokeSignalEvent(
  event: {
    name: string;
    description: string;
    startsAt: string;
    endsAt?: string;
    location?: string;
    url?: string;
    maxParticipants?: number;
  },
  authToken: string,
  pdsUrl = 'https://pds.degenfeed.xyz',
): Promise<{ ok: boolean; uri?: string; error?: string }> {
  try {
    const res = await $fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        collection: 'events.smokesignal.event',
        record: {
          ...event,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` };
    }

    const data = (await res.json()) as { uri: string };
    return { ok: true, uri: data.uri };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Alias for feed import */
export const fetchEvents = fetchSmokeSignalEvents;
