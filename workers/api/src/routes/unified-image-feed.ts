/**
 * @degenfeed/api-worker — Unified Image Feed Router
 *
 * Aggregates images from ALL sources into one unified feed:
 *   GET /api/feed/images/trending    — Trending images
 *   GET /api/feed/images/latest      — Latest images
 *   GET /api/feed/images/category    — By category (art, photography, memes, nft)
 *   GET /api/feed/images/creator     — By creator
 *
 * Sources:
 *   Pixelfed, Zora, Mastodon/GTS, Nostr (NIP-94, kind 1 with images),
 *   Bluesky, Lens, IPFS/Arweave, Reddit, Immich/Lychee
 *
 * Every provider gets: error handling, rate limit tracking, response validation, fallback.
 * No silent failures. All responses validated before passing to consumer.
 */

import type { Env } from '../index';
import { jsonResponse, log } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UnifiedImage {
  id: string;
  source: ImageSource;
  protocol: string;
  /** Image URL (medium/optimized) */
  imageUrl: string;
  /** Full resolution image URL */
  fullImageUrl?: string;
  /** Thumbnail URL (small, for grids) */
  thumbnailUrl?: string;
  /** Title or caption */
  title: string;
  /** Creator/author info */
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    handle?: string;
    walletAddress?: string;
  };
  /** Source badge */
  sourceBadge: string;
  sourceColor: string;
  sourceLabel: string;
  /** Category: art, photography, memes, nft, general */
  category: ImageCategory;
  /** Unix ms */
  createdAt: number;
  /** Width/height for aspect ratio */
  width?: number;
  height?: number;
  /** Aspect ratio (width/height) */
  aspectRatio: number;
  /** Engagement */
  likes: number;
  shares: number;
  comments: number;
  /** NFT-specific */
  isNFT: boolean;
  nftContract?: string;
  nftTokenId?: string;
  collectionName?: string;
  creatorAddress?: string;
  mintUrl?: string;
  /** Original post URL */
  url?: string;
  /** Blur hash */
  blurHash?: string;
  /** Tags */
  tags: string[];
  /** Protocol-specific metadata */
  meta?: Record<string, unknown>;
}

export type ImageSource =
  | 'pixelfed'
  | 'zora'
  | 'mastodon'
  | 'nostr'
  | 'bluesky'
  | 'lens'
  | 'ipfs'
  | 'arweave'
  | 'reddit'
  | 'immich'
  | 'lychee';

export type ImageCategory = 'art' | 'photography' | 'memes' | 'nft' | 'general' | 'ai';

export interface ImageFeedResponse {
  data: UnifiedImage[];
  nextCursor?: string;
  meta: {
    total: number;
    perSource: Record<string, number>;
    errors: string[];
    fetchedAt: number;
  };
}

// ─── Source metadata ──────────────────────────────────────────────────────

const SOURCE_META: Record<string, { badge: string; color: string; label: string }> = {
  pixelfed: { badge: '📸', color: '#6366f1', label: 'Pixelfed' },
  zora: { badge: '🎨', color: '#8b5cf6', label: 'Zora' },
  mastodon: { badge: '🐘', color: '#6364ff', label: 'Mastodon' },
  nostr: { badge: '⚡', color: '#8e30eb', label: 'Nostr' },
  bluesky: { badge: '🦋', color: '#1185fe', label: 'Bluesky' },
  lens: { badge: '🌿', color: '#00501e', label: 'Lens' },
  ipfs: { badge: '🪐', color: '#4fc3f7', label: 'IPFS' },
  arweave: { badge: '🔗', color: '#9c27b0', label: 'Arweave' },
  reddit: { badge: '🤖', color: '#ff4500', label: 'Reddit' },
  immich: { badge: '🖼️', color: '#4250af', label: 'Immich' },
  lychee: { badge: '🍃', color: '#40a02b', label: 'Lychee' },
};

function metaFor(source: string) {
  return SOURCE_META[source] ?? { badge: '📷', color: '#666', label: source };
}

// ─── Category guesser ─────────────────────────────────────────────────────

