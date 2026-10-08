/**
 * @degenfeed/api-worker — Shorts Aggregator V3 Main Class
 *
 * Multi-source short-form video aggregator.
 * Delegates dedup, quality scoring, health checking, and conversion
 * to standalone modules.
 */

import { detectNiches } from '@degenfeed/feed-core';
import {
  fetchInstagramReels,
  fetchPeerTubeShorts,
  fetchTikTokShorts,
  fetchYouTubeShorts,
} from '@degenfeed/shorts-provider';
import type { Env } from '../../types';
import { toAggregated, weiToEth } from './convert';
import { deduplicate } from './dedup';
import { scoreQuality } from './quality';
import type {
  AggregatedShort,
  AggregationOpts,
  AggregationResult,
  ExtendedSource,
  SourceHealth,
} from './types';
import { ALL_SOURCES, SHORTS_MAX_DURATION, SOURCE_META } from './types';

export class ShortsAggregatorV2 {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Fetch from all requested sources in parallel with graceful degradation.
   * Returns normalized, deduplicated, quality-scored shorts.
   */
  async aggregate(opts: AggregationOpts = {}): Promise<AggregationResult> {
    const { sources = ALL_SOURCES, limit = 50, deduplicate: shouldDedup = true } = opts;

    const fetchPromises = sources.map(async (source) => {
      const startTime = Date.now();
      try {
        let shorts: AggregatedShort[];
        switch (source) {
          case 'peertube':
            shorts = await this.fetchPeerTubeAggregated(limit);
            break;
          case 'youtube':
            shorts = await this.fetchYouTubeAggregated(limit);
            break;
          case 'tiktok_rss':
            shorts = await this.fetchTikTokAggregated(limit);
            break;
          case 'instagram':
            shorts = await this.fetchInstagramAggregated(limit);
            break;
          case 'owncast':
            shorts = await this.fetchOwncastClips(limit);
            break;
          case 'loops':
            shorts = await this.fetchLoopsShorts(limit);
            break;
          case 'rss_bridge':
            shorts = await this.fetchRSSBridge(limit);
            break;
          case 'lemmy':
            shorts = await this.fetchLemmyVideos(limit);
            break;
          case 'pixelfed':
            shorts = await this.fetchPixelfedVideos(limit);
            break;
          case 'atprotocol':
            shorts = await this.fetchATProtocolShorts(limit);
            break;
          case 'zora':
            shorts = await this.fetchZoraShorts(limit);
            break;
          case 'farcaster':
            shorts = await this.fetchFarcasterShorts(limit);
            break;
          case 'nostr':
            shorts = await this.fetchNostrShorts(limit);
            break;
          case 'lens':
            shorts = await this.fetchLensShorts(limit);
            break;
          case 'bluesky':
            shorts = await this.fetchBlueskyShorts(limit);
            break;
          default:
            shorts = [];
        }
        return {
          source,
          shorts,
          health: {
            source,
            healthy: true,
            lastFetch: Date.now(),
            videosCount: shorts.length,
          } as SourceHealth,
        };
      } catch (err) {
        return {
          source,
          shorts: [] as AggregatedShort[],
          health: {
            source,
            healthy: false,
            lastFetch: startTime,
            error: err instanceof Error ? err.message : String(err),
            videosCount: 0,
          } as SourceHealth,
        };
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    const sourceResults = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          source: ExtendedSource;
          shorts: AggregatedShort[];
          health: SourceHealth;
        }> => r.status === 'fulfilled',
      )
      .map((r) => r.value);

    const allShorts: AggregatedShort[] = [];
    const sourceCounts: Record<string, number> = {};
    const sourceHealth: SourceHealth[] = [];

    for (const { source, shorts, health } of sourceResults) {
      allShorts.push(...shorts);
      sourceCounts[source] = shorts.length;
      sourceHealth.push(health);
    }

    // Deduplicate if requested
    let finalShorts = shouldDedup ? deduplicate(allShorts) : allShorts;

    // Compute quality scores & engagement rate
    finalShorts = scoreQuality(finalShorts);

    // Sort by quality score descending
    finalShorts.sort((a, b) => b.qualityScore - a.qualityScore);

    return {
      shorts: finalShorts.slice(0, limit),
      sourceCounts: sourceCounts as Record<ExtendedSource, number>,
      sourceHealth,
      aggregatedAt: Date.now(),
    };
  }

  // ── Source fetchers ─────────────────────────────────────────────────

  private async fetchPeerTubeAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchPeerTubeShorts(limit);
    return raw.map((v) => toAggregated(v, 'peertube'));
  }

