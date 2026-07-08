import { buildUnifiedPost, detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_GTS_INSTANCE = 'https://social.degenfeed.xyz';
export const PUBLIC_MASTODON_INSTANCES = [
  // Crypto-first instances
  'https://bitcoinhackers.org',
  'https://cryptodon.lol',
  'https://noagendasocial.com',
  // Tech/AI instances
  'https://fosstodon.org',
  'https://hachyderm.io',
  'https://ioc.exchange',
  'https://infosec.exchange',
  'https://mathstodon.xyz',
  'https://techhub.social',
  'https://mastodon.social',
  'https://mas.to',
  'https://universeodon.com',
  'https://mstdn.social',
  'https://mastodon.world',
  'https://mastodon.online',
  'https://mastodon.cloud',
  'https://mastodon.energy',
  'https://fedi.social',
  'https://ohai.social',
  'https://social.linux.pizza',
  'https://hackers.town',
  'https://layer8.space',
  'https://defcon.social',
  'https://infosec.town',
];

export const CRYPTO_HASHTAGS = [
  'bitcoin',
  'ethereum',
  'solana',
  'crypto',
  'cryptocurrency',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'altcoin',
];
export const TECH_HASHTAGS = [
  'ai',
  'machinelearning',
  'programming',
  'linux',
  'opensource',
  'rust',
  'golang',
  'python',
  'typescript',
  'privacy',
  'security',
  'infosec',
];

interface GtSAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  fields: { name: string; value: string; verified_at: string | null }[];
}

interface GtSCard {
  url: string;
  title: string;
  description: string;
  image: string | null;
}

interface GtSMediaAttachment {
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
}

interface GtSStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: GtSMediaAttachment[];
  tags: { name: string }[];
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  in_reply_to_id: string | null;
  reblog: GtSStatus | null;
  card: GtSCard | null;
  account: GtSAccount;
  favourited?: boolean;
  reblogged?: boolean;
}

function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function accountToIdentity(account: GtSAccount, instanceUrl: string): UnifiedIdentity {
  const hostname = new URL(instanceUrl).hostname;
  const handle = account.acct.includes('@') ? account.acct : `${account.acct}@${hostname}`;
  return {
    id: `mastodon:${account.id}@${hostname}`,
    primary: { protocol: 'mastodon', id: account.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: handle,
    },
    displayName: account.display_name || account.username,
    bio: stripHtml(account.note),
    avatarUrl: account.avatar,
    bannerUrl: account.header !== account.header_static ? account.header : undefined,
    verified: account.fields
      .filter((f) => f.verified_at)
      .map((f) => ({ protocol: 'mastodon' as Protocol, badge: f.name })),
    followerCount: account.followers_count,
    followingCount: account.following_count,
    links: account.fields.map((f) => ({ label: f.name, url: f.value })),
    keys: {},
  };
}