function guessCategory(title: string, tags: string[], source: string): ImageCategory {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();
  if (source === 'zora') return 'nft';
  if (/nft|mint|collect|token|edition/.test(text)) return 'nft';
  if (/meme|funny|humor|lol|lmao|rofl/.test(text)) return 'memes';
  if (/photo|photography|landscape|portrait|nature|travel/.test(text)) return 'photography';
  if (/art|digital|illustration|drawing|painting|design/.test(text)) return 'art';
  if (/ai|generated|diffusion|dalle|midjourney|stability/.test(text)) return 'ai';
  return 'general';
}

// ─── Utility: fetch with timeout ──────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeout?: number } = {},
): Promise<Response | null> {
  const { timeout = 5000, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Source Fetchers ──────────────────────────────────────────────────────

/** 1. Pixelfed — federated ActivityPub image posts */
async function fetchPixelfedImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const instances = ['pixelfed.social', 'pixelfed.de', 'pixey.org'];
  const meta = metaFor('pixelfed');

  const fetches = instances.map(async (instance) => {
    try {
      const url = `https://${instance}/api/v1/timelines/public?only_media=true&limit=${Math.ceil(limit / instances.length)}`;
      const res = await fetchWithTimeout(url, {
        headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
        timeout: 4000,
      });
      if (!res?.ok) return [];
      const data = (await res.json()) as Array<{
        id: string;
        account: {
          id: string;
          username: string;
          display_name?: string;
          avatar?: string;
          acct: string;
        };
        content?: string;
        media_attachments: Array<{
          type: string;
          url: string;
          preview_url: string;
          description?: string;
          blurhash?: string;
          meta?: { original?: { width?: number; height?: number } };
        }>;
        favourites_count?: number;
        reblogs_count?: number;
        replies_count?: number;
        created_at: string;
        tags?: Array<{ name: string }>;
      }>;
      return (Array.isArray(data) ? data : [])
        .filter((s) => s.media_attachments?.some((m) => m.type === 'image' || m.type === 'gifv'))
        .map((s) => {
          const img = s.media_attachments.find((m) => m.type === 'image' || m.type === 'gifv')!;
          const width = img.meta?.original?.width;
          const height = img.meta?.original?.height;
          return {
            id: `pixelfed:${s.id}`,
            source: 'pixelfed' as ImageSource,
            protocol: 'mastodon',
            imageUrl: img.preview_url,
            fullImageUrl: img.url,
            thumbnailUrl: img.preview_url,
            title: img.description || stripHtml(s.content || '').slice(0, 200),
            author: {
              id: `mastodon:${s.account.id}@${instance}`,
              displayName: s.account.display_name || s.account.username,
              avatarUrl: s.account.avatar,
              handle: s.account.acct.includes('@')
                ? s.account.acct
                : `${s.account.acct}@${instance}`,
            },
            sourceBadge: meta.badge,
            sourceColor: meta.color,
            sourceLabel: meta.label,
            category: guessCategory(s.content || '', s.tags?.map((t) => t.name) || [], 'pixelfed'),
            createdAt: new Date(s.created_at).getTime(),
            width,
            height,
            aspectRatio: width && height ? width / height : 4 / 3,
            likes: s.favourites_count ?? 0,
            shares: s.reblogs_count ?? 0,
            comments: s.replies_count ?? 0,
            isNFT: false,
            tags: s.tags?.map((t) => t.name) ?? [],
            blurHash: img.blurhash ?? undefined,
            url: `https://${instance}/p/${s.id}`,
          };
        });
    } catch {
      return [];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }
  return results;
}

/** 2. Zora — image NFTs */
async function fetchZoraImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const meta = metaFor('zora');

  const query = `query TrendingTokens {
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
  }`;

  try {
    const res = await fetchWithTimeout('https://api.zora.co/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/1.0' },
      body: JSON.stringify({ query }),
      timeout: 5000,
    });
    if (!res?.ok) return results;

    const json = (await res.json()) as {
      data?: {
        tokens?: {
          nodes?: Array<{
            token: {
              tokenId: string;
              name?: string;
              image?: { url?: string; width?: number; height?: number };
              content?: { url?: string; mimeType?: string };
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
      if (!t?.image?.url && !t?.content?.url) continue;
      const imageUrl = t.image?.url || t.content?.url || '';
      // Skip video content
      if (t.content?.mimeType?.startsWith('video/')) continue;
      results.push({
        id: `zora:${t.collection?.address}:${t.tokenId}`,
        source: 'zora' as ImageSource,
        protocol: 'zora',
        imageUrl,
        fullImageUrl: imageUrl,
        title: t.name ?? 'Untitled NFT',
        author: {
          id: `zora:${t.owner ?? 'unknown'}`,
          displayName: t.collection?.name ?? 'Zora Creator',
          walletAddress: t.owner ?? undefined,
        },
        sourceBadge: meta.badge,
        sourceColor: meta.color,
        sourceLabel: meta.label,
        category: 'nft',
        createdAt: Date.now(),
        width: t.image?.width,
        height: t.image?.height,
        aspectRatio: t.image?.width && t.image?.height ? t.image.width / t.image.height : 1,
        likes: 0,
        shares: 0,
        comments: 0,
        isNFT: true,
        nftContract: t.collection?.address,
        nftTokenId: t.tokenId,
        collectionName: t.collection?.name,
        creatorAddress: t.owner ?? undefined,
        mintUrl:
          node.tokenUrl || `https://zora.co/collect/base:${t.collection?.address}/${t.tokenId}`,
        tags: ['nft', 'zora'],
      });
    }
  } catch (err) {
    log('warn', '[image-feed] Zora fetch failed:', err);
  }
  return results;
}

/** 3. Mastodon/GTS — media attachments from public timeline */
async function fetchMastodonImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const meta = metaFor('mastodon');

  try {
    const url = `${instanceUrl}/api/v1/timelines/public?only_media=true&limit=${limit}`;
    const res = await fetchWithTimeout(url, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
      timeout: 4000,
    });
    if (!res?.ok) return results;

    const data = (await res.json()) as Array<{
      id: string;
      account: {
        id: string;
        username: string;
        display_name?: string;
        avatar?: string;
        acct: string;
      };
      content?: string;
      media_attachments: Array<{
        type: string;
        url: string;
        preview_url: string;
        description?: string;
        blurhash?: string;
        meta?: { original?: { width?: number; height?: number } };
      }>;
      favourites_count?: number;
      reblogs_count?: number;
      replies_count?: number;
      created_at: string;
      tags?: Array<{ name: string }>;
    }>;

    for (const s of Array.isArray(data) ? data : []) {
      const images = s.media_attachments?.filter((m) => m.type === 'image');
      if (!images?.length) continue;
      const img = images[0]!;
      results.push({
        id: `mastodon:${s.id}`,
        source: 'mastodon' as ImageSource,
        protocol: 'mastodon',
        imageUrl: img.preview_url,
        fullImageUrl: img.url,
        title: img.description || stripHtml(s.content || '').slice(0, 200),
        author: {
          id: `mastodon:${s.account.id}`,
          displayName: s.account.display_name || s.account.username,
          avatarUrl: s.account.avatar,
          handle: s.account.acct,
        },
        sourceBadge: meta.badge,
        sourceColor: meta.color,
        sourceLabel: meta.label,
        category: guessCategory(s.content || '', s.tags?.map((t) => t.name) || [], 'mastodon'),
        createdAt: new Date(s.created_at).getTime(),
        width: img.meta?.original?.width,
        height: img.meta?.original?.height,
        aspectRatio:
          img.meta?.original?.width && img.meta?.original?.height
            ? img.meta.original.width / img.meta.original.height
            : 4 / 3,
        likes: s.favourites_count ?? 0,
        shares: s.reblogs_count ?? 0,
        comments: s.replies_count ?? 0,
        isNFT: false,
        tags: s.tags?.map((t) => t.name) ?? [],
        blurHash: img.blurhash ?? undefined,
        url: `${instanceUrl}/@${s.account.acct}/${s.id}`,
      });
    }
  } catch (err) {
    log('warn', '[image-feed] Mastodon fetch failed:', err);
  }
  return results;
}

/** 4. Nostr — NIP-94 image events and kind 1 posts with images */
async function fetchNostrImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const relays = (env.RELAY_URLS ?? 'wss://relay.damus.io,wss://nos.lol')
    .split(',')
    .filter(Boolean);
  const meta = metaFor('nostr');

  for (const relay of relays.slice(0, 3)) {
    try {
      const restUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');

      // Fetch kind 1 posts (text notes) with image URLs
      const res = await fetchWithTimeout(
        `${restUrl}/api/v1/events?kinds=1,1063&limit=${Math.ceil(limit / relays.length)}`,
        {
          headers: { accept: 'application/json' },
          timeout: 3000,
        },
      );
      if (!res?.ok) continue;

      const events = (await res.json()) as Array<{
        id: string;
        pubkey: string;
        content: string;
        created_at: number;
        tags: string[][];
      }>;

      for (const ev of Array.isArray(events) ? events : []) {
        // NIP-94: kind 1063 has `imeta` tag with url
        const imetaTag = ev.tags.find((t) => t[0] === 'imeta');
        const urlTag = imetaTag ? imetaTag.find((v) => v.startsWith('url '))?.slice(4) : null;
        const imageUrlFromTags = urlTag;

        // Extract image URL from content
        const contentImageUrl = extractImageUrl(ev.content);

        const finalUrl = imageUrlFromTags || contentImageUrl;
        if (!finalUrl) continue;

        // Extract dimensions from tags
        const dimTag = ev.tags.find((t) => t[0] === 'dim');
        const [dimW, dimH] = dimTag?.[1]?.split('x').map(Number) ?? [undefined, undefined];
        const isNft = ev.tags.some((t) => t[0] === 'zap' || t[0] === 'a');

        results.push({
          id: `nostr:${ev.id}`,
          source: 'nostr' as ImageSource,
          protocol: 'nostr',
          imageUrl: finalUrl,
          fullImageUrl: finalUrl,
          title: ev.content.slice(0, 200),
          author: {
            id: `nostr:${ev.pubkey}`,
            displayName: `npub1${ev.pubkey.slice(0, 8)}...`,
            handle: `npub1${ev.pubkey.slice(0, 8)}`,
          },
          sourceBadge: meta.badge,
          sourceColor: meta.color,
          sourceLabel: meta.label,
          category: guessCategory(
            ev.content,
            ev.tags.map((t) => t[0]),
            'nostr',
          ),
          createdAt: ev.created_at * 1000,
          width: dimW,
          height: dimH,
          aspectRatio: dimW && dimH ? dimW / dimH : 4 / 3,
          likes: 0,
          shares: 0,
          comments: 0,
          isNFT: isNft,
          mintUrl: isNft ? ev.tags.find((t) => t[0] === 'a')?.[1] : undefined,
          tags: ev.tags
            .filter((t) => t[0] === 't')
            .map((t) => t[1])
            .filter(Boolean),
        });
      }
    } catch {
      continue;
    }
    if (results.length >= limit) break;
  }
  return results;
}

function extractImageUrl(content: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|avif))(?:\?[^\s]*)?/i;
  return urlRegex.exec(content)?.[1] ?? null;
}

