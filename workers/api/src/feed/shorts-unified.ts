/**
 * @degenfeed/api-worker — Unified Multi-Protocol Shorts Feed
 *
 * Aggregates short-form videos from ALL supported protocols into a
 * single, ranked, deduplicated feed. Sources include:
 *
 *   ActivityPub (Loops/Pixelfed/PeerTube via AP)
 *   AT Protocol (Bluesky/Flashes via app.bsky.embed.video)
 *   Nostr (Kind 1 with video attachments)
 *   Farcaster (Casts with video embeds)
 *   Lens (Publications with video)
 *   Zora (Video NFTs)
 *   PeerTube (Federated short videos)
 *   YouTube/TikTok/Instagram (existing ShortVideoItem sources)
 *   DegenFeed native shorts
 *
 * Each source is fetched in parallel, normalized to a common ShortVideo
 * type, deduplicated by content hash, and ranked by engagement + freshness.
 *
 * @see ShortsAggregator for the original single-source aggregator
 * @see UnifiedShortsPipeline for the publishing side
 */

import {
  fetchInstagramReels,
  fetchPeerTubeShorts,
  fetchTikTokShorts,
  fetchYouTubeShorts,
  type ShortVideoItem,
} from '@degenfeed/shorts-provider';
import type { Env } from '../types';
import { PROTOCOL_META, type ShortProtocol, type ShortVideo } from '../lib/unified-shorts';

// ─── Types ────────────────────────────────────────────────────────────────

export type FeedSource =
  | 'loops'
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'bluesky'
  | 'peertube'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'pixelfed'
  | 'degenfeed';

export interface UnifiedFeedOptions {
  sources?: FeedSource[];
  category?: string;
  creatorFilter?: string[];
  sort: 'trending' | 'newest' | 'for-you';
  limit: number;
  cursor?: string;
  excludeIds?: string[];
}

export interface UnifiedShortFeed {
  shorts: ShortVideo[];
  nextCursor?: string;
  sources: Record<string, number>;
  total: number;
  hasMore: boolean;
  aggregatedAt: number;
}

export interface UserPreferences {
  followedCreators: string[];
  likedTopics: string[];
  preferredProtocols: ShortProtocol[];
  /** User's preferred content sources (enabled/disabled) */
  enabledSources?: string[];
  /** Whether to show only Loops content */
  loopsOnly?: boolean;
}

// ─── Source Protocol Color Map (for frontend badges) ─────────────────────

export const FEED_SOURCE_COLORS: Record<string, string> = {
  loops: PROTOCOL_META.activitypub.color,
  activitypub: PROTOCOL_META.activitypub.color,
  atproto: PROTOCOL_META.atproto.color,
  nostr: PROTOCOL_META.nostr.color,
  farcaster: PROTOCOL_META.farcaster.color,
  lens: PROTOCOL_META.lens.color,
  zora: PROTOCOL_META.zora.color,
  peertube: PROTOCOL_META.peertube.color,
  youtube: '#ff0000',
  tiktok: '#010101',
  instagram: '#e1306c',
  pixelfed: '#FF4500',
  degenfeed: PROTOCOL_META.degenfeed.color,
};

export const FEED_SOURCE_LABELS: Record<string, string> = {
  loops: 'Loops',
  activitypub: 'ActivityPub',
  atproto: 'AT Protocol',
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  zora: 'Zora',
  peertube: 'PeerTube',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  pixelfed: 'Pixelfed',
  bluesky: 'Bluesky',
  degenfeed: 'DegenFeed',
};

// ─── Unified Feed Aggregator ─────────────────────────────────────────────

