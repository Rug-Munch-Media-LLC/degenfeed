/**
 * @degenfeed/api-worker — Unified Image Feed Source Fetchers
 *
 * Source-specific image fetchers for all supported protocols.
 * Each fetcher handles its own error handling, rate limit tracking,
 * response validation, and fallback.
 *
 * Sources: Pixelfed, Zora, Mastodon/GTS, Nostr (NIP-94, kind 1 with images),
 *          Bluesky, Lens, IPFS/Arweave, Reddit, Immich/Lychee
 */

import { log } from '../index';
import type { Env } from '../types';
import type { ImageSource, UnifiedImage } from './image-feed-types';
import {
  extractImageUrl,
  fetchWithTimeout,
  guessCategory,
  metaFor,
  stripHtml,
} from './image-feed-types';

// ─── Source Fetchers ──────────────────────────────────────────────────────

/** 1. Pixelfed — federated ActivityPub image posts */
export async function fetchPixelfedImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
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
export async function fetchZoraImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
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
export async function fetchMastodonImages(env: Env, limit: number): Promise<UnifiedImage[]> {
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
export async function fetchNostrImages(env: Env, limit: number): Promise<UnifiedImage[]> {
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
            ev.tags.map((t) => t[0] ?? ''),
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
            .filter((v): v is string => Boolean(v)),
        });
      }
    } catch {
      continue;
    }
    if (results.length >= limit) break;
  }
  return results;
}

/** 5. Bluesky — images in skeets */
export async function fetchBlueskyImages(env: Env, limit: number): Promise<UnifiedImage[]> {
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
      const embedImages: Array<{
        thumb?: string;
        fullsize?: string;
        alt?: string;
        aspectRatio?: { width: number; height: number };
      }> =
        p.embed?.images ??
        (
          p.record?.embed as
            | {
                images?: Array<{
                  thumb?: string;
                  fullsize?: string;
                  alt?: string;
                  aspectRatio?: { width: number; height: number };
                }>;
              }
            | undefined
        )?.images ??
        [];
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
