/**
 * @degenfeed/cross-protocol-bridge — Cross-Protocol Search
 *
 * Unified search across all protocols from a single search bar.
 * Results are grouped by protocol with relevance scoring.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type {
  CrossProtocolSearchResponse,
  CrossProtocolSearchResult,
  NormalizedMedia,
} from './types';
import { extractHashtags, extractMedia, extractMentions } from './normalization';

// ─── Relevance Scoring ───────────────────────────────────────────────────

interface SearchQuery {
  text: string;
  terms: string[];
  exactPhrase: string | null;
  hashtags: string[];
  mentions: string[];
}

function parseSearchQuery(query: string): SearchQuery {
  const text = query.trim().toLowerCase();
  const terms: string[] = [];
  const hashtags: string[] = [];
  const mentions: string[] = [];
  let exactPhrase: string | null = null;

  // Extract exact phrase
  const phraseMatch = text.match(/"([^"]+)"/);
  if (phraseMatch) {
    exactPhrase = phraseMatch[1].toLowerCase();
  }

  // Tokenize
  const tokens = text.replace(/"[^"]+"/g, '').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith('#')) {
      hashtags.push(token.slice(1).toLowerCase());
    } else if (token.startsWith('@')) {
      mentions.push(token.slice(1).toLowerCase());
    } else {
      terms.push(token);
    }
  }

  return { text, terms, exactPhrase, hashtags, mentions };
}

/**
 * Compute a relevance score (0-1) for a post against a search query.
 */
export function computeRelevanceScore(
  post: { text: string; hashtags: string[]; niches: string[] },
  query: SearchQuery,
): number {
  const lowerText = post.text.toLowerCase();
  let score = 0;
  let maxScore = 0;

  // Exact phrase match (highest weight)
  if (query.exactPhrase) {
    maxScore += 50;
    if (lowerText.includes(query.exactPhrase)) {
      score += 50;
    }
    // Bonus for exact match at start
    if (lowerText.startsWith(query.exactPhrase)) {
      score += 20;
    }
  }

  // Term matches
  for (const term of query.terms) {
    if (term.length < 2) continue;
    maxScore += 10;

    // Full word match
    const wordRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
    if (wordRegex.test(lowerText)) {
      score += 10;
      continue;
    }

    // Partial match
    if (lowerText.includes(term)) {
      score += 5;
    }
  }

  // Hashtag matches (exact)
  for (const tag of query.hashtags) {
    maxScore += 15;
    if (post.hashtags.includes(tag)) {
      score += 15;
    }
    // Also check post niches (canonical tags)
    if (post.niches.includes(tag)) {
      score += 10;
    }
  }

  // Mention matches
  for (const mention of query.mentions) {
    maxScore += 10;
    if (lowerText.includes(`@${mention}`)) {
      score += 10;
    }
  }

  // Recency bonus (posts within last 24h get +10%)
  const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
  if ('createdAt' in post && typeof (post as { createdAt: number }).createdAt === 'number') {
    const createdAt = (post as { createdAt: number }).createdAt;
    if (createdAt > recentThreshold) {
      score *= 1.1;
      maxScore *= 1.1;
    }
  }

  return maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
}

// ─── Protocol-specific search providers ──────────────────────────────────

interface SearchProvider {
  protocol: Protocol;
  /** Search this protocol for the given query */
  search(query: SearchQuery, limit: number): Promise<UnifiedPost[]>;
}

const searchProviders: SearchProvider[] = [];

/**
 * Register a search provider for a protocol.
 */
export function registerSearchProvider(provider: SearchProvider): void {
  const existing = searchProviders.findIndex((p) => p.protocol === provider.protocol);
  if (existing >= 0) {
    searchProviders[existing] = provider;
  } else {
    searchProviders.push(provider);
  }
}

/**
 * Search across all registered providers.
 */
async function searchAllProviders(
  query: SearchQuery,
  targetProtocols?: Protocol[],
  limit = 20,
): Promise<Map<Protocol, UnifiedPost[]>> {
  const providers = targetProtocols
    ? searchProviders.filter((p) => targetProtocols.includes(p.protocol))
    : searchProviders;

  const results = new Map<Protocol, UnifiedPost[]>();

  if (providers.length === 0) return results;

  const perProvider = Math.max(5, Math.ceil((limit * 2) / providers.length));

  const searchResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const posts = await provider.search(query, perProvider);
      return { protocol: provider.protocol, posts };
    }),
  );

  for (const result of searchResults) {
    if (result.status === 'fulfilled') {
      results.set(result.value.protocol, result.value.posts);
    }
  }

  return results;
}

