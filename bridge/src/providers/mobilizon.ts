/**
 * Mobilizon Provider
 *
 * Fetches events from Mobilizon instances — a federated, open-source
 * event planning platform (meetup.com alternative) with ActivityPub.
 *
 * API: GraphQL at /api or /graphiql
 *   Query: searchEvents(location, radius, tags, term, beginsOn, endsOn, limit)
 *   Mutation: createEvent(...)
 *
 * Strategy:
 * 1. GraphQL API from DegenFeed Mobilizon fork + public instances
 * 2. RSS feed fallback
 * 3. ICS calendar export fallback
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface MobilizonSource {
  instance: string;
  displayName: string;
}

const CURATED_INSTANCES: MobilizonSource[] = [
  { instance: 'http://127.0.0.1:8098', displayName: 'DegenFeed Events' },
  { instance: 'https://mobilizon.fr', displayName: 'Mobilizon France' },
  { instance: 'https://mobilizon.org', displayName: 'Mobilizon Main' },
];

const SEARCH_EVENTS_QUERY = `
query SearchEvents($limit: Int) {
  searchEvents(limit: $limit) {
    total
    elements {
      id
      title
      uuid
      beginsOn
      endsOn
      description
      status
      visibility
      tags { id slug title }
      picture { id url name }
      physicalAddress {
        description
        locality
        region
        country
        postalCode
        streetAddress
      }
      onlineAddress
      organizerActor { id preferredUsername name summary }
      attributedTo { id preferredUsername name summary }
      options {
        maximumAttendeeCapacity
        remainingAttendeeCapacity
        showAttendeeCapacity
        isOnline
      }
      contacts { name email }
    }
  }
}
`;

// ─── Types ─────────────────────────────────────────────────────────────

interface MobilizonActor {
  id: string;
  preferredUsername?: string;
  name?: string;
  summary?: string;
}

interface MobilizonAddress {
  description?: string;
  locality?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  streetAddress?: string;
}

interface MobilizonEvent {
  id: string;
  title: string;
  uuid: string;
  beginsOn: string;
  endsOn?: string;
  description?: string;
  status?: string;
  visibility?: string;
  tags?: Array<{ id: string; slug: string; title: string }>;
  picture?: { id: string; url: string; name?: string };
  physicalAddress?: MobilizonAddress;
  onlineAddress?: string;
  organizerActor?: MobilizonActor;
  attributedTo?: MobilizonActor;
  options?: {
    maximumAttendeeCapacity?: number;
    remainingAttendeeCapacity?: number;
    isOnline?: boolean;
  };
  contacts?: Array<{ name: string; email: string }>;
}

interface MobilizonSearchResponse {
  data?: {
    searchEvents?: {
      total: number;
      elements: MobilizonEvent[];
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAddress(addr?: MobilizonAddress): string {
  if (!addr) return '';
  const parts = [addr.streetAddress, addr.locality, addr.region, addr.country].filter(Boolean);
  return parts.join(', ');
}

function guessEventNiches(title: string, desc: string, tags: string[] = []): string[] {
  const lower = `${title} ${desc} ${tags.join(' ')}`.toLowerCase();
  const niches: string[] = [];
  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi|nft)\b/.test(lower))
    niches.push('crypto');
  if (/\b(ai|artificial|intelligence|llm|machine.learning)\b/.test(lower)) niches.push('ai');
  if (/\b(tech|technology|programming|code|developer|hackathon)\b/.test(lower)) niches.push('tech');
  if (/\b(meetup|conference|workshop|talk|lecture|seminar)\b/.test(lower)) niches.push('events');
  if (/\b(music|concert|festival|performance|dj|live)\b/.test(lower)) niches.push('music');
  if (/\b(art|exhibition|gallery|culture|museum)\b/.test(lower)) niches.push('art');
  if (/\b(dao|community|governance|vote|proposal)\b/.test(lower)) niches.push('dao');
  if (niches.length === 0) niches.push('events');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function eventToPost(event: MobilizonEvent, source: MobilizonSource): UnifiedPost {
  const desc = event.description ? stripHtml(event.description).slice(0, 1000) : '';
  const location = formatAddress(event.physicalAddress);
  const isOnline = event.options?.isOnline || !!event.onlineAddress;
  const tags = (event.tags || []).map((t) => t.title || t.slug);

  const text = [
    `📅 ${event.title}`,
    `📆 ${new Date(event.beginsOn).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    event.endsOn
      ? `  → ${new Date(event.endsOn).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '',
    isOnline ? `🌐 Online: ${event.onlineAddress || 'Virtual event'}` : '',
    location ? `📍 ${location}` : '',
    '',
    desc,
    tags.length > 0 ? `\n🏷️ ${tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: `mobilizon:${event.uuid}@${source.instance}`,
    protocol: 'mobilizon',
    author: {
      id: `mobilizon:${event.organizerActor?.id || event.attributedTo?.id || 'unknown'}`,
      primary: {
        protocol: 'mobilizon',
        id: event.organizerActor?.preferredUsername || 'organizer',
      },
      handles: { mobilizon: event.organizerActor?.preferredUsername || null },
      displayName: event.organizerActor?.name || event.attributedTo?.name || 'Event Organizer',
      bio: event.organizerActor?.summary ? stripHtml(event.organizerActor.summary) : '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [
      ...(event.picture?.url ? [{ kind: 'image' as const, url: event.picture.url }] : []),
      {
        kind: 'link',
        url: `${source.instance}/events/${event.uuid}`,
        meta: { title: event.title },
      },
    ],
    contentType: 'event',
    createdAt: new Date(event.beginsOn).getTime(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: event.options?.maximumAttendeeCapacity || undefined,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: { ...event, _instanceUrl: source.instance },
    niches: guessEventNiches(event.title, desc, tags),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromInstance(source: MobilizonSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${source.instance}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1 (Mobilizon)',
      },
      body: JSON.stringify({ query: SEARCH_EVENTS_QUERY, variables: { limit } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as MobilizonSearchResponse;
    const elements = data?.data?.searchEvents?.elements || [];
    if (!Array.isArray(elements)) return [];

    return elements
      .filter((e: MobilizonEvent) => e.status === 'confirmed' || e.status === 'published')
      .slice(0, limit)
      .map((e: MobilizonEvent) => eventToPost(e, source));
  } catch (err) {
    // console.log(`[bridge] Mobilizon GraphQL error (${source.instance}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'mobilizon',
  name: 'Mobilizon',
  description: 'Federated event planning platform (meetup.com alternative)',
  endpoint: '/api/feed/mobilizon',
  requiresAuth: false,
  contentType: 'event',
};

export async function fetchMobilizonPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / CURATED_INSTANCES.length));

  const results = await Promise.allSettled(
    CURATED_INSTANCES.map((src) => fetchFromInstance(src, perSource)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Mobilizon: ${deduped.length} events`);
  return deduped;
}

// ─── UnifiedEvent Conversion ─────────────────────────────────────────────

/**
 * Convert a UnifiedPost (from Mobilizon) to a UnifiedEvent for the event bridge.
 */