export class UnifiedShortsFeed {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Get the unified multi-protocol shorts feed.
   * Fetches from all requested sources in parallel, normalizes,
   * deduplicates, ranks, and paginates.
   */
  async getFeed(opts: UnifiedFeedOptions): Promise<UnifiedShortFeed> {
    const {
      sources = [
        'loops',
        'activitypub',
        'atproto',
        'nostr',
        'farcaster',
        'lens',
        'zora',
        'bluesky',
        'peertube',
        'youtube',
        'tiktok',
        'instagram',
        'degenfeed',
      ] as FeedSource[],
      sort = 'trending',
      limit = 20,
      cursor,
      excludeIds = [],
    } = opts;

    const _startedAt = Date.now();
    const fetchPromises = sources.map(async (source) => {
      try {
        const sourceShorts = await this.fetchSource(source, limit * 2);
        return { source, shorts: sourceShorts, count: sourceShorts.length };
      } catch (err) {
        console.error(`[shorts-unified] ${source} fetch failed:`, err);
        return { source, shorts: [], count: 0 };
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    const sourceContents = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          source: FeedSource;
          shorts: ShortVideo[];
          count: number;
        }> => r.status === 'fulfilled',
      )
      .map((r) => r.value);

    // Merge all shorts
    const allShorts: ShortVideo[] = [];
    const sourceCounts: Record<string, number> = {};
    for (const { source, shorts, count } of sourceContents) {
      allShorts.push(...shorts);
      sourceCounts[source] = count;
    }

    // Apply cursor pagination
    let processed = allShorts;
    if (cursor) {
      const cursorIdx = processed.findIndex((s) => s.id === cursor);
      if (cursorIdx >= 0) {
        processed = processed.slice(cursorIdx + 1);
      }
    }

    // Exclude seen IDs
    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds);
      processed = processed.filter((s) => !excludeSet.has(s.id));
    }

    // Deduplicate by content hash
    const deduped = this.deduplicateByContentHash(processed);

    // Rank
    const ranked = this.rank(deduped, sort);

    // Paginate
    const paginated = ranked.slice(0, limit);

