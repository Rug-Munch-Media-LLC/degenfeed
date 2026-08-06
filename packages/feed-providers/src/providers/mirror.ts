/**
 * Mirror.xyz provider — decentralized publishing on Ethereum + Arweave.
 *
 * Mirror entries are stored on the Arweave permaweb and surfaced through
 * the mirror.xyz frontend. We query Arweave GraphQL directly for
 * MirrorXYZ transactions, then read each entry's content envelope from the
 * permaweb gateway (https://arweave.net/{txId}) — this yields real
 * titles/authors/cover images instead of placeholders.
 *
 * A self-hosted `degenfeed-mirror-bridge` (port 8240) also exists; it is
 * used as a fallback when the native Arweave path is unreachable.
 *
 * Both paths carry a circuit breaker + health check.
 */

import { CircuitBreaker, CircuitBreakerError, detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';
import { firstImage, stripArticleHtml } from './article-media';

/** Default bridge endpoint — degenfeed-mirror-bridge (port 8240). */
export const MIRROR_BRIDGE_URL = 'http://127.0.0.1:8240';
export const MIRROR_FRONT = 'https://mirror.xyz';
export const ARWEAVE_GRAPHQL = 'https://arweave.net/graphql';
export const ARWEAVE_GATEWAY = 'https://arweave.net';

/** Curated Mirror writers (best-effort RSS fallback is unreliable — kept as metadata). */
export const CURATED_MIRROR_WRITERS = [
  'vasa.eth',
  'chainyman.eth',
  '0x1379971e6380c0c1E92c0e0E1260f068c118016',
];

export interface MirrorArticleRaw {
  digest?: string;
  title?: string;
  body?: string;
  excerpt?: string;
  authors?: string[];
  contributor?: string;
  coverImage?: string;
  timestamp?: number;
  publishedAt?: string;
  arweaveTxId?: string;
  author?: string;
  tags?: Array<{ name: string; value: string }>;
  content?: Record<string, unknown>;
}

export interface MirrorBridgeResponse {
  source?: string;
  articles?: MirrorArticleRaw[];
  articleCount?: number;
}

export interface MirrorProviderOptions {
  /** Bridge base URL fallback (default http://127.0.0.1:8240). */
  bridgeUrl?: string;
  /** Arweave GraphQL endpoint override (testing). */
  graphqlUrl?: string;
  /** Arweave gateway override (testing). */
  gatewayUrl?: string;
  /** Disable the bridge fallback (native-only mode). */
  disableBridgeFallback?: boolean;
}

interface ArweaveTxNode {
  id: string;
  tags?: Array<{ name: string; value: string }>;
  block?: { timestamp?: number };
}

/** Extract image URLs from Markdown body (![alt](url) + raw https image links). */
export function extractMarkdownImages(markdown: string): string[] {
  if (!markdown) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string): void => {
    const url = raw.trim().replace(/[()\s"']+$/g, '');
    if (!url || seen.has(url)) return;
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        seen.add(url);
        out.push(url);
      }
    } catch {
      // not a URL
    }
  };
  const mdRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = mdRe.exec(markdown)) !== null) push(m[1] ?? '');
  const rawRe = /(https?:\/\/[^\s)\]"'<>]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s)\]]*)?)/gi;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = rawRe.exec(markdown)) !== null) push(m[1] ?? '');
  return out;
}

/** Build a UnifiedPost from a raw Mirror article. */
export function mirrorArticleToPost(article: MirrorArticleRaw): UnifiedPost | null {
  const title = (article.title ?? '').trim();
  const body = (article.body ?? '').trim();
  if (!title && !body) return null;

  const contributor = article.contributor || article.authors?.[0] || article.author || '';
  const authorName = contributor
    ? contributor.length > 12
      ? `${contributor.slice(0, 6)}…${contributor.slice(-4)}`
      : contributor
    : 'Mirror writer';
  const digest = article.digest || article.arweaveTxId || '';
  const link = `${MIRROR_FRONT}/${contributor || '0x0'}/${digest}`;
  const images = [
    ...(article.coverImage ? [article.coverImage] : []),
    ...extractMarkdownImages(body),
  ];
  const image = firstImage(article.coverImage, images[0]);
  const html = `<p>${stripArticleHtml(body).slice(0, 1200).replace(/\n/g, '<br/>')}</p>`;

  const author: UnifiedIdentity = {
    id: `mirror:${contributor || digest || 'unknown'}`,
    primary: { protocol: 'mirror', id: contributor || digest },
    handles: { mirror: authorName } as UnifiedIdentity['handles'],
    displayName: authorName,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: contributor
      ? [{ label: 'mirror-writer', url: `${MIRROR_FRONT}/${contributor}` }]
      : [],
    keys: contributor ? { evmAddress: contributor } : {},
  };

  const text = (title ? `${title}\n\n` : '') + stripArticleHtml(body).slice(0, 900);
  const embeds: UnifiedPost['embeds'] = [];
  for (const url of images.slice(0, 4)) embeds.push({ kind: 'image', url });
  embeds.push({ kind: 'link', url: link, meta: { title, type: 'mirror-article' } });

  let createdAt = Date.now();
  if (article.publishedAt) {
    const parsed = new Date(article.publishedAt).getTime();
    if (!Number.isNaN(parsed)) createdAt = parsed;
  } else if (article.timestamp) {
    createdAt = article.timestamp * 1000;
  }

  return {
    id: `mirror:${digest}`,
    protocol: 'mirror',
    author,
    text,
    html,
    embeds,
    contentType: 'article',
    createdAt,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    image,
    media: image,
    raw: {
      source: article.arweaveTxId ? 'mirror-arweave' : 'mirror-bridge',
      arweaveTxId: article.arweaveTxId,
      digest,
      contributor,
      tags: article.tags,
    },
    niches: [...new Set(detectNiches(`${title} ${body}`))],
  } as UnifiedPost;
}