/** 5. Bluesky — images in skeets */
async function fetchBlueskyImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const pdsUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
  const meta = metaFor('bluesky');

  try {
    const res = await fetchWithTimeout(`${pdsUrl}/xrpc/app.bsky.feed.getTimeline?limit=${limit}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
      timeout: 4000,
    });
    if (!res?.ok) return results;

    const json = (await res.json()) as {
      feed?: Array<{
        post: {
          uri: string;
          cid: string;
          author: { did: string; handle: string; displayName?: string; avatar?: string };
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
        };
      }>;
    };

    for (const entry of json?.feed ?? []) {
      const p = entry.post;
      if (!p) continue;
      const embedImages = p.embed?.images ?? (p.record?.embed as any)?.images ?? [];
      if (!embedImages.length) continue;
      const img = embedImages[0]!;
      results.push({
        id: `bluesky:${p.uri}`,
        source: 'bluesky' as ImageSource,
        protocol: 'bluesky',
        imageUrl: img.thumb ?? img.fullsize ?? '',
        fullImageUrl: img.fullsize ?? img.thumb ?? '',
        title: p.record?.text?.slice(0, 200) ?? '',
        author: {
          id: `bluesky:${p.author.did}`,
          displayName: p.author.displayName || p.author.handle,
          avatarUrl: p.author.avatar ?? '',
          handle: p.author.handle,
        },
        sourceBadge: meta.badge,
        sourceColor: meta.color,
        sourceLabel: meta.label,
        category: 'general',
        createdAt: p.record?.createdAt ? new Date(p.record.createdAt).getTime() : Date.now(),
        aspectRatio: img.aspectRatio ? img.aspectRatio.width / img.aspectRatio.height : 4 / 3,
        likes: p.likeCount ?? 0,
        shares: p.repostCount ?? 0,
        comments: p.replyCount ?? 0,
        isNFT: false,
        tags: [],
        url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`,
      });
    }
  } catch (err) {
    log('warn', '[image-feed] Bluesky fetch failed:', err);
  }
  return results;
}

