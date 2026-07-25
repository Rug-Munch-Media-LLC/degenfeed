/**
 * @degenfeed/api-worker — Protocol-specific feed sections.
 *
 * GET /api/feed/protocol-sections?protocol=<farcaster|lens|bluesky|nostr|mastodon>
 *
 * Returns two curated sections per protocol for the protocol pages:
 *   Farcaster: Trending Channels + Popular Frames
 *   Lens:      Top Collectors + Hot Mirrors
 *   Bluesky:   Popular Custom Feeds + Trending Labels
 *   Nostr:     Active Relays + Most Zapped
 *   Mastodon:  Trending Hashtags + Popular Instances
 *
 * Aggregates from the (already cached) home feed via loopback fetch,
 * plus protocol-native public APIs where available. Cached 5 min in KV.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SectionItem {
  id: string;
  /** Primary label (channel name, relay url, author name…). */
  label: string;
  /** Secondary line (handle, domain, snippet…). */
  sublabel?: string;
  /** Numeric signal shown on the right (posts, zaps, collects…). */
  value: number;
  /** Unit for the value ("posts", "zaps", "collects"…). */
  unit: string;
  url?: string;
  imageUrl?: string;
}

export interface ProtocolSection {
  id: string;
  title: string;
  icon: string;
  items: SectionItem[];
}

export interface ProtocolSectionsResponse {
  protocol: string;
  sections: ProtocolSection[];
  fetchedAt: number;
}

const SUPPORTED = new Set([
  'farcaster',
  'lens',
  'bluesky',
  'nostr',
  'mastodon',
  'pixelfed',
  'lemmy',
  'peertube',
  'threads',
  'zora',
  'reddit',
  'rss',
  'mirror',
  'hive',
  'dtube',
  'lbry',
  'pleroma',
  'misskey',
  'writefreely',
  'funkwhale',
  'castopod',
  'subsocial',
  'steem',
  'telegram',
  'diaspora',
  'friendica',
  'mediagoblin',
  'bookwyrm',
  'mobilizon',
  'bonfire',
  'mitra',
  'takahe',
  'forgejo',
  'owncast',
  'faircamp',
  'gab',
  'minds',
  'aether',
  'scuttlebutt',
  'deso',
  'session',
  'cyberconnect',
  'arena',
  'microblog',
  'orbis',
  'ceramic',
  'audius',
  'rarible',
  'xmtp',
  'push',
  'huddle01',
  'tableland',
  'ponder',
  'ethereum',
  'solana',
  'kbin',
  'tildes',
  'discord',
  'matrix',
  'github',
]);
const CACHE_TTL = 300; // 5 minutes
const API_TIMEOUT_MS = 3000;
const MAX_ITEMS = 6;

// ─── Helpers ──────────────────────────────────────────────────────────────

function cacheKey(protocol: string): string {
  return `protocol:sections:v1:${protocol}`;
}