export class MirrorProvider implements FeedProvider {
  readonly protocol: Protocol = 'mirror';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly bridgeUrl: string;
  private readonly graphqlUrl: string;
  private readonly gatewayUrl: string;
  private readonly disableBridgeFallback: boolean;
  private readonly breaker = new CircuitBreaker('mirror');

  constructor(options: MirrorProviderOptions = {}) {
    this.bridgeUrl = (options.bridgeUrl ?? MIRROR_BRIDGE_URL).replace(/\/+$/, '');
    this.graphqlUrl = options.graphqlUrl ?? ARWEAVE_GRAPHQL;
    this.gatewayUrl = (options.gatewayUrl ?? ARWEAVE_GATEWAY).replace(/\/+$/, '');
    this.disableBridgeFallback = options.disableBridgeFallback ?? false;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const native = await this.fetchNative(timeoutMs, opts);
        if (native.length > 0) {
          return { posts: native.slice(0, 50), notice: `Mirror: ${native.length} articles via Arweave GraphQL` };
        }
        if (this.disableBridgeFallback) {
          return { posts: [], notice: 'Mirror: native fetch empty (bridge fallback disabled)' };
        }
        const bridge = await this.fetchBridge(timeoutMs, opts);
        return {
          posts: bridge.slice(0, 50),
          notice:
            bridge.length > 0
              ? `Mirror: ${bridge.length} articles via bridge fallback (native empty)`
              : 'Mirror: no articles (native + bridge unavailable)',
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Mirror: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Mirror feed unavailable' };
    }
  }

  /** Native path: Arweave GraphQL → permaweb content envelopes. */
  private async fetchNative(timeoutMs: number, _opts: FetchOptions): Promise<UnifiedPost[]> {
    try {
      const query = `{
        transactions(
          tags: [{ name: "App-Name", values: ["MirrorXYZ"] }]
          first: 40
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags { name value }
              block { timestamp }
            }
          }
        }
      }`;
      const result = await withTimeout(
        fetchJson<{
          data?: { transactions?: { edges?: Array<{ node: ArweaveTxNode }> } };
        }>(this.graphqlUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': DEFAULT_USER_AGENT },
          body: JSON.stringify({ query }),
        }),
        timeoutMs,
        'mirror:arweave-graphql',
      );
      const edges = result?.data?.transactions?.edges ?? [];

      const posts: UnifiedPost[] = [];
      for (const edge of edges.slice(0, 20)) {
        const content = await this.fetchArweaveContent(edge.node.id, timeoutMs);
        if (!content) continue;
        const article: MirrorArticleRaw = {
          title: (content.title as string) ?? '',
          body: (content.body as string) ?? '',
          excerpt: (content.excerpt as string) ?? '',
          digest: (content.digest as string) ?? edge.node.id,
          arweaveTxId: edge.node.id,
          contributor:
            (content.authors as string[] | undefined)?.[0] ??
            (content.contributor as string) ??
            edge.node.tags?.find((t) => t.name === 'Contributor')?.value ??
            '',
          coverImage: (content.coverImage as string) ?? '',
          timestamp: (content.timestamp as number) ?? edge.node.block?.timestamp ?? 0,
          tags: edge.node.tags,
        };
        const post = mirrorArticleToPost(article);
        if (post) posts.push(post);
      }
      return posts.slice(0, 30);
    } catch {
      return [];
    }
  }

  private async fetchArweaveContent(
    txId: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | null> {
    try {
      const raw = await withTimeout(
        fetchJson<Record<string, unknown>>(`${this.gatewayUrl}/${txId}`, {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
          redirect: 'follow',
        }),
        timeoutMs,
        `mirror:arweave-tx:${txId.slice(0, 8)}`,
      );
      const content = (raw?.content as Record<string, unknown> | undefined) ?? raw;
      if (!content || typeof content !== 'object') return null;
      return content;
    } catch {
      return null;
    }
  }

  /** Bridge fallback path: degenfeed-mirror-bridge. */
  private async fetchBridge(timeoutMs: number, opts: FetchOptions): Promise<UnifiedPost[]> {
    try {
      const data = await withTimeout(
        fetchJson<MirrorBridgeResponse>(`${this.bridgeUrl}/api/mirror/articles?limit=30`, {
          signal: opts.signal,
        }),
        timeoutMs,
        'mirror:bridge',
      );
      const articles = data.articles ?? [];
      if (!Array.isArray(articles)) return [];
      const posts: UnifiedPost[] = [];
      for (const a of articles) {
        const post = mirrorArticleToPost(a);
        if (post) posts.push(post);
      }
      return posts;
    } catch {
      return [];
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    // Prefer native Arweave GraphQL probe.
    try {
      await withTimeout(
        fetchJson(this.graphqlUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `{ transactions(tags: [{ name: "App-Name", values: ["MirrorXYZ"] }] first: 1) { edges { node { id } } } }`,
          }),
        }),
        opts.timeoutMs ?? 6000,
        'mirror:health',
      );
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      try {
        const res = await withTimeout(
          fetch(`${this.bridgeUrl}/health`, { signal: opts.signal }),
          opts.timeoutMs ?? 3000,
          'mirror:health:bridge',
        );
        if (res.ok) return { healthy: true, latencyMs: Date.now() - start };
        return { healthy: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
      } catch (err) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : 'unknown',
        };
      }
    }
  }
}