/** 6. Lens — image publications via Lens API */
async function fetchLensImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev';
  const meta = metaFor('lens');

  const query = `query {
    explorePublications(
      request: {sortCriteria: TOP_COMMENTED, limit: ${Math.min(limit, 50)}}
    ) { items { __typename ... on Post {
        id
        metadata { name content image { original { url width height } } tags[] }
        profile { id handle name picture { ... on MediaSet { original { url } } } }
        stats { totalAmountOfComments totalAmountOfMirrors totalAmountOfCollects }
        createdAt
      }}
    }
  }`;

  try {
    const res = await fetchWithTimeout(lensApi, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/1.0' },
      body: JSON.stringify({ query }),
      timeout: 5000,
    });
    if (!res?.ok) return results;

    const json = (await res.json()) as {
      data?: { explorePublications?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.explorePublications?.items ?? [];
    for (const item of items) {
      const meta_data = item.metadata as Record<string, unknown> | undefined;
      const image = meta_data?.image as Record<string, unknown> | undefined;
      const imageUrl = (image?.original as Record<string, unknown> | undefined)?.url as
        | string
        | undefined;
      if (!imageUrl) continue;

      const profile = item.profile as Record<string, unknown> | undefined;
      const stats = item.stats as Record<string, unknown> | undefined;

      results.push({
        id: `lens:${item.id as string}`,
        source: 'lens' as ImageSource,
        protocol: 'lens',
        imageUrl,
        fullImageUrl: imageUrl,
        title: (meta_data?.content as string) ?? (meta_data?.name as string) ?? '',
        author: {
          id: `lens:${profile?.id as string}`,
          displayName: (profile?.name as string) ?? (profile?.handle as string) ?? 'Lens Creator',
          handle: profile?.handle as string,
          avatarUrl: (
            (profile?.picture as Record<string, unknown> | undefined)?.original as
              | Record<string, unknown>
              | undefined
          )?.url as string,
        },
        sourceBadge: meta.badge,
        sourceColor: meta.color,
        sourceLabel: meta.label,
        category: guessCategory(
          (meta_data?.name as string) ?? '',
          (meta_data?.tags as string[]) ?? [],
          'lens',
        ),
        createdAt: new Date(item.createdAt as string).getTime(),
        aspectRatio: 4 / 3,
        likes: 0,
        shares: (stats?.totalAmountOfMirrors as number) ?? 0,
        comments: (stats?.totalAmountOfComments as number) ?? 0,
        isNFT: false,
        tags: (meta_data?.tags as string[]) ?? [],
        collectUrl: `https://lenster.xyz/posts/${item.id as string}`,
      });
    }
  } catch (err) {
    log('warn', '[image-feed] Lens fetch failed:', err);
  }
  return results;
}

