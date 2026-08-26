/**
 * Cross-Protocol Event Bridge — Bridgy Fed Pattern
 *
 * Two-way sync between event protocols:
 *   Smoke Signal (AT Protocol) ↔ Mobilizon (ActivityPub)
 *   Smoke Signal (AT Protocol) ↔ Nostr (NIP-52 Calendar Events)
 *   Smoke Signal (AT Protocol) ↔ Farcaster (Event Frames)
 *
 * Architecture:
 *   ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
 *   │ Smoke Signal │◄───►│  Event Bridge │◄───►│   Mobilizon   │
 *   │  (AT Proto)  │     │  (Bridgy Fed) │     │  (ActivityPub) │
 *   └─────────────┘     └──────────────┘     └───────────────┘
 *                              │
 *                    ┌─────────┼─────────┐
 *                    ▼         ▼         ▼
 *               ┌────────┐ ┌────────┐ ┌──────────┐
 *               │ Nostr  │ │Farcast │ │  Other   │
 *               │NIP-52  │ │ Events │ │Protocols  │
 *               └────────┘ └────────┘ └──────────┘
 *
 * Each sync direction:
 *   - Polls source protocol for NEW events (since last check)
 *   - Deduplicates against seen-IDs cache
 *   - Transforms to target protocol format
 *   - Creates event on target protocol
 *   - Maps RSVPs bidirectionally
 *
 * Dedup strategy: event ID cache with TTL (24h) and content hash
 */

import { fetchFarcasterEvents } from './providers/farcaster-events';
import { fetchMobilizonPosts, mobilizonEventToUnified } from './providers/mobilizon';
import { fetchNostrCalendarEvents } from './providers/nostr-events';
import {
  createSmokeSignalEvent,
  fetchSmokeSignalEvents,
  rsvpToEvent,
} from './providers/smokesignal';
import type { RSVPCrossProtocol, UnifiedEvent } from './server/types';

// ─── Constants ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Seen event IDs cache: map<protocol:eventId, timestamp> */
const seenEvents = new Map<string, number>();

/** Mapped IDs: map<sourceEventId, targetEventIds> */
const bridgedIds = new Map<string, string[]>();

/** Pending RSVPs to sync */
const pendingRsvps: RSVPCrossProtocol[] = [];

let lastPollTime = 0;

// ─── Logging ──────────────────────────────────────────────────────────

function log(msg: string) {
  // console.log(`[event-bridge] ${msg}`);
}

// ─── Dedup Helpers ────────────────────────────────────────────────────

function isSeen(protocol: string, eventId: string): boolean {
  const key = `${protocol}:${eventId}`;
  const seen = seenEvents.get(key);
  if (!seen) return false;
  if (Date.now() - seen > CACHE_TTL_MS) {
    seenEvents.delete(key);
    return false;
  }
  return true;
}

function markSeen(protocol: string, eventId: string) {
  seenEvents.set(`${protocol}:${eventId}`, Date.now());
}