/** Loopback fetch of the protocol feed (hits the KV feed cache when warm). */
async function fetchProtocolPosts(protocol: string, limit = 100): Promise<UnifiedPost[]> {
  try {
    const req = new Request(
      `http://localhost/api/feed/home?limit=${limit}&protocols=${protocol}&sort=new&preset=everything`,
    );
    const res = await fetch(req);
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: UnifiedPost[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

function raw(post: UnifiedPost): Record<string, unknown> {
  return (post.raw ?? {}) as Record<string, unknown>;
}

function engagementOf(p: UnifiedPost): number {
  return p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3;
}

function snippet(text: string, len = 60): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, len);
}

function topHashtags(posts: UnifiedPost[], unit: string): SectionItem[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const tags = p.text.match(/#[a-zA-Z][a-zA-Z0-9_]{1,30}/g) ?? [];
    for (const t of new Set(tags.map((t) => t.toLowerCase()))) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ITEMS)
    .map(([tag, count]) => ({ id: tag, label: tag, value: count, unit }));
}

// ─── Farcaster: Trending Channels + Popular Frames ────────────────────────

async function farcasterSections(env: Env, posts: UnifiedPost[]): Promise<ProtocolSection[]> {
  // Aggregate channels from cast data (parent_url / warpcast channel links / hashtags).
  // We use Hubble to scan casts for channel references.
  // Instead, scan casts for parent_url references and channel tags.
  let channels: SectionItem[] = [];
  if (posts.length > 0) {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const text = p.text || '';
      const channelMatch = text.match(/\/([a-z0-9-]{2,})/i)?.[1] || null;
      if (channelMatch) counts.set(channelMatch, (counts.get(channelMatch) ?? 0) + 1);
    }
    channels = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ITEMS)
      .map(([id, count]) => ({
        id: `channel:${id}`,
        label: `/${id}`,
        value: count,
        unit: 'casts',
        url: `https://warpcast.com/~/channel/${id}`,
      }));
    if (channels.length === 0) channels = topHashtags(posts, 'casts');
  }
            id: `channel:${c.channel?.id}`,
            label: `/${c.channel?.id}`,
            sublabel: c.channel?.name,
            value: c.cast_count_24h ?? c.channel?.follower_count ?? 0,
            unit: 'casts 24h',
            url: `https://warpcast.com/~/channel/${c.channel?.id}`,
            imageUrl: c.channel?.image_url,
          }));
      }
    } catch {
      /* fall through to aggregation */
    }
  }
  if (channels.length === 0) {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const r = raw(p);
      const parentUrl = typeof r.parent_url === 'string' ? r.parent_url : '';
      const channelMatch =
        parentUrl.match(/warpcast\.com\/~\/channel\/([a-z0-9-]+)/i)?.[1] ??
        (typeof (r.channel as Record<string, unknown>)?.id === 'string'
          ? String((r.channel as Record<string, unknown>).id)
          : null);
      if (channelMatch) counts.set(channelMatch, (counts.get(channelMatch) ?? 0) + 1);
    }
    channels = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ITEMS)
      .map(([id, count]) => ({
        id: `channel:${id}`,
        label: `/${id}`,
        value: count,
        unit: 'casts',
        url: `https://warpcast.com/~/channel/${id}`,
      }));
    // Last resort: hashtags as topic proxies.
    if (channels.length === 0) channels = topHashtags(posts, 'casts');
  }

  // Popular frames: casts carrying frame embeds ranked by engagement.
  const framePosts = posts
    .filter(
      (p) =>
        p.embeds.some((e) => e.kind === 'frame') ||
        (Array.isArray(raw(p).frames) && (raw(p).frames as unknown[]).length > 0),
    )
    .sort((a, b) => engagementOf(b) - engagementOf(a))
    .slice(0, MAX_ITEMS);
  const frames: SectionItem[] = framePosts.map((p) => {
    const frameEmbed = p.embeds.find((e) => e.kind === 'frame') ?? p.embeds[0];
    let domain = '';
    try {
      domain = frameEmbed ? new URL(frameEmbed.url).hostname : '';
    } catch {
      /* KV operation failed -- non-critical, continue */
    }
    return {
      id: p.id,
      label: snippet(p.text) || domain || 'Frame',
      sublabel: domain || p.author.displayName,
      value: engagementOf(p),
      unit: 'engagement',
      url: frameEmbed?.url,
    };
  });

  return [
    {
      id: 'trending-channels',
      title: 'Trending Channels',
      icon: '📡',
      items: channels,
    },
    { id: 'popular-frames', title: 'Popular Frames', icon: '🖼', items: frames },
  ];
}

// ─── Lens: Top Collectors + Hot Mirrors ───────────────────────────────────

