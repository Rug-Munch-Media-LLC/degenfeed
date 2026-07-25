/**
 * @degenfeed/api-worker — PeerTube Multi-Instance Live Source
 *
 * Aggregates live streams from multiple PeerTube instances across the fediverse.
 * Each instance is polled independently — one failure never blocks others.
 *
 * Instances:
 *   - video.degenfeed.xyz (self-hosted, primary)
 *   - tube.cryptoschizo.club (crypto-adjacent)
 *   - video.ploud.fr (general)
 *   - diode.zone (tech/creative)
 *   - Any additional federated instances from env
 *
 * Features:
 *   - Multi-instance parallel fetching
 *   - Live status detection via PeerTube REST API
 *   - Viewer + total views tracking
 *   - Channel info with avatar
 *   - Category ID → label mapping
 *   - Independent error handling per instance
 */

import type { Env } from '../../index';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';

// ─── PeerTube API Types ─────────────────────────────────────────────────

interface PeerTubeVideo {
  id: number;
  uuid: string;
  name: string;
  isLive: boolean;
  views: number;
  viewers?: number;
  publishedAt: string;
  thumbnailPath?: string;
  embedPath: string;
  channel: {
    id: number;
    name: string;
    displayName: string;
    avatar?: { path: string };
  };
  category?: { id: number; label: string };
  tags?: string[];
  description?: string;
}

interface PeerTubeApiResponse {
  total: number;
  data: PeerTubeVideo[];
}

// ─── Instance Configuration ─────────────────────────────────────────────

interface PeerTubeInstance {
  url: string;
  label: string;
  enabled: boolean;
  category: string; // default category for this instance
  tags: string[];
}

const DEFAULT_INSTANCES: PeerTubeInstance[] = [
  {
    url: 'https://video.degenfeed.xyz',
    label: 'DegenFeed Video',
    enabled: true,
    category: 'crypto',
    tags: ['peertube', 'degenfeed', 'crypto'],
  },
  {
    url: 'https://tube.cryptoschizo.club',
    label: 'CryptoSchizo Tube',
    enabled: true,
    category: 'crypto',
    tags: ['peertube', 'crypto', 'web3'],
  },
  {
    url: 'https://video.ploud.fr',
    label: 'Ploud Video',
    enabled: true,
    category: 'tech',
    tags: ['peertube', 'tech', 'foss'],
  },
  {
    url: 'https://diode.zone',
    label: 'Diode Zone',
    enabled: true,
    category: 'tech',
    tags: ['peertube', 'tech', 'creative'],
  },
  {
    url: 'https://peertube.tv',
    label: 'PeerTube.tv',
    enabled: true,
    category: 'general',
    tags: ['peertube', 'general'],
  },
  {
    url: 'https://videos.lukesmith.xyz',
    label: 'Luke Smith Videos',
    enabled: true,
    category: 'tech',
    tags: ['peertube', 'tech', 'linux'],
  },
  {
    url: 'https://tilvids.com',
    label: 'TILvids',
    enabled: true,
    category: 'education',
    tags: ['peertube', 'education', 'edutainment'],
  },
  {
    url: 'https://peatube.net',
    label: 'PeaTube',
    enabled: true,
    category: 'general',
    tags: ['peertube', 'general'],
  },
  {
    url: 'https://spectra.video',
    label: 'Spectra Video',
    enabled: true,
    category: 'general',
    tags: ['peertube', 'general', 'foss'],
  },
  {
    url: 'https://videos.dv4x.com',
    label: 'DV4X Video',
    enabled: true,
    category: 'tech',
    tags: ['peertube', 'tech', 'dev'],
  },
];

// ─── Source Health Tracking ─────────────────────────────────────────────

