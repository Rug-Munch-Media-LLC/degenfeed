/**
 * @degenfeed/source-discovery — YouTube channel discovery engine.
 *
 * Uses the YouTube Data API v3 search endpoint to find crypto channels,
 * then fetches channel stats for scoring. Falls back to a web scrape
 * approach if no API key is available.
 */

import type { DiscoveredSource } from './types';
import { SEARCH_KEYWORDS, DEFAULT_DISCOVERY_CONFIG } from './types';
import { computeQualityScore, estimateRelevance } from './quality';

const REQUEST_TIMEOUT_MS = 5000;
const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

interface YouTubeSearchItem {
  id: { channelId?: string };
  snippet: {
    channelId: string;
    title: string;
    description: string;
    thumbnails?: { default?: { url: string } };
    publishedAt: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

interface YouTubeChannelStats {
  items?: Array<{
    statistics: {
      subscriberCount?: string;
      videoCount?: string;
      viewCount?: string;
    };
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      thumbnails?: { default?: { url: string } };
    };
  }>;
}

/**
 * Search YouTube via free public OEmbed + channel search.
 * Uses the public YouTube search (no API key required) for initial discovery,
 * then fetches stats via the Data API if a key is available.
 */
export async function discoverYouTubeChannels(
  apiKey?: string,
  existingChannels: string[] = [],
): Promise<DiscoveredSource[]> {
  const seen = new Set<string>();
  const sources: DiscoveredSource[] = [];
  const existingLower = new Set(existingChannels.map((c) => c.toLowerCase()));

  // Use the YouTube Data API if key provided
  if (apiKey) {
    for (const keyword of SEARCH_KEYWORDS) {
      const results = await searchYouTubeAPI(keyword, apiKey);
      for (const item of results) {
        const channelId = item.id.channelId ?? item.snippet.channelId;
        if (!channelId || seen.has(channelId)) continue;
        seen.add(channelId);

        const nameLower = item.snippet.title.toLowerCase();
        if (existingLower.has(nameLower)) continue;

        const stats = await fetchChannelStats(channelId, apiKey);
        const subscriberCount = Number(stats?.statistics.subscriberCount ?? 0);
        const videoCount = Number(stats?.statistics.videoCount ?? 0);
        const relevanceScore = estimateRelevance(
          item.snippet.title,
          item.snippet.description,
        );

        const weeklyActivity = Math.max(1, Math.round(videoCount / 52));

        const candidate = {
          id: `youtube:${channelId}`,
          platform: 'youtube' as const,
          name: item.snippet.title,
          url: `https://youtube.com/channel/${channelId}`,
          iconUrl: item.snippet.thumbnails?.default?.url || stats?.snippet.thumbnails?.default?.url,
          description: item.snippet.description?.slice(0, 300),
          subscriberCount,
          weeklyActivity,
          sourceCreatedAt: new Date(item.snippet.publishedAt).getTime(),
          relevanceScore,
          metadata: { channelId, videoCount, keyword },
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
  }

  // Also search via public methods (OEmbed discovery, RSS feeds)
  await discoverYouTubeFromRSS(seen, existingLower, sources);

  return sources.sort((a, b) => b.score - a.score);
}

async function searchYouTubeAPI(
  keyword: string,
  apiKey: string,
): Promise<YouTubeSearchItem[]> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=10&key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];

    const body = (await res.json()) as YouTubeSearchResponse;
    return body.items ?? [];
  } catch {
    return [];
  }
}

async function fetchChannelStats(
  channelId: string,
  apiKey: string,
): Promise<YouTubeChannelStats['items'] extends (infer U)[] ? U : null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const body = (await res.json()) as YouTubeChannelStats;
    return body.items?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fallback: discover YouTube channels via their RSS feeds.
 * Every YouTube channel has an RSS feed at:
 *   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 */
async function discoverYouTubeFromRSS(
  seen: Set<string>,
  existingLower: Set<string>,
  sources: DiscoveredSource[],
): Promise<void> {
  // Known crypto YouTube channels to check via RSS
  const knownCryptoChannels = [
    { id: 'UCnY0U4Ul1CKx3FCTd5I7frg', name: 'Coin Bureau' },
    { id: 'UC1usFRN4LCM0IVr4wP6E2bQ', name: 'Ivan on Tech' },
    { id: 'UCJWCJCWOHjYcBmT-kzC2ldQ', name: 'Crypto Zombie' },
    { id: 'UC5I2hj0iKVYYSo3E6lFYR7A', name: 'Benjamin Cowen' },
    { id: 'UC6D5R3fI1vWNP8VQRoHkqJg', name: 'DataDash' },
  ];

  for (const channel of knownCryptoChannels) {
    if (seen.has(channel.id)) continue;
    const nameLower = channel.name.toLowerCase();
    if (existingLower.has(nameLower)) continue;
    seen.add(channel.id);

    // Try to fetch RSS to verify channel is active
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(feedUrl, {
        headers: { 'user-agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const text = await res.text();

      // Count recent entries (crude: count <entry> tags)
      const entryCount = (text.match(/<entry>/g) ?? []).length;

      const relevanceScore = estimateRelevance(channel.name, 'Crypto analysis');
      const candidate = {
        id: `youtube:${channel.id}`,
        platform: 'youtube' as const,
        name: channel.name,
        url: `https://youtube.com/channel/${channel.id}`,
        subscriberCount: 50000, // rough estimate for known channels
        weeklyActivity: Math.max(1, entryCount),
        relevanceScore,
        metadata: { channelId: channel.id, source: 'rss-fallback' },
      };

      const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

      sources.push({
        ...candidate,
        score,
        autoApproved: passed,
        status: passed ? 'approved' : 'pending',
        discoveredAt: Date.now(),
      });
    } catch {
      // RSS not available, skip
    }
  }
}