    return {
      shorts: paginated,
      nextCursor: paginated.length > 0 ? paginated[paginated.length - 1]?.id : undefined,
      sources: sourceCounts,
      total: ranked.length,
      hasMore: ranked.length > limit,
      aggregatedAt: Date.now(),
    };
  }

  /**
   * Fetch shorts from a single protocol source.
   */
  async fetchSource(source: FeedSource, limit: number): Promise<ShortVideo[]> {
    switch (source) {
      case 'loops':
        return this.fetchActivityPubShorts(limit); // Loops is ActivityPub-based
      case 'activitypub':
        return this.fetchActivityPubShorts(limit);
      case 'atproto':
        return this.fetchATProtocolShorts(limit);
      case 'nostr':
        return this.fetchNostrShorts(limit);
      case 'farcaster':
        return this.fetchFarcasterShorts(limit);
      case 'lens':
        return this.fetchLensShorts(limit);
      case 'zora':
        return this.fetchZoraShorts(limit);
      case 'peertube':
        return this.mapShortVideoItems(await fetchPeerTubeShorts(limit), 'peertube');
      case 'youtube':
        return this.mapShortVideoItems(await fetchYouTubeShorts(limit), 'youtube');
      case 'tiktok':
        return this.mapShortVideoItems(await fetchTikTokShorts(limit), 'tiktok');
      case 'instagram':
        return this.mapShortVideoItems(await fetchInstagramReels(limit), 'instagram');
      case 'bluesky':
        return this.fetchBlueskyShorts(limit);
      case 'degenfeed':
        return this.fetchDegenFeedShorts(limit);
      default:
        return [];
    }
  }

  // ── Source-specific fetchers ───────────────────────────────────────

  async fetchActivityPubShorts(limit: number): Promise<ShortVideo[]> {
    // 1. Fetch from our GoToSocial instance (Loops/Pixelfed compatible)
    const apShorts: ShortVideo[] = [];
    const instanceUrl = this.env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';

    try {
      // Query the federated timeline for video posts
      const res = await fetch(
        `${instanceUrl}/api/v1/timelines/public?limit=${Math.min(limit, 40)}&only_media=true`,
      );

      if (res.ok) {
        const posts = (await res.json()) as Array<{
          id: string;
          content: string;
          media_attachments?: Array<{
            id: string;
            type: string;
            url: string;
            preview_url: string;
            description?: string;
            meta?: { duration?: number };
          }>;
          account: {
            username: string;
            display_name: string;
            avatar: string;
          };
          created_at: string;
          tags?: Array<{ name: string }>;
          favourites_count: number;
          reblogs_count: number;
        }>;

        for (const post of posts) {
          const videoMedia = post.media_attachments?.filter(
            (m) => m.type === 'video' || m.type === 'gifv',
          );
          if (!videoMedia || videoMedia.length === 0) continue;

          for (const media of videoMedia) {
            const hashtags = post.tags?.map((t) => t.name) ?? [];
            apShorts.push({
              id: `activitypub:${post.id}:${media.id}`,
              title:
                media.description || post.content?.replace(/<[^>]+>/g, '').slice(0, 100) || 'Video',
              caption: post.content?.replace(/<[^>]+>/g, '').slice(0, 500) || '',
              videoUrl: media.url,
              thumbnailUrl: media.preview_url || '',
              duration: media.meta?.duration || 30,
              hashtags,
              creator: {
                address: `ap:${post.account.username}@${new URL(instanceUrl).hostname}`,
                handle: post.account.display_name || post.account.username,
                avatar: post.account.avatar,
              },
              publishedAt: new Date(post.created_at).getTime(),
              protocols: {
                activitypub: `${instanceUrl}/@${post.account.username}/${post.id}`,
              },
              engagement: {
                likes: (post.favourites_count ?? 0) + (post.reblogs_count ?? 0),
                views: 0,
                tips: 0,
              },
              contentHash: `ap:${media.id}`,
            });
          }
        }
      }
    } catch {
      // Fail-open
    }

    return apShorts.slice(0, limit);
  }

  async fetchATProtocolShorts(limit: number): Promise<ShortVideo[]> {
    // Fetch Bluesky posts with video embeds (Flashes-compatible)
    const atShorts: ShortVideo[] = [];
    const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

    try {
      // Use the Bluesky public API to discover posts with video
      const res = await fetch(
        `${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=${Math.min(limit, 30)}`,
        {
          headers: {
            accept: 'application/json',
          },
        },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          feed?: Array<{
            post: {
              uri: string;
              author: { handle: string; displayName?: string; avatar?: string };
              record: {
                text: string;
                createdAt: string;
                embed?: {
                  $type: string;
                  video?: {
                    $type?: string;
                    ref?: { $link?: string };
                    mimeType?: string;
                  };
                  playlist?: string;
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
          ) {
            continue;
          }

          const videoUrl =
            embed.playlist || `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
          if (!videoUrl) continue;

          const hashtags = item.post.record.text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];

          atShorts.push({
            id: `atproto:${item.post.uri}`,
            title: item.post.record.text.split('\n')[0]?.slice(0, 100) || 'Video',
            caption: item.post.record.text.slice(0, 500),
            videoUrl,
            thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
            duration: 30,
            hashtags,
            creator: {
              address: `did:${item.post.author.handle}`,
              handle: item.post.author.displayName || item.post.author.handle,
              avatar: item.post.author.avatar,
            },
            publishedAt: new Date(item.post.record.createdAt).getTime(),
            protocols: {
              atproto: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            },
            engagement: {
              likes: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
              views: 0,
              tips: 0,
            },
            contentHash: `at:${item.post.uri}`,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return atShorts.slice(0, limit);
  }

  async fetchNostrShorts(limit: number): Promise<ShortVideo[]> {
    // Fetch Nostr kind 1 events with video attachments (i tags with video URLs)
    const nostrShorts: ShortVideo[] = [];
    const relayUrls = (
      this.env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
    )
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    // Use relay.sc bridge for HTTP-accessible Nostr queries
    for (const relay of relayUrls.slice(0, 2)) {
      try {
        const relayHttpUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
        const res = await fetch(
          `${relayHttpUrl}/api/v1/events?kind=1&limit=${Math.min(limit, 20)}`,
        );

        if (res.ok) {
          const events = (await res.json()) as Array<{
            id: string;
            pubkey: string;
            content: string;
            tags: string[][];
            created_at: number;
          }>;

          for (const evt of events) {
            // Check for video URLs in tags (imeta or i tags with video URLs)
            const videoTags = evt.tags.filter(
              (t) => (t[0] === 'i' || t[0] === 'imeta') && t[1]?.match(/\.(mp4|webm|mov|avi)$/i),
            );
            if (videoTags.length === 0) {
              // Also check content for direct video URLs
              const urlMatch = evt.content.match(/(https?:\/\/[^\s]+\.(mp4|webm|mov))/i);
              if (!urlMatch) continue;
            }

            const hashtags: string[] = evt.tags
              .filter((t) => t[0] === 't')
              .map((t) => t[1])
              .filter((t): t is string => t !== undefined);

            nostrShorts.push({
              id: `nostr:${evt.id}`,
              title: evt.content.split('\n')[0]?.slice(0, 100) || 'Video',
              caption: evt.content.slice(0, 500),
              videoUrl: videoTags[0]?.[1] || '',
              thumbnailUrl: '',
              duration: 30,
              hashtags,
              creator: {
                address: `npub:${evt.pubkey}`,
                handle: `npub${evt.pubkey.slice(0, 8)}`,
              },
              publishedAt: evt.created_at * 1000,
              protocols: { nostr: `https://snort.social/e/${evt.id}` },
              engagement: { likes: 0, views: 0, tips: 0 },
              contentHash: `nostr:${evt.id}`,
            });
          }
        }
      } catch {}
    }

    return nostrShorts.slice(0, limit);
  }

  async fetchFarcasterShorts(limit: number): Promise<ShortVideo[]> {
    // Fetch Farcaster casts with video embeds via our Hubble
    const fcShorts: ShortVideo[] = [];

    const hubUrl = this.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';

    try {
      // Scan curated FIDs for casts with video embeds
      const curatedFids = [3, 2, 1, 228, 239, 354, 5650, 602, 7771];
      for (const fid of curatedFids) {
        if (fcShorts.length >= limit) break;
        const res = await fetch(`${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=10`, {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          messages?: Array<{
            hash: string;
            data: {
              castAddBody: { text: string; embeds: Array<{ url: string }> };
              fid: number;
              timestamp: number;
            };
          }>;
        };

        for (const msg of data?.messages ?? []) {
          const body = msg.data?.castAddBody;
          if (!body?.text) continue;
          const videoEmbed = (body.embeds || []).find(
            (e) => e.url.match(/\.(mp4|webm|mov)$/i) || e.url.includes('video'),
          );
          if (!videoEmbed) continue;

          const fid = msg.data?.fid || 0;
          const ts = (msg.data?.timestamp || 0) * 1000;

          fcShorts.push({
            id: `farcaster:${msg.hash}`,
            title: body.text.split('\n')[0]?.slice(0, 100) || 'Cast',
            caption: body.text.slice(0, 500),
            videoUrl: videoEmbed.url,
            thumbnailUrl: '',
            duration: 30,
            hashtags: [],
            creator: {
              address: `fid:${fid}`,
              handle: `fid:${fid}`,
              avatar: '',
            },
            publishedAt: ts ? new Date(ts).getTime() : Date.now(),
            protocols: {
              farcaster: `https://warpcast.com/fid:${fid}/${msg.hash}`,
            },
            engagement: {
              likes: 0,
              views: 0,
              tips: 0,
            },
            contentHash: `fc:${msg.hash}`,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return fcShorts.slice(0, limit);
  }

  async fetchLensShorts(limit: number): Promise<ShortVideo[]> {
    // Fetch Lens publications with video via Lens API
    const lensShorts: ShortVideo[] = [];

    try {
      const lensApiUrl = this.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
      const query = `
				query ExplorePublications {
					explorePublications(
						request: { limit: ${Math.min(limit, 25)}, orderBy: TOP_REACTION }
					) {
						items {
							... on Post {
								id
								metadata {
									name
									content
									media {
										original { url mimeType }
									}
								}
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
                  media?: Array<{
                    original?: { url: string; mimeType: string };
                  }>;
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

          lensShorts.push({
            id: `lens:${item.id}`,
            title:
              item.metadata?.name ||
              item.metadata?.content?.split('\n')[0]?.slice(0, 100) ||
              'Video',
            caption: item.metadata?.content?.slice(0, 500) || '',
            videoUrl: videoMedia.original.url,
            thumbnailUrl: item.profile?.metadata?.picture?.optimized?.uri || '',
            duration: 30,
            hashtags: [],
            creator: {
              address: `lens:${item.profile?.id}`,
              handle: item.profile?.handle || '',
              avatar: item.profile?.metadata?.picture?.optimized?.uri,
            },
            publishedAt: new Date(item.createdAt).getTime(),
            protocols: { lens: `https://hey.xyz/posts/${item.id}` },
            engagement: {
              likes: (item.stats?.totalUpvotes ?? 0) + (item.stats?.reactions ?? 0),
              views: 0,
              tips: 0,
            },
            contentHash: `lens:${item.id}`,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return lensShorts.slice(0, limit);
  }

  async fetchZoraShorts(limit: number): Promise<ShortVideo[]> {
    // Fetch video NFTs from Zora
    const zoraShorts: ShortVideo[] = [];

    try {
      const zoraApiUrl = 'https://api.zora.co/graphql';
      const query = `
				query VideoNFTs($first: Int!) {
					tokens(
						sort: { sortKey: TRANSFER_COUNT, sortDirection: DESC }
						networks: { network: BASE, chain: BASE_MAINNET }
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
        body: JSON.stringify({ query, variables: { first: limit } }),
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
          const t = node?.token;
          if (!t?.content?.mimeType?.startsWith('video/')) continue;

          zoraShorts.push({
            id: `zora:${t.tokenId}`,
            title: t.name,
            caption: t.description?.slice(0, 500) || '',
            videoUrl: t.content.url,
            thumbnailUrl: t.image?.url || '',
            duration: 30,
            hashtags: ['nft', 'zora', 'video'],
            creator: {
              address: t.owner,
              handle: t.owner.slice(0, 10),
            },
            publishedAt: Date.now(),
            protocols: {
              zora: `https://zora.co/collect/${t.collection?.address || 'base'}:${t.tokenId}`,
            },
            zoraTokenId: t.tokenId,
            zoraContractAddress: t.collection?.address,
            zoraUrl: `https://zora.co/collect/${t.collection?.address || 'base'}:${t.tokenId}`,
            engagement: { likes: 0, views: 0, tips: 0 },
            contentHash: `zora:${t.tokenId}`,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return zoraShorts.slice(0, limit);
  }

  async fetchPeerTubeV2Shorts(limit: number): Promise<ShortVideo[]> {
    // Enhanced PeerTube fetcher using the instance API
    const ptShorts: ShortVideo[] = [];
    const instanceUrl = this.env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz';

    try {
      const res = await fetch(
        `${instanceUrl}/api/v1/videos?sort=-views&category=1&nsfw=false&filter=local&count=${Math.min(limit, 30)}`,
      );

      if (res.ok) {
        const data = (await res.json()) as {
          data: Array<{
            uuid: string;
            name: string;
            description?: string;
            thumbnailPath?: string;
            previewPath?: string;
            duration: number;
            url: string;
            channel?: {
              displayName: string;
              name: string;
              avatar?: { path: string };
            };
            views: number;
            likes: number;
            tags?: string[];
            publishedAt: string;
          }>;
        };

        for (const video of data.data) {
          if (video.duration > 120 && !video.name.toLowerCase().includes('shorts')) continue;

          ptShorts.push({
            id: `peertube:${video.uuid}`,
            title: video.name,
            caption: video.description?.slice(0, 500) || '',
            videoUrl: video.url,
            thumbnailUrl: video.thumbnailPath
              ? `${instanceUrl}${video.thumbnailPath}`
              : video.previewPath
                ? `${instanceUrl}${video.previewPath}`
                : '',
            duration: video.duration,
            hashtags: video.tags ?? [],
            creator: {
              address: `peertube:${video.channel?.name || 'unknown'}`,
              handle: video.channel?.displayName || video.channel?.name || 'unknown',
              avatar: video.channel?.avatar?.path
                ? `${instanceUrl}${video.channel.avatar.path}`
                : undefined,
            },
            publishedAt: new Date(video.publishedAt).getTime(),
            protocols: { peertube: video.url },
            engagement: {
              likes: video.likes ?? 0,
              views: video.views ?? 0,
              tips: 0,
            },
            contentHash: `pt:${video.uuid}`,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return ptShorts.slice(0, limit);
  }

  async fetchDegenFeedShorts(limit: number): Promise<ShortVideo[]> {
    // Fetch native DegenFeed shorts from KV
    const dfShorts: ShortVideo[] = [];

    try {
      // List all shorts from KV
      const listResult = await this.env.SHORTS?.list({
        prefix: 'shorts:',
        limit,
      });

      if (listResult?.keys) {
        for (const key of listResult.keys) {
          if (key.name.startsWith('shorts:by_') || key.name.includes(':comments:')) continue;

          try {
            const raw = await this.env.SHORTS?.get(key.name);
            if (raw) {
              const short = JSON.parse(raw) as ShortVideo;
              // Only include valid shorts with a video URL
              if (short.videoUrl) {
                short.protocols.degenfeed = `https://app.degenfeed.xyz/shorts/${short.id}`;
                dfShorts.push(short);
              }
            }
          } catch {}
        }
      }
    } catch {
      // Fail-open
    }

    // Sort by publishedAt descending
    dfShorts.sort((a, b) => b.publishedAt - a.publishedAt);
    return dfShorts.slice(0, limit);
  }

  // ── Merge, deduplicate, rank ──────────────────────────────────────

  /**
   * Deduplicate shorts by content hash (the master dedup key).
   * When two shorts have the same content hash, keep the one with
   * higher engagement and merge protocol URLs.
   */
  deduplicateByContentHash(shorts: ShortVideo[]): ShortVideo[] {
    const seen = new Map<string, ShortVideo>();

    for (const short of shorts) {
      const existing = seen.get(short.contentHash);
      if (!existing) {
        seen.set(short.contentHash, short);
        continue;
      }

      // Merge protocol URLs from both
      const mergedProtocols = {
        ...existing.protocols,
        ...short.protocols,
      } as Partial<Record<ShortProtocol, string>>;

      // Merge engagement metrics (sum likes, views, tips)
      const mergedEngagement = {
        likes: Math.max(existing.engagement.likes, short.engagement.likes),
        views: Math.max(existing.engagement.views, short.engagement.views),
        tips: existing.engagement.tips + short.engagement.tips,
      };

      // Keep the one with higher total engagement
      const existingScore = existing.engagement.likes + existing.engagement.views;
      const newScore = short.engagement.likes + short.engagement.views;

      if (newScore > existingScore) {
        seen.set(short.contentHash, {
          ...short,
          protocols: mergedProtocols,
          engagement: mergedEngagement,
        });
      } else {
        seen.set(short.contentHash, {
          ...existing,
          protocols: mergedProtocols,
          engagement: mergedEngagement,
        });
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Rank shorts by sort mode.
   */
  rank(shorts: ShortVideo[], sort: UnifiedFeedOptions['sort']): ShortVideo[] {
    const sorted = [...shorts];

    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => b.publishedAt - a.publishedAt);
        break;

      case 'trending':
        sorted.sort((a, b) => {
          const aScore = this.computeTrendingScore(a);
          const bScore = this.computeTrendingScore(b);
          return bScore - aScore;
        });
        break;

      case 'for-you':
        // Weighted: 60% engagement, 30% freshness, 10% source diversity
        sorted.sort((a, b) => {
          const aScore =
            this.computeTrendingScore(a) * 0.6 +
            this.computeFreshness(a) * 0.3 +
            this.computeDiversityBonus(a) * 0.1;
          const bScore =
            this.computeTrendingScore(b) * 0.6 +
            this.computeFreshness(b) * 0.3 +
            this.computeDiversityBonus(b) * 0.1;
          return bScore - aScore;
        });
        break;

      default:
        sorted.sort((a, b) => b.publishedAt - a.publishedAt);
    }

    return sorted;
  }

  /**
   * Compute a trending score based on engagement velocity.
   */
  private computeTrendingScore(short: ShortVideo): number {
    const ageHours = Math.max(1, (Date.now() - short.publishedAt) / 3600000);
    const engagement =
      short.engagement.likes + short.engagement.views * 0.01 + short.engagement.tips * 0.5;
    return engagement / ageHours ** 1.2;
  }

  /**
   * Compute freshness score (0-1), decaying over 7 days.
   */
  private computeFreshness(short: ShortVideo): number {
    const ageHours = (Date.now() - short.publishedAt) / 3600000;
    return Math.max(0, 1 - ageHours / 168);
  }

  /**
   * Compute diversity bonus for less common protocols.
   * Gives a small boost to content from protocols we have less of.
   */
  private computeDiversityBonus(short: ShortVideo): number {
    // Bonus for non-mainstream sources
    const protocols = Object.keys(short.protocols);
    const rareProtocols = protocols.filter((p) =>
      ['nostr', 'lens', 'zora', 'activitypub'].includes(p),
    );
    return rareProtocols.length * 0.1;
  }

  /**
   * Map ShortVideoItem[] (from the existing shorts-provider) to ShortVideo[].
   */
  private mapShortVideoItems(items: ShortVideoItem[], source: FeedSource): ShortVideo[] {
    return items.map((item) => ({
      id: `${source}:${item.id}`,
      title: item.title,
      caption: item.description,
      videoUrl: item.videoUrl,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration,
      hashtags: item.topics,
      creator: {
        address: `${source}:${item.authorName.replace(/[^a-zA-Z0-9]/g, '_')}`,
        handle: item.authorName,
        avatar: item.authorAvatar,
      },
      publishedAt: item.publishedAt,
      protocols: { [source]: item.sourceUrl } as Partial<Record<ShortProtocol, string>>,
      engagement: { likes: item.likes, views: item.views, tips: 0 },
      contentHash: `${source}:${item.id}`,
    }));
  }

  // ── Bluesky Native Video (separate from AT Protocol firehose) ──────────

  /**
   * Fetch short-form video content from Bluesky's native video feed.
   * Uses the curated Bluesky video feed generator for best results.
   */
  async fetchBlueskyShorts(limit: number): Promise<ShortVideo[]> {
    const bskyShorts: ShortVideo[] = [];
    const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

    try {
      // Try the curated Bluesky video feed generator
      const res = await fetch(
        `${bskyUrl}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hd5jnv5a7j5l3s5j3xh/app.bsky.feed.generator/video-feed&limit=${Math.min(limit, 30)}`,
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
            (embed.$type !== 'app.bsky.embed.video' &&
              embed.$type !== 'app.bsky.embed.video#main')
          ) {
            continue;
          }

          const videoUrl =
            embed.playlist ||
            `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
          if (!videoUrl) continue;

          const hashtags = item.post.record.text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];

          bskyShorts.push({
            id: `bluesky:${item.post.cid}`,
            title: item.post.record.text.split('\n')[0]?.slice(0, 100) || 'Bluesky Video',
            caption: item.post.record.text.slice(0, 500),
            videoUrl,
            thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
            duration: 30,
            hashtags,
            creator: {
              address: `did:${item.post.author.handle}`,
              handle: item.post.author.displayName || item.post.author.handle,
              avatar: item.post.author.avatar,
            },
            publishedAt: new Date(item.post.record.createdAt).getTime(),
            protocols: {
              atproto: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            },
            engagement: {
              likes: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
              views: 0,
              tips: 0,
            },
            contentHash: `bsky:${item.post.cid}`,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return bskyShorts.slice(0, limit);
  }
}
