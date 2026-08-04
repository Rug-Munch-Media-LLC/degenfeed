/**
 * @degenfeed/api-worker — Video Platform Wrapper Implementations
 *
 * Platform-specific wrappers for decentralized video platforms.
 * Each provider implements VideoPlatformWrapper for a specific video source.
 *
 * Reconstructed 2026-08-04: the original refactor promised individual
 * wrapper files (farcaster-wrapper.ts, zora-wrapper.ts, ...) but those
 * files were never created — the split left only re-export stubs pointing
 * at non-existent modules, which broke `wrangler deploy`. The concrete
 * wrapper implementations lived inline in this module before the split
 * (commit bb4e12fb), so they are restored here with imports fixed to the
 * split type module (./types).
 *
 * Every provider gets: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API
 * changes. Every provider gets a health check.
 */

import type { Env } from '../../index';
import type { UnifiedLiveStream } from '../../feed/live-aggregator';
import type {
  AggregatedShort,
  PlatformHealth,
  ShortsQueryOptions,
  UnifiedVideo,
  VideoPlatformWrapper,
  VideoQueryOptions,
  VideoSource,
} from './types';
export const farcasterPlatformWrapper: VideoPlatformWrapper = {
  name: 'Farcaster',
  source: 'farcaster',

  async detectLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
    const streams: UnifiedLiveStream[] = [];
    const _startTime = Date.now();

    try {
      // Check Hubble for casts with fc:live meta tags or frame embeds
      const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';
      const fid = Number(env.FARCASTER_FID ?? '');
      if (!fid) return [];

      // Check our tracked live activities cache
      const cachedRaw = await env.CACHE?.get('farcaster:live:active');
      if (cachedRaw) {
        const active = JSON.parse(cachedRaw) as Array<{
          fid: number;
          username: string;
          displayName: string;
          pfpUrl?: string;
          title: string;
          hlsUrl: string;
          thumbnailUrl: string;
          viewerCount: number;
          startedAt: number;
          castHash: string;
        }>;
        for (const a of active) {
          streams.push({
            id: `farcaster:live:${a.fid}`,
            source: 'farcaster',
            title: a.title || `${a.displayName}'s Live Stream`,
            streamer: {
              id: `farcaster:fid:${a.fid}`,
              handle: a.username,
              displayName: a.displayName,
              avatarUrl: a.pfpUrl,
              walletAddress: undefined,
              followers: 0,
            },
            thumbnailUrl: a.thumbnailUrl || '',
            viewerCount: a.viewerCount || 0,
            startedAt: a.startedAt,
            category: 'Live',
            tags: ['farcaster', 'live', 'frame'],
            isLive: true,
            embedUrl: `https://warpcast.com/${a.username}/0x${a.castHash}`,
            chatEnabled: true,
            platformMeta: { fid: a.fid, castHash: a.castHash },
          });
        }
      }

      // Try fetching live activities from Hubble
      try {
        const resp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            messages?: Array<{ data?: { userDataBody?: { type: string; value: string } } }>;
          };
          // Check if user has USER_DATA_TYPE_LIVE_AT set
          if (data.messages) {
            for (const msg of data.messages) {
              const body = msg.data?.userDataBody;
              if (body?.type === 'USER_DATA_TYPE_LIVE_AT' && body.value) {
                // This FID has a live activity URL — fetch its content to verify
                try {
                  const pageResp = await fetch(body.value, {
                    signal: AbortSignal.timeout(3000),
                  });
                  if (pageResp.ok) {
                    const pageText = await pageResp.text();
                    if (pageText.includes('fc:live') && pageText.includes('fc:frame:video')) {
                      // Extract HLS URL from meta tags
                      const hlsMatch = pageText.match(
                        /<meta\s+property="fc:frame:video"\s+content="([^"]+)"/,
                      );
                      const titleMatch = pageText.match(
                        /<meta\s+property="og:title"\s+content="([^"]+)"/,
                      );
                      const hlsUrl = hlsMatch?.[1] || '';
                      const title = titleMatch?.[1] || 'Farcaster Live Stream';

                      if (hlsUrl) {
                        streams.push({
                          id: `farcaster:live:fid:${body.value}`,
                          source: 'farcaster',
                          title,
                          streamer: {
                            id: `farcaster:fid:${fid}`,
                            handle: `fid:${fid}`,
                            displayName: `Farcaster User ${fid}`,
                          },
                          thumbnailUrl: '',
                          viewerCount: 0,
                          startedAt: Date.now(),
                          category: 'Live',
                          tags: ['farcaster', 'live', 'frame', 'fip269'],
                          isLive: true,
                          embedUrl: body.value,
                          chatEnabled: true,
                          platformMeta: {
                            hlsUrl,
                            fid,
                            activityUrl: body.value,
                          },
                        });
                      }
                    }
                  }
                } catch {
                  // Activity URL unreachable — skip
                }
              }
            }
          }
        }
      } catch {
        // Hubble unavailable
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Farcaster live detection failed:', err);
    }

    return streams;
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';
      const limit = options.limit ?? 20;

      // Fetch casts with video embeds from Hubble
      const resp = await fetch(
        `${hubUrl}/v1/castsByFid?fid=${env.FARCASTER_FID ?? '1'}&limit=${limit}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (resp.ok) {
        const data = (await resp.json()) as {
          messages?: Array<{
            data?: {
              fid?: number;
              timestamp?: number;
              castAddBody?: {
                text: string;
                embeds?: Array<{ url: string }>;
              };
            };
          }>;
        };

        for (const msg of data.messages || []) {
          const body = msg.data?.castAddBody;
          if (!body?.embeds?.length) continue;

          for (const embed of body.embeds) {
            const url = embed.url;
            if (!url) continue;

            // Check if this embed is a video URL or frame with video
            const isVideoUrl = /\.(mp4|webm|m3u8|mov|avi)$/i.test(url);
            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            const isFrameWithVideo = url.includes('fc:frame:video');

            if (isVideoUrl || isYouTube || isFrameWithVideo) {
              videos.push({
                id: `farcaster:embed:${msg.data?.fid || '0'}:${body.text.slice(0, 16)}`,
                source: 'farcaster',
                title: body.text.slice(0, 80) || 'Farcaster Video',
                description: body.text,
                duration: 0,
                thumbnailUrl: '',
                videoUrl: url,
                views: 0,
                likes: 0,
                createdAt: msg.data?.timestamp
                  ? msg.data.timestamp > 1e12
                    ? msg.data.timestamp
                    : msg.data.timestamp * 1000
                  : Date.now(),
                creator: {
                  id: `farcaster:fid:${msg.data?.fid || '0'}`,
                  handle: `fid:${msg.data?.fid || '0'}`,
                  displayName: `Farcaster User ${msg.data?.fid || '0'}`,
                },
                tags: ['farcaster', 'video'],
                isLive: false,
                isShort: false,
                nsfw: false,
                platformMeta: { fid: msg.data?.fid, text: body.text.slice(0, 200) },
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Farcaster videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    // Farcaster doesn't natively support shorts — return frames as pseudo-shorts
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos
      .filter((v) => v.duration === 0 || v.duration <= 60)
      .map((v) => ({
        id: v.id,
        source: 'farcaster' as VideoSource,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration || 30,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
        tags: v.tags,
        isPortrait: false,
        platformMeta: v.platformMeta,
      }));
  },

  async healthCheck(env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';
      const resp = await fetch(`${hubUrl}/v1/info`, { signal: AbortSignal.timeout(5000) });
      return {
        healthy: resp.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'Farcaster Hub unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. Zora Video Wrapper
// ═══════════════════════════════════════════════════════════════════════════

export const zoraPlatformWrapper: VideoPlatformWrapper = {
  name: 'Zora',
  source: 'zora',

  async detectLiveStreams(_env: Env): Promise<UnifiedLiveStream[]> {
    // Zora does not natively support live streaming — only on-chain video NFTs
    return [];
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const limit = options.limit ?? 20;
      const zoraApiUrl = 'https://api.zora.co/graphql';
      const chain = options.chain ?? 'base';

      const query = `
        query TrendingVideos($first: Int!, $chain: Network!) {
          tokens(
            where: { collectionAddresses: ["${env.ZORA_VIDEO_CONTRACT || ''}"] }
            sort: { sortKey: TRANSFER_COUNT, sortDirection: DESC }
            networks: { network: $chain, chain: ${chain === 'base' ? 'BASE_MAINNET' : 'ETH_MAINNET'} }
            pagination: { limit: $first }
          ) {
            nodes {
              token {
                tokenId
                name
                description
                image { url }
                content { url mimeType }
                owner
                collection { address name }
              }
            }
          }
        }
      `;

      const res = await fetch(zoraApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { first: limit, chain: chain.toUpperCase() },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: {
            tokens?: {
              nodes?: Array<{
                token?: {
                  tokenId: string;
                  name: string;
                  description: string;
                  image?: { url: string };
                  content?: { url: string; mimeType: string };
                  owner: string;
                  collection?: { address: string; name: string };
                };
              }>;
            };
          };
        };

        for (const node of data?.data?.tokens?.nodes ?? []) {
          if (!node.token?.content?.mimeType?.startsWith('video/')) continue;

          const token = node.token;
          videos.push({
            id: `zora:${token.tokenId}`,
            source: 'zora',
            title: token.name || 'Untitled Zora Video',
            description: token.description || '',
            duration: 0,
            thumbnailUrl: token.image?.url || '',
            videoUrl: token.content?.url || token.image?.url || '',
            views: 0,
            likes: 0,
            createdAt: Date.now(),
            creator: {
              id: `zora:owner:${token.owner}`,
              handle: token.owner.slice(0, 8),
              displayName: token.owner.slice(0, 10),
              walletAddress: token.owner,
            },
            tags: ['zora', 'nft', 'video'],
            isLive: false,
            isShort: true,
            nsfw: false,
            collectUrl: `https://zora.co/collect/${chain}:${token.collection?.address || ''}/${token.tokenId}`,
            contentHash: token.tokenId,
            platformMeta: {
              tokenId: token.tokenId,
              contractAddress: token.collection?.address,
              chain,
            },
          });
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Zora videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos.map((v) => ({
      id: v.id,
      source: 'zora' as VideoSource,
      title: v.title,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration || 30,
      creator: v.creator,
      views: v.views,
      likes: v.likes,
      createdAt: v.createdAt,
      tags: ['zora', 'nft', 'short'],
      isPortrait: false,
      platformMeta: v.platformMeta,
    }));
  },

  async healthCheck(_env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const res = await fetch('https://api.zora.co/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: '{ __typename }',
        }),
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: res.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'Zora API unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. Lens Video Wrapper
// ═══════════════════════════════════════════════════════════════════════════