// ─── Identity search (people results) ────────────────────────────────────

/**
 * Search for identities matching the query across protocols.
 * Returns people results alongside content results.
 */
async function searchIdentities(
  query: SearchQuery,
  _limit = 10,
): Promise<CrossProtocolSearchResult[]> {
  // In production, this would search a user/identity index
  // For now, search the identity store by matching handles and names
  const { resolveByHandle } = await import('./identity-linking');
  const results: CrossProtocolSearchResult[] = [];

  for (const term of query.terms) {
    // Try resolving as a handle
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
          url: undefined,
        });
      }
    }
  }

  return results;
}

// ─── Public Search API ───────────────────────────────────────────────────

/**
 * Main cross-protocol search function.
 * Searches across all configured protocols, computes relevance scores,
 * and returns grouped results.
 */
export async function crossProtocolSearch(
  query: string,
  options?: {
    protocols?: Protocol[];
    limit?: number;
    page?: number;
    includeIdentities?: boolean;
  },
): Promise<CrossProtocolSearchResponse> {
  const startTime = Date.now();
  const parsedQuery = parseSearchQuery(query);
  const limit = options?.limit ?? 20;
  const page = options?.page ?? 1;
  const protocols = options?.protocols;

  // Search all providers
  const providerResults = await searchAllProviders(
    parsedQuery,
    protocols,
    limit,
  );

  // Flatten and score
  const allResults: CrossProtocolSearchResult[] = [];
  const byProtocol: Partial<Record<Protocol, number>> = {};

  for (const [protocol, posts] of providerResults) {
    byProtocol[protocol] = (byProtocol[protocol] ?? 0) + posts.length;

    for (const post of posts) {
      const hashtags = extractHashtags(post.text);
      const media = extractMedia(post);
      const score = computeRelevanceScore(
        { text: post.text, hashtags, niches: post.niches },
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
          linkedHandles: post.author.handles as Partial<Record<Protocol, string>> | undefined,
        },
        createdAt: post.createdAt,
        metrics: post.metrics,
        niches: post.niches,
        relevanceScore: score,
        url: undefined,
        media: media.length > 0 ? media : undefined,
        crossPostedTo: post.crossPostedTo as Protocol[] | undefined,
      });
    }
  }

  // Sort by relevance score, then recency
  allResults.sort((a, b) => {
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.1) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.createdAt - a.createdAt;
  });

  // Paginate
  const offset = (page - 1) * limit;
  const paginated = allResults.slice(offset, offset + limit);

  // Optionally search identities
  let identities: CrossProtocolSearchResult[] | undefined;
  if (options?.includeIdentities) {
    identities = await searchIdentities(parsedQuery);
  }

  return {
    results: paginated,
    meta: {
      query,
      totalResults: allResults.length,
      byProtocol,
      page,
      limit,
      latencyMs: Date.now() - startTime,
      sources: protocols ?? Object.keys(byProtocol) as Protocol[],
    },
    identityResults: identities,
  };
}

/**
 * Search a single protocol. Useful for "search within this protocol" views.
 */
export async function searchProtocol(
  query: string,
  protocol: Protocol,
  options?: { limit?: number; page?: number },
): Promise<CrossProtocolSearchResponse> {
  return crossProtocolSearch(query, {
    protocols: [protocol],
    limit: options?.limit,
    page: options?.page,
  });
}

// ─── Helper to register a provider from a list of posts ──────────────────

/**
 * Register an in-memory search provider from a list of UnifiedPost objects.
 * Useful for testing or for small static datasets.
 */
export function registerSearchProviderFromPosts(
  protocol: Protocol,
  posts: UnifiedPost[],
): void {
  registerSearchProvider({
    protocol,
    async search(query: SearchQuery, limit: number) {
      const scored = posts
        .map((post) => ({
          post,
          score: computeRelevanceScore(
            { text: post.text, hashtags: extractHashtags(post.text), niches: post.niches },
            query,
          ),
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      return scored.slice(0, limit).map((s) => s.post);
    },
  });
}

// ─── Helper ──────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