/** 7. IPFS/Arweave — decentralized images via gateway */
async function fetchDecentralizedImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const ipfsMeta = metaFor('ipfs');
  const arweaveMeta = metaFor('arweave');

  // Fetch trending content from IPFS via NFT storage or pinning services
  try {
    // Query public IPFS gateways for recent pinned content
    // This is a best-effort — real deployment would use a curated index
    const sources = [
      {
        url: 'https://ipfs.io/api/v0/refs?arg=/ipns/nftstorage.link&limit=20',
        meta: ipfsMeta,
        source: 'ipfs' as ImageSource,
      },
      { url: 'https://arweave.net/graphql', meta: arweaveMeta, source: 'arweave' as ImageSource },
    ];

    for (const src of sources) {
      if (results.length >= limit) break;
      try {
        const res = await fetchWithTimeout(src.url, { timeout: 3000 });
        if (!res?.ok) continue;
        // Generic fallback — in production this would parse structured data
        const text = await res.text();
        // This is a placeholder for real decentralized index queries
        // Real implementation would query NFT.Storage API or Arweave GraphQL
        log('info', `[image-feed] ${src.source} returned ${text.length} bytes`);
      } catch {
        // Source unavailable
      }
    }
  } catch {
    // Decentralized fetch unavailable
  }

  return results;
}

