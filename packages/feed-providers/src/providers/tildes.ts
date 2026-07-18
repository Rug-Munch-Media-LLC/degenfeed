/**
 * TildesProvider — Tildes.net Reddit alternative (non-federated).
 *
 * Tildes is a community-driven Reddit alternative focused on quality
 * discussion. It exposes a JSON API at /api/ for group listings and
 * topic details.
 *
 * Strategy:
 *   1. Query Tildes API for group listings and recent topics
 *   2. Filter for tech/crypto topics
 *   3. Return as UnifiedPost
 */

import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

const TILDES_BASE = 'https://tildes.net';

interface TildesTopic {
  id: number;
  title: string;
  group: string;
  author: string;
  time: string; // ISO 8601
  num_comments: number;
  tags: string[];
  link_url?: string;
  body?: string;
}

interface TildesGroupResponse {
  metadata: {
    description: string;
    total_topics: number;
  };
  topics: TildesTopic[];
}

export const TILDES_GROUPS = [
  'comp', 'tech', 'linux', 'programming', 'security', 'science', 'crypto', 'privacy',
];

function adaptTildesTopic(topic: TildesTopic, groupName: string): UnifiedPost {
  const nativeId = `tildes:${groupName}:${topic.id}`;
  const text = topic.title + (topic.body ? '\n\n' + topic.body : '');

  const author: UnifiedIdentity = {
    id: `tildes:${topic.author}`,
    primary: { protocol: 'tildes' as Protocol, id: topic.author },
    handles: { tildes: topic.author },
    displayName: topic.author,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  return {
    id: nativeId,
    protocol: 'tildes' as Protocol,
    author,
    text: text.slice(0, 1500),
    embeds: topic.link_url ? [{ kind: 'link' as const, url: topic.link_url }] : [],
    createdAt: new Date(topic.time).getTime(),
    metrics: { likes: 0, reposts: 0, replies: topic.num_comments, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: topic.num_comments, quotes: 0 },
    },
    community: {
      name: `~${groupName}`,
      title: `~${groupName}`,
      instance: 'tildes.net',
      niche: 'tech',
    },
    niches: detectNiches(text),
    raw: topic,
    url: `${TILDES_BASE}/~${groupName}/${topic.id}`,
    dfUri: `df://tildes/~${groupName}/${topic.id}`,
  } as UnifiedPost;
}

export class TildesProvider implements FeedProvider {
  readonly protocol: Protocol = 'tildes' as Protocol;
  private readonly groups: string[];

  constructor(groups?: string[]) {
    this.groups = groups ?? TILDES_GROUPS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allPosts: UnifiedPost[] = [];

    const results = await Promise.allSettled(
      this.groups.map(async (group) => {
        try {
          const url = `${TILDES_BASE}/api/groups/${encodeURIComponent(group)}`;
          const data = await withTimeout(
            fetchJson<TildesGroupResponse>(url, {
              headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
            }),
            Math.min(timeoutMs, 5000),
            `tildes:${group}`,
          );
          return (data.topics ?? []).map((topic) => adaptTildesTopic(topic, group));
        } catch {
          return [] as UnifiedPost[];
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    if (allPosts.length === 0) {
      return { posts: [], notice: 'Tildes unavailable' };
    }
    return { posts: allPosts };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(`${TILDES_BASE}/api/groups/comp`, {
          headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'tildes:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
