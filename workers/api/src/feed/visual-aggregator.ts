/**
 * visual-aggregator — Fetches from all visual sources (Pixelfed, Zora,
 * Bluesky, Nostr media, Farcaster media, GoToSocial), normalizes to
 * VisualPost, merges, deduplicates, ranks, and paginates.
 *
 * This is the core engine powering the unified visual feed.
 */

import { GtSClient, type GtSStatus } from '@degenfeed/mastodon-sdk';
import type { VisualFeedOptions, VisualPost, VisualSource } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Timeout helpers ──────────────────────────────────────────────────

async function fetchWithTimeout(url: string, opts: RequestInit & { timeout?: number } = {}) {
  const { timeout = 6000, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Visual badge registry ─────────────────────────────────────────────

const BADGES: Record<string, { emoji: string; color: string; label: string }> = {
  pixelfed: { emoji: '📸', color: '#6366f1', label: 'Pixelfed' },
  peertube: { emoji: '🎬', color: '#f1680d', label: 'PeerTube' },
  owncast: { emoji: '🔴', color: '#ef4444', label: 'Owncast' },
  zora: { emoji: '🎨', color: '#8b5cf6', label: 'Zora' },
  bluesky: { emoji: '🦋', color: '#1185fe', label: 'Bluesky' },
  nostr: { emoji: '⚡', color: '#8e30eb', label: 'Nostr' },
  farcaster: { emoji: '🟣', color: '#8a63d2', label: 'Farcaster' },
  gotosocial: { emoji: '🐘', color: '#6364ff', label: 'GoToSocial' },
  mastodon: { emoji: '🐘', color: '#6364ff', label: 'Mastodon' },
};

function badgeFor(source: string) {
  return BADGES[source] ?? { emoji: '📷', color: '#666', label: source };
}

// ─── Normalizer helpers ───────────────────────────────────────────────

import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

function makeMinimalIdentity(
  protocol: string,
  id: string,
  name: string,
  avatarUrl?: string,
  handle?: string,
): UnifiedIdentity {
  return {
    id: `${protocol}:${id}`,
    primary: { protocol: protocol as Protocol, id },
    handles: (handle ? { [protocol]: handle } : {}) as Partial<Record<Protocol, string | null>>,
    displayName: name,
    bio: '',
    avatarUrl: avatarUrl ?? '',
    bannerUrl: undefined,
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  } as UnifiedIdentity;
}

function makeEngagement(likes = 0, reposts = 0, replies = 0) {
  return {
    viewerLiked: false,
    viewerReposted: false,
    viewerBookmarked: false,
    raw: { likes, reposts, replies, quotes: 0 },
  };
}

function makeMetrics(likes = 0, reposts = 0, replies = 0) {
  return { likes, reposts, replies, quotes: 0 };
}

// ─── Source 1: Pixelfed via GoToSocial federation + direct API ─────────

async function fetchPixelfedContent(env: Env, limit: number): Promise<VisualPost[]> {
  const results: VisualPost[] = [];

  // Option A0: Self-hosted Pixelfed instance with Bearer token (local=true)
  try {
    const localUrl = env.PIXELFED_INSTANCE_URL || 'http://127.0.0.1:8096';
    const token = env.PIXELFED_ACCESS_TOKEN;
    const publicUrl = env.PIXELFED_PUBLIC_URL || 'https://photos.degenfeed.xyz';
    if (token) {
      const res = await fetchWithTimeout(
        `${localUrl}/api/v1/timelines/public?only_media=true&local=true&limit=${Math.min(limit, 40)}`,
        {
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${token}`,
            'user-agent': 'DegenFeed/1.0',
          },
          timeout: 4000,
        },
      );
      if (res.ok) {
        const data = (await res.json()) as GtSStatus[];
        for (const status of Array.isArray(data) ? data : []) {
          const normalized = normalizeGtSStatusToVisual(status, localUrl);
          if (normalized) {
            // Rewrite container-local media URLs to the public origin.
            normalized.imageUrl = normalized.imageUrl.replace(
              /^https?:\/\/localhost(:\d+)?/i,
              publicUrl,
            );
            normalized.fullImageUrl = normalized.fullImageUrl?.replace(
              /^https?:\/\/localhost(:\d+)?/i,
              publicUrl,
            );
            results.push(normalized);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[visual-feed] Local Pixelfed timeline fetch failed:', err);
  }

  // Option A: GtS public timeline filtered to media-only posts
  try {
    const gtsUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
    const gts = new GtSClient(gtsUrl);
    const timeline = await gts.get<GtSStatus[]>('/api/v1/timelines/public', {
      limit: Math.min(limit, 40),
      only_media: 'true',
    });
    for (const status of Array.isArray(timeline) ? timeline : []) {
      const normalized = normalizeGtSStatusToVisual(status, gtsUrl);
      if (normalized) results.push(normalized);
    }
  } catch (err) {
    console.warn('[visual-feed] GtS timeline fetch failed:', err);
  }

  // Option B: Query popular Pixelfed instances directly
  if (results.length < limit) {
    const instances = ['pixelfed.social', 'pixelfed.de', 'pixey.org'];
    const instanceResults = await Promise.allSettled(
      instances.map(async (instance) => {
        const url = `https://${instance}/api/v1/timelines/public?only_media=true&limit=${Math.ceil(limit / instances.length)}`;
        const res = await fetchWithTimeout(url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'DegenFeed/1.0',
          },
          timeout: 4000,
        });
        if (!res.ok) return [];
        const data = (await res.json()) as GtSStatus[];
        const pfBadgeForInstance = badgeFor('pixelfed');
        return (Array.isArray(data) ? data : []).flatMap((s) => {
          const normalized = normalizeGtSStatusToVisual(s, instance);
          if (!normalized) return [];
          return [
            {
              ...normalized,
              source: 'pixelfed' as VisualSource,
              protocol: 'mastodon',
              sourceBadge: pfBadgeForInstance.emoji,
              sourceColor: pfBadgeForInstance.color,
              sourceLabel: pfBadgeForInstance.label,
            },
          ];
        });
      }),
    );
    for (const r of instanceResults) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  }

  return results;
}

