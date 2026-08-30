/**
 * Nostr NIP-29 Groups Provider
 *
 * NIP-29 defines decentralized group chats on Nostr (kind 9000-9030).
 * Groups can be public communities, chat rooms, or support channels.
 *
 * What it adds: Community group discussions from the Nostr ecosystem
 * NIP-29: Nostr Groups (kind 9000-9030 for group events)
 * NIPs: 29 (Groups), 90 (Data Vending Machines - kind 5000-5999)
 *
 * Data sources: Nostr relays supporting NIP-29
 * Self-host: Already running a Nostr relay (strfry/nostr-rs-relay)
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// Nostr relays that support NIP-29 group events
const NIP29_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  ...(process.env.NOSTR_RELAYS?.split(',').filter(Boolean) ?? []),
];

// NIP-29 uses kind 9000-9030 for group management
// kind 11 is regular thread, kind 12 is group thread (NIP-29)
const NIP29_KINDS = [11, 12, 9000, 9001, 9002, 9003, 9004, 9005, 9006, 9007, 9011, 9021, 9030];

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// Simple Nostr relay query via HTTP (NIP-11)
async function queryRelayEvents(
  _relay: string,
  kinds: number[],
  limit: number,
): Promise<NostrEvent[]> {
  try {
    // Try HTTP relay proxy if available

    // Use nostr.wine or similar public NIP-11 relay proxy
    const searchUrl = `https://relay.nostr.band/npub?kinds=${kinds.join(',')}&limit=${limit}`;
    const res = await $fetch(searchUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
    });

    if (!res.ok) return [];
    const text = await res.text();
    const events: NostrEvent[] = [];

    // Parse NDJSON response
    for (const line of text.trim().split('\n')) {
      try {
        const parsed = JSON.parse(line);
        if (Array.isArray(parsed) && parsed[0] === 'EVENT' && parsed[2]) {
          events.push(parsed[2] as NostrEvent);
        }
      } catch {
        // skip malformed lines
      }
    }
    return events.slice(0, limit);
  } catch {
    return [];
  }
}

function extractNIP29Metadata(event: NostrEvent): {
  groupId?: string;
  groupName?: string;
  memberCount?: number;
} {
  const groupTag = event.tags.find((t) => t[0] === 'd');
  const nameTag = event.tags.find((t) => t[0] === 'name');
  const memberTag = event.tags.find((t) => t[0] === 'member');

  return {
    groupId: groupTag?.[1],
    groupName: nameTag?.[1],
    memberCount: memberTag ? parseInt(memberTag[1]!, 10) : undefined,
  };
}

export async function fetchNostrGroupsPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:nostr-groups';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  const results = await Promise.allSettled(
    NIP29_RELAYS.map((relay) =>
      queryRelayEvents(relay, NIP29_KINDS, Math.ceil(limit / NIP29_RELAYS.length)),
    ),
  );

  const events: NostrEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') events.push(...r.value);
  }

  const posts: UnifiedPost[] = [];
  const seen = new Set<string>();

  for (const event of events.sort((a, b) => b.created_at - a.created_at)) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);

    const meta = extractNIP29Metadata(event);
    const isChat = event.kind === 11 || event.kind === 12;
    const groupId = meta.groupId ?? event.tags.find((t) => t[0] === 'h')?.[1] ?? 'unknown';
    const groupName =
      meta.groupName ??
      event.tags.find((t) => t[0] === 'd')?.[1] ??
      `Nostr Group ${groupId.slice(0, 8)}`;

    const text = isChat
      ? `💬 [${groupName}] ${event.content.slice(0, 280)}`
      : `🏛️ ${groupName} — ${event.content.slice(0, 280)}`;

    const niches = ['nostr', 'groups', 'chat', groupName.toLowerCase().replace(/\s+/g, '-')];

    posts.push({
      id: `nostr-group-${event.id}`,
      protocol: 'nostr-groups',
      author: {
        id: `nostr:${event.pubkey}`,
        primary: { protocol: 'nostr', id: event.pubkey },
        handles: { nostr: event.pubkey.slice(0, 12) },
        displayName: `NIP-29 ${groupName}`,
        bio: `Group on Nostr (kind ${event.kind})`,
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text,
      html: `<p>${event.content}</p>`,
      embeds: [],
      createdAt: event.created_at * 1000,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: event,
      niches,
      contentType: isChat ? 'chat' : 'group',
    });

    if (posts.length >= limit) break;
  }

  return posts.slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'nostr-groups',
  name: 'Nostr Groups (NIP-29)',
  description: 'Decentralized group chats & communities on Nostr NIP-29 protocol',
  endpoint: '/api/feed/nostr-groups',
  requiresAuth: false,
  contentType: 'chat',
};