function statusToUnifiedPost(status: GtSStatus, instanceUrl: string): UnifiedPost {
  const identity = accountToIdentity(status.account, instanceUrl);
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;
  const html = original.content || '';
  const text = stripHtml(html);

  const embeds: Embed[] = [];
  for (const media of original.media_attachments) {
    if (media.type === 'image' || media.type === 'gifv')
      embeds.push({ kind: 'image', url: media.url });
    else if (media.type === 'video') embeds.push({ kind: 'video', url: media.url });
  }
  if (original.card) {
    embeds.push({
      kind: 'link',
      url: original.card.url,
      meta: {
        title: original.card.title,
        description: original.card.description,
        image: original.card.image,
      },
    });
  }

  const finalText = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${text}` : text;
  const _niches = detectNiches(`${finalText} ${original.tags.map((t) => t.name).join(' ')}`);
  const nativeId = isBoost ? `boost:${status.id}:${original.id}` : original.id;

  return buildUnifiedPost({
    protocol: 'mastodon',
    nativeId,
    author: identity,
    text: finalText,
    html,
    embeds,
    parentNativeId: original.in_reply_to_id ?? undefined,
    createdAt: new Date(original.created_at).getTime(),
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    viewer: { liked: original.favourited ?? false, reposted: original.reblogged ?? false },
    raw: status,
  });
}

async function fetchHashtagTimeline(
  instanceUrl: string,
  tag: string,
  limit: number,
): Promise<GtSStatus[]> {
  const url = buildUrl(instanceUrl, `/api/v1/timelines/tag/${encodeURIComponent(tag)}`, {
    limit: String(limit),
  });
  return fetchJson<GtSStatus[]>(url, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
}

async function fetchPublicTimeline(instanceUrl: string, limit: number): Promise<GtSStatus[]> {
  const url = buildUrl(instanceUrl, '/api/v1/timelines/public', {
    limit: String(limit),
    local: 'true',
  });
  return fetchJson<GtSStatus[]>(url, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
}

export interface MastodonProviderOptions {
  instanceUrl?: string;
  fallbackInstances?: string[];
}

export class MastodonProvider implements FeedProvider {
  readonly protocol: Protocol = 'mastodon';
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];

  constructor(options: MastodonProviderOptions = {}) {
    this.primaryUrl = options.instanceUrl || DEFAULT_GTS_INSTANCE;
    this.fallbackUrls =
      options.fallbackInstances ?? PUBLIC_MASTODON_INSTANCES.filter((u) => u !== this.primaryUrl);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 30;
    const endpoints = [this.primaryUrl, ...this.fallbackUrls];

    try {
      const allStatuses: GtSStatus[] = [];

      // 1. Primary public timeline
      try {
        const primaryPublic = await withTimeout(
          fetchPublicTimeline(this.primaryUrl, Math.ceil(limit / 2)),
          timeoutMs,
          `mastodon:public:${this.primaryUrl}`,
        );
        allStatuses.push(...primaryPublic);
      } catch {
        /* continue */
      }

      // 2. Hashtag searches across crypto+tech instances for crypto+AI topics
      const allHashes = [...CRYPTO_HASHTAGS.slice(0, 5), ...TECH_HASHTAGS.slice(0, 5)];
      const hashtagTargets = [];
      for (const instanceUrl of endpoints.slice(0, 8)) {
        for (const tag of allHashes) {
          hashtagTargets.push({ instanceUrl, tag });
        }
      }
      const tagResults = await withConcurrencyLimit(
        hashtagTargets,
        4,
        async ({ instanceUrl, tag }) => {
          try {
            return await withTimeout(
              fetchHashtagTimeline(instanceUrl, tag, 5),
              Math.min(timeoutMs, 3000),
              `mastodon:${new URL(instanceUrl).hostname}#${tag}`,
            );
          } catch {
            return [];
          }
        },
      );
      for (const r of tagResults) allStatuses.push(...r);

      // 3. Public timelines from general instances
      const generalResults = await withConcurrencyLimit(
        endpoints.slice(0, 6),
        2,
        async (instanceUrl) => {
          try {
            return await withTimeout(
              fetchPublicTimeline(instanceUrl, 5),
              Math.min(timeoutMs, 3000),
              `mastodon:${instanceUrl}`,
            );
          } catch {
            return [];
          }
        },
      );
      for (const r of generalResults) allStatuses.push(...r);

      if (allStatuses.length === 0) {
        return { posts: [], notice: 'Mastodon feed unavailable' };
      }

      const seen = new Set<string>();
      const unique = allStatuses.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // Pick a sensible instance URL for each status. When the acct is
      // fully-qualified (user@host), use that host. Otherwise the status
      // came from the primary instance.
      const instanceMap = new Map<string, string>();
      for (const u of endpoints) {
        try {
          instanceMap.set(new URL(u).hostname, u);
        } catch {
          /* ignore */
        }
      }
      const pickInstance = (acct: string): string => {
        if (acct.includes('@')) {
          const host = acct.split('@')[1];
          if (host && instanceMap.has(host)) return instanceMap.get(host) ?? this.primaryUrl;
        }
        return endpoints[0] ?? this.primaryUrl;
      };

      return {
        posts: unique.map((s) => statusToUnifiedPost(s, pickInstance(s.account.acct))),
      };
    } catch (err) {
      return {
        posts: [],
        notice: err instanceof Error ? err.message : 'Mastodon feed unavailable',
      };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(buildUrl(this.primaryUrl, '/api/v1/instance')),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'mastodon:health',
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