function normalizeGtSStatusToVisual(status: GtSStatus, instanceUrl: string): VisualPost | null {
  const media = status.media_attachments?.filter((m) =>
    ['image', 'video', 'gifv'].includes(m.type),
  );
  if (!media || media.length === 0) return null;

  const firstMedia = media[0]!;
  const isVideo = firstMedia.type === 'video' || firstMedia.type === 'gifv';

  const pfBadge = badgeFor('pixelfed');
  const hostname = new URL(instanceUrl).hostname;
  const handle = status.account.acct.includes('@')
    ? status.account.acct
    : `${status.account.acct}@${hostname}`;
  // Media served from container-local origins won't load in browsers — rewrite.
  const mediaUrl = (u: string) =>
    u.replace(/^https?:\/\/localhost(:\d+)?/i, 'https://photos.degenfeed.xyz')
      .replace(/^https?:\/\/127\.0\.0\.1(:\d+)?/i, 'https://photos.degenfeed.xyz');

  return {
    id: `pixelfed:${status.id}`,
    source: 'pixelfed',
    protocol: 'mastodon',
    author: {
      id: `mastodon:${status.account.id}@${hostname}`,
      primary: { protocol: 'mastodon', id: status.account.id },
      handles: { mastodon: handle },
      displayName: status.account.display_name || status.account.username,
      bio: '',
      avatarUrl: status.account.avatar,
      verified: [],
      followerCount: status.account.followers_count,
      followingCount: status.account.following_count,
      links: [],
      keys: {},
    },
    text: status.content ? stripHtml(status.content).slice(0, 200) : '',
    imageUrl: mediaUrl(isVideo ? firstMedia.preview_url : firstMedia.url),
    fullImageUrl: isVideo ? undefined : mediaUrl(firstMedia.url),
    videoUrl: isVideo ? mediaUrl(firstMedia.url) : undefined,
    duration: isVideo
      ? (((firstMedia.meta?.original as Record<string, unknown>)?.duration as number) ?? undefined)
      : undefined,
    embeds: media.map((m) => ({
      kind: m.type === 'video' ? 'video' : 'image',
      url: mediaUrl(m.url),
      meta: { description: m.description, blurhash: m.blurhash },
    })),
    blurHash: firstMedia.blurhash ?? undefined,
    aspectRatio: calcAspectRatio(firstMedia.meta),
    width: (firstMedia.meta?.original as Record<string, unknown>)?.width as number,
    height: (firstMedia.meta?.original as Record<string, unknown>)?.height as number,
    isNFT: false,
    mediaType: isVideo ? (firstMedia.type === 'gifv' ? 'gif' : 'video') : 'image',
    createdAt: new Date(status.created_at).getTime(),
    metrics: makeMetrics(status.favourites_count, status.reblogs_count, status.replies_count),
    engagement: makeEngagement(status.favourites_count, status.reblogs_count, status.replies_count),
    sourceBadge: pfBadge.emoji,
    sourceColor: pfBadge.color,
    sourceLabel: pfBadge.label,
    raw: status,
    url: status.url,
    tipUrl: undefined,
  };
}

