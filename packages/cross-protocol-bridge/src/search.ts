import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { extractHashtags, extractMedia } from './normalization';
import type { CrossProtocolSearchResponse, CrossProtocolSearchResult } from './types';

interface SearchQuery {
  text: string;
  terms: string[];
  exactPhrase: string | null;
  hashtags: string[];
  mentions: string[];
}

function parseSearchQuery(queryStr: string): SearchQuery {
  const q = (queryStr ?? '').trim().toLowerCase();
  const terms: string[] = [];
  const hashtags: string[] = [];
  const mentions: string[] = [];
  let exactPhrase: string | null = null;

  const phraseMatch = q.match(/"([^"]+)"/);
  if (phraseMatch) exactPhrase = (phraseMatch[1] ?? '').toLowerCase();

  for (const token of q
    .replace(/"[^"]+"/g, '')
    .split(/\s+/)
    .filter(Boolean)) {
    if (token.startsWith('#')) hashtags.push(token.slice(1).toLowerCase());
    else if (token.startsWith('@')) mentions.push(token.slice(1).toLowerCase());
    else terms.push(token);
  }

  return { text: q, terms, exactPhrase, hashtags, mentions };
}

export function computeRelevanceScore(
  post: { text: string; hashtags: string[]; niches: string[]; createdAt?: number },
  query: SearchQuery,
): number {
  const lowerText = post.text.toLowerCase();
  let score = 0;
  let maxScore = 0;

  if (query.exactPhrase) {
    maxScore += 50;
    if (lowerText.includes(query.exactPhrase)) score += 50;
    if (lowerText.startsWith(query.exactPhrase)) score += 20;
  }

  for (const term of query.terms) {
    if (term.length < 2) continue;
    maxScore += 10;
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lowerText))
      score += 10;
    else if (lowerText.includes(term)) score += 5;
  }

  for (const tag of query.hashtags) {
    maxScore += 15;
    if (post.hashtags.includes(tag)) score += 15;
    if (post.niches.includes(tag)) score += 10;
  }

  for (const mention of query.mentions) {
    maxScore += 10;
    if (lowerText.includes(`@${mention}`)) score += 10;
  }

  if (post.createdAt && post.createdAt > Date.now() - 86400000) {
    score *= 1.1;
    maxScore *= 1.1;
  }

  return maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
}

interface SearchProvider {
  protocol: Protocol;
  search(query: SearchQuery, limit: number): Promise<UnifiedPost[]>;
}

const searchProviders: SearchProvider[] = [];

export function registerSearchProvider(provider: SearchProvider): void {
  const idx = searchProviders.findIndex((p) => p.protocol === provider.protocol);
  if (idx >= 0) searchProviders[idx] = provider;
  else searchProviders.push(provider);
}

async function searchAllProviders(
  query: SearchQuery,
  targetProtocols?: Protocol[],
  limit = 20,
): Promise<Map<Protocol, UnifiedPost[]>> {
  const results = new Map<Protocol, UnifiedPost[]>();
  const providers = targetProtocols
    ? searchProviders.filter((p) => targetProtocols.includes(p.protocol))
    : searchProviders;
  if (providers.length === 0) return results;

  const perProvider = Math.max(5, Math.ceil((limit * 2) / providers.length));
  const searchResults = await Promise.allSettled(
    providers.map(async (p) => ({
      protocol: p.protocol,
      posts: await p.search(query, perProvider),
    })),
  );

  for (const r of searchResults) {
    if (r.status === 'fulfilled') results.set(r.value.protocol, r.value.posts);
  }
  return results;
}

async function searchIdentities(
  query: SearchQuery,
  _limit = 10,
): Promise<CrossProtocolSearchResult[]> {
  const { resolveByHandle } = await import('./identity-linking');
  const results: CrossProtocolSearchResult[] = [];

  for (const term of query.terms) {
    const identity = resolveByHandle('nostr', term);
    if (identity) {
      for (const proto of identity.protocols) {
        results.push({
          id: `identity:${proto.protocol}:${proto.id}`,
          protocol: proto.protocol,
          text: proto.displayName ?? proto.handle,
          author: {
            displayName: proto.displayName ?? proto.handle,
            handle: proto.handle,
            avatarUrl: proto.avatarUrl,
            id: proto.id,
          },
          createdAt: identity.linkedAt,
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          niches: [],
          relevanceScore: 0.8,
        });
      }
    }
  }
  return results;
}

export async function crossProtocolSearch(
  queryStr: string,
  options?: { protocols?: Protocol[]; limit?: number; page?: number; includeIdentities?: boolean },
): Promise<CrossProtocolSearchResponse> {
  const startTime = Date.now();
  const parsedQuery = parseSearchQuery(queryStr);
  const limit = options?.limit ?? 20;
  const page = options?.page ?? 1;

  const providerResults = await searchAllProviders(parsedQuery, options?.protocols, limit);
  const allResults: CrossProtocolSearchResult[] = [];
  const byProtocol: Partial<Record<Protocol, number>> = {};

  for (const [protocol, posts] of providerResults) {
    byProtocol[protocol] = (byProtocol[protocol] ?? 0) + posts.length;
    for (const post of posts) {
      const hashtags = extractHashtags(post.text);
      const media = extractMedia(post);
      const score = computeRelevanceScore(
        { text: post.text, hashtags, niches: post.niches, createdAt: post.createdAt },
        parsedQuery,
      );
      allResults.push({
        id: post.id,
        protocol: post.protocol as Protocol,
        text: post.text,
        author: {
          displayName: post.author.displayName,
          handle: post.author.handles?.[post.protocol] ?? undefined,
          avatarUrl: post.author.avatarUrl,
          id: post.author.id,
        },
        createdAt: post.createdAt,
        metrics: post.metrics,
        niches: post.niches,
        relevanceScore: score,
        media: media.length > 0 ? media : undefined,
        crossPostedTo: post.crossPostedTo as Protocol[] | undefined,
      });
    }
  }

  allResults.sort((a, b) => {
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1)
      return b.relevanceScore - a.relevanceScore;
    return b.createdAt - a.createdAt;
  });

  const offset = (page - 1) * limit;
  const paginated = allResults.slice(offset, offset + limit);
  const identities = options?.includeIdentities ? await searchIdentities(parsedQuery) : undefined;

  return {
    results: paginated,
    meta: {
      query: queryStr,
      totalResults: allResults.length,
      byProtocol,
      page,
      limit,
      latencyMs: Date.now() - startTime,
      sources: options?.protocols ?? (Object.keys(byProtocol) as Protocol[]),
    },
    identityResults: identities,
  };
}

export async function searchProtocol(
  queryStr: string,
  protocol: Protocol,
  options?: { limit?: number; page?: number },
): Promise<CrossProtocolSearchResponse> {
  return crossProtocolSearch(queryStr, {
    protocols: [protocol],
    limit: options?.limit,
    page: options?.page,
  });
}

export function registerSearchProviderFromPosts(protocol: Protocol, posts: UnifiedPost[]): void {
  registerSearchProvider({
    protocol,
    async search(query: SearchQuery, limit: number) {
      return posts
        .map((post) => ({
          post,
          score: computeRelevanceScore(
            {
              text: post.text,
              hashtags: extractHashtags(post.text),
              niches: post.niches,
              createdAt: post.createdAt,
            },
            query,
          ),
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.post);
    },
  });
}