async function trackPeerTubeHealth(
  env: Env,
  instanceUrl: string,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {
  try {
    const key = 'live:source-health';
    const raw = await env.CACHE?.get(key);
    const health: Record<string, {
      source: LiveSource;
      healthy: boolean;
      lastChecked: number;
      error?: string;
      streamCount: number;
      latencyMs: number;
    }> = raw ? JSON.parse(raw) : {};
    const instanceLabel = `peertube:${instanceUrl.replace(/https?:\/\//, '')}`;

    health[instanceLabel] = {
      source: 'peertube',
      healthy: !error,
      lastChecked: Date.now(),
      error,
      streamCount,
      latencyMs,
    };

    await env.CACHE?.put(key, JSON.stringify(health), { expirationTtl: 300 });
  } catch {
    // Non-critical
  }
}

// ─── Category Overrides by Instance ─────────────────────────────────────

function getInstanceCategory(instance: PeerTubeInstance, apiCategory?: { id: number; label: string }): string {
  if (apiCategory?.label) {
    const normalized = apiCategory.label.toLowerCase();
    if (normalized.includes('gaming') || normalized.includes('game')) return 'gaming';
    if (normalized.includes('music')) return 'music';
    if (normalized.includes('art') || normalized.includes('creative')) return 'art';
    if (normalized.includes('tech') || normalized.includes('science') || normalized.includes('code')) return 'tech';
    if (normalized.includes('crypto') || normalized.includes('blockchain') || normalized.includes('web3')) return 'crypto';
    if (normalized.includes('education') || normalized.includes('tutorial') || normalized.includes('howto')) return 'education';
    if (normalized.includes('talk') || normalized.includes('podcast') || normalized.includes('interview')) return 'talk';
    if (normalized.includes('sport') || normalized.includes('fitness')) return 'sports';
    if (normalized.includes('irl') || normalized.includes('lifestyle')) return 'irl';
    if (normalized.includes('trading') || normalized.includes('finance') || normalized.includes('invest')) return 'trading';
  }
  return instance.category;
}

// ─── Fetch Single Instance ──────────────────────────────────────────────

/**
 * Fetch live streams from a single PeerTube instance.
 */
async function fetchPeerTubeInstance(
  instance: PeerTubeInstance,
  env: Env,
): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const params = new URLSearchParams({
      isLive: 'true',
      sort: '-publishedAt',
      count: '30',
    });

    const response = await fetch(
      `${instance.url}/api/v1/videos?${params.toString()}`,
      {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      throw new Error(`PeerTube ${instance.url} returned ${response.status}`);
    }

    const result = (await response.json()) as PeerTubeApiResponse;

    for (const video of result.data) {
      if (!video.isLive) continue;

      const streamerAvatar = video.channel.avatar?.path
        ? `${instance.url}${video.channel.avatar.path}`
        : undefined;

      const category = getInstanceCategory(instance, video.category);
      const videoTags = video.tags ?? [];

      streams.push({
        id: `peertube:${video.uuid}`,
        source: 'peertube',
        title: video.name,
        streamer: {
          id: `peertube:channel:${video.channel.id}`,
          handle: video.channel.name,
          displayName: video.channel.displayName,
          avatarUrl: streamerAvatar,
        },
        thumbnailUrl: video.thumbnailPath ? `${instance.url}${video.thumbnailPath}` : '',
        viewerCount: video.viewers ?? video.views ?? 0,
        startedAt: new Date(video.publishedAt).getTime(),
        category,
        tags: [...instance.tags, ...videoTags, category],
        isLive: true,
        embedUrl: `${instance.url}${video.embedPath}`,
        chatEnabled: true,
        platformMeta: {
          peertubeId: video.id,
          uuid: video.uuid,
          instanceUrl: instance.url,
          categoryId: video.category?.id,
          categoryLabel: video.category?.label,
        },
      });
    }

    await trackPeerTubeHealth(env, instance.url, streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[peertube-source] Instance ${instance.url} failed:`, error);
    await trackPeerTubeHealth(env, instance.url, streams.length, Date.now() - startTime, error);
  }

  return streams;
}

// ─── Main Fetcher ───────────────────────────────────────────────────────

/**
 * Fetch live PeerTube streams from all configured instances.
 * Each instance is fetched independently — one failure never blocks others.
 * Primary instance (video.degenfeed.xyz) uses full 50 count; others use 20.
 */
export async function fetchAllPeerTubeStreams(
  env: Env,
): Promise<UnifiedLiveStream[]> {
  const startTime = Date.now();

  // Build instance list: env overrides + defaults
  const instances = [...DEFAULT_INSTANCES];

  // Allow additional instances from env
  const extraInstances = env.PEERTUBE_EXTRA_INSTANCES;
  if (extraInstances) {
    const extras = extraInstances.split(',').map((s) => s.trim()).filter(Boolean);
    for (const extra of extras) {
      // Avoid duplicates
      if (!instances.find((i) => i.url === extra)) {
        instances.push({
          url: extra,
          label: new URL(extra).hostname,
          enabled: true,
          category: 'general',
          tags: ['peertube', 'fediverse'],
        });
      }
    }
  }

  // Fetch all instances in parallel
  const results = await Promise.allSettled(
    instances.map((instance) => fetchPeerTubeInstance(instance, env)),
  );

  const allStreams: UnifiedLiveStream[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allStreams.push(...result.value);
    }
  }

  // Sort by viewer count descending
  allStreams.sort((a, b) => b.viewerCount - a.viewerCount);

  return allStreams;
}

/**
 * Get total live count across all PeerTube instances.
 * Useful for the "Live" badge counter.
 */
export async function getPeerTubeLiveCount(env: Env): Promise<number> {
  try {
    const streams = await fetchAllPeerTubeStreams(env);
    return streams.length;
  } catch {
    return 0;
  }
}

/**
 * Get instance health summary for monitoring.
 */
export async function getPeerTubeInstanceHealth(
  env: Env,
): Promise<Array<{ url: string; label: string; healthy: boolean; streamCount: number; error?: string }>> {
  const instances = [...DEFAULT_INSTANCES];
  const health: Array<{ url: string; label: string; healthy: boolean; streamCount: number; error?: string }> = [];

  try {
    const key = 'live:source-health';
    const raw = await env.CACHE?.get(key);
    const storedHealth: Record<string, {
      source: string;
      healthy: boolean;
      error?: string;
      streamCount: number;
    }> = raw ? JSON.parse(raw) : {};

    for (const instance of instances) {
      const instanceLabel = `peertube:${instance.url.replace(/https?:\/\//, '')}`;
      const h = storedHealth[instanceLabel];
      health.push({
        url: instance.url,
        label: instance.label,
        healthy: h?.healthy ?? false,
        streamCount: h?.streamCount ?? 0,
        error: h?.error,
      });
    }
  } catch {
    for (const instance of instances) {
      health.push({ url: instance.url, label: instance.label, healthy: false, streamCount: 0 });
    }
  }

  return health;
}