function contentHash(event: Partial<UnifiedEvent>): string {
  const str = `${event.title}|${event.beginsOn}|${event.description?.slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `ch:${Math.abs(hash).toString(36)}`;
}

function isDuplicateByContent(event: Partial<UnifiedEvent>): boolean {
  const hash = contentHash(event);
  return isSeen('ch', hash);
}

function markContentSeen(event: Partial<UnifiedEvent>) {
  seenEvents.set(`ch:${contentHash(event)}`, Date.now());
}

// ─── Mobilizon → Smoke Signal Sync ─────────────────────────────────────

/**
 * Fetch events from Mobilizon and create them on Smoke Signal (AT Protocol).
 */
export async function syncMobilizonToSmokeSignal(authToken: string): Promise<{
  bridged: number;
  skipped: number;
  errors: string[];
}> {
  let bridged = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const mobilizonPosts = await fetchMobilizonPosts(20);

    for (const post of mobilizonPosts) {
      const eventId = post.id;

      // Skip if already seen
      if (isSeen('mobilizon', eventId)) {
        skipped++;
        continue;
      }

      // Skip duplicates by content
      if (
        isDuplicateByContent({
          title: post.text?.split('\n')[0],
          beginsOn: new Date(post.createdAt).toISOString(),
        })
      ) {
        skipped++;
        continue;
      }

      // Extract event data from UnifiedPost
      const lines = post.text?.split('\n') || [];
      const title = lines[0]?.replace(/^[📅🎉]\s*/u, '') || 'Untitled Event';
      const beginsOn = new Date(post.createdAt).toISOString();
      const description = lines.slice(1).join('\n').slice(0, 2000);

      // Create event on Smoke Signal via AT Protocol
      const result = await createSmokeSignalEvent(
        {
          name: title,
          description,
          startsAt: beginsOn,
          location: post.embeds?.find((e) => e.kind === 'link')?.url || undefined,
        },
        authToken,
      );

      if (result.ok && result.uri) {
        markSeen('mobilizon', eventId);
        markContentSeen({ title, beginsOn, description });

        // Track bridging
        const targetIds = bridgedIds.get(eventId) || [];
        targetIds.push(result.uri);
        bridgedIds.set(eventId, targetIds);

        bridged++;
        log(`✓ Mobilizon→SmokeSignal: "${title}"`);
      } else {
        errors.push(`Mobilizon→SmokeSignal failed for ${title}: ${result.error}`);
      }
    }
  } catch (err) {
    errors.push(`Mobilizon→SmokeSignal sync error: ${(err as Error).message}`);
  }

  return { bridged, skipped, errors };
}

// ─── Smoke Signal → Mobilizon Sync ─────────────────────────────────────

/**
 * Fetch events from Smoke Signal and create them on Mobilizon.
 * Note: Requires Mobilizon admin credentials for mutation access.
 */
export async function syncSmokeSignalToMobilizon(mobilizonToken: string): Promise<{
  bridged: number;
  skipped: number;
  errors: string[];
}> {
  let bridged = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const atprotoEvents = await fetchSmokeSignalEvents(20);

    for (const event of atprotoEvents) {
      const eventId = event.id;

      if (isSeen('smokesignal', eventId)) {
        skipped++;
        continue;
      }

      if (isDuplicateByContent(event)) {
        skipped++;
        continue;
      }

      // Create event on local Mobilizon instance via GraphQL
      const mobilizonUrl = process.env.MOBILIZON_API_URL || 'http://127.0.0.1:8098';

      try {
        const gqlMutation = `
          mutation CreateEvent($input: CreateEventInput!) {
            createEvent(input: $input) {
              event { id uuid title beginsOn }
            }
          }
        `;

        const locationDesc = event.location
          ? `${event.location.name || ''}, ${event.location.address || ''}`
          : '';

        const variables = {
          input: {
            title: event.title,
            description: event.description.slice(0, 5000),
            beginsOn: event.beginsOn,
            endsOn: event.endsOn || undefined,
            onlineAddress: event.onlineAddress || undefined,
            physicalAddress: locationDesc ? { description: locationDesc } : undefined,
            tags: event.tags.slice(0, 10).map((t: string) => ({ title: t })),
            visibility: event.visibility || 'public',
          },
        };

        const res = await fetch(`${mobilizonUrl}/api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: mobilizonToken ? `Bearer ${mobilizonToken}` : '',
            'User-Agent': 'DegenFeed-Bridge/0.1 (EventBridge)',
          },
          body: JSON.stringify({ query: gqlMutation, variables }),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            data?: { createEvent?: { event?: { id: string; uuid: string } } };
          };
          const createdId = data?.data?.createEvent?.event?.uuid;

          if (createdId) {
            markSeen('smokesignal', eventId);
            markContentSeen(event);

            const targetIds = bridgedIds.get(eventId) || [];
            targetIds.push(`mobilizon:${createdId}`);
            bridgedIds.set(eventId, targetIds);

            bridged++;
            log(`✓ SmokeSignal→Mobilizon: "${event.title}"`);
          } else {
            errors.push(`SmokeSignal→Mobilizon: no event returned for "${event.title}"`);
          }
        } else {
          const errText = await res.text().catch(() => '');
          // Mobilizon API may return errors for unauthenticated requests
          errors.push(`SmokeSignal→Mobilizon HTTP ${res.status}: ${errText.slice(0, 100)}`);
        }
      } catch (err) {
        errors.push(
          `SmokeSignal→Mobilizon fetch error: "${event.title}": ${(err as Error).message}`,
        );
      }
    }
  } catch (err) {
    errors.push(`SmokeSignal→Mobilizon sync error: ${(err as Error).message}`);
  }

  return { bridged, skipped, errors };
}

// ─── RSVP Sync ─────────────────────────────────────────────────────────

/**
 * Queue an RSVP for cross-protocol sync.
 * When a user RSVPs on one protocol, we sync it to all bridged protocols.
 */
