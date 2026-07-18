/**
 * @degenfeed/source-discovery — PeerTube channel discovery engine.
 *
 * Searches SepiaSearch (federated PeerTube search) and our own instance
 * for crypto/tech channels, scores by video count and view metrics.
 */

import type { DiscoveredSource } from './types';
import { CRYPTO_KEYWORDS, DEFAULT_DISCOVERY_CONFIG, SEARCH_KEYWORDS } from './types';
import { computeQualityScore, estimateRelevance } from './quality';

const REQUEST_TIMEOUT_MS = 5000;

const OWN_INSTANCE = 'https://video.degenfeed.xyz';
const SEPIA_SEARCH_URL = 'https://sepiasearch.org/api/v1/search/videos';

interface SepiaVideo {
  uuid: string;
  name: string;
  channel?: { displayName?: string; name?: string; id?: number };
  account?: { displayName?: string; name?: string; avatar?: { path?: string } };
  duration?: number;
  views?: number;
  likes?: number;
  publishedAt?: string;
  originInstanceUrl?: string;
}

interface SepiaSearchResponse {
  data?: SepiaVideo[];
  total?: number;
}

interface PeerTubeChannel {
  id: number;
  displayName: string;
  name: string;
  description: string;
  avatar?: { path?: string };
  videosCount?: number;
  followersCount?: number;
  viewsCount?: number;
  createdAt: string;
}

/**
 * Search SepiaSearch for videos matching a keyword, then extract channels.
 */
async function searchSepiaVideos(keyword: string): Promise<Map<string, SepiaVideo[]>> {
  const channelMap = new Map<string, SepiaVideo[]>();

  try {
    const url = `${SEPIA_SEARCH_URL}?search=${encodeURIComponent(keyword)}&count=20&sort=-views`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return channelMap;

    const body = (await res.json()) as SepiaSearchResponse;
    for (const video of body.data ?? []) {
      const channelName = video.channel?.displayName ?? video.account?.displayName ?? 'unknown';
      const existing = channelMap.get(channelName) ?? [];
      existing.push(video);
      channelMap.set(channelName, existing);
    }
  } catch {
    // SepiaSearch unavailable
  }

  return channelMap;
}

/**
 * Get channel details from our own PeerTube instance.
 */
async function getOwnInstanceChannels(): Promise<PeerTubeChannel[]> {
  try {
    const url = `${OWN_INSTANCE}/api/v1/video-channels?count=50&sort=-followersCount`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const body = (await res.json()) as { data?: PeerTubeChannel[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Discover new PeerTube crypto channels across the fediverse.
 */
export async function discoverPeerTubeChannels(
  existingChannels: string[] = [],
): Promise<DiscoveredSource[]> {
  const seen = new Set<string>();
  const sources: DiscoveredSource[] = [];
  const existingLower = new Set(existingChannels.map((c) => c.toLowerCase()));

  // Phase 1: Search SepiaSearch for crypto-related channels
  for (const keyword of SEARCH_KEYWORDS) {
    const channelMap = await searchSepiaVideos(keyword);

    for (const [channelName, videos] of channelMap) {
      const nameLower = channelName.toLowerCase();
      if (seen.has(nameLower) || existingLower.has(nameLower)) continue;
      seen.add(nameLower);

      const totalViews = videos.reduce((sum, v) => sum + (v.views ?? 0), 0);
      const relevanceScore = estimateRelevance(channelName);

      const subscriberCount = Math.max(100, Math.round(totalViews / videos.length / 10));
      const weeklyActivity = Math.max(1, Math.round(videos.length / 4));

      const latestVideo = videos.reduce(
        (latest, v) => {
          const ts = v.publishedAt ? new Date(v.publishedAt).getTime() : 0;
          return ts > (latest.ts ?? 0) ? { ts, video: v } : latest;
        },
        { ts: 0, video: null as SepiaVideo | null },
      );

      const candidate = {
        id: `peertube:${encodeURIComponent(channelName)}`,
        platform: 'peertube' as const,
        name: channelName,
        url: `https://sepiasearch.org/search?search=${encodeURIComponent(channelName)}`,
        description: `PeerTube channel with ${videos.length} videos found`,
        subscriberCount,
        weeklyActivity,
        sourceCreatedAt: latestVideo.video?.publishedAt
          ? new Date(latestVideo.video.publishedAt).getTime()
          : undefined,
        relevanceScore,
        metadata: { keyword, videoCount: videos.length, totalViews, source: 'sepiasearch' },
      };

      const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

      sources.push({
        ...candidate,
        score,
        autoApproved: passed,
        status: passed ? 'approved' : 'pending',
        discoveredAt: Date.now(),
      });
    }
  }

  // Phase 2: Browse own instance for new channels
  const ownChannels = await getOwnInstanceChannels();
  for (const channel of ownChannels) {
    const nameLower = channel.displayName.toLowerCase();
    if (seen.has(nameLower) || existingLower.has(nameLower)) continue;
    seen.add(nameLower);

    const hasCryptoRelevance = CRYPTO_KEYWORDS.some(
      (kw) => channel.displayName.toLowerCase().includes(kw) ||
        channel.description.toLowerCase().includes(kw),
    );
    if (!hasCryptoRelevance) continue;

    const relevanceScore = estimateRelevance(channel.displayName, channel.description);

    const candidate = {
      id: `peertube:own:${channel.name}`,
      platform: 'peertube' as const,
      name: channel.displayName,
      url: `${OWN_INSTANCE}/video-channels/${channel.name}`,
      iconUrl: channel.avatar?.path ? `${OWN_INSTANCE}${channel.avatar.path}` : undefined,
      description: channel.description?.slice(0, 300),
      subscriberCount: channel.followersCount ?? 0,
      weeklyActivity: Math.max(1, Math.round((channel.videosCount ?? 0) / 52)),
      sourceCreatedAt: new Date(channel.createdAt).getTime(),
      relevanceScore,
      metadata: { instance: OWN_INSTANCE, channelId: channel.id, source: 'own-instance' },
    };

    const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

    sources.push({
      ...candidate,
      score,
      autoApproved: passed,
      status: passed ? 'approved' : 'pending',
      discoveredAt: Date.now(),
    });
  }

  return sources.sort((a, b) => b.score - a.score);
}
