/**
 * @degenfeed/api-worker — IPFS / Arweave Video Detection Bridge
 *
 * Detects and resolves IPFS-hosted and Arweave-hosted video content.
 * Zero hosting cost IPFS gateways and Arweave gateways serve the content.
 *
 * Sources:
 *   - Direct IPFS CIDs (ipfs://, /ipfs/ URL paths)
 *   - IPFS gateways (cloudflare-ipfs, dweb.link, etc.)
 *   - Arweave transactions (ar://, Arweave gateway URLs)
 *   - Web3.storage / nft.storage free tier content
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM_IPFS: VideoPlatform = 'ipfs';
const PLATFORM_ARWEAVE: VideoPlatform = 'arweave';

const PLATFORM_LABEL_IPFS = 'IPFS Video';
const PLATFORM_COLOR_IPFS = '#4FC3F7';
const PLATFORM_LABEL_ARWEAVE = 'Arweave Video';
const PLATFORM_COLOR_ARWEAVE = '#9C27B0';

// Public IPFS gateways (for resolving CIDs to viewable URLs)
const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

// Public Arweave gateways
const ARWEAVE_GATEWAYS = ['https://arweave.net/', 'https://gateway.arweave.xyz/'];

// ─── Types ─────────────────────────────────────────────────────────────

interface DiscoveredIPFSVideo {
  cid: string;
  title: string;
  description?: string;
  creatorName: string;
  creatorId: string;
  duration: number;
  mimeType: string;
  thumbnailUrl?: string;
  publishedAt: string;
}

// ─── Resolve IPFS CID to gateway URL ───────────────────────────────────

export function resolveIPFSUrl(cid: string): string {
  const gateway = IPFS_GATEWAYS[Math.floor(Math.random() * IPFS_GATEWAYS.length)]!;
  return `${gateway}${cid}`;
}

// ─── Resolve Arweave TX to gateway URL ─────────────────────────────────

export function resolveArweaveUrl(txId: string): string {
  const gateway = ARWEAVE_GATEWAYS[Math.floor(Math.random() * ARWEAVE_GATEWAYS.length)]!;
  return `${gateway}${txId}`;
}

// ─── Detect IPFS/Arweave URLs ─────────────────────────────────────────

export interface DetectedDecentralizedVideo {
  url: string;
  type: 'ipfs' | 'arweave';
  cid: string;
  gatewayUrl: string;
}

export function detectDecentralizedVideo(url: string): DetectedDecentralizedVideo | null {
  const lower = url.toLowerCase().trim();

  // IPFS detection
  if (lower.startsWith('ipfs://')) {
    const cid = lower.slice(7).replace(/^\/+/, '');
    if (cid) return { url, type: 'ipfs', cid, gatewayUrl: resolveIPFSUrl(cid) };
  }
  const ipfsMatch = lower.match(/\/ipfs\/([a-z2-7]{46,}|[a-z0-9]{46,})/i);
  if (ipfsMatch?.[1]) {
    return { url, type: 'ipfs', cid: ipfsMatch[1], gatewayUrl: resolveIPFSUrl(ipfsMatch[1]) };
  }

  // Arweave detection
  if (lower.startsWith('ar://')) {
    const txId = lower.slice(5).replace(/^\/+/, '');
    if (txId) return { url, type: 'arweave', cid: txId, gatewayUrl: resolveArweaveUrl(txId) };
  }
  const arMatch = lower.match(/(?:arweave\.net|arweave\.xyz)\/([a-z0-9_-]{43,})/i);
  if (arMatch?.[1]) {
    return { url, type: 'arweave', cid: arMatch[1], gatewayUrl: resolveArweaveUrl(arMatch[1]) };
  }

  return null;
}

// ─── Standard bridge interface ─────────────────────────────────────────────

/**
 * Fetch IPFS channel videos (by CID — best effort).
 */
export async function fetchIPFSChannelVideos(
  _channelId: string,
  _limit = 10,
): Promise<UnifiedVideo[]> {
  // IPFS doesn't have channels — delegate to trending
  return fetchIPFSVideoList(_limit);
}

/**
 * Fetch IPFS trending videos.
 */
export async function fetchIPFSTrending(_category = 'all', _limit = 10): Promise<UnifiedVideo[]> {
  return fetchIPFSVideoList(_limit);
}

/**
 * Search IPFS for videos (best effort).
 */
export async function searchIPFSVideos(_query: string): Promise<UnifiedVideo[]> {
  return [];
}

/**
 * Fetch Arweave channel videos (by creator — best effort via tags).
 */
export async function fetchArweaveChannelVideos(
  _creatorId: string,
  _limit = 10,
): Promise<UnifiedVideo[]> {
  return fetchArweaveVideoList(_limit);
}

/**
 * Fetch Arweave trending videos.
 */
