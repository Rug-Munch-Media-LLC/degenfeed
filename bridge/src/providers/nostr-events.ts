/**
 * Nostr NIP-52 Calendar Events Provider
 *
 * Fetches calendar events from Nostr relays using NIP-52 (kind 31922).
 * NIP-52 defines a standardized calendar event format:
 *   kind: 31922 (calendar event) — a single event occurrence
 *   kind: 31923 (calendar) — a list of events (RSVP)
 *   kind: 31924 (date-based calendar event) — events with dates instead of timestamps
 *
 * Tags:
 *   d   — identifier (required)
 *   title — event title
 *   start — Unix timestamp of event start
 *   end   — Unix timestamp of event end
 *   location — event location (string or geohash)
 *   g     — geohash for location-based queries
 *   t     — hashtag
 *   p     — pubkey of participant
 *   r     — reference URL
 */

import type { NostrCalendarEvent, SchemaGuard, UnifiedEvent } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const RELAYS = [
  'ws://127.0.0.1:8085',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://purplepag.es',
];

const KIND_CALENDAR_EVENT = 31922;
const KIND_CALENDAR = 31923;

const FETCH_TIMEOUT_MS = 8000;

// ─── Helpers ──────────────────────────────────────────────────────────

function extractTag(tags: string[][], key: string): string | undefined {
  const tag = tags.find((t) => t[0] === key);
  return tag?.[1];
}

function extractAllTags(tags: string[][], key: string): string[] {
  return tags.filter((t) => t[0] === key).map((t) => t[1]);
}

function hexToBech32(hex: string): string {
  if (!hex || hex.length < 8) return hex || 'unknown';
  return hex.slice(0, 12);
}

function guessEventCategories(title: string, desc: string, tags: string[]): string[] {
  const lower = `${title} ${desc} ${tags.join(' ')}`.toLowerCase();
  const cats: string[] = [];
  if (/\b(crypto|bitcoin|ethereum|solana|blockchain|defi|nft)\b/.test(lower)) cats.push('crypto');
  if (/\b(ai|artificial|intelligence|llm|machine.learning)\b/.test(lower)) cats.push('ai');
  if (/\b(tech|hackathon|conference|workshop|meetup|talk)\b/.test(lower)) cats.push('tech');
  if (/\b(music|concert|festival|dj|live)\b/.test(lower)) cats.push('music');
  if (/\b(art|exhibition|gallery)\b/.test(lower)) cats.push('art');
  if (/\b(social|party|community|networking)\b/.test(lower)) cats.push('social');
  if (/\b(sport|game|gaming|esport)\b/.test(lower)) cats.push('gaming');
  if (cats.length === 0) cats.push('general');
  return cats;
}

// ─── Fetch from Relay ─────────────────────────────────────────────────

function fetchEventsFromRelay(
  relayUrl: string,
  limit: number,
  timeout = FETCH_TIMEOUT_MS,
): Promise<NostrCalendarEvent[]> {
  return new Promise((resolve) => {
    const events: NostrCalendarEvent[] = [];
    let resolved = false;
    let ws: WebSocket | null = null;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws?.close();
        resolve(events);
      }
    }, timeout);

    try {
      ws = new WebSocket(relayUrl);

      ws.addEventListener('open', () => {
        if (!ws) return;
        // Subscribe to NIP-52 calendar events
        ws.send(
          JSON.stringify([
            'REQ',
            'degenfeed-calendar',
            {
              kinds: [KIND_CALENDAR_EVENT],
              limit: Math.min(limit, 50),
            },
          ]),
        );
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg[0] === 'EVENT' && msg[2]?.kind === KIND_CALENDAR_EVENT) {
            events.push(msg[2] as NostrCalendarEvent);
          }
          if (msg[0] === 'EOSE') {
            clearTimeout(timer);
            if (!resolved) {
              resolved = true;
              ws?.close();
              resolve(events);
            }
          }
        } catch {
          // Bad message
        }
      });

      ws.addEventListener('error', () => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(events);
        }
      });

      ws.addEventListener('close', () => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(events);
        }
      });

      // Safety: close after 2x timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws?.close();
          resolve(events);
        }
      }, timeout * 2);
    } catch {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve(events);
      }
    }
  });
}

// ─── Normalization ────────────────────────────────────────────────────

function nostrEventToUnified(event: NostrCalendarEvent): UnifiedEvent | null {
  try {
    const identifier = extractTag(event.tags, 'd') || event.id.slice(0, 12);
    const title = extractTag(event.tags, 'title') || 'Untitled Event';
    const startStr = extractTag(event.tags, 'start');
    const endStr = extractTag(event.tags, 'end');
    const location = extractTag(event.tags, 'location');
    const geohash = extractTag(event.tags, 'g');
    const refs = extractAllTags(event.tags, 'r');
    const hashtags = extractAllTags(event.tags, 't');
    const participants = extractAllTags(event.tags, 'p');

    const startUnix = startStr ? parseInt(startStr, 10) : event.created_at;
    const endUnix = endStr ? parseInt(endStr, 10) : undefined;

    if (!startUnix || isNaN(startUnix)) return null;

    const beginsOn = new Date(startUnix * 1000).toISOString();
    const endsOn = endUnix ? new Date(endUnix * 1000).toISOString() : undefined;

    const content = event.content || '';
    const description = content.slice(0, 2000);

    return {
      id: `nostr-calendar:${identifier}@${event.id.slice(0, 8)}`,
      protocol: 'nostr-calendar',
      title: title.slice(0, 200),
      description,
      beginsOn,
      endsOn,
      location: location ? { name: location, address: location } : undefined,
      isOnline: !location,
      organizer: {
        id: `nostr:${event.pubkey}`,
        primary: { protocol: 'nostr', id: event.pubkey },
        handles: { nostr: hexToBech32(event.pubkey) },
        displayName: hexToBech32(event.pubkey),
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: { nostrPubkey: event.pubkey },
      },
      tags: hashtags,
      picture: refs.length > 0 ? { url: refs[0] } : undefined,
      url: refs[0] || `nostr:${event.id}`,
      rsvpCount: participants.length,
      status: 'confirmed',
      visibility: 'public',
      categories: guessEventCategories(title, description, hashtags),
      createdAt: event.created_at * 1000,
      raw: event,
    };
  } catch {
    return null;
  }
}

// ─── Main Fetch ───────────────────────────────────────────────────────

/**
 * Fetch NIP-52 calendar events from Nostr relays.
 */
export async function fetchNostrCalendarEvents(limit = 20): Promise<UnifiedEvent[]> {
  const perRelay = Math.max(5, Math.ceil(limit / RELAYS.length));

  const results = await Promise.allSettled(
    RELAYS.map((relay) => fetchEventsFromRelay(relay, perRelay)),
  );

  const allEvents: NostrCalendarEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allEvents.push(...r.value);
  }

  // Deduplicate by event id
  const seen = new Set<string>();
  const unified: UnifiedEvent[] = [];
  for (const e of allEvents) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      const ue = nostrEventToUnified(e);
      if (ue) {
        unified.push(ue);
        if (unified.length >= limit) break;
      }
    }
  }

  console.log(`[nostr-events] NIP-52: ${unified.length} calendar events`);
  return unified;
}

// ─── Provider Schema ─────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'nostr-calendar',
  name: 'Nostr NIP-52 Calendar Events',
  description: 'Calendar events from Nostr relays using NIP-52 (kind 31922)',
  endpoint: '/api/events/nostr',
  requiresAuth: false,
  contentType: 'event',
};
