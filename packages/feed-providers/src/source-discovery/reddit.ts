/**
 * @degenfeed/source-discovery — Reddit subreddit discovery engine.
 *
 * Searches Reddit for crypto/defi/web3 subreddits via the public JSON API,
 * scores them by subscriber count and activity, and returns candidates.
 */

import { computeQualityScore, estimateRelevance } from './quality';
import type { DiscoveredSource } from './types';
import { DEFAULT_DISCOVERY_CONFIG, SEARCH_KEYWORDS } from './types';

const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';
const SEARCH_LIMIT = 25;
const REQUEST_TIMEOUT_MS = 5000;

interface RedditSubreddit {
  data: {
    display_name: string;
    display_name_prefixed: string;
    title: string;
    public_description: string;
    subscribers: number;
    url: string;
    community_icon: string | null;
    icon_img: string | null;
    created_utc: number;
    active_user_count?: number;
    over18: boolean;
  };
}

interface RedditSearchResponse {
  data?: {
    children: RedditSubreddit[];
  };
}

/**
 * Search Reddit for crypto subreddits by keyword.
 */
async function searchSubreddits(keyword: string): Promise<RedditSubreddit[]> {
  try {
    const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(keyword)}&limit=${SEARCH_LIMIT}&raw_json=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const body = (await res.json()) as RedditSearchResponse;
    return body.data?.children ?? [];
  } catch {
    return [];
  }
}

/**
 * Discover new crypto subreddits.
 * Searches across keywords, filters known/existing subs, and scores candidates.
 */
export async function discoverRedditSubreddits(
  existingSubs: string[] = [],
): Promise<DiscoveredSource[]> {
  const seen = new Set<string>();
  const sources: DiscoveredSource[] = [];
  const existingLower = new Set(existingSubs.map((s) => s.toLowerCase()));

  for (const keyword of SEARCH_KEYWORDS) {
    const subs = await searchSubreddits(keyword);

    for (const sub of subs) {
      const d = sub.data;
      if (d.over18) continue;
      const nameLower = d.display_name.toLowerCase();
      if (seen.has(nameLower)) continue;
      if (existingLower.has(nameLower)) continue;
      seen.add(nameLower);

      const relevanceScore = estimateRelevance(d.title, d.public_description);
      const weeklyActivity = Math.max(1, Math.round((d.active_user_count ?? 0) / 100) + 1);

      const candidate = {
        id: `reddit:${nameLower}`,
        platform: 'reddit' as const,
        name: `r/${d.display_name}`,
        url: `https://reddit.com${d.url}`,
        iconUrl: d.community_icon || d.icon_img || undefined,
        description: d.title || d.public_description?.slice(0, 300),
        subscriberCount: d.subscribers,
        weeklyActivity,
        sourceCreatedAt: d.created_utc ? d.created_utc * 1000 : undefined,
        relevanceScore,
        metadata: {
          keyword,
          activeUsers: d.active_user_count,
        },
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

  return sources.sort((a, b) => b.score - a.score);
}