function lensSections(posts: UnifiedPost[]): ProtocolSection[] {
  const collectsOf = (p: UnifiedPost): number => {
    const stats = (raw(p).stats ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return n(stats.collects) + n(stats.countOpenActions) + n(stats.bookmarks);
  };

  // Top collectors: creators ranked by collected publications.
  const byAuthor = new Map<string, { label: string; sublabel?: string; total: number }>();
  for (const p of posts) {
    const collected = collectsOf(p) || p.metrics.quotes; // quotes carry Lens quote-posts
    if (collected <= 0) continue;
    const cur = byAuthor.get(p.author.id) ?? {
      label: p.author.displayName || p.author.handles.lens || p.author.id,
      sublabel: p.author.handles.lens ?? undefined,
      total: 0,
    };
    cur.total += collected;
    byAuthor.set(p.author.id, cur);
  }
  let collectors: SectionItem[] = [...byAuthor.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, MAX_ITEMS)
    .map(([id, a]) => ({
      id,
      label: a.label,
      sublabel: a.sublabel,
      value: a.total,
      unit: 'collects',
    }));
  if (collectors.length === 0) {
    // Fallback: most-engaged creators in the window.
    const engaged = new Map<string, { label: string; sublabel?: string; total: number }>();
    for (const p of posts) {
      const cur = engaged.get(p.author.id) ?? {
        label: p.author.displayName || p.author.handles.lens || p.author.id,
        sublabel: p.author.handles.lens ?? undefined,
        total: 0,
      };
      cur.total += engagementOf(p);
      engaged.set(p.author.id, cur);
    }
    collectors = [...engaged.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, MAX_ITEMS)
      .map(([id, a]) => ({
        id,
        label: a.label,
        sublabel: a.sublabel,
        value: a.total,
        unit: 'engagement',
      }));
  }

  // Hot mirrors: publications ranked by mirror count.
  const mirrors: SectionItem[] = [...posts]
    .filter((p) => p.metrics.reposts > 0)
    .sort((a, b) => b.metrics.reposts - a.metrics.reposts)
    .slice(0, MAX_ITEMS)
    .map((p) => ({
      id: p.id,
      label: snippet(p.text) || '(media publication)',
      sublabel: p.author.displayName || p.author.handles.lens || undefined,
      value: p.metrics.reposts,
      unit: 'mirrors',
    }));

  return [
    {
      id: 'top-collectors',
      title: 'Top Collectors',
      icon: '💎',
      items: collectors,
    },
    { id: 'hot-mirrors', title: 'Hot Mirrors', icon: '🪞', items: mirrors },
  ];
}

// ─── Bluesky: Popular Custom Feeds + Trending Labels ──────────────────────

async function blueskySections(posts: UnifiedPost[]): Promise<ProtocolSection[]> {
  // Popular custom feeds from the public AT Protocol appview (no auth).
  let feeds: SectionItem[] = [];
  try {
    const res = await fetch(
      'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getPopularFeedGenerators?limit=6',
      {
        headers: { 'user-agent': 'DegenFeed/0.1' },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        feeds?: Array<{
          uri: string;
          displayName?: string;
          description?: string;
          likeCount?: number;
          avatar?: string;
          creator?: { handle?: string };
        }>;
      };
      feeds = (body.feeds ?? []).slice(0, MAX_ITEMS).map((f) => {
        const rkey = f.uri.split('/').pop() ?? '';
        const did = f.uri.split('/')[2] ?? '';
        return {
          id: f.uri,
          label: f.displayName ?? rkey,
          sublabel: f.creator?.handle ? `by @${f.creator.handle}` : undefined,
          value: f.likeCount ?? 0,
          unit: 'likes',
          url: `https://bsky.app/profile/${did}/feed/${rkey}`,
          imageUrl: f.avatar,
        };
      });
    }
  } catch {
    /* appview unavailable */
  }

  // Trending labels: hashtags across the current skeet window.
  const labels = topHashtags(posts, 'skeets');

  return [
    {
      id: 'popular-feeds',
      title: 'Popular Custom Feeds',
      icon: '📰',
      items: feeds,
    },
    {
      id: 'trending-labels',
      title: 'Trending Labels',
      icon: '🏷',
      items: labels,
    },
  ];
}

// ─── Nostr: Active Relays + Most Zapped ───────────────────────────────────

function nostrSections(posts: UnifiedPost[]): ProtocolSection[] {
  // Active relays: multi-relay propagation counts stamped by the provider.
  const relayCounts = new Map<number, number>(); // relayCount -> posts
  let multiRelay = 0;
  for (const p of posts) {
    const rc = Number(raw(p).__relayCount) || 1;
    relayCounts.set(rc, (relayCounts.get(rc) ?? 0) + 1);
    if (rc >= 2) multiRelay++;
  }
  const knownRelays = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://relay.nostr.band',
    'wss://relay.snort.social',
    'wss://nos.lol',
    'wss://relay.nostr.bg',
  ];
  const relays: SectionItem[] = knownRelays.slice(0, MAX_ITEMS).map((r, i) => ({
    id: r,
    label: r.replace('wss://', ''),
    sublabel: i === 0 && multiRelay > 0 ? `${multiRelay} multi-relay notes in window` : undefined,
    value: posts.length,
    unit: 'notes in pool',
    url: `https://nostr.watch/relay/${r.replace('wss://', '')}`,
  }));

  // Most zapped: zaps land in metrics.quotes via enrichNostrEngagement.
  const zapped: SectionItem[] = [...posts]
    .filter((p) => p.metrics.quotes > 0)
    .sort((a, b) => b.metrics.quotes - a.metrics.quotes)
    .slice(0, MAX_ITEMS)
    .map((p) => ({
      id: p.id,
      label: snippet(p.text) || '(media note)',
      sublabel: p.author.displayName,
      value: p.metrics.quotes,
      unit: 'zaps',
    }));
  // Fallback when zap enrichment is cold: top liked notes.
  const zapItems =
    zapped.length > 0
      ? zapped
      : [...posts]
          .sort((a, b) => b.metrics.likes - a.metrics.likes)
          .slice(0, MAX_ITEMS)
          .filter((p) => p.metrics.likes > 0)
          .map((p) => ({
            id: p.id,
            label: snippet(p.text) || '(media note)',
            sublabel: p.author.displayName,
            value: p.metrics.likes,
            unit: 'likes',
          }));

  return [
    { id: 'active-relays', title: 'Active Relays', icon: '📶', items: relays },
    { id: 'most-zapped', title: 'Most Zapped', icon: '⚡', items: zapItems },
  ];
}

