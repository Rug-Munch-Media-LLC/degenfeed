/**
 * Gancio Provider — Federated Event Calendar
 *
 * Gancio shares events over ActivityPub. Self-hostable, lightweight,
 * federated alternative to Meetup/Eventbrite.
 *
 * API: Public REST + ActivityPub outbox
 * Self-host: https://gancio.org/
 *
 * What it adds to DegenFeed:
 * - Real-world IRL events (meetups, conferences, hackathons)
 * - Federated via ActivityPub for cross-instance discovery
 * - Lightweight alternative to Mobilizon (fewer features, simpler deploy)
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const GANCIO_INSTANCES: string[] = [
  ...(process.env.GANCIO_INSTANCES?.split(',').filter(Boolean) ?? []),
  'https://gancio.cisti.org',
  'https://events.codeberg.org',
  'https://agora.pepcyber.fr',
  'https://events.ivpn.net',
];

interface GancioEvent {
  id: number;
  title: string;
  description: string;
  content: string;
  start_datetime: string;
  end_datetime?: string;
  location?: string;
  address?: string;
  lat?: string;
  lon?: string;
  tags?: Array<{ slug: string; title: string }>;
  online?: boolean;
  url?: string;
  pict?: string;
  actor?: {
    id: number;
    username: string;
    display_name?: string;
    avatar?: string;
  };
  mb_remote_url?: string;
}

interface GancioResponse {
  events?: GancioEvent[];
  data?: GancioEvent[];
}

async function fetchInstanceEvents(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await $fetch(`${instance}/api/events?limit=${limit}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const json: GancioResponse = await res.json();
    const events = json.events ?? json.data ?? [];

    return events.slice(0, limit).map((event) => {
      const tags = event.tags?.map((t) => t.title) ?? [];
      const _location = event.location || event.address || '';

      return {
        id: `gancio-${instance}-${event.id}`,
        protocol: 'gancio',
        author: {
          id: `gancio:${instance}:${event.actor?.username ?? 'anonymous'}`,
          primary: { protocol: 'gancio', id: String(event.actor?.id ?? event.id) },
          handles: { gancio: event.actor?.username ?? null },
          displayName: event.actor?.display_name ?? event.actor?.username ?? 'Event Organizer',
          bio: '',
          avatarUrl: event.actor?.avatar ?? '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `📅 ${event.title}\n${event.description?.slice(0, 280) ?? ''}`,
        html: event.content ?? event.description ?? '',
        embeds: [
          ...(event.pict ? [{ kind: 'image' as const, url: event.pict }] : []),
          ...(event.url ? [{ kind: 'link' as const, url: event.url }] : []),
        ],
        createdAt: new Date(event.start_datetime).getTime(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: event,
        niches: ['events', ...tags.map((t) => t.toLowerCase())],
        contentType: 'event',
      };
    });
  } catch {
    return [];
  }
}

export async function fetchGancioPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:gancio';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  const results = await Promise.allSettled(
    GANCIO_INSTANCES.map((inst) =>
      fetchInstanceEvents(inst, Math.ceil(limit / GANCIO_INSTANCES.length)),
    ),
  );

  const posts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }

  return posts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'gancio',
  name: 'Gancio Events',
  description: 'Federated event calendar — real-world meetups, conferences & hackathons',
  endpoint: '/api/feed/gancio',
  requiresAuth: false,
  contentType: 'event',
};