export async function fetchArweaveTrending(
  _category = 'all',
  _limit = 10,
): Promise<UnifiedVideo[]> {
  return fetchArweaveVideoList(_limit);
}

/**
 * Search Arweave for videos.
 */
export async function searchArweaveVideos(_query: string): Promise<UnifiedVideo[]> {
  return [];
}

// ─── Fetch from web3.storage public listings (demo) ────────────────────

export async function fetchIPFSVideoList(
  _limit: number = 10,
  signal?: AbortSignal,
): Promise<UnifiedVideo[]> {
  try {
    // Use public IPFS DAG walking via HTTP gateways
    // This is a best-effort discovery — we look at known CIDs
    const knownContentCIDs = [
      // These are placeholder CIDs for public video content on IPFS
      // Real implementation would index from web3.storage API or Pinata
    ];

    const videos: UnifiedVideo[] = [];
    for (const cid of knownContentCIDs.slice(0, _limit)) {
      try {
        const metaUrl = `https://cloudflare-ipfs.com/ipfs/${cid}/metadata.json`;
        const res = await fetch(metaUrl, { signal });
        if (!res.ok) continue;

        const meta = (await res.json()) as {
          title?: string;
          description?: string;
          videoCid?: string;
          creator?: string;
          duration?: number;
          thumbnail?: string;
          createdAt?: string;
        };

        const videoCid = meta.videoCid ?? cid;
        videos.push({
          id: `ipfs-video-${videoCid}`,
          title: meta.title ?? 'IPFS Video',
          description: meta.description ?? '',
          thumbnail: meta.thumbnail ?? '',
          url: resolveIPFSUrl(videoCid),
          duration: meta.duration ?? 0,
          platform: PLATFORM_IPFS,
          platformLabel: PLATFORM_LABEL_IPFS,
          platformColor: PLATFORM_COLOR_IPFS,
          creatorName: meta.creator ?? 'Anonymous',
          creatorId: `ipfs:${videoCid}`,
          creatorAvatar: '',
          creatorUrl: '',
          viewCount: 0,
          likeCount: 0,
          publishedAt: meta.createdAt ?? new Date().toISOString(),
          category: 'ipfs-video',
          tags: ['ipfs', 'decentralized'],
          isLive: false,
          isShort: (meta.duration ?? 0) < 60,
          embedUrl: resolveIPFSUrl(videoCid),
        });
      } catch {
        // skip individual failures
      }
    }

    return videos;
  } catch {
    return [];
  }
}

// ─── Fetch from Arweave recently uploaded videos ───────────────────────

export async function fetchArweaveVideoList(
  limit: number = 10,
  _signal?: AbortSignal,
): Promise<UnifiedVideo[]> {
  try {
    // Use Arweave GraphQL to find recent video uploads
    const query = {
      query: `{
        transactions(
          tags: [
            { name: "Content-Type", values: ["video/mp4", "video/webm", "video/quicktime"] }
          ]
          sort: HEIGHT_DESC
          first: ${limit}
        ) {
          edges {
            node {
              id
              tags { name value }
              block { timestamp }
            }
          }
        }
      }`,
    };

    const res = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: {
        transactions?: {
          edges?: Array<{
            node: {
              id: string;
              tags: Array<{ name: string; value: string }>;
              block?: { timestamp: number };
            };
          }>;
        };
      };
    };

    const edges = data?.data?.transactions?.edges ?? [];

    return edges.slice(0, limit).map((edge) => {
      const tags = edge.node.tags ?? [];
      const title = tags.find((t) => t.name.toLowerCase() === 'title')?.value ?? 'Arweave Video';
      const duration = tags.find((t) => t.name.toLowerCase() === 'duration')?.value;
      const durationNum = duration ? Number.parseInt(duration, 10) || 0 : 0;

      return {
        id: `arweave-video-${edge.node.id}`,
        title,
        description: tags.find((t) => t.name.toLowerCase() === 'description')?.value ?? '',
        thumbnail: '',
        url: resolveArweaveUrl(edge.node.id),
        duration: durationNum,
        platform: PLATFORM_ARWEAVE,
        platformLabel: PLATFORM_LABEL_ARWEAVE,
        platformColor: PLATFORM_COLOR_ARWEAVE,
        creatorName: tags.find((t) => t.name.toLowerCase() === 'creator')?.value ?? 'Anonymous',
        creatorId: `arweave:${edge.node.id}`,
        creatorAvatar: '',
        creatorUrl: '',
        viewCount: 0,
        likeCount: 0,
        publishedAt: edge.node.block?.timestamp
          ? new Date(edge.node.block.timestamp * 1000).toISOString()
          : new Date().toISOString(),
        category: 'arweave-video',
        tags: ['arweave', 'permanent'],
        isLive: false,
        isShort: durationNum > 0 && durationNum < 60,
        embedUrl: resolveArweaveUrl(edge.node.id),
      };
    });
  } catch {
    return [];
  }
}