export async function syncRSVP(
  rsvp: RSVPCrossProtocol,
  authToken: string,
): Promise<{ ok: boolean; synced: string[]; errors: string[] }> {
  const synced: string[] = [];
  const errors: string[] = [];

  // Find bridged event IDs
  const targets = bridgedIds.get(rsvp.eventId) || [];

  for (const targetId of targets) {
    const [targetProtocol] = targetId.split(':');

    try {
      if (targetProtocol === 'smokesignal' || targetProtocol === 'atproto') {
        const result = await rsvpToEvent(
          targetId.replace(/^smokesignal:/, ''),
          rsvp.response as 'yes' | 'no' | 'maybe',
          authToken,
        );
        if (result.ok) {
          synced.push(targetId);
          log(`✓ RSVP synced to SmokeSignal: ${rsvp.attendee.displayName} → ${rsvp.response}`);
        } else {
          errors.push(`RSVP→SmokeSignal: ${result.error}`);
        }
      }
      // Mobilizon RSVP sync (requires GraphQL mutation)
      else if (targetProtocol === 'mobilizon') {
        const mobilizonUrl = process.env.MOBILIZON_API_URL || 'http://127.0.0.1:8098';
        const gqlMutation = `
          mutation Participate($eventId: String!, $status: ParticipantStatusEnum!) {
            participate(eventId: $eventId, status: $status) {
              participant { id }
            }
          }
        `;
        const status =
          rsvp.response === 'yes'
            ? 'ACCEPTED'
            : rsvp.response === 'maybe'
              ? 'TENTATIVE'
              : 'REJECTED';

        const res = await fetch(`${mobilizonUrl}/api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            query: gqlMutation,
            variables: { eventId: targetId.replace(/^mobilizon:/, ''), status },
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          synced.push(targetId);
          log(`✓ RSVP synced to Mobilizon: ${rsvp.attendee.displayName} → ${rsvp.response}`);
        } else {
          errors.push(`RSVP→Mobilizon: HTTP ${res.status}`);
        }
      }
    } catch (err) {
      errors.push(`RSVP sync to ${targetId}: ${(err as Error).message}`);
    }
  }

  pendingRsvps.push(rsvp);

  return { ok: errors.length === 0, synced, errors };
}

// ─── Full Sync Cycle ───────────────────────────────────────────────────

/**
 * Run a full sync cycle: Mobilizon→SmokeSignal + SmokeSignal→Mobilizon.
 */
export async function runSyncCycle(
  atprotoToken: string,
  mobilizonToken: string,
): Promise<{
  mobilizonToSS: { bridged: number; skipped: number; errors: string[] };
  ssToMobilizon: { bridged: number; skipped: number; errors: string[] };
  durationMs: number;
}> {
  const start = Date.now();
  log('Starting sync cycle...');

  const [m2ss, ss2m] = await Promise.all([
    syncMobilizonToSmokeSignal(atprotoToken),
    syncSmokeSignalToMobilizon(mobilizonToken),
  ]);

  const durationMs = Date.now() - start;
  lastPollTime = Date.now();

  log(
    `Sync cycle complete: ` +
      `M→SS ${m2ss.bridged} bridged, ${m2ss.skipped} skipped; ` +
      `SS→M ${ss2m.bridged} bridged, ${ss2m.skipped} skipped ` +
      `(${durationMs}ms)`,
  );

  return { mobilizonToSS: m2ss, ssToMobilizon: ss2m, durationMs };
}

// ─── Status ────────────────────────────────────────────────────────────

export interface EventBridgeStatus {
  running: boolean;
  lastPollTime: number | null;
  cacheSize: number;
  bridgedCount: number;
  pendingRsvps: number;
}

export function getEventBridgeStatus(): EventBridgeStatus {
  return {
    running: lastPollTime > 0,
    lastPollTime: lastPollTime || null,
    cacheSize: seenEvents.size,
    bridgedCount: bridgedIds.size,
    pendingRsvps: pendingRsvps.length,
  };
}

// ─── Unified Events Feed (aggregate all protocols) ──────────────────────

/**
 * Fetch events from ALL protocols and merge into a single deduped feed.
 */
export async function fetchUnifiedEventsFeed(
  limit = 50,
  filters?: {
    protocols?: string[];
    categories?: string[];
    dateFrom?: string;
    dateTo?: string;
    location?: string;
    query?: string;
  },
): Promise<{ events: UnifiedEvent[]; total: number }> {
  const protocols: Array<{ name: string; fetchFn: (l: number) => Promise<UnifiedEvent[]> }> = [
    { name: 'smokesignal', fetchFn: fetchSmokeSignalEvents },
    { name: 'nostr-calendar', fetchFn: fetchNostrCalendarEvents },
    { name: 'farcaster-event', fetchFn: fetchFarcasterEvents },
  ];

  // Dynamically load Mobilizon events as UnifiedEvents
  try {
    const { fetchMobilizonPosts, mobilizonEventToUnified } = await import('./providers/mobilizon');
    protocols.push({
      name: 'mobilizon',
      fetchFn: async (l: number) => {
        const posts = await fetchMobilizonPosts(l);
        return posts.map((p: any) => mobilizonEventToUnified(p)).filter(Boolean) as UnifiedEvent[];
      },
    });
  } catch {
    // Mobilizon provider not available
  }

  // Filter protocols
  const activeProtocols = filters?.protocols
    ? protocols.filter((p) => filters.protocols!.includes(p.name))
    : protocols;

  // Fetch from all protocols in parallel
  const perProtocol = Math.max(5, Math.ceil((limit * 2) / activeProtocols.length));
  const results = await Promise.allSettled(
    activeProtocols.map(async (p) => {
      try {
        const events = await p.fetchFn(perProtocol);
        return events.map((e) => ({ ...e, protocol: p.name }));
      } catch {
        return [] as UnifiedEvent[];
      }
    }),
  );

  // Collect all events
  const allEvents: UnifiedEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allEvents.push(...r.value);
  }

  // Apply filters
  let filtered = allEvents;

  if (filters?.categories?.length) {
    const cats = filters.categories.map((c) => c.toLowerCase());
    filtered = filtered.filter((e) => e.categories.some((c) => cats.includes(c.toLowerCase())));
  }

  if (filters?.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    filtered = filtered.filter((e) => new Date(e.beginsOn).getTime() >= from);
  }

  if (filters?.dateTo) {
    const to = new Date(filters.dateTo).getTime();
    filtered = filtered.filter((e) => new Date(e.beginsOn).getTime() <= to);
  }

  if (filters?.location) {
    const q = filters.location.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.location?.name?.toLowerCase().includes(q) ||
        e.location?.address?.toLowerCase().includes(q) ||
        e.location?.locality?.toLowerCase().includes(q),
    );
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Deduplicate by content hash
  const seen = new Set<string>();
  const deduped: UnifiedEvent[] = [];
  for (const e of filtered) {
    const key = contentHash(e);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  // Sort by date (upcoming first)
  deduped.sort((a, b) => new Date(a.beginsOn).getTime() - new Date(b.beginsOn).getTime());

  // Limit
  const sliced = deduped.slice(0, limit);

  return { events: sliced, total: sliced.length };
}

// ─── Trending Events ────────────────────────────────────────────────────

/**
 * Get trending events based on RSVP count and recency.
 */
export async function fetchTrendingEvents(limit = 20): Promise<UnifiedEvent[]> {
  const { events } = await fetchUnifiedEventsFeed(limit * 3);

  const now = Date.now();
  const scored = events.map((e) => {
    const rsvpScore = e.rsvpCount * 10;
    const recencyMs = now - new Date(e.beginsOn).getTime();
    const recencyScore = Math.max(0, 1 - recencyMs / (30 * 24 * 60 * 60 * 1000)) * 50;
    const score = rsvpScore + recencyScore;
    return { event: e, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.event);
}

// ─── Events Near Location ──────────────────────────────────────────────

/**
 * Filter events near a location string.
 */
export async function fetchEventsNear(locationQuery: string, limit = 20): Promise<UnifiedEvent[]> {
  const { events } = await fetchUnifiedEventsFeed(limit * 2, { location: locationQuery });
  return events.slice(0, limit);
}

// ─── Events by Creator ─────────────────────────────────────────────────

/**
 * Get events created by a specific DID/handle across protocols.
 */
export async function fetchEventsByCreator(
  creatorDid: string,
  limit = 20,
): Promise<UnifiedEvent[]> {
  const { events } = await fetchUnifiedEventsFeed(limit * 2);
  return events
    .filter((e) => e.organizer?.id?.includes(creatorDid) || e.organizer?.primary?.id === creatorDid)
    .slice(0, limit);
}

// ─── Event Discovery ────────────────────────────────────────────────────

export interface EventDiscoveryResult {
  trending: UnifiedEvent[];
  upcoming: UnifiedEvent[];
  near: UnifiedEvent[];
  byCreator: UnifiedEvent[];
  byCategory: Record<string, UnifiedEvent[]>;
}

/**
 * Comprehensive event discovery — returns trending, upcoming, and categorized events.
 */
export async function discoverEvents(
  creatorDid?: string,
  location?: string,
  limit = 10,
): Promise<EventDiscoveryResult> {
  const [trending, upcoming, near, byCreator, all] = await Promise.all([
    fetchTrendingEvents(limit),
    fetchUnifiedEventsFeed(limit, { dateFrom: new Date().toISOString() }).then((r) => r.events),
    location ? fetchEventsNear(location, limit) : Promise.resolve([]),
    creatorDid ? fetchEventsByCreator(creatorDid, limit) : Promise.resolve([]),
    fetchUnifiedEventsFeed(limit * 3).then((r) => r.events),
  ]);

  // Group by category
  const byCategory: Record<string, UnifiedEvent[]> = {};
  for (const e of all) {
    for (const cat of e.categories) {
      if (!byCategory[cat]) byCategory[cat] = [];
      if (byCategory[cat].length < 5) byCategory[cat].push(e);
    }
  }

  return { trending, upcoming, near, byCreator, byCategory };
}
