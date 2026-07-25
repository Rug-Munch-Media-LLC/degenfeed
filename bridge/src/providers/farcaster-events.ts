/**
 * Farcaster Event Frames Provider
 *
 * Discovers events from Farcaster casts that contain event-related content:
 *   - OpenGraph/twitter card embeds pointing to event pages
 *   - Casts mentioning specific event keywords
 *   - Event-specific channels (#events, #meetup, etc.)
 *
 * Uses the self-hosted Hubble hub for data.
 */

import type { SchemaGuard, UnifiedEvent, FarcasterEventFrame } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const HUBBLE_BASE = process.env.HUBBLE_URL || 'http://127.0.0.1:2281';

// Event-related Farcaster channels (these are real channel IDs on Farcaster)
const EVENT_CHANNELS = [
  'events',
  'meetups',
  'conferences',
  'hackathons',
  'crypto-events',
  'ethereum-events',
  'solana-events',
];

const EVENT_KEYWORDS = [
  'event', 'meetup', 'conference', 'hackathon', 'workshop', 'talk',
  'panel', 'summit', 'convention', 'festival', 'live show', 'concert',
  'webinar', 'AMA', 'town hall', 'community call',
];

const CURATED_FIDS: number[] = [
  1, 2, 3, 50, 215, 228, 239, 339, 354, 433, 602, 615, 910,
  1099, 1565, 2281, 2875, 3093, 3621, 4120, 4983, 5120,
  5650, 6423, 7486, 7771, 8642, 8832, 9245,
];

const FETCH_TIMEOUT_MS = 10000;

// ─── Helpers ──────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  return text.match(urlRegex) || [];
}

function isEventRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return EVENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractEventDate(text: string): string | undefined {
  // Try to find date patterns: "June 15", "2024-06-15", "tomorrow", "next week"
  const dateRegex = /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b)/gi;
  const match = text.match(dateRegex);
  if (match) return match[0];

  const isoRegex = /\b\d{4}-\d{2}-\d{2}\b/g;
  const isoMatch = text.match(isoRegex);
  if (isoMatch) return isoMatch[0];

  return undefined;
}

function extractEventTitle(text: string): string | undefined {
  // Try to find title patterns: first line if short, or after "Event:" pattern
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 200 && !trimmed.startsWith('http')) {
      return trimmed;
    }
  }
  return undefined;
}

function guessEventCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const cats: string[] = [];
  if (/\b(crypto|bitcoin|ethereum|solana|blockchain|defi)\b/.test(lower)) cats.push('crypto');
  if (/\b(ai|artificial|intelligence|llm)\b/.test(lower)) cats.push('ai');
  if (/\b(hackathon|tech|developer|code|programming)\b/.test(lower)) cats.push('tech');
  if (/\b(music|concert|festival|dj|live)\b/.test(lower)) cats.push('music');
  if (/\b(community|social|meetup|networking)\b/.test(lower)) cats.push('social');
  if (cats.length === 0) cats.push('general');
  return cats;
}

// ─── Fetch from Hubble ───────────────────────────────────────────────

async function fetchCastsFromHubble(
  fid: number,
  limit: number,
): Promise<FarcasterEventFrame[]> {
  try {
    const res = await $fetch(
      `${HUBBLE_BASE}/v1/castsByFid?fid=${fid}&pageSize=${Math.min(limit, 25)}`,
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      messages?: Array<{
        data?: {
          fid?: number;
          timestamp?: number;
          castAddBody?: {
            text?: string;
            embeds?: Array<{ url: string }>;
            parentCastId?: { fid: number; hash: string };
          };
        };
        hash?: string;
      }>;
    };

    if (!data.messages) return [];

    return data.messages
      .filter((msg) => {
        const text = msg?.data?.castAddBody?.text || '';
        return isEventRelated(text);
      })
      .map((msg): FarcasterEventFrame | null => {
        try {
          const body = msg?.data?.castAddBody;
          if (!body || !body.text) return null;

          return {
            fid: msg.data?.fid || fid,
            hash: msg.hash || '',
            text: body.text,
            embeds: body.embeds || [],
            timestamp: msg.data?.timestamp || Date.now(),
            parentHash: body.parentCastId?.hash,
            parentFid: body.parentCastId?.fid,
            eventUrl: undefined,
            eventTitle: extractEventTitle(body.text),
            eventDate: extractEventDate(body.text),
          };
        } catch {
          return null;
        }
      })
      .filter((f): f is FarcasterEventFrame => f !== null);
  } catch {
    return [];
  }
}

// ─── Normalization ────────────────────────────────────────────────────

function farcasterFrameToUnifiedEvent(frame: FarcasterEventFrame): UnifiedEvent | null {
  try {
    const title = frame.eventTitle || 'Untitled Farcaster Event';
    const eventUrl = frame.eventUrl || frame.embeds[0]?.url || `https://warpcast.com/~/conversations/${frame.hash}`;
    const eventDate = frame.eventDate || new Date(frame.timestamp * 1000).toISOString().split('T')[0];

    // Try to parse a date from frame text
    const beginsOn = frame.eventDate
      ? new Date(frame.eventDate).toISOString()
      : new Date(frame.timestamp * 1000).toISOString();

    return {
      id: `farcaster-event:${frame.hash}`,
      protocol: 'farcaster-event',
      title,
      description: frame.text.slice(0, 2000),
      beginsOn,
      isOnline: true,
      organizer: {
        id: `farcaster:${frame.fid}`,
        primary: { protocol: 'farcaster', id: String(frame.fid) },
        handles: { farcaster: `fid:${frame.fid}` },
        displayName: `Farcaster User #${frame.fid}`,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [{ label: 'profile', url: `https://warpcast.com/~/profiles/${frame.fid}` }],
        keys: { farcasterFid: String(frame.fid) },
      },
      tags: extractUrls(frame.text),
      picture: undefined,
      url: eventUrl,
      rsvpCount: 0,
      status: 'confirmed',
      visibility: 'public',
      categories: guessEventCategories(frame.text),
      createdAt: frame.timestamp * 1000,
      raw: frame,
    };
  } catch {
    return null;
  }
}

// ─── Main Fetch ───────────────────────────────────────────────────────

/**
 * Fetch event-related Farcaster casts and normalize to UnifiedEvent.
 */
export async function fetchFarcasterEvents(limit = 20): Promise<UnifiedEvent[]> {
  const perFid = Math.max(3, Math.ceil(limit / CURATED_FIDS.length));

  const results = await Promise.allSettled(
    CURATED_FIDS.map((fid) => fetchCastsFromHubble(fid, perFid)),
  );

  const allFrames: FarcasterEventFrame[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allFrames.push(...r.value);
  }

  // Deduplicate by hash
  const seen = new Set<string>();
  const unified: UnifiedEvent[] = [];
  for (const frame of allFrames) {
    if (!seen.has(frame.hash)) {
      seen.add(frame.hash);
      const ue = farcasterFrameToUnifiedEvent(frame);
      if (ue) {
        unified.push(ue);
        if (unified.length >= limit) break;
      }
    }
  }

  console.log(`[farcaster-events] ${unified.length} event frames`);
  return unified;
}

// ─── Provider Schema ─────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'farcaster-events',
  name: 'Farcaster Event Frames',
  description: 'Events discovered from Farcaster casts with event-related content',
  endpoint: '/api/events/farcaster',
  requiresAuth: false,
  contentType: 'event',
};