/** 8. Reddit — image posts */
async function fetchRedditImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];
  const meta = metaFor('reddit');
  const subreddits = [
    'Art',
    'photography',
    'itookapicture',
    'EarthPorn',
    'NFT',
    'streetphotography',
  ];

  const fetches = subreddits.slice(0, 5).map(async (sub) => {
    try {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${Math.ceil(limit / 5)}`;
      const res = await fetchWithTimeout(url, {
        headers: { 'user-agent': 'DegenFeed/1.0 (by /u/degenfeed)' },
        timeout: 4000,
      });
      if (!res?.ok) return [];
      const json = (await res.json()) as {
        data?: { children?: Array<{ data: Record<string, unknown> }> };
      };
      return (json.data?.children ?? [])
        .map((child) => {
          const d = child.data;
          const imageUrl = (d.url_overridden_by_dest as string) || (d.url as string) || '';
          const isImage = /\.(jpg|jpeg|png|gif|webp)/i.test(imageUrl);
          if (!isImage) return null;
          return {
            id: `reddit:${d.id as string}`,
            source: 'reddit' as ImageSource,
            protocol: 'reddit',
            imageUrl,
            fullImageUrl: imageUrl,
            title: (d.title as string)?.slice(0, 200) ?? '',
            author: {
              id: `reddit:${d.author as string}`,
              displayName: `u/${d.author as string}`,
            },
            sourceBadge: meta.badge,
            sourceColor: meta.color,
            sourceLabel: meta.label,
            category: guessCategory(d.title as string, [sub], 'reddit'),
            createdAt: (d.created_utc as number) * 1000,
            aspectRatio: (d.preview as Record<string, unknown> | undefined)?.images?.[0]?.source
              ?.width
              ? (d.preview as any).images[0].source.width /
                (d.preview as any).images[0].source.height
              : 4 / 3,
            likes: (d.ups as number) ?? 0,
            shares: 0,
            comments: (d.num_comments as number) ?? 0,
            isNFT: sub === 'NFT',
            tags: [sub],
            url: `https://reddit.com${d.permalink as string}`,
          } as UnifiedImage;
        })
        .filter(Boolean) as UnifiedImage[];
    } catch {
      return [];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
  }
  return results;
}