// ─── Mastodon: Trending Hashtags + Popular Instances ──────────────────────

async function mastodonSections(posts: UnifiedPost[]): Promise<ProtocolSection[]> {
  // Trending hashtags from our own instance.
  let hashtags: SectionItem[] = [];
  try {
    const res = await fetch('https://social.degenfeed.xyz/api/v1/trends/tags?limit=6', {
      headers: { 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (res.ok) {
      const tags = (await res.json()) as Array<{
        name: string;
        url?: string;
        history?: Array<{ uses?: string; accounts?: string }>;
      }>;
      hashtags = tags.slice(0, MAX_ITEMS).map((t) => ({
        id: `tag:${t.name}`,
        label: `#${t.name}`,
        value: Number(t.history?.[0]?.uses ?? t.history?.length ?? 0),
        unit: 'uses today',
        url: t.url,
      }));
    }
  } catch {
    /* instance trends unavailable */
  }
  if (hashtags.length === 0) hashtags = topHashtags(posts, 'toots');

  // Popular instances: aggregate author handle domains in the window.
  const instances = new Map<string, number>();
  for (const p of posts) {
    const handle = p.author.handles.mastodon ?? '';
    const domain = handle.includes('@') ? (handle.split('@').pop() ?? '') : '';
    if (domain) instances.set(domain, (instances.get(domain) ?? 0) + 1);
  }
  const instanceItems: SectionItem[] = [...instances.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ITEMS)
    .map(([domain, count]) => ({
      id: `instance:${domain}`,
      label: domain,
      value: count,
      unit: 'toots',
      url: `https://${domain}/explore`,
    }));

  return [
    {
      id: 'trending-hashtags',
      title: 'Trending Hashtags',
      icon: '#️⃣',
      items: hashtags,
    },
    {
      id: 'popular-instances',
      title: 'Popular Instances',
      icon: '🌐',
      items: instanceItems,
    },
  ];
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleProtocolSections(request: Request, env: Env): Promise<Response> {
  const protocol = (new URL(request.url).searchParams.get('protocol') ?? '').toLowerCase();
  if (!SUPPORTED.has(protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${protocol || '(none)'}` }, 400);
  }

  try {
    const cached = await env.CACHE?.get(cacheKey(protocol));
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const posts = await fetchProtocolPosts(protocol, 100);

  let sections: ProtocolSection[];
  switch (protocol) {
    case 'farcaster':
      sections = await farcasterSections(env, posts);
      break;
    case 'lens':
      sections = lensSections(posts);
      break;
    case 'bluesky':
      sections = await blueskySections(posts);
      break;
    case 'nostr':
      sections = nostrSections(posts);
      break;
    default:
      sections = await mastodonSections(posts);
  }

  const response: ProtocolSectionsResponse = {
    protocol,
    sections,
    fetchedAt: Date.now(),
  };

  try {
    await env.CACHE?.put(cacheKey(protocol), JSON.stringify(response), {
      expirationTtl: CACHE_TTL,
    });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}