export function mobilizonEventToUnified(
  post: UnifiedPost,
): import('../server/types').UnifiedEvent | null {
  try {
    const lines = post.text?.split('\n') || [];
    const title = lines[0]?.replace(/^[📅🎉]\s*/u, '').trim() || 'Untitled Event';
    const desc = lines
      .slice(2)
      .filter((l) => !l.startsWith('📍') && !l.startsWith('🌐') && !l.startsWith('🏷️'))
      .join('\n')
      .trim();
    const locationLine = lines.find((l) => l.startsWith('📍'))?.replace('📍 ', '') || '';
    const onlineLine = lines.find((l) => l.startsWith('🌐'))?.replace('🌐 Online: ', '') || '';
    const isOnline = !!onlineLine;
    const tagLine = lines.find((l) => l.startsWith('🏷️'))?.replace('🏷️ ', '') || '';
    const tags = tagLine ? tagLine.split(',').map((t: string) => t.trim()) : [];

    const raw = (post.raw || {}) as Record<string, unknown>;
    const beginsOn = (raw.beginsOn as string) || new Date(post.createdAt).toISOString();
    const endsOn = raw.endsOn as string | undefined;
    const physicalAddress = raw.physicalAddress as Record<string, string> | undefined;
    const picture = raw.picture as { url: string; name?: string } | undefined;

    return {
      id: post.id,
      protocol: 'mobilizon',
      title,
      description: desc.slice(0, 2000),
      beginsOn,
      endsOn,
      location: physicalAddress
        ? {
            name: physicalAddress.description || '',
            address: physicalAddress.streetAddress || '',
            locality: physicalAddress.locality || '',
            region: physicalAddress.region || '',
            country: physicalAddress.country || '',
          }
        : locationLine
          ? { name: locationLine, address: locationLine }
          : undefined,
      onlineAddress: onlineLine || undefined,
      isOnline,
      organizer: post.author,
      tags,
      picture: picture ? { url: picture.url, name: picture.name } : undefined,
      url:
        (raw.uuid ? `${(raw as any)._instanceUrl || ''}/events/${raw.uuid}` : undefined) ||
        post.embeds?.find((e) => e.kind === 'link')?.url ||
        '',
      rsvpCount: 0,
      maxAttendees: (raw.options as Record<string, unknown>)?.maximumAttendeeCapacity as
        | number
        | undefined,
      status: raw.status === 'cancelled' ? 'cancelled' : 'confirmed',
      visibility: (raw.visibility as string) === 'private' ? 'private' : 'public',
      categories: guessEventNiches(title, desc, tags),
      createdAt: post.createdAt,
      raw: post,
    };
  } catch {
    return null;
  }
}

export const fetch = fetchMobilizonPosts;