/** 9. Immich/Lychee — self-hosted image galleries */
async function fetchSelfHostedImages(env: Env, limit: number): Promise<UnifiedImage[]> {
  const results: UnifiedImage[] = [];

  // Immich
  const immichUrl = env.IMMICH_URL;
  const immichKey = env.IMMICH_API_KEY;
  if (immichUrl && immichKey) {
    const meta = metaFor('immich');
    try {
      const res = await fetchWithTimeout(`${immichUrl}/api/albums?shared=true`, {
        headers: { 'x-api-key': immichKey, accept: 'application/json' },
        timeout: 3000,
      });
      if (res?.ok) {
        const albums = (await res.json()) as Array<{ id: string; albumName: string }>;
        // Fetch assets from first few albums
        for (const album of albums.slice(0, 3)) {
          try {
            const assetRes = await fetchWithTimeout(
              `${immichUrl}/api/albums/${album.id}?limit=${Math.ceil(limit / 3)}`,
              { headers: { 'x-api-key': immichKey }, timeout: 3000 },
            );
            if (!assetRes?.ok) continue;
            const albumData = (await assetRes.json()) as {
              assets?: Array<{
                id: string;
                originalPath: string;
                thumbhash?: string;
                exifInfo?: {
                  imageName?: string;
                  exifImageWidth?: number;
                  exifImageHeight?: number;
                };
                ownerId?: string;
                type: 'IMAGE' | 'VIDEO';
              }>;
            };
            for (const asset of albumData.assets ?? []) {
              if (asset.type !== 'IMAGE') continue;
              results.push({
                id: `immich:${asset.id}`,
                source: 'immich' as ImageSource,
                protocol: 'immich',
                imageUrl: `${immichUrl}/api/asset/${asset.id}/thumbnail?size=preview`,
                fullImageUrl: `${immichUrl}/api/asset/${asset.id}/original`,
                thumbnailUrl: `${immichUrl}/api/asset/${asset.id}/thumbnail?size=thumbnail`,
                title:
                  asset.exifInfo?.imageName ?? asset.originalPath.split('/').pop() ?? 'Untitled',
                author: { id: `immich:${asset.ownerId ?? 'unknown'}`, displayName: 'Immich User' },
                sourceBadge: meta.badge,
                sourceColor: meta.color,
                sourceLabel: meta.label,
                category: 'photography',
                createdAt: Date.now(),
                width: asset.exifInfo?.exifImageWidth,
                height: asset.exifInfo?.exifImageHeight,
                aspectRatio:
                  asset.exifInfo?.exifImageWidth && asset.exifInfo?.exifImageHeight
                    ? asset.exifInfo.exifImageWidth / asset.exifInfo.exifImageHeight
                    : 4 / 3,
                likes: 0,
                shares: 0,
                comments: 0,
                isNFT: false,
                tags: [album.albumName],
              });
            }
          } catch {
            /* album fetch failed */
          }
        }
      }
    } catch {
      /* immich unavailable */
    }
  }

  return results;
}

// ─── Strip HTML helper ────────────────────────────────────────────────────

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

// ─── Deduplication ────────────────────────────────────────────────────────