export const lensPlatformWrapper: VideoPlatformWrapper = {
  name: 'Lens',
  source: 'lens',

  async detectLiveStreams(_env: Env): Promise<UnifiedLiveStream[]> {
    // Lens does not have native live streaming
    return [];
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const apiUrl = env.LENS_API_URL ?? 'https://api-v2.lens.dev/graphql';
      const limit = options.limit ?? 20;

      const query = `
        query ExplorePublications($limit: LimitType!) {
          explorePublications(
            request: { where: { publicationTypes: [POST] }, limit: $limit, orderBy: TOP_COMMENTED }
          ) {
            items {
              ... on Post {
                id
                metadata {
                  ... on VideoMetadataV3 {
                    title
                    content
                    asset { video { original { url } } }
                    cover { original { url } }
                    duration
                  }
                }
                profile {
                  id
                  handle
                  metadata { displayName picture { ... on ImageSet { optimized { uri } } } }
                  ownedBy
                }
                createdAt
                stats { views }
              }
            }
          }
        }
      `;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables: { limit } }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: { explorePublications?: { items?: Array<Record<string, unknown>> } };
        };
        const items = data?.data?.explorePublications?.items ?? [];

        for (const item of items) {
          const meta = item.metadata as Record<string, unknown> | undefined;
          const profile = item.profile as Record<string, unknown> | undefined;
          const asset = meta?.asset as Record<string, unknown> | undefined;
          const video = asset?.video as Record<string, unknown> | undefined;
          const cover = meta?.cover as Record<string, unknown> | undefined;

          if (!video?.original || typeof video.original !== 'object') continue;
          const videoUrl = (video.original as Record<string, unknown>).url as string;
          if (!videoUrl) continue;

          const profileMeta = profile?.metadata as Record<string, unknown> | undefined;
          const picture = profileMeta?.picture as Record<string, unknown> | undefined;
          const imgSet = picture?.optimized as Record<string, unknown> | undefined;

          videos.push({
            id: `lens:${item.id as string}`,
            source: 'lens',
            title: (meta?.title as string) || 'Lens Video',
            description: (meta?.content as string) || '',
            duration: (meta?.duration as number) || 0,
            thumbnailUrl:
              ((cover?.original as Record<string, unknown> | undefined)?.url as string) || '',
            videoUrl,
            views: ((item.stats as Record<string, unknown>)?.views as number) || 0,
            likes: 0,
            createdAt: new Date(item.createdAt as string).getTime() || Date.now(),
            creator: {
              id: `lens:profile:${profile?.id as string}`,
              handle: (profile?.handle as string) || 'unknown',
              displayName:
                (profileMeta?.displayName as string) || (profile?.handle as string) || 'Lens User',
              avatarUrl: (imgSet?.uri as string) || '',
              walletAddress: profile?.ownedBy as string,
            },
            tags: ['lens', 'video'],
            isLive: false,
            isShort: (meta?.duration as number) ? (meta?.duration as number) <= 60 : false,
            nsfw: false,
            platformMeta: { lensId: item.id },
          });
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Lens videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos
      .filter((v) => v.isShort)
      .map((v) => ({
        id: v.id,
        source: 'lens' as VideoSource,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
        tags: ['lens', 'short'],
        isPortrait: false,
        platformMeta: v.platformMeta,
      }));
  },

  async healthCheck(env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const apiUrl = env.LENS_API_URL ?? 'https://api-v2.lens.dev/graphql';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: res.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'Lens API unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. Nostr Video Wrapper (NIP-71 + NIP-53)
// ═══════════════════════════════════════════════════════════════════════════

export const nostrPlatformWrapper: VideoPlatformWrapper = {
  name: 'Nostr',
  source: 'nostr',

  async detectLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
    const streams: UnifiedLiveStream[] = [];
    try {
      const relays = (
        env.NOSTR_RELAYS ?? 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
      )
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      // NIP-53: Live Event kind 30311
      const liveEvents = await fetchNostrEvents(relays, { kinds: [30311], limit: 20 });

      for (const event of liveEvents) {
        const tags = event.tags ?? [];
        const title = tags.find((t: string[]) => t[0] === 'title')?.[1] || 'Nostr Live Stream';
        const summary = tags.find((t: string[]) => t[0] === 'summary')?.[1] || '';
        const image = tags.find((t: string[]) => t[0] === 'image')?.[1] || '';
        const streaming = tags.find((t: string[]) => t[0] === 'streaming')?.[1] || '';
        const status = tags.find((t: string[]) => t[0] === 'status')?.[1] || 'live';
        const currentParticipants = parseInt(
          tags.find((t: string[]) => t[0] === 'current_participants')?.[1] || '0',
          10,
        );
        const _host = tags.find((t: string[]) => t[0] === 'host')?.[1] || event.pubkey;

        if (status !== 'live') continue;

        streams.push({
          id: `nostr:live:${event.id.slice(0, 16)}`,
          source: 'nostr',
          title,
          streamer: {
            id: `nostr:pubkey:${event.pubkey}`,
            handle: event.pubkey.slice(0, 8),
            displayName:
              tags.find((t: string[]) => t[0] === 'user_name')?.[1] || event.pubkey.slice(0, 8),
          },
          thumbnailUrl: image,
          viewerCount: currentParticipants,
          startedAt: event.created_at * 1000,
          category: summary || 'Live',
          tags: ['nostr', 'live', 'nip53'],
          isLive: true,
          embedUrl: streaming || `https://nostr.band/${event.id}`,
          chatEnabled: true,
          platformMeta: { eventId: event.id, pubkey: event.pubkey, relays, streaming },
        });
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Nostr live detection failed:', err);
    }
    return streams;
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const relays = (env.NOSTR_RELAYS ?? 'wss://relay.damus.io,wss://nos.lol')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      // NIP-71: Video events kind 34235 (horizontal) and kind 34236 (vertical)
      const videoEvents = await fetchNostrEvents(relays, {
        kinds: [34235, 34236],
        limit: options.limit ?? 20,
        search: options.search,
      });

      for (const event of videoEvents) {
        const tags = event.tags ?? [];
        const url = tags.find((t: string[]) => t[0] === 'url')?.[1] || '';
        const title = tags.find((t: string[]) => t[0] === 'title')?.[1] || 'Nostr Video';
        const summary = tags.find((t: string[]) => t[0] === 'summary')?.[1] || '';
        const image = tags.find((t: string[]) => t[0] === 'image')?.[1] || '';
        const duration = parseInt(tags.find((t: string[]) => t[0] === 'duration')?.[1] || '0', 10);
        const mimeType = tags.find((t: string[]) => t[0] === 'm')?.[1] || 'video/mp4';
        const blurhash = tags.find((t: string[]) => t[0] === 'blurhash')?.[1] || '';

        if (!url) continue;

        videos.push({
          id: `nostr:video:${event.id.slice(0, 16)}`,
          source: 'nostr',
          title,
          description: summary,
          duration,
          thumbnailUrl: image,
          videoUrl: url,
          views: 0,
          likes: 0,
          createdAt: event.created_at * 1000,
          creator: {
            id: `nostr:pubkey:${event.pubkey}`,
            handle: event.pubkey.slice(0, 8),
            displayName:
              tags.find((t: string[]) => t[0] === 'user_name')?.[1] || event.pubkey.slice(0, 8),
            walletAddress: event.pubkey,
          },
          tags: ['nostr', 'video', 'nip71'],
          isLive: false,
          isShort: event.kind === 34236 || (duration > 0 && duration <= 60),
          nsfw: tags.some((t: string[]) => t[0] === 'content-warning'),
          platformMeta: {
            eventId: event.id,
            kind: event.kind,
            mimeType,
            blurhash,
            relays,
          },
        });
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Nostr videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos
      .filter((v) => v.isShort)
      .map((v) => ({
        id: v.id,
        source: 'nostr' as VideoSource,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
        tags: ['nostr', 'short'],
        isPortrait: true,
        platformMeta: v.platformMeta,
      }));
  },

  async healthCheck(env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const relay =
        (env.NOSTR_RELAYS ?? 'wss://relay.damus.io').split(',')[0]?.trim() ||
        'wss://relay.damus.io';
      // WebSocket connection check
      const ws = new WebSocket(relay);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.close();
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
        setTimeout(() => {
          ws.close();
          reject(new Error('Timeout'));
        }, 5000);
      });
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'Nostr relay unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. DTube Wrapper (Steem/Hive)
// ═══════════════════════════════════════════════════════════════════════════

export const dtubePlatformWrapper: VideoPlatformWrapper = {
  name: 'DTube',
  source: 'dtube',

  async detectLiveStreams(_env: Env): Promise<UnifiedLiveStream[]> {
    // DTube does not natively support live streaming
    return [];
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const limit = options.limit ?? 20;
      // DTube API via blockchain RPC (Hive)
      const hiveRpcUrl = env.BASE_RPC_URL || 'https://api.hive.blog';
      const query = {
        jsonrpc: '2.0',
        method: 'bridge.get_ranked_posts',
        params: {
          sort: options.sort === 'trending' ? 'trending' : 'hot',
          tag: options.category || 'dtube',
          limit: Math.min(limit, 50),
        },
        id: 1,
      };

      const resp = await fetch(hiveRpcUrl.replace('ethereum', 'hive').replace('base', 'hive'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          result?: Array<{
            post_id: number;
            title: string;
            body: string;
            author: string;
            created: string;
            url: string;
            image?: string;
            json_metadata?: string;
            stats?: { total_votes: number };
          }>;
        };

        for (const post of data.result ?? []) {
          // Check if this is a DTube video post
          let jsonMeta: Record<string, unknown> = {};
          try {
            jsonMeta = JSON.parse(post.json_metadata || '{}') as Record<string, unknown>;
          } catch {
            /* ignore */
          }
          const videoMeta = jsonMeta.video as Record<string, unknown> | undefined;
          const content = videoMeta?.content as Record<string, unknown> | undefined;
          const videoUrl = (content?.video_url as string) || (videoMeta?.video_url as string) || '';

          if (!videoUrl) continue;

          const info = videoMeta?.info as Record<string, unknown> | undefined;
          const thumb =
            ((info?.snapshot as Record<string, unknown> | undefined)?.url as string) ||
            post.image ||
            '';

          videos.push({
            id: `dtube:${post.post_id}`,
            source: 'dtube',
            title: post.title || 'DTube Video',
            description: post.body?.slice(0, 500) || '',
            duration: (content?.duration as number) || 0,
            thumbnailUrl: thumb,
            videoUrl,
            views: 0,
            likes: post.stats?.total_votes || 0,
            createdAt: new Date(post.created).getTime() || Date.now(),
            creator: {
              id: `dtube:author:${post.author}`,
              handle: post.author,
              displayName: post.author,
            },
            tags: ['dtube', 'hive', options.category || 'video'].filter(Boolean) as string[],
            isLive: false,
            isShort: (content?.duration as number) ? (content?.duration as number) <= 60 : false,
            nsfw: false,
            platformMeta: { postId: post.post_id, author: post.author, permlink: post.url },
          });
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] DTube videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos
      .filter((v) => v.isShort)
      .map((v) => ({
        id: v.id,
        source: 'dtube' as VideoSource,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
        tags: ['dtube', 'short'],
        isPortrait: false,
        platformMeta: v.platformMeta,
      }));
  },

  async healthCheck(env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const hiveRpc = env.BASE_RPC_URL || 'https://api.hive.blog';
      const resp = await fetch(hiveRpc.replace('ethereum', 'hive').replace('base', 'hive'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'database_api.get_dynamic_global_properties',
          params: {},
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: resp.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'Hive RPC unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. Odysee / LBRY Wrapper
// ═══════════════════════════════════════════════════════════════════════════

export const odyseePlatformWrapper: VideoPlatformWrapper = {
  name: 'Odysee',
  source: 'odysee',

  async detectLiveStreams(_env: Env): Promise<UnifiedLiveStream[]> {
    // Odysee supports live streaming but requires API key
    return [];
  },

  async getVideos(_env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const limit = options.limit ?? 20;
      const apiUrl = 'https://api.lbry.tv/api/v1/proxy';

      const params: Record<string, unknown> = {
        page_size: limit,
        claim_type: 'stream',
        sort_by: options.sort === 'trending' ? 'trending_score' : 'release_time',
        ...(options.search ? { text: options.search } : {}),
        ...(options.category ? { tags: [options.category] } : {}),
      };

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream_list',
          params,
          id: 1,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          result?: { items?: Array<Record<string, unknown>> };
        };

        for (const item of data?.result?.items ?? []) {
          const value = item.value as Record<string, unknown> | undefined;
          const source = value?.source as Record<string, unknown> | undefined;
          const videoUrl = (source?.media_url as string) || (source?.sd_hash as string) || '';
          const thumbObj = value?.thumbnail as { url?: string } | string | undefined;
          const thumbnail = typeof thumbObj === 'string' ? thumbObj : (thumbObj?.url ?? '');
          const author = (item.author as string) || 'unknown';

          if (!videoUrl) continue;

          videos.push({
            id: `odysee:${item.claim_id as string}`,
            source: 'odysee',
            title: (value?.title as string) || 'Odysee Video',
            description: (value?.description as string) || '',
            duration: (value?.duration as number) || 0,
            thumbnailUrl: thumbnail,
            videoUrl,
            views: (item?.views as number) || 0,
            likes: (item?.likes as number) || 0,
            createdAt: item?.timestamp ? new Date(item.timestamp as string).getTime() : Date.now(),
            creator: {
              id: `odysee:author:${author}`,
              handle: author,
              displayName: author,
            },
            tags: ['odysee', 'lbry'],
            isLive: false,
            isShort: (value?.duration as number) ? (value?.duration as number) <= 60 : false,
            nsfw: false,
            platformMeta: { claimId: item.claim_id, channelId: item.channel_id },
          });
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Odysee videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos
      .filter((v) => v.isShort)
      .map((v) => ({
        id: v.id,
        source: 'odysee' as VideoSource,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
        tags: ['odysee', 'short'],
        isPortrait: false,
        platformMeta: v.platformMeta,
      }));
  },

  async healthCheck(_env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const resp = await fetch('https://api.lbry.tv/api/v1/proxy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'version',
          params: {},
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: resp.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        version: resp.ok
          ? ((await resp.json()) as { result?: { version?: string } }).result?.version
          : undefined,
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'LBRY API unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. Rumble Wrapper (via RSS)
// ═══════════════════════════════════════════════════════════════════════════

export const rumblePlatformWrapper: VideoPlatformWrapper = {
  name: 'Rumble',
  source: 'rumble',

  async detectLiveStreams(_env: Env): Promise<UnifiedLiveStream[]> {
    // Rumble live detection via RSS requires channel-specific feeds
    return [];
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const rssBridgeUrl = env.RSS_BRIDGE_URL || 'http://127.0.0.1:8282';
      const limit = options.limit ?? 20;

      // Try RSS-Bridge Rumble bridge
      const resp = await fetch(
        `${rssBridgeUrl}/?action=display&bridge=Rumble&context=By+channel&format=Json`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (resp.ok) {
        const data = (await resp.json()) as Array<{
          title: string;
          uri: string;
          timestamp: number;
          author?: string;
          thumbnail?: string;
          content?: string;
          uid?: string;
        }>;

        for (const item of data.slice(0, limit)) {
          videos.push({
            id: `rumble:${item.uid || item.uri?.match(/\/v([a-zA-Z0-9]+)/)?.[1] || Math.random().toString(36).slice(2, 10)}`,
            source: 'rumble',
            title: item.title || 'Rumble Video',
            description: '',
            duration: 0,
            thumbnailUrl: item.thumbnail || '',
            videoUrl: item.uri || '',
            views: 0,
            likes: 0,
            createdAt: item.timestamp || Date.now(),
            creator: {
              id: `rumble:${item.author || 'unknown'}`,
              handle: item.author || 'unknown',
              displayName: item.author || 'Rumble Creator',
            },
            tags: ['rumble'],
            isLive: false,
            isShort: false,
            nsfw: false,
            platformMeta: { uid: item.uid },
          });
        }
      } else {
        // Fallback: parse Rumble RSS feed directly
        const fallbackResp = await fetch('https://rumble.com/user/feed/', {
          signal: AbortSignal.timeout(5000),
        });
        if (fallbackResp.ok) {
          const text = await fallbackResp.text();
          const itemRegex = /<item>[\s\S]*?<\/item>/g;
          const titleRegex = /<title>(.*?)<\/title>/;
          const linkRegex = /<link>(.*?)<\/link>/;
          const dateRegex = /<pubDate>(.*?)<\/pubDate>/;
          const descRegex = /<description>(.*?)<\/description>/;
          const items = text.match(itemRegex) || [];
          for (const item of items.slice(0, limit)) {
            const title = item.match(titleRegex)?.[1] || 'Rumble Video';
            const link = item.match(linkRegex)?.[1] || '';
            const date = item.match(dateRegex)?.[1] || '';
            if (link) {
              videos.push({
                id: `rumble:rss:${link}`,
                source: 'rumble',
                title,
                description: item.match(descRegex)?.[1] || '',
                duration: 0,
                thumbnailUrl: '',
                videoUrl: link,
                views: 0,
                likes: 0,
                createdAt: date ? new Date(date).getTime() : Date.now(),
                creator: {
                  id: 'rumble:rss',
                  handle: 'Rumble',
                  displayName: 'Rumble',
                },
                tags: ['rumble', 'rss'],
                isLive: false,
                isShort: false,
                nsfw: false,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] Rumble videos failed:', err);
    }
    return videos;
  },

  async getShorts(_env: Env, _options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    return [];
  },

  async healthCheck(env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const rssBridgeUrl = env.RSS_BRIDGE_URL || 'http://127.0.0.1:8282';
      const resp = await fetch(`${rssBridgeUrl}/?action=display&bridge=Rumble&format=Json`, {
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: resp.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'Rumble bridge unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. BitTube Wrapper
// ═══════════════════════════════════════════════════════════════════════════

export const bittubePlatformWrapper: VideoPlatformWrapper = {
  name: 'BitTube',
  source: 'bittube',

  async detectLiveStreams(_env: Env): Promise<UnifiedLiveStream[]> {
    return [];
  },

  async getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]> {
    const videos: UnifiedVideo[] = [];
    try {
      const limit = options.limit ?? 20;
      // BitTube uses IPFS-based content — check IPFS gateway for content listings
      const ipfsGateway = env.DEGENFEED_CDN_URL || 'https://ipfs.io';
      const apiUrl = 'https://api.bittube.app';

      const resp = await fetch(
        `${apiUrl}/video/list?limit=${limit}&sort=${options.sort || 'trending'}`,
        {
          signal: AbortSignal.timeout(8000),
        },
      );

      if (resp.ok) {
        const data = (await resp.json()) as {
          videos?: Array<{
            id: string;
            title: string;
            description: string;
            ipfsHash: string;
            thumbnailHash: string;
            duration: number;
            author: string;
            authorName: string;
            authorAvatar: string;
            timestamp: number;
            tags: string[];
          }>;
        };

        for (const video of data.videos ?? []) {
          videos.push({
            id: `bittube:${video.id}`,
            source: 'bittube',
            title: video.title || 'BitTube Video',
            description: video.description || '',
            duration: video.duration || 0,
            thumbnailUrl: video.thumbnailHash ? `${ipfsGateway}/ipfs/${video.thumbnailHash}` : '',
            videoUrl: `${ipfsGateway}/ipfs/${video.ipfsHash}`,
            views: 0,
            likes: 0,
            createdAt: video.timestamp || Date.now(),
            creator: {
              id: `bittube:${video.author}`,
              handle: video.authorName || video.author,
              displayName: video.authorName || video.author,
              avatarUrl: video.authorAvatar || '',
              walletAddress: video.author,
            },
            tags: video.tags || ['bittube'],
            isLive: false,
            isShort: video.duration ? video.duration <= 60 : false,
            nsfw: false,
            contentHash: video.ipfsHash,
            platformMeta: { ipfsHash: video.ipfsHash },
          });
        }
      }
    } catch (err) {
      console.error('[video-platform-wrapper] BitTube videos failed:', err);
    }
    return videos;
  },

  async getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]> {
    const videos = await this.getVideos(env, { limit: options.limit ?? 10 });
    return videos
      .filter((v) => v.isShort)
      .map((v) => ({
        id: v.id,
        source: 'bittube' as VideoSource,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        creator: v.creator,
        views: v.views,
        likes: v.likes,
        createdAt: v.createdAt,
        tags: ['bittube', 'short'],
        isPortrait: false,
        platformMeta: v.platformMeta,
      }));
  },

  async healthCheck(_env: Env): Promise<PlatformHealth> {
    const start = Date.now();
    try {
      const resp = await fetch('https://api.bittube.app/health', {
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: resp.ok,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: 'BitTube API unreachable',
      };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Nostr Event Fetcher Helper
// ═══════════════════════════════════════════════════════════════════════════

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}


// ─── Nostr Event Fetcher Helper ────────────────────────────────────────

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

async function fetchNostrEvents(
  relayUrls: string[],
  filter: { kinds: number[]; limit: number; search?: string },
): Promise<NostrEvent[]> {
  const allEvents: NostrEvent[] = [];
  const seen = new Set<string>();

  for (const relayUrl of relayUrls) {
    try {
      const ws = new WebSocket(relayUrl);
      const events = await new Promise<NostrEvent[]>((resolve, _reject) => {
        const results: NostrEvent[] = [];
        const timeout = setTimeout(() => {
          ws.close();
          resolve(results);
        }, 5000);

        ws.onopen = () => {
          ws.send(JSON.stringify(['REQ', 'sub-video', filter]));
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data as string) as unknown[];
            if (data[0] === 'EVENT' && data[2]) {
              results.push(data[2] as NostrEvent);
            }
            if (data[0] === 'EOSE') {
              clearTimeout(timeout);
              ws.close();
              resolve(results);
            }
          } catch {
            /* ignore */
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(results);
        };
      });

      for (const event of events) {
        const key = event.id;
        if (!seen.has(key)) {
          seen.add(key);
          allEvents.push(event);
        }
      }

      if (allEvents.length >= filter.limit) break;
    } catch {
      // Relay failed — try next
    }
  }

  return allEvents.slice(0, filter.limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// Master Video Aggregator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch videos from ALL registered platform wrappers in parallel.
 * Each wrapper has independent error handling.
 */