// ─── Source 2: Zora NFTs via Zora API (GraphQL) ───────────────────────

const ZORA_API_URL = 'https://api.zora.co/graphql';

async function fetchZoraNFTs(_env: Env, limit: number): Promise<VisualPost[]> {
  const results: VisualPost[] = [];

  const query = `
    query TrendingTokens {
      tokens(
        networks: {network: BASE_ETH, chain: BASE}
        pagination: {limit: ${Math.min(limit, 50)}}
        sort: {sortKey: TRANSFER_COUNT, sortDirection: DESC}
        where: {collectionAddresses: null}
      ) {
        nodes {
          token {
            tokenId
            name
            image { url width height }
            content { url mimeType size }
            collection { name address }
            owner
          }
          tokenUrl
        }
      }
    }
  `;

  try {
    const res = await fetchWithTimeout(ZORA_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/1.0',
      },
      body: JSON.stringify({ query }),
      timeout: 5000,
    });

    if (!res.ok) return results;
    const json = (await res.json()) as {
      data?: {
        tokens?: {
          nodes?: Array<{
            token: {
              tokenId: string;
              name?: string;
              image?: { url?: string; width?: number; height?: number };
              content?: { url?: string; mimeType?: string; size?: number };
              collection?: { name?: string; address?: string };
              owner?: string;
            };
            tokenUrl?: string;
          }>;
        };
      };
    };

    const nodes = json?.data?.tokens?.nodes ?? [];
    for (const node of nodes) {
      const t = node.token;
      if (!t || (!t.image?.url && !t.content?.url)) continue;

      const imageUrl = t.image?.url || t.content?.url || '';
      const isVideo = t.content?.mimeType?.startsWith('video/') ?? false;
      const badge = badgeFor('zora');

      results.push({
        id: `zora:${t.collection?.address}:${t.tokenId}`,
        source: 'zora',
        protocol: 'zora',
        author: makeMinimalIdentity('zora', t.owner ?? 'unknown', 'Zora Creator'),
        text: t.name ?? 'Untitled NFT',
        imageUrl,
        fullImageUrl: imageUrl,
        videoUrl: isVideo ? t.content?.url : undefined,
        embeds: [
          {
            kind: isVideo ? 'video' : 'image',
            url: imageUrl,
            meta: { collection: t.collection?.name },
          },
        ],
        aspectRatio: t.image?.width && t.image?.height ? t.image.width / t.image.height : 1,
        width: t.image?.width,
        height: t.image?.height,
        isNFT: true,
        nftContract: t.collection?.address,
        nftTokenId: t.tokenId,
        collectionName: t.collection?.name,
        creatorAddress: t.owner ?? undefined,
        mediaType: isVideo ? 'nft_video' : 'nft_image',
        createdAt: Date.now(),
        metrics: makeMetrics(),
        engagement: makeEngagement(),
        sourceBadge: badge.emoji,
        sourceColor: badge.color,
        sourceLabel: badge.label,
        raw: node,
        mintUrl:
          node.tokenUrl || `https://zora.co/collect/base:${t.collection?.address}/${t.tokenId}`,
      });
    }
  } catch {
    // Zora API unavailable — return partial results
  }

  return results;
}

// ─── Source 3: Bluesky media posts via AT Protocol ────────────────────

