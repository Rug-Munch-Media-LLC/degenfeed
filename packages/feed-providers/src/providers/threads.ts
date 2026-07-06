import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  fetchText,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const THREADS_PUBLIC_URL = 'https://public.threads.net';
export const THREADS_WEB_URL = 'https://www.threads.net';

export const CURATED_THREADS_HANDLES = [
  'threads',
  'mosseri',
  'zuck',
  'meta',
  'instagram',
  'mkobach',
  'alexandermuessig',
  'crypto',
  'ethereum',
  'solana',
];

interface ThreadsAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface ThreadsPostView {
  uri: string;
  cid: string;
  author: ThreadsAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      external?: { uri: string };
      images?: { image: { ref: string }; alt: string }[];
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

function authorToIdentity(author: ThreadsAuthor): UnifiedIdentity {
  return {
    id: `threads:${author.did}`,
    primary: { protocol: 'threads', id: author.did },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: author.handle,
      rss: null,
      mastodon: null,
    },
    displayName: author.displayName || author.handle,
    bio: '',
    avatarUrl: author.avatar || '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { threadsDid: author.did },
  };
}

function postToUnifiedPost(post: ThreadsPostView): UnifiedPost {
  const embeds: { kind: 'image' | 'link'; url: string; meta?: Record<string, unknown> }[] = [];
  if (post.record.embed?.external) {
    embeds.push({ kind: 'link', url: post.record.embed.external.uri });
  }
  if (post.record.embed?.images) {
    for (const img of post.record.embed.images) {
      embeds.push({ kind: 'image', url: `https://threads.net${img.image.ref}` });
    }
  }

  return buildUnifiedPost({
    protocol: 'threads',
    nativeId: post.uri,
    author: authorToIdentity(post.author),
    text: post.record.text,
    parentNativeId: post.record.reply?.parent.uri,
    rootNativeId: post.record.reply?.root.uri,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: 0,
    },
    viewer: { liked: false, reposted: false },
    raw: post,
    embeds,
  });
}

async function resolveHandle(baseUrl: string, handle: string): Promise<string | null> {
  try {
    const normalized = handle.replace(/^@/, '').replace(/\.threads\.net$/, '');
    const url = buildUrl(baseUrl, '/xrpc/com.atproto.identity.resolveHandle', {
      handle: `${normalized}.threads.net`,
    });
    const data = await fetchJson<{ did?: string }>(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
    });
    return data.did ?? null;
  } catch {
    return null;
  }
}

async function fetchAuthorFeed(
  baseUrl: string,
  actor: string,
  limit: number,
): Promise<ThreadsPostView[]> {
  const url = buildUrl(baseUrl, '/xrpc/app.bsky.feed.getAuthorFeed', {
    actor,
    limit: String(Math.min(limit, 100)),
  });
  const data = await fetchJson<{ feed?: { post: ThreadsPostView }[] }>(url, {
    headers: { 'user-agent': DEFAULT_USER_AGENT },
  });
  return (data.feed ?? []).map((f) => f.post);
}

async function scrapeThreadsProfile(handle: string): Promise<UnifiedPost[]> {
  try {
    const normalized = handle.replace(/^@/, '');
    const html = await fetchText(`${THREADS_WEB_URL}/@${normalized}`, {
      headers: { 'user-agent': DEFAULT_USER_AGENT },
    });
    const posts: UnifiedPost[] = [];
    const scriptRe =
      /\u003cscript[^\u003e]*type="application\/ld\+json"[^\u003e]*\u003e([\s\S]*?)\u003c\/script\u003e/gi;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
    while ((match = scriptRe.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1] ?? '{}') as Record<string, unknown>;
        if (json['@type'] === 'SocialMediaPosting' && typeof json.articleBody === 'string') {
          const author = (json.author as Record<string, string>) ?? {};
          const text = json.articleBody;
          const url = json.url as string;
          posts.push(
            buildUnifiedPost({
              protocol: 'threads',
              nativeId: url ?? `threads:scraped:${Date.now()}:${posts.length}`,
              author: {
                id: `threads:${author.identifier ?? normalized}`,
                primary: { protocol: 'threads', id: author.identifier ?? normalized },
                handles: {
                  nostr: null,
                  farcaster: null,
                  lens: null,
                  bluesky: null,
                  threads: normalized,
                  rss: null,
                  mastodon: null,
                },
                displayName: author.name ?? normalized,
                bio: '',
                avatarUrl: author.image ?? '',
                verified: [],
                followerCount: 0,
                followingCount: 0,
                links: [],
                keys: {},
              },
              text,
              createdAt: json.datePublished
                ? new Date(json.datePublished as string).getTime()
                : Date.now(),
              raw: json,
            }),
          );
        }
      } catch {
        // ignore malformed JSON
      }
    }
    return posts;
  } catch {
    return [];
  }
}

export interface ThreadsProviderOptions {
  pdsUrl?: string;
  curatedHandles?: string[];
}

export class ThreadsProvider implements FeedProvider {
  readonly protocol: Protocol = 'threads';
  private readonly pdsUrl: string;
  private readonly curatedHandles: string[];

  constructor(options: ThreadsProviderOptions = {}) {
    this.pdsUrl = options.pdsUrl || THREADS_PUBLIC_URL;
    this.curatedHandles = options.curatedHandles ?? CURATED_THREADS_HANDLES;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 25;

    try {
      const posts: ThreadsPostView[] = [];
      await withConcurrencyLimit(
        this.curatedHandles.slice(0, 8),
        opts.concurrency ?? 4,
        async (handle) => {
          const did = await resolveHandle(this.pdsUrl, handle);
          if (!did) return;
          const feed = await withTimeout(
            fetchAuthorFeed(
              this.pdsUrl,
              did,
              Math.max(2, Math.ceil(limit / this.curatedHandles.length)),
            ),
            timeoutMs,
            `threads:${handle}`,
          );
          posts.push(...feed);
        },
      );

      if (posts.length > 0) {
        return { posts: posts.map((p) => enrichPostNiches(postToUnifiedPost(p))) };
      }
    } catch {
      /* fall through to scrape */
    }

    const scraped: UnifiedPost[] = [];
    for (const handle of this.curatedHandles.slice(0, 3)) {
      const posts = await scrapeThreadsProfile(handle);
      scraped.push(...posts);
    }

    if (scraped.length > 0) {
      return { posts: scraped.map(enrichPostNiches) };
    }

    return { posts: [], notice: 'Threads feed unavailable' };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(
          buildUrl(this.pdsUrl, '/xrpc/com.atproto.identity.resolveHandle', {
            handle: 'threads.threads.net',
          }),
        ),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'threads:health',
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