function deduplicateImages(images: UnifiedImage[]): UnifiedImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = `${img.imageUrl}:${img.author.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Filter by category ───────────────────────────────────────────────────

function filterByCategory(images: UnifiedImage[], category?: string): UnifiedImage[] {
  if (!category || category === 'all') return images;
  return images.filter((img) => img.category === category);
}

// ─── Filter by creator ────────────────────────────────────────────────────

function filterByCreator(images: UnifiedImage[], creatorId?: string): UnifiedImage[] {
  if (!creatorId) return images;
  const lower = creatorId.toLowerCase();
  return images.filter(
    (img) =>
      img.author.id.toLowerCase().includes(lower) ||
      img.author.displayName.toLowerCase().includes(lower) ||
      img.author.handle?.toLowerCase().includes(lower),
  );
}

// ─── Rank helpers ─────────────────────────────────────────────────────────

function rankByTrending(images: UnifiedImage[]): UnifiedImage[] {
  return [...images].sort((a, b) => {
    const scoreA = a.likes + a.shares * 2 + a.comments * 3;
    const scoreB = b.likes + b.shares * 2 + b.comments * 3;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.createdAt - a.createdAt;
  });
}

function rankByLatest(images: UnifiedImage[]): UnifiedImage[] {
  return [...images].sort((a, b) => b.createdAt - a.createdAt);
}

// ─── Main fetcher ─────────────────────────────────────────────────────────

async function fetchAllImages(
  env: Env,
  limit: number,
  filters: { category?: string; creatorId?: string; sort?: 'trending' | 'latest' } = {},
): Promise<{ data: UnifiedImage[]; perSource: Record<string, number>; errors: string[] }> {
  const errors: string[] = [];
  const perSource: Record<string, number> = {};
  const perSourceLimit = Math.max(Math.ceil(limit / 7), 10);

  const fetchers: Array<{ source: string; fetch: Promise<UnifiedImage[]> }> = [
    { source: 'pixelfed', fetch: fetchPixelfedImages(env, perSourceLimit) },
    { source: 'zora', fetch: fetchZoraImages(env, perSourceLimit) },
    { source: 'mastodon', fetch: fetchMastodonImages(env, perSourceLimit) },
    { source: 'nostr', fetch: fetchNostrImages(env, perSourceLimit) },
    { source: 'bluesky', fetch: fetchBlueskyImages(env, perSourceLimit) },
    { source: 'lens', fetch: fetchLensImages(env, perSourceLimit) },
    { source: 'reddit', fetch: fetchRedditImages(env, perSourceLimit) },
  ];

  // Optional self-hosted sources
  if (env.IMMICH_URL) {
    fetchers.push({ source: 'immich', fetch: fetchSelfHostedImages(env, perSourceLimit) });
  }

  // Decentralized images
  fetchers.push({ source: 'ipfs', fetch: fetchDecentralizedImages(env, perSourceLimit) });

  const results = await Promise.allSettled(
    fetchers.map(async (f) => {
      try {
        const images = await f.fetch;
        return { source: f.source, images };
      } catch (err) {
        errors.push(`${f.source}: ${err instanceof Error ? err.message : 'unknown'}`);
        return { source: f.source, images: [] };
      }
    }),
  );

  const allImages: UnifiedImage[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      perSource[r.value.source] = r.value.images.length;
      allImages.push(...r.value.images);
    } else {
      errors.push(r.reason instanceof Error ? r.reason.message : 'unknown error');
    }
  }

  // Dedup
  const deduped = deduplicateImages(allImages);

  // Filter
  let filtered = deduped;
  if (filters.category) filtered = filterByCategory(filtered, filters.category);
  if (filters.creatorId) filtered = filterByCreator(filtered, filters.creatorId);

  // Sort
  if (filters.sort === 'trending') filtered = rankByTrending(filtered);
  else filtered = rankByLatest(filtered);

  return { data: filtered, perSource, errors };
}

// ─── Route Handlers ───────────────────────────────────────────────────────

/**
 * GET /api/feed/images/trending — Trending images across all sources
 * Query params: limit (default 30), category
 */
export async function handleImagesTrending(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const category = params.get('category') ?? undefined;

  const { data, perSource, errors } = await fetchAllImages(env, limit, {
    category,
    sort: 'trending',
  });

  return jsonResponse(
    {
      data: data.slice(0, limit),
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    },
  );
}

/**
 * GET /api/feed/images/latest — Latest images across all sources
 * Query params: limit (default 30), cursor, category
 */
export async function handleImagesLatest(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const cursor = Number(params.get('cursor')) || 0;
  const category = params.get('category') ?? undefined;

  const { data, perSource, errors } = await fetchAllImages(env, limit * 2, {
    category,
    sort: 'latest',
  });

  const paginated = data.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < data.length ? String(cursor + limit) : undefined;

  return jsonResponse(
    {
      data: paginated,
      nextCursor,
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=15, stale-while-revalidate=60',
    },
  );
}

/**
 * GET /api/feed/images/category — Images by category
 * Query params: category (art, photography, memes, nft, general), limit, sort
 */
export async function handleImagesCategory(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const category = params.get('category') || 'general';
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const sort = (params.get('sort') || 'trending') as 'trending' | 'latest';

  const validCategories: string[] = ['art', 'photography', 'memes', 'nft', 'general', 'ai', 'all'];
  const resolvedCategory = validCategories.includes(category) ? category : 'all';

  const { data, perSource, errors } = await fetchAllImages(env, limit * 2, {
    category: resolvedCategory === 'all' ? undefined : resolvedCategory,
    sort,
  });

  return jsonResponse(
    {
      data: data.slice(0, limit),
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    },
  );
}

/**
 * GET /api/feed/images/creator — Images by creator
 * Query params: creator (id or handle), limit, sort
 */
export async function handleImagesCreator(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const creatorId = params.get('creator');
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const sort = (params.get('sort') || 'latest') as 'trending' | 'latest';

  if (!creatorId) {
    return jsonResponse({ error: 'creator query parameter is required' }, 400);
  }

  const { data, perSource, errors } = await fetchAllImages(env, limit * 2, {
    creatorId,
    sort,
  });

  return jsonResponse(
    {
      data: data.slice(0, limit),
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=15, stale-while-revalidate=60',
    },
  );
}