  private async fetchYouTubeAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchYouTubeShorts(limit);
    return raw.map((v) => toAggregated(v, 'youtube'));
  }

  private async fetchTikTokAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchTikTokShorts(limit);
    return raw.map((v) => toAggregated(v, 'tiktok_rss'));
  }

  private async fetchInstagramAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchInstagramReels(limit);
    return raw.map((v) => toAggregated(v, 'instagram'));
  }

  // ── Owncast ─────────────────────────────────────────────────────────

  private async fetchOwncastClips(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const owncastUrl = this.env.OWNCAST_INSTANCE_URL || 'https://owncast.degenfeed.xyz';

    try {
      const statusRes = await fetch(`${owncastUrl}/api/status`);
      if (statusRes.ok) {
        const status = (await statusRes.json()) as {
          online?: boolean;
          viewerCount?: number;
          streamTitle?: string;
        };
        if (status.online) {
          shorts.push({
            id: `owncast:live:${Date.now()}`,
            source: 'owncast',
            sourceLabel: 'Owncast',
            sourceColor: SOURCE_META.owncast.color,
            sourceUrl: `${owncastUrl}/embed`,
            title: status.streamTitle || 'Live Now',
            description: status.streamTitle || 'Live streaming on Owncast',
            thumbnailUrl: `${owncastUrl}/thumbnail.jpg`,
            videoUrl: `${owncastUrl}/playlist.m3u8`,
            duration: 60,
            creatorName: 'Streamer',
            creatorHandle: 'owncast',
            views: status.viewerCount ?? 0,
            likes: 0,
            tags: ['live', 'streaming'],
            categories: ['streaming'],
            publishedAt: Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `owncast:live:${Date.now()}`,
            vertical: false,
          });
        }
      }

      const clipsRes = await fetch(`${owncastUrl}/api/videoclips`).catch(() => null);
      if (clipsRes?.ok) {
        const clips = (await clipsRes.json()) as Array<{
          id: string;
          name?: string;
          description?: string;
          url: string;
          thumbnailUrl?: string;
          duration?: number;
          createdAt?: string;
          views?: number;
        }>;

        for (const clip of clips.slice(0, limit)) {
          if ((clip.duration ?? 999) > 90) continue;
          shorts.push({
            id: `owncast:clip:${clip.id}`,
            source: 'owncast',
            sourceLabel: 'Owncast',
            sourceColor: SOURCE_META.owncast.color,
            sourceUrl: clip.url,
            title: clip.name || 'Owncast Clip',
            description: clip.description || '',
            thumbnailUrl: clip.thumbnailUrl || `${owncastUrl}/thumbnail.jpg`,
            videoUrl: clip.url,
            duration: clip.duration ?? 60,
            creatorName: 'Streamer',
            creatorHandle: 'owncast',
            views: clip.views ?? 0,
            likes: 0,
            tags: ['clip', 'streaming'],
            categories: ['streaming'],
            publishedAt: clip.createdAt ? new Date(clip.createdAt).getTime() : Date.now(),
            qualityScore: 0.6,
            engagementRate: 0,
            canTip: true,
            contentHash: `owncast:clip:${clip.id}`,
            vertical: false,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── RSS-Bridge ──────────────────────────────────────────────────────

  private async fetchRSSBridge(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const bridgeUrl = this.env.RSS_BRIDGE_URL;
    if (!bridgeUrl) return [];

    const bridges = [
      { name: 'TikTok', bridge: 'TikTok', query: 'trending' },
      { name: 'Instagram', bridge: 'Instagram', query: 'reels' },
    ];

    for (const { name, bridge, query } of bridges) {
      if (shorts.length >= limit) break;
      try {
        const res = await fetch(
          `${bridgeUrl}/?action=request&bridge=${bridge}&format=Json&q=${encodeURIComponent(query)}&limit=${limit}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const data = (await res.json()) as {
          items?: Array<{
            uri: string;
            title: string;
            timestamp?: number;
            content?: string;
            thumbnail?: string;
            author?: string;
            uid?: string;
          }>;
        };

        for (const item of (data.items ?? []).slice(0, limit - shorts.length)) {
          const topics = detectNiches(`${item.title} ${item.content ?? ''}`);
          shorts.push({
            id: `rss_bridge:${item.uid ?? item.uri}`,
            source: 'rss_bridge',
            sourceLabel: name,
            sourceColor: SOURCE_META.rss_bridge.color,
            sourceUrl: item.uri,
            title: item.title || `${name} Video`,
            description: item.content?.replace(/<[^>]+>/g, '').slice(0, 500) || '',
            thumbnailUrl: item.thumbnail || '',
            videoUrl: item.uri,
            duration: 30,
            creatorName: item.author || name,
            creatorHandle: item.author,
            views: 0,
            likes: 0,
            tags: topics,
            categories: topics,
            publishedAt: item.timestamp ? item.timestamp * 1000 : Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: false,
            contentHash: `rss_bridge:${item.uid ?? item.uri}`,
            vertical: true,
          });
        }
      } catch {
        // Fail-open per bridge
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Lemmy ───────────────────────────────────────────────────────────

  private async fetchLemmyVideos(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const lemmyInstances = (
      this.env.LEMMY_INSTANCES || 'https://lemmy.world,https://lemmy.ml,https://feddit.de'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const instanceUrl of lemmyInstances.slice(0, 2)) {
      if (shorts.length >= limit) break;
      try {
        const res = await fetch(
          `${instanceUrl}/api/v3/post/list?type_=All&sort=Active&limit=${Math.min(limit, 20)}&page=1`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const data = (await res.json()) as {
          posts?: Array<{
            post: {
              id: number;
              name: string;
              url?: string;
              thumbnail_url?: string;
              body?: string;
              published: string;
              embed_video_url?: string;
            };
            counts?: { score: number; comments: number; upvotes: number };
            creator?: { display_name?: string; name: string; avatar?: string };
            community?: { title: string; name: string };
          }>;
        };

        for (const item of data.posts ?? []) {
          const p = item.post;
          const videoUrl = p.embed_video_url || p.url || '';
          if (!videoUrl.match(/\.(mp4|webm|mov|avi)$/i) && !p.embed_video_url) continue;

          const topics = detectNiches(`${p.name} ${p.body ?? ''}`);
          shorts.push({
            id: `lemmy:${p.id}`,
            source: 'lemmy',
            sourceLabel: 'Lemmy',
            sourceColor: SOURCE_META.lemmy.color,
            sourceUrl: `${instanceUrl}/post/${p.id}`,
            title: p.name,
            description: p.body?.slice(0, 500) || '',
            thumbnailUrl: p.thumbnail_url || '',
            videoUrl,
            duration: 30,
            creatorName: item.creator?.display_name || item.creator?.name || 'unknown',
            creatorAvatar: item.creator?.avatar,
            creatorHandle: item.creator?.name,
            views: item.counts?.score ?? 0,
            likes: item.counts?.upvotes ?? 0,
            tags: topics,
            categories: [item.community?.name || 'lemmy'],
            publishedAt: new Date(p.published).getTime(),
            qualityScore: 0.5,
            engagementRate: item.counts ? item.counts.upvotes / Math.max(item.counts.score, 1) : 0,
            canTip: true,
            contentHash: `lemmy:${p.id}`,
            vertical: false,
          });
        }
      } catch {
        // Fail-open per instance
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Pixelfed ────────────────────────────────────────────────────────

  private async fetchPixelfedVideos(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const pixelfedInstances = (
      this.env.PIXELFED_INSTANCES || 'https://pixelfed.social,https://pixelfed.de'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const instanceUrl of pixelfedInstances.slice(0, 2)) {
      if (shorts.length >= limit) break;
      try {
        const res = await fetch(
          `${instanceUrl}/api/v1/timelines/public?limit=${Math.min(limit, 20)}&only_media=true`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const posts = (await res.json()) as Array<{
          id: string;
          content?: string;
          media_attachments?: Array<{
            id: string;
            type: string;
            url: string;
            preview_url?: string;
            meta?: { duration?: number; original?: { width: number; height: number } };
          }>;
          account: {
            username: string;
            display_name?: string;
            avatar?: string;
          };
          created_at: string;
          favourites_count: number;
          reblogs_count: number;
          tags?: Array<{ name: string }>;
        }>;

        for (const post of posts) {
          const videoMedia = (post.media_attachments ?? []).filter(
            (m) => m.type === 'video' || m.type === 'gifv',
          );
          if (videoMedia.length === 0) continue;

          for (const media of videoMedia) {
            const hashtags = (post.tags ?? []).map((t) => t.name);
            const isPortrait =
              media.meta?.original && media.meta.original.height > media.meta.original.width;
            const duration = media.meta?.duration ?? 30;

            if (duration > SHORTS_MAX_DURATION) continue;

            shorts.push({
              id: `pixelfed:${post.id}:${media.id}`,
              source: 'pixelfed',
              sourceLabel: 'Pixelfed',
              sourceColor: SOURCE_META.pixelfed.color,
              sourceUrl: `${instanceUrl}/p/${post.account.username}/${post.id}`,
              title: hashtags.slice(0, 3).join(', ') || 'Pixelfed Video',
              description: post.content?.replace(/<[^>]+>/g, '').slice(0, 500) || '',
              thumbnailUrl: media.preview_url || '',
              videoUrl: media.url,
              duration,
              creatorName: post.account.display_name || post.account.username,
              creatorAvatar: post.account.avatar,
              creatorHandle: post.account.username,
              views: post.favourites_count + post.reblogs_count,
              likes: post.favourites_count,
              tags: hashtags,
              categories: detectNiches(hashtags.join(' ')),
              publishedAt: new Date(post.created_at).getTime(),
              qualityScore: 0.5,
              engagementRate: 0,
              canTip: true,
              contentHash: `pixelfed:${media.id}`,
              vertical: isPortrait ?? true,
            });
          }
        }
      } catch {
        // Fail-open per instance
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Loops (Primary, Self-Hosted) ────────────────────────────────────

  private async fetchLoopsShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const loopsUrl = this.env.LOOPS_INSTANCE_URL || 'https://loops.video';

    try {
      const res = await fetch(
        `${loopsUrl}/api/v1/videos?sort=-createdAt&category=shorts&count=${Math.min(limit, 30)}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{
            uuid: string;
            name: string;
            description?: string;
            thumbnailPath?: string;
            previewPath?: string;
            duration: number;
            url: string;
            channel?: { displayName: string; name: string; avatar?: { path: string } };
            account?: { displayName: string; username: string; avatar?: string };
            views: number;
            likes: number;
            tags?: string[];
            publishedAt: string;
            isShort: boolean;
          }>;
        };

        for (const video of (data?.data ?? []).slice(0, limit)) {
          if (video.duration > 60 && !video.isShort) continue;
          const topics = detectNiches(
            `${video.name} ${video.description ?? ''} ${(video.tags ?? []).join(' ')}`,
          );
          shorts.push({
            id: `loops:${video.uuid}`,
            source: 'loops',
            sourceLabel: 'Loops',
            sourceColor: SOURCE_META.loops.color,
            sourceUrl: `${loopsUrl}/w/${video.uuid}`,
            title: video.name,
            description: video.description?.slice(0, 500) || '',
            thumbnailUrl: video.thumbnailPath
              ? `${loopsUrl}${video.thumbnailPath}`
              : video.previewPath
                ? `${loopsUrl}${video.previewPath}`
                : '',
            videoUrl: video.url,
            duration: video.duration,
            creatorName:
              video.channel?.displayName || video.account?.displayName || 'Loops Creator',
            creatorAvatar: video.channel?.avatar?.path
              ? `${loopsUrl}${video.channel.avatar.path}`
              : video.account?.avatar,
            creatorHandle: video.channel?.name || video.account?.username,
            views: video.views ?? 0,
            likes: video.likes ?? 0,
            tags: video.tags ?? topics,
            categories: topics,
            publishedAt: new Date(video.publishedAt).getTime(),
            qualityScore: 0.7,
            engagementRate: video.views > 0 ? (video.likes ?? 0) / Math.max(video.views, 1) : 0,
            canTip: true,
            contentHash: `loops:${video.uuid}`,
            vertical: video.duration < 60,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── AT Protocol Firehose ────────────────────────────────────────────

  private async fetchATProtocolShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

    try {
      const res = await fetch(
        `${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=${Math.min(limit, 30)}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          feed?: Array<{
            post: {
              uri: string;
              cid: string;
              author: { handle: string; displayName?: string; avatar?: string };
              record: {
                text: string;
                createdAt: string;
                embed?: {
                  $type: string;
                  video?: { ref?: { $link?: string }; mimeType?: string };
                  playlist?: string;
                  alt?: string;
                };
              };
              likeCount?: number;
              repostCount?: number;
            };
          }>;
        };

        for (const item of data?.feed ?? []) {
          const embed = item.post.record.embed;
          if (
            !embed ||
            (embed.$type !== 'app.bsky.embed.video' && embed.$type !== 'app.bsky.embed.video#main')
          )
            continue;

          const videoUrl =
            embed.playlist || `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
          if (!videoUrl) continue;

          const text = item.post.record.text || '';
          const hashtags = text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
          const topics = detectNiches(text);

          shorts.push({
            id: `atproto:${item.post.cid}`,
            source: 'atprotocol',
            sourceLabel: 'AT Protocol',
            sourceColor: SOURCE_META.atprotocol.color,
            sourceUrl: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            title: text.split('\n')[0]?.slice(0, 100) || 'Video',
            description: text.slice(0, 500),
            thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
            videoUrl,
            duration: 30,
            creatorName: item.post.author.displayName || item.post.author.handle,
            creatorAvatar: item.post.author.avatar,
            creatorHandle: item.post.author.handle,
            views: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
            likes: item.post.likeCount ?? 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics,
            publishedAt: new Date(item.post.record.createdAt).getTime(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: false,
            contentHash: `atproto:${item.post.cid}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Zora Video NFTs ─────────────────────────────────────────────────

  private async fetchZoraShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];

    try {
      const res = await fetch('https://api.zora.co/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            query VideoNFTs($first: Int!) {
              tokens(
                sort: { sortKey: TRANSFER_COUNT, sortDirection: DESC }
                networks: { network: BASE, chain: BASE_MAINNET }
                pagination: { limit: $first }
              ) {
                nodes {
                  token {
                    tokenId, name, description
                    image { url }
                    content { url mimeType }
                    owner
                    collection { address name }
                  }
                  sales { totalCount salePrice { chainTokenPrice { raw } } }
                }
              }
            }
          `,
          variables: { first: limit },
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
                sales?: {
                  totalCount: number;
                  salePrice?: { chainTokenPrice?: { raw: string } };
                };
              }>;
            };
          };
        };

        for (const node of data?.data?.tokens?.nodes ?? []) {
          const t = node?.token;
          if (!t?.content?.mimeType?.startsWith('video/')) continue;
          if (!t.content.url) continue;

          const topics = detectNiches(`${t.name} ${t.description}`);
          const contractAddr = t.collection?.address || 'base';
          const sourceUrl = `https://zora.co/collect/${contractAddr}:${t.tokenId}`;
          const lastSalePrice = node?.sales?.salePrice?.chainTokenPrice?.raw
            ? weiToEth(node.sales.salePrice.chainTokenPrice.raw)
            : undefined;

          let marketData: {
            priceEth?: string;
            bidCount?: number;
            topBidEth?: string;
            mintCount?: number;
          } = {};
          try {
            marketData = await this.fetchZoraMarketplaceData(contractAddr, t.tokenId);
          } catch {
            // Marketplace data is additive
          }

          shorts.push({
            id: `zora:${t.tokenId}`,
            source: 'zora',
            sourceLabel: 'Zora',
            sourceColor: SOURCE_META.zora.color,
            sourceUrl,
            title: t.name,
            description: t.description?.slice(0, 500) || '',
            thumbnailUrl: t.image?.url || '',
            videoUrl: t.content.url,
            duration: 30,
            creatorName: t.owner.slice(0, 10),
            creatorHandle: t.owner.slice(0, 10),
            creatorAddress: t.owner,
            views: node?.sales?.totalCount ?? 0,
            likes: node?.sales?.totalCount ?? 0,
            tags: ['nft', 'zora', 'video', ...topics],
            categories: ['nft', ...topics],
            publishedAt: Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `zora:${t.tokenId}`,
            vertical: true,
            zoraTokenId: t.tokenId,
            zoraContractAddress: contractAddr,
            zoraUrl: sourceUrl,
            zoraPriceEth: marketData.priceEth || lastSalePrice,
            zoraBidCount: marketData.bidCount ?? 0,
            zoraTopBidEth: marketData.topBidEth,
            zoraEditionMints: marketData.mintCount ?? node?.sales?.totalCount ?? 0,
            zoraMarketplaceActive: !!(marketData.priceEth || marketData.bidCount),
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  /**
   * Fetch real-time marketplace data for a Zora NFT.
   * Prices, active bids, and mint counts from the Zora Indexer API.
   */
  async fetchZoraMarketplaceData(
    contractAddress: string,
    tokenId: string,
  ): Promise<{
    priceEth?: string;
    bidCount?: number;
    topBidEth?: string;
    mintCount?: number;
  }> {
    try {
      const res = await fetch('https://api.zora.co/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            query MarketData($collection: String!, $tokenId: String!) {
              token(
                network: { network: BASE, chain: BASE_MAINNET }
                address: $collection
                tokenId: $tokenId
              ) {
                token { tokenId, mintCount: totalMinted }
                ask { price { chainTokenPrice { raw decimal } } }
                bids(first: 5) {
                  nodes { bid { amount { chainTokenPrice { raw decimal } } } }
                }
              }
            }
          `,
          variables: { collection: contractAddress, tokenId },
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return {};
      const data = (await res.json()) as {
        data?: {
          token?: {
            token?: { tokenId: string; mintCount?: number };
            ask?: { price?: { chainTokenPrice?: { raw: string; decimal: number } } };
            bids?: {
              nodes?: Array<{
                bid?: { amount?: { chainTokenPrice?: { raw: string; decimal: number } } };
              }>;
            };
          };
        };
      };

      const t = data?.data?.token;
      const mintCount = t?.token?.mintCount ?? undefined;
      const askPrice = t?.ask?.price?.chainTokenPrice?.raw
        ? weiToEth(t.ask.price.chainTokenPrice.raw)
        : undefined;
      const bids = t?.bids?.nodes ?? [];
      const bidCount = bids.length;
      const topBid = bids
        .map((b) =>
          b?.bid?.amount?.chainTokenPrice?.raw ? BigInt(b.bid.amount.chainTokenPrice.raw) : 0n,
        )
        .filter((b) => b > 0n)
        .sort((a, b) => (b > a ? 1 : -1))[0];
      const topBidEth = topBid ? weiToEth(topBid.toString()) : undefined;

      return {
        priceEth: askPrice,
        bidCount: bidCount > 0 ? bidCount : undefined,
        topBidEth,
        mintCount,
      };
    } catch {
      return {};
    }
  }

  // ── Farcaster Video Frames ──────────────────────────────────────────

  private async fetchFarcasterShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const hubUrl = this.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';

    try {
      const curatedFids = [3, 2, 1, 228, 239, 354, 5650, 602, 7771, 124, 7245];
      for (const fid of curatedFids) {
        if (shorts.length >= limit) break;
        const res = await fetch(`${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=10`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as {
          messages?: Array<{
            hash: string;
            data: {
              castAddBody: {
                text: string;
                embeds: Array<{ url: string }>;
                mentions?: Array<{ fid: number }>;
              };
              fid: number;
              timestamp: number;
            };
          }>;
        };

        for (const msg of data?.messages ?? []) {
          const body = msg.data?.castAddBody;
          if (!body?.text) continue;

          const videoEmbed = (body.embeds || []).find(
            (e) =>
              e.url.match(/\.(mp4|webm|mov)$/i) ||
              e.url.includes('video') ||
              e.url.includes('/watch?'),
          );
          if (!videoEmbed) continue;

          const textContent = body.text || '';
          const hashtags = textContent.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
          const topics = detectNiches(textContent);

          shorts.push({
            id: `farcaster:${msg.hash}`,
            source: 'farcaster',
            sourceLabel: 'Farcaster',
            sourceColor: SOURCE_META.farcaster.color,
            sourceUrl: `https://warpcast.com/fid:${msg.data.fid}/${msg.hash}`,
            title: textContent.split('\n')[0]?.slice(0, 100) || 'Cast',
            description: textContent.slice(0, 500),
            thumbnailUrl: '',
            videoUrl: videoEmbed.url,
            duration: 30,
            creatorName: `fid:${msg.data.fid}`,
            creatorHandle: `fid:${msg.data.fid}`,
            views: 0,
            likes: 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics.length > 0 ? topics : ['farcaster'],
            publishedAt: msg.data.timestamp
              ? new Date(msg.data.timestamp * 1000).getTime()
              : Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: false,
            contentHash: `fc:${msg.hash}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Nostr NIP-71 Video Events ────────────────────────────────────────

  private async fetchNostrShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const relayUrls = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
    ];

    for (const relay of relayUrls.slice(0, 3)) {
      if (shorts.length >= limit) break;
      try {
        const restUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
        const res = await fetch(
          `${restUrl}/api/v1/events?kinds=31388&limit=${Math.ceil(limit / 3)}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const events = (await res.json()) as Array<{
          id: string;
          pubkey: string;
          content: string;
          created_at: number;
          tags: string[][];
        }>;

        for (const ev of Array.isArray(events) ? events : []) {
          if (shorts.length >= limit) break;

          const imetaTag = ev.tags.find((t) => t[0] === 'imeta');
          const titleTag = ev.tags.find((t) => t[0] === 'title');
          const imageTag = ev.tags.find((t) => t[0] === 'image');
          const durationTag = ev.tags.find((t) => t[0] === 'duration');

          let videoUrl: string | undefined;
          if (imetaTag) {
            for (const entry of imetaTag) {
              if (entry.startsWith('url ')) videoUrl = entry.slice(4);
            }
          }
          if (!videoUrl) {
            const urlMatch = ev.content.match(
              /(https?:\/\/[^\s]+\.(?:mp4|webm|mov|m3u8))(?:\?[^\s]*)?/i,
            );
            videoUrl = urlMatch?.[1] ?? undefined;
          }
          if (!videoUrl) continue;

          const title =
            (titleTag?.[1] ?? ev.content.split('\n')[0]?.slice(0, 100)) || 'Nostr Video';
          const duration = durationTag?.[1] ? Number(durationTag[1]) : 30;
          const hashtags = ev.tags
            .filter((t) => t[0] === 't')
            .map((t) => t[1])
            .filter(Boolean);
          const topics = detectNiches(`${title} ${ev.content}`);

          if (duration > 0 && duration > SHORTS_MAX_DURATION) continue;

          shorts.push({
            id: `nostr:${ev.id}`,
            source: 'nostr',
            sourceLabel: 'Nostr',
            sourceColor: SOURCE_META.nostr.color,
            sourceUrl: `https://snort.social/e/${ev.id}`,
            title,
            description: ev.content.slice(0, 500),
            thumbnailUrl: imageTag?.[1] ?? '',
            videoUrl,
            duration,
            creatorName: `npub1${ev.pubkey.slice(0, 8)}...`,
            creatorHandle: ev.pubkey,
            views: 0,
            likes: 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics.length > 0 ? topics : ['nostr'],
            publishedAt: ev.created_at * 1000,
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `nostr:${ev.id}`,
            vertical: true,
          });
        }
      } catch {
        // Fail-open per relay
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Lens Video Publications ───────────────────────────────────────────

  private async fetchLensShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const lensApiUrl = this.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';

    try {
      const query = `
        query ExploreVideos {
          explorePublications(
            request: { limit: ${Math.min(limit, 25)}, orderBy: TOP_REACTION }
          ) {
            items {
              ... on Post {
                id
                metadata { name content media { original { url mimeType } } }
                profile { id handle metadata { picture { ... on ImageSet { optimized { uri } } } } }
                stats { reactions totalUpvotes }
                createdAt
              }
            }
          }
        }
      `;

      const res = await fetch(lensApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: {
            explorePublications?: {
              items?: Array<{
                id: string;
                metadata?: {
                  name?: string;
                  content?: string;
                  media?: Array<{ original?: { url: string; mimeType: string } }>;
                };
                profile?: {
                  id: string;
                  handle: string;
                  metadata?: { picture?: { optimized?: { uri: string } } };
                };
                stats?: { reactions: number; totalUpvotes: number };
                createdAt: string;
              }>;
            };
          };
        };

        for (const item of data?.data?.explorePublications?.items ?? []) {
          const videoMedia = item.metadata?.media?.find((m) =>
            m.original?.mimeType?.startsWith('video/'),
          );
          if (!videoMedia?.original?.url) continue;

          const textContent = `${item.metadata?.name ?? ''} ${item.metadata?.content ?? ''}`;
          const topics = detectNiches(textContent);
          const duration = 30;

          if (duration > SHORTS_MAX_DURATION) continue;

          shorts.push({
            id: `lens:${item.id}`,
            source: 'lens',
            sourceLabel: 'Lens',
            sourceColor: SOURCE_META.lens.color,
            sourceUrl: `https://hey.xyz/posts/${item.id}`,
            title: item.metadata?.name || textContent.split('\n')[0]?.slice(0, 100) || 'Lens Video',
            description: item.metadata?.content?.slice(0, 500) || '',
            thumbnailUrl: item.profile?.metadata?.picture?.optimized?.uri || '',
            videoUrl: videoMedia.original.url,
            duration,
            creatorName: item.profile?.handle || 'Lens Creator',
            creatorAvatar: item.profile?.metadata?.picture?.optimized?.uri,
            creatorHandle: item.profile?.handle,
            views: (item.stats?.reactions ?? 0) + (item.stats?.totalUpvotes ?? 0),
            likes: item.stats?.totalUpvotes ?? 0,
            tags: topics,
            categories: ['lens', ...topics],
            publishedAt: new Date(item.createdAt).getTime(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `lens:${item.id}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Bluesky Native Video Posts ─────────────────────────────────────────

  private async fetchBlueskyShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

    try {
      const feedRes = await fetch(
        `${bskyUrl}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hd5jnv5a7j5l3s5j3xh/app.bsky.feed.generator/video-feed&limit=${Math.min(limit, 30)}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (feedRes.ok) {
        const feedData = (await feedRes.json()) as {
          feed?: Array<{
            post: {
              uri: string;
              cid: string;
              author: { handle: string; displayName?: string; avatar?: string };
              record: {
                text: string;
                createdAt: string;
                embed?: {
                  $type: string;
                  video?: { ref?: { $link?: string }; mimeType?: string };
                  playlist?: string;
                  alt?: string;
                };
              };
              likeCount?: number;
              repostCount?: number;
            };
          }>;
        };

        for (const item of feedData?.feed ?? []) {
          if (shorts.length >= limit) break;
          const embed = item.post.record.embed;
          if (
            !embed ||
            (embed.$type !== 'app.bsky.embed.video' && embed.$type !== 'app.bsky.embed.video#main')
          )
            continue;

          const videoUrl =
            embed.playlist || `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
          if (!videoUrl) continue;

          const text = item.post.record.text || '';
          const hashtags = text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
          const topics = detectNiches(text);

          shorts.push({
            id: `bluesky:${item.post.cid}`,
            source: 'bluesky',
            sourceLabel: 'Bluesky',
            sourceColor: SOURCE_META.bluesky.color,
            sourceUrl: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            title: text.split('\n')[0]?.slice(0, 100) || 'Bluesky Video',
            description: text.slice(0, 500),
            thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
            videoUrl,
            duration: 30,
            creatorName: item.post.author.displayName || item.post.author.handle,
            creatorAvatar: item.post.author.avatar,
            creatorHandle: item.post.author.handle,
            views: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
            likes: item.post.likeCount ?? 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics,
            publishedAt: new Date(item.post.record.createdAt).getTime(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `bsky:${item.post.cid}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }
}