async function fetchBlueskyMedia(env: Env, _limit: number): Promise<VisualPost[]> {
  const results: VisualPost[] = [];
  const pdsUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

  // Fetch from curated visual feeds and search for media posts
  const feedUrls = [
    `${pdsUrl}/xrpc/app.bsky.feed.getTimeline?limit=30`,
    `${pdsUrl}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hd5jnv5a7j5l3s5j3xh/app.bsky.feed.generator/visual-feed`,
  ];

  const allPosts: Array<{
    post: {
      uri: string;
      cid: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      record: {
        text?: string;
        embed?: {
          $type: string;
          images?: Array<{
            fullsize?: string;
            thumb?: string;
            alt?: string;
            aspectRatio?: { width: number; height: number };
          }>;
          external?: {
            uri?: string;
            title?: string;
            description?: string;
            thumb?: string;
          };
        };
        createdAt?: string;
      };
      embed?: {
        $type: string;
        images?: Array<{
          fullsize?: string;
          thumb?: string;
          alt?: string;
          aspectRatio?: { width: number; height: number };
        }>;
      };
      likeCount?: number;
      repostCount?: number;
      replyCount?: number;
      indexedAt?: string;
    };
  }> = [];

  for (const feedUrl of feedUrls) {
    try {
      const res = await fetchWithTimeout(feedUrl, {
        headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
        timeout: 4000,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { feed?: Array<{ post: unknown }> };
      if (json.feed) {
        for (const entry of json.feed) {
          allPosts.push(entry as { post: (typeof allPosts)[number]['post'] });
        }
      }
    } catch {}
  }

  // Deduplicate by URI
  const seen = new Set<string>();
  for (const entry of allPosts) {
    const p = entry.post;
    if (!p || seen.has(p.uri)) continue;
    seen.add(p.uri);

    // Only include posts with images
    const embedImages = p.embed?.images ?? p.record?.embed?.images ?? [];
    if (embedImages.length === 0) continue;

    const firstImage = embedImages[0]!;
    const badge = badgeFor('bluesky');

    results.push({
      id: `bluesky:${p.uri}`,
      source: 'bluesky',
      protocol: 'bluesky',
      author: {
        id: `bluesky:${p.author.did}`,
        primary: { protocol: 'bluesky', id: p.author.did },
        handles: { bluesky: p.author.handle },
        displayName: p.author.displayName || p.author.handle,
        bio: '',
        avatarUrl: p.author.avatar ?? '',
        verified: [],
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: { did: p.author.did },
      },
      text: p.record?.text?.slice(0, 200) ?? '',
      imageUrl: firstImage.thumb ?? firstImage.fullsize ?? '',
      fullImageUrl: firstImage.fullsize ?? firstImage.thumb ?? '',
      embeds: embedImages.map((img) => ({
        kind: 'image',
        url: img.fullsize ?? img.thumb ?? '',
        meta: { alt: img.alt, aspectRatio: img.aspectRatio },
      })),
      aspectRatio: firstImage.aspectRatio
        ? firstImage.aspectRatio.width / firstImage.aspectRatio.height
        : 4 / 3,
      isNFT: false,
      mediaType: 'image',
      createdAt: p.record?.createdAt ? new Date(p.record.createdAt).getTime() : Date.now(),
      metrics: makeMetrics(p.likeCount ?? 0, p.repostCount ?? 0, p.replyCount ?? 0),
      engagement: makeEngagement(p.likeCount ?? 0, p.repostCount ?? 0, p.replyCount ?? 0),
      sourceBadge: badge.emoji,
      sourceColor: badge.color,
      sourceLabel: badge.label,
      raw: p,
      url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`,
    });
  }

  return results;
}

// ─── Source 4: GoToSocial media posts (our own users) ─────────────────

async function fetchGoToSocialMedia(env: Env, limit: number): Promise<VisualPost[]> {
  const results: VisualPost[] = [];
  const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';

  try {
    const gts = new GtSClient(instanceUrl);
    const timeline = await gts.get<GtSStatus[]>('/api/v1/timelines/public', {
      limit: Math.min(limit, 40),
      only_media: 'true',
    });
    for (const status of Array.isArray(timeline) ? timeline : []) {
      const normalized = normalizeGtSStatusToVisual(status, instanceUrl);
      if (normalized) {
        normalized.source = 'gotosocial';
        normalized.protocol = 'mastodon';
        const badge = badgeFor('gotosocial');
        normalized.sourceBadge = badge.emoji;
        normalized.sourceColor = badge.color;
        normalized.sourceLabel = badge.label;
        results.push(normalized);
      }
    }
  } catch {
    // GtS unavailable
  }

  return results;
}

// ─── Source 5: Nostr media posts ──────────────────────────────────────

async function fetchNostrMedia(env: Env, limit: number): Promise<VisualPost[]> {
  const results: VisualPost[] = [];
  const relays = (env.RELAY_URLS ?? 'wss://relay.damus.io,wss://nos.lol')
    .split(',')
    .filter(Boolean);

  // Use a Nostr relay search for kind 1 posts with image URLs
  const _searchTerms = ['https://', '.jpg', '.png', '.gif', '.webp', 'http://'];

  for (const relay of relays.slice(0, 3)) {
    try {
      // Request kind 1 events with media via a relay query
      const _sub = JSON.stringify([
        'REQ',
        `media-${Date.now()}`,
        {
          kinds: [1],
          limit: Math.ceil(limit / relays.length / 2),
          '#t': ['photography', 'art', 'nft'],
        },
      ]);
      const _wsUrl = relay.replace('http', 'ws');
      // Fallback: try REST-based relay if available
      const restUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket

      // Some relays expose a search API
      try {
        const res = await fetchWithTimeout(`${restUrl}/api/v1/events?kinds=1&limit=20`, {
          headers: { accept: 'application/json' },
          timeout: 3000,
        });
        if (res.ok) {
          const events = (await res.json()) as Array<{
            id: string;
            pubkey: string;
            content: string;
            created_at: number;
            tags: string[][];
          }>;
          for (const ev of Array.isArray(events) ? events : []) {
            const imageUrl = extractImageUrl(ev.content);
            if (!imageUrl) continue;
            const badge = badgeFor('nostr');
            results.push({
              id: `nostr:${ev.id}`,
              source: 'nostr',
              protocol: 'nostr',
              author: makeMinimalIdentity(
                'nostr',
                ev.pubkey,
                `npub1${ev.pubkey.slice(0, 8)}...`,
                undefined,
                `npub1${ev.pubkey.slice(0, 8)}`,
              ),
              text: ev.content.slice(0, 200),
              imageUrl,
              fullImageUrl: imageUrl,
              embeds: [{ kind: 'image', url: imageUrl }],
              aspectRatio: 4 / 3,
              isNFT: ev.tags.some((t) => t[0] === 'NFT' || t[0] === 'zap'),
              nftContract: ev.tags.find((t) => t[0] === 'a')?.[1],
              mediaType: imageUrl.match(/\.(mp4|webm|mov)/i) ? 'video' : 'image',
              createdAt: ev.created_at * 1000,
              metrics: makeMetrics(),
              engagement: makeEngagement(),
              sourceBadge: badge.emoji,
              sourceColor: badge.color,
              sourceLabel: badge.label,
              raw: ev,
            });
          }
        }
      } catch {
        // Relay REST unavailable
      }
    } catch {
      continue;
    }
    if (results.length >= limit) break;
  }

  return results;
}

function extractImageUrl(content: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|mp4|webm|mov))(?:\?[^\s]*)?/i;
  const match = urlRegex.exec(content);
  return match?.[1] ?? null;
}

// ─── Source 6: Farcaster media casts ──────────────────────────────────

async function fetchFarcasterMedia(env: Env, limit: number): Promise<VisualPost[]> {
  const results: VisualPost[] = [];
  const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';

  try {
    // Query hub for recent casts with embeds containing images
    const res = await fetchWithTimeout(`${hubUrl}/v1/castsByFid?fid=1&limit=50`, {
      headers: { accept: 'application/json' },
      timeout: 3000,
    });
    if (!res.ok) return results;

    const data = (await res.json()) as {
      messages?: Array<{
        data?: {
          fid?: number;
          timestamp?: number;
          castAddBody?: {
            text?: string;
            embeds?: Array<{ url?: string }>;
            parentUrl?: string;
          };
        };
        hash?: string;
      }>;
    };

    const messages = data.messages ?? [];
    for (const msg of messages) {
      const body = msg.data?.castAddBody;
      if (!body?.embeds || body.embeds.length === 0) continue;

      const imageEmbed = body.embeds.find((e) => e.url?.match(/\.(jpg|jpeg|png|gif|webp)/i));
      if (!imageEmbed?.url) continue;

      const badge = badgeFor('farcaster');

      results.push({
        id: `farcaster:${msg.hash}`,
        source: 'farcaster',
        protocol: 'farcaster',
        author: makeMinimalIdentity(
          'farcaster',
          String(msg.data?.fid ?? 0),
          `FC User ${msg.data?.fid ?? ''}`,
        ),
        text: body.text?.slice(0, 200) ?? '',
        imageUrl: imageEmbed.url,
        fullImageUrl: imageEmbed.url,
        embeds: body.embeds.map((e) => ({ kind: 'image', url: e.url ?? '' })),
        aspectRatio: 4 / 3,
        isNFT: false,
        mediaType: 'image',
        createdAt: (msg.data?.timestamp ?? 0) * 1000,
        metrics: makeMetrics(),
        engagement: makeEngagement(),
        sourceBadge: badge.emoji,
        sourceColor: badge.color,
        sourceLabel: badge.label,
        raw: msg,
      });

      if (results.length >= limit) break;
    }
  } catch {
    // Hub unavailable
  }

  return results;
}

// ─── Utility functions ─────────────────────────────────────────────────

function calcAspectRatio(meta: Record<string, unknown> | null | undefined): number {
  if (!meta) return 4 / 3;
  const original = meta.original as Record<string, unknown> | undefined;
  if (original?.width && original?.height) {
    return Number(original.width) / Number(original.height);
  }
  if (meta.width && meta.height) {
    return Number(meta.width) / Number(meta.height);
  }
  return 4 / 3;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Ranking and merging ───────────────────────────────────────────────

function rankPosts(posts: VisualPost[], sort: string): VisualPost[] {
  const _now = Date.now();
  return [...posts].sort((a, b) => {
    switch (sort) {
      case 'trending': {
        const aScore = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3;
        const bScore = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3;
        if (aScore !== bScore) return bScore - aScore;
        return b.createdAt - a.createdAt;
      }
      case 'top':
        return b.metrics.likes - a.metrics.likes;
      default:
        return b.createdAt - a.createdAt;
    }
  });
}

function deduplicateVisualPosts(posts: VisualPost[]): VisualPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    // Deduplicate by image URL + author combo
    const key = `${p.imageUrl}:${p.author.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Filter by media type ──────────────────────────────────────────────

function applyFilter(posts: VisualPost[], filter?: string): VisualPost[] {
  if (!filter || filter === 'all') return posts;

  switch (filter) {
    case 'photos':
      return posts.filter((p) => p.mediaType === 'image' || p.mediaType === 'nft_image');
    case 'nfts':
      return posts.filter((p) => p.isNFT);
    case 'video':
      return posts.filter(
        (p) => p.mediaType === 'video' || p.mediaType === 'gif' || p.mediaType === 'nft_video',
      );
    case 'bluesky':
      return posts.filter((p) => p.source === 'bluesky');
    default:
      return posts;
  }
}

// ─── Main export ──────────────────────────────────────────────────────

/**
 * Fetches from all visual sources, normalizes, merges, deduplicates,
 * ranks, filters, and paginates.
 */
export async function getVisualFeed(
  env: Env,
  opts: VisualFeedOptions,
): Promise<{
  data: VisualPost[];
  nextCursor?: string;
  meta: {
    total: number;
    perSource: Record<string, number>;
    errors: string[];
    fetchedAt: number;
  };
}> {
  const errors: string[] = [];
  const perSource: Record<string, number> = {};
  const sourcePromises: Array<{
    source: VisualSource;
    promise: Promise<VisualPost[]>;
  }> = [];

  const sources = opts.sources;

  if (sources.includes('pixelfed') || sources.includes('all')) {
    sourcePromises.push({
      source: 'pixelfed',
      promise: fetchPixelfedContent(env, Math.ceil(opts.limit / sources.length)),
    });
  }
  if (sources.includes('zora') || sources.includes('all')) {
    sourcePromises.push({
      source: 'zora',
      promise: fetchZoraNFTs(env, Math.ceil(opts.limit / sources.length)),
    });
  }
  if (sources.includes('bluesky') || sources.includes('all')) {
    sourcePromises.push({
      source: 'bluesky',
      promise: fetchBlueskyMedia(env, Math.ceil(opts.limit / sources.length)),
    });
  }
  if (sources.includes('gotosocial') || sources.includes('all')) {
    sourcePromises.push({
      source: 'gotosocial',
      promise: fetchGoToSocialMedia(env, Math.ceil(opts.limit / sources.length)),
    });
  }
  if (sources.includes('nostr') || sources.includes('all')) {
    sourcePromises.push({
      source: 'nostr',
      promise: fetchNostrMedia(env, Math.ceil(opts.limit / sources.length)),
    });
  }
  if (sources.includes('farcaster') || sources.includes('all')) {
    sourcePromises.push({
      source: 'farcaster',
      promise: fetchFarcasterMedia(env, Math.ceil(opts.limit / sources.length)),
    });
  }

  // Execute all source fetches in parallel with a global timeout
  const timeoutMs = 8000;
  const results = await Promise.allSettled(
    sourcePromises.map(async ({ source, promise }) => {
      const timer = setTimeout(() => {
        throw new Error(`${source} visual fetch timed out`);
      }, timeoutMs);
      try {
        const posts = await promise;
        clearTimeout(timer);
        return { source, posts };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const allPosts: VisualPost[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      perSource[r.value.source] = (r.value.posts ?? []).length;
      allPosts.push(...(r.value.posts ?? []));
    } else {
      const errMsg = r.reason instanceof Error ? r.reason.message : 'unknown error';
      errors.push(errMsg);
    }
  }

  // Deduplicate
  const deduped = deduplicateVisualPosts(allPosts);

  // Apply filter
  const filtered = applyFilter(deduped, opts.filter);

  // Sort
  const ranked = rankPosts(filtered, opts.sort ?? 'newest');

  // Paginate
  const cursor = opts.cursor ? Number(opts.cursor) : 0;
  const paginated = ranked.slice(cursor, cursor + opts.limit);
  const nextCursor = cursor + opts.limit < ranked.length ? String(cursor + opts.limit) : undefined;

  return {
    data: paginated,
    nextCursor,
    meta: {
      total: ranked.length,
      perSource,
      errors: errors.length > 0 ? errors : [],
      fetchedAt: Date.now(),
    },
  };
}

/**
 * Returns trending visual content — highest-engagement posts across
 * all sources within the last 7 days.
 */
export async function getTrendingVisualFeed(
  env: Env,
  limit = 30,
): Promise<{
  data: VisualPost[];
  meta: { total: number; perSource: Record<string, number>; errors: string[] };
}> {
  const result = await getVisualFeed(env, {
    sources: ['all'],
    filter: 'all',
    sort: 'trending',
    limit: limit * 3, // Fetch more, then filter by recency
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = result.data.filter((p) => p.createdAt > sevenDaysAgo);

  return {
    data: recent.slice(0, limit),
    meta: result.meta,
  };
}

/**
 * Returns personalized visual feed — content from followed creators
 * plus recommended content.
 */
export async function getForYouVisualFeed(
  env: Env,
  opts: { limit?: number; followingOnly?: boolean; creatorFilter?: string[] },
): Promise<{
  data: VisualPost[];
  meta: { total: number; perSource: Record<string, number>; errors: string[] };
}> {
  const result = await getVisualFeed(env, {
    sources: ['all'],
    filter: 'all',
    sort: 'trending',
    limit: opts.limit ?? 30,
  });

  // If following only, filter by followed creators
  if (opts.followingOnly && opts.creatorFilter && opts.creatorFilter.length > 0) {
    const filterSet = new Set(opts.creatorFilter.map((a) => a.toLowerCase()));
    const followed = result.data.filter((p) => filterSet.has(p.author.id.toLowerCase()));
    // Fill remaining slots with trending content
    const remaining = opts.limit ? opts.limit - followed.length : 0;
    const trending = result.data
      .filter((p) => !filterSet.has(p.author.id.toLowerCase()))
      .slice(0, Math.max(0, remaining));
    return {
      data: [...followed, ...trending],
      meta: result.meta,
    };
  }

  return result;
}
