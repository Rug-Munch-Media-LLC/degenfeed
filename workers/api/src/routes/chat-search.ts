/**
 * /api/messages/search — Chat Search & Organization
 *
 * Advanced message search across conversations:
 *   GET /api/messages/search?q=...&conversationId=...  — Search messages by content
 *   GET /api/messages/search/advanced                   — Advanced search with filters
 *   GET /api/messages/search/media/:conversationId      — Search by media type
 *   POST /api/messages/search/index                    — Index messages for search
 *
 * Features:
 *   - Search by text content
 *   - Search by sender
 *   - Search by date range
 *   - Search by media type (images, videos, files, links)
 *   - Highlight search matches
 *   - Jump to message in conversation
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const SEARCH_INDEX_PREFIX = 'chat:search:idx:';
const SEARCH_TERM_PREFIX = 'chat:search:term:';
const SEARCH_RESULTS_CACHE_PREFIX = 'chat:search:cache:';
const SEARCH_CONV_INDEX_PREFIX = 'chat:search:conv:';
const SEARCH_MEDIA_INDEX_PREFIX = 'chat:search:media:';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SearchResult {
  /** Message ID */
  id: string;
  /** Conversation ID */
  conversationId?: string;
  /** Sender wallet address */
  fromId: string;
  /** Message content (with highlight markers) */
  content: string;
  /** Raw content (without highlights) */
  rawContent: string;
  /** Protocol used */
  protocol?: string;
  /** Timestamp */
  createdAt: number;
  /** Whether the message was read */
  read?: boolean;
  /** Media type if the message contains media */
  mediaType?: 'image' | 'video' | 'audio' | 'file' | 'link';
  /** File/media URL */
  mediaUrl?: string;
  /** Match positions for highlighting */
  matches: Array<{ start: number; end: number }>;
  /** Relevance score (0-1) */
  score: number;
}

export interface AdvancedSearchParams {
  query?: string;
  conversationId?: string;
  senderId?: string;
  dateFrom?: number;
  dateTo?: number;
  mediaType?: 'image' | 'video' | 'audio' | 'file' | 'link';
  limit?: number;
  offset?: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'contact' | 'recent' | 'media';
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_RESULTS = 100;
const DEFAULT_RESULTS = 25;
const SEARCH_CACHE_TTL = 300; // 5 minutes
const INDEX_TERM_MIN_LENGTH = 2;
const INDEX_TERM_MAX_LENGTH = 50;
const MAX_INDEX_TERMS = 20;

// ─── Search Indexing ───────────────────────────────────────────────────────

/**
 * Index a message for search.
 * Extracts searchable terms and stores them in KV.
 */
export async function indexMessageForSearch(
  env: Env,
  messageId: string,
  conversationId: string,
  fromId: string,
  content: string,
  protocol?: string,
  mediaType?: SearchResult['mediaType'],
  mediaUrl?: string,
  createdAt?: number,
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const timestamp = createdAt ?? Date.now();

  // Store the full message record
  const messageRecord: SearchResult = {
    id: messageId,
    conversationId,
    fromId,
    content: highlightMatches(content, []),
    rawContent: content,
    protocol,
    createdAt: timestamp,
    matches: [],
    score: 1,
    ...(mediaType ? { mediaType, mediaUrl } : {}),
  };

  // Store by conversation for scoped search
  const convKey = `${SEARCH_CONV_INDEX_PREFIX}${conversationId}:${messageId}`;
  await kv
    .put(convKey, JSON.stringify(messageRecord), { expirationTtl: 86400 * 90 })
    .catch(() => {});

  // Index by media type
  if (mediaType) {
    const mediaKey = `${SEARCH_MEDIA_INDEX_PREFIX}${conversationId}:${mediaType}:${messageId}`;
    await kv
      .put(mediaKey, JSON.stringify(messageRecord), { expirationTtl: 86400 * 90 })
      .catch(() => {});
  }

  // Extract and index search terms
  const terms = extractSearchTerms(content);
  for (const term of terms.slice(0, MAX_INDEX_TERMS)) {
    const termKey = `${SEARCH_TERM_PREFIX}${term}:${messageId}`;
    await kv
      .put(
        termKey,
        JSON.stringify({ messageId, conversationId, fromId, term, createdAt: timestamp }),
        { expirationTtl: 86400 * 30 },
      )
      .catch(() => {});
  }

  // Global search index for this conversation (list of message IDs)
  const globalKey = `${SEARCH_INDEX_PREFIX}${conversationId}`;
  const existingRaw = await kv.get(globalKey).catch(() => null);
  const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
  if (!existing.includes(messageId)) {
    existing.push(messageId);
    // Keep last 1000 messages indexed per conversation
    await kv
      .put(globalKey, JSON.stringify(existing.slice(-1000)), { expirationTtl: 86400 * 90 })
      .catch(() => {});
  }
}

/**
 * Extract searchable terms from text content.
 * Splits on whitespace and punctuation, filters short/common words.
 */
function extractSearchTerms(content: string): string[] {
  const commonWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'has',
    'have',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'can',
    'could',
    'should',
    'may',
    'might',
    'shall',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'he',
    'she',
    'they',
    'we',
    'you',
    'me',
    'my',
    'your',
    'his',
    'her',
    'our',
    'their',
    'not',
    'no',
    'yes',
    'so',
    'if',
    'hi',
    'hey',
    'hello',
    'ok',
    'okay',
    'yeah',
    'yes',
    'no',
    'nope',
    'please',
    'thanks',
    'thank',
    'ty',
    'thx',
    'lol',
    'lmao',
    'lmfao',
    'brb',
    'gtg',
    'afk',
    'idk',
    'tbh',
    'imo',
    'imho',
    'btw',
    'fwiw',
    'omg',
    'wtf',
    'wth',
    'smh',
    'fyi',
    'dm',
    'gm',
    'gn',
  ]);

  const words = content
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}/"'@#$%^&*+=\-<>~`|\\]+/)
    .filter((w) => w.length >= INDEX_TERM_MIN_LENGTH && w.length <= INDEX_TERM_MAX_LENGTH)
    .filter((w) => !commonWords.has(w))
    .filter((w) => /^[a-z0-9]+$/.test(w));

  // Deduplicate
  return [...new Set(words)];
}

// ─── Search Execution ─────────────────────────────────────────────────────

/**
 * Search messages by text content.
 */
export async function searchMessages(
  env: Env,
  userId: string,
  query: string,
  options?: {
    conversationId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ results: SearchResult[]; total: number }> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return { results: [], total: 0 };

  const limit = Math.min(options?.limit ?? DEFAULT_RESULTS, MAX_RESULTS);
  const offset = options?.offset ?? 0;
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return { results: [], total: 0 };
  }

  // Check cache
  const cacheKey = `${SEARCH_RESULTS_CACHE_PREFIX}${userId}:${normalizedQuery}:${options?.conversationId ?? 'all'}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      const cachedResults = JSON.parse(cached) as { results: SearchResult[]; total: number };
      return {
        results: cachedResults.results.slice(offset, offset + limit),
        total: cachedResults.total,
      };
    }
  } catch {
    // Cache miss — continue
  }

  const results: SearchResult[] = [];
  const matchedIds = new Set<string>();

  // Split query into terms for multi-term search
  const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (searchTerms.length === 0) return { results: [], total: 0 };

  // If conversationId is specified, search within that conversation
  const convIds = options?.conversationId
    ? [options.conversationId]
    : await getUserConversationIds(env, userId);

  for (const convId of convIds) {
    try {
      const globalKey = `${SEARCH_INDEX_PREFIX}${convId}`;
      const indexRaw = await kv.get(globalKey);
      if (!indexRaw) continue;

      const messageIds: string[] = JSON.parse(indexRaw);

      for (const msgId of messageIds) {
        if (matchedIds.has(msgId)) continue;

        // Get full message record
        const record = await getIndexedMessage(env, convId, msgId);
        if (!record) continue;

        const rawContent = record.rawContent.toLowerCase();
        const match = searchTerms.every((term) => rawContent.includes(term));
        if (!match) continue;

        matchedIds.add(msgId);

        // Calculate relevance score
        let score = 0;
        const exactMatches = searchTerms.filter((t) => rawContent.includes(t)).length;
        score = exactMatches / searchTerms.length;

        // Boost recent messages
        const ageHours = (Date.now() - record.createdAt) / 3600000;
        if (ageHours < 1) score += 0.2;
        else if (ageHours < 24) score += 0.1;

        // Find match positions for highlighting
        const matchPositions = findMatchPositions(record.rawContent, searchTerms);

        results.push({
          ...record,
          content: highlightMatches(record.rawContent, searchTerms),
          matches: matchPositions,
          score: Math.min(1, score),
        });
      }
    } catch {}
  }

  // Sort by score (desc), then by date (desc)
  results.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
    return b.createdAt - a.createdAt;
  });

  const total = results.length;

  // Cache results
  if (results.length > 0) {
    await kv
      .put(cacheKey, JSON.stringify({ results, total }), {
        expirationTtl: SEARCH_CACHE_TTL,
      })
      .catch(() => {});
  }

  return {
    results: results.slice(offset, offset + limit),
    total,
  };
}

/**
 * Advanced search with multiple filters.
 */
export async function advancedSearch(
  env: Env,
  userId: string,
  params: AdvancedSearchParams,
): Promise<{ results: SearchResult[]; total: number }> {
  const results = await searchMessages(env, userId, params.query ?? '', {
    conversationId: params.conversationId,
    limit: 1000,
  });

  let filtered = results.results;

  // Filter by sender
  if (params.senderId) {
    const sender = params.senderId.toLowerCase();
    filtered = filtered.filter((r) => r.fromId === sender);
  }

  // Filter by date range
  if (params.dateFrom) {
    filtered = filtered.filter((r) => r.createdAt >= params.dateFrom!);
  }
  if (params.dateTo) {
    filtered = filtered.filter((r) => r.createdAt <= params.dateTo!);
  }

  // Filter by media type
  if (params.mediaType) {
    filtered = filtered.filter((r) => r.mediaType === params.mediaType);
  }

  const total = filtered.length;
  const limit = params.limit ?? DEFAULT_RESULTS;
  const offset = params.offset ?? 0;

  return {
    results: filtered.slice(offset, offset + limit),
    total,
  };
}

/**
 * Search media in a conversation by type.
 */
export async function searchByMediaType(
  env: Env,
  conversationId: string,
  mediaType: SearchResult['mediaType'],
  options?: { limit?: number; offset?: number },
): Promise<{ results: SearchResult[]; total: number }> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return { results: [], total: 0 };

  const limit = Math.min(options?.limit ?? DEFAULT_RESULTS, MAX_RESULTS);
  const offset = options?.offset ?? 0;
  const results: SearchResult[] = [];

  try {
    const list = await kv.list({
      prefix: `${SEARCH_MEDIA_INDEX_PREFIX}${conversationId}:${mediaType}:`,
    });

    for (const key of list.keys) {
      const raw = await kv.get(key.name);
      if (raw) {
        results.push(JSON.parse(raw) as SearchResult);
      }
    }

    results.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    // Ignore
  }

  return {
    results: results.slice(offset, offset + limit),
    total: results.length,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Get indexed message record from KV.
 */
async function getIndexedMessage(
  env: Env,
  conversationId: string,
  messageId: string,
): Promise<SearchResult | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  try {
    const raw = await kv.get(`${SEARCH_CONV_INDEX_PREFIX}${conversationId}:${messageId}`);
    return raw ? (JSON.parse(raw) as SearchResult) : null;
  } catch {
    return null;
  }
}

/**
 * Get all conversation IDs for a user.
 */
async function getUserConversationIds(env: Env, userId: string): Promise<string[]> {
  // Try to get from conversation list
  try {
    const { getConversationList } = await import('./messages');
    const conversations = await getConversationList(env, userId);
    return conversations.map((c: { id: string }) => c.id);
  } catch {
    return [];
  }
}

/**
 * Find match positions in content for highlighting.
 */
function findMatchPositions(
  content: string,
  terms: string[],
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  const lower = content.toLowerCase();

  for (const term of terms) {
    let pos = 0;
    while (pos < lower.length) {
      const idx = lower.indexOf(term, pos);
      if (idx === -1) break;
      matches.push({ start: idx, end: idx + term.length });
      pos = idx + term.length;
    }
  }

  // Sort and deduplicate overlapping matches
  matches.sort((a, b) => a.start - b.start);
  return matches.filter((m, i) => {
    if (i === 0) return true;
    return m.start !== matches[i - 1]?.start;
  });
}

/**
 * Highlight search terms in content with markers.
 */
function highlightMatches(content: string, terms: string[]): string {
  if (!terms.length) return content;

  const lower = content.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];

  for (const term of terms) {
    let pos = 0;
    while (pos < lower.length) {
      const idx = lower.indexOf(term, pos);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + term.length });
      pos = idx + term.length;
    }
  }

  if (ranges.length === 0) return content;

  // Merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged = [ranges[0]!];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1]!;
    const current = ranges[i]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(ranges[i]!);
    }
  }

  // Apply highlights
  let result = '';
  let lastEnd = 0;
  for (const range of merged) {
    result += content.slice(lastEnd, range.start);
    result += '<<hl>>';
    result += content.slice(range.start, range.end);
    result += '<</hl>>';
    lastEnd = range.end;
  }
  result += content.slice(lastEnd);

  return result;
}

// ─── Search Suggestions ───────────────────────────────────────────────────

/**
 * Get search suggestions for a partial query.
 */
export async function getSearchSuggestions(
  env: Env,
  userId: string,
  partial: string,
): Promise<SearchSuggestion[]> {
  const suggestions: SearchSuggestion[] = [];

  if (partial.length < 1) return suggestions;

  // Search recent contacts
  try {
    const { getConversationList } = await import('./messages');
    const conversations = await getConversationList(env, userId);
    const matchingConvs = conversations.filter((c: { lastMessage?: { content: string } }) =>
      c.lastMessage?.content?.toLowerCase().includes(partial.toLowerCase()),
    );
    if (matchingConvs.length > 0) {
      suggestions.push({
        text: `Search ${matchingConvs.length} conversations`,
        type: 'recent',
        count: matchingConvs.length,
      });
    }
  } catch {
    // Ignore
  }

  // Search media types
  const mediaTypes = ['image', 'video', 'audio', 'file', 'link'] as const;
  for (const mt of mediaTypes) {
    if (mt.includes(partial.toLowerCase())) {
      suggestions.push({
        text: `Search ${mt}s`,
        type: 'media',
        count: 0,
      });
    }
  }

  return suggestions.slice(0, 5);
}

// ─── Route Handlers ───────────────────────────────────────────────────────

/**
 * GET /api/messages/search — Search messages by text.
 * Query params: q, conversationId, limit, offset
 */
export async function handleSearchMessages(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const conversationId = url.searchParams.get('conversationId') ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? String(DEFAULT_RESULTS), 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  if (!query.trim()) {
    return jsonResponse({ error: 'Search query is required' }, 400);
  }

  try {
    const results = await searchMessages(env, userId, query, {
      conversationId,
      limit,
      offset,
    });

    return noCacheJsonResponse({
      results: results.results,
      total: results.total,
      query,
      hasMore: results.total > offset + results.results.length,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Search failed',
      },
      500,
    );
  }
}

/**
 * GET /api/messages/search/advanced — Advanced search with filters.
 */
export async function handleAdvancedSearch(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();
  const url = new URL(request.url);

  const params: AdvancedSearchParams = {
    query: url.searchParams.get('q') ?? undefined,
    conversationId: url.searchParams.get('conversationId') ?? undefined,
    senderId: url.searchParams.get('sender') ?? undefined,
    dateFrom: url.searchParams.get('dateFrom')
      ? parseInt(url.searchParams.get('dateFrom')!, 10)
      : undefined,
    dateTo: url.searchParams.get('dateTo')
      ? parseInt(url.searchParams.get('dateTo')!, 10)
      : undefined,
    mediaType: url.searchParams.get('mediaType') as SearchResult['mediaType'] | undefined,
    limit: parseInt(url.searchParams.get('limit') ?? String(DEFAULT_RESULTS), 10),
    offset: parseInt(url.searchParams.get('offset') ?? '0', 10),
  };

  try {
    const results = await advancedSearch(env, userId, params);
    return noCacheJsonResponse({
      results: results.results,
      total: results.total,
      params,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Advanced search failed',
      },
      500,
    );
  }
}

/**
 * GET /api/messages/search/media/:conversationId — Search by media type.
 */
export async function handleSearchMedia(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const mediaType = url.searchParams.get('type') as SearchResult['mediaType'];
  const limit = parseInt(url.searchParams.get('limit') ?? String(DEFAULT_RESULTS), 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  if (!mediaType || !['image', 'video', 'audio', 'file', 'link'].includes(mediaType)) {
    return jsonResponse(
      { error: 'Valid media type required (image, video, audio, file, link)' },
      400,
    );
  }

  try {
    const results = await searchByMediaType(env, conversationId, mediaType, { limit, offset });
    return noCacheJsonResponse({
      results: results.results,
      total: results.total,
      mediaType,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Media search failed',
      },
      500,
    );
  }
}

/**
 * POST /api/messages/search/index — Index a message for search.
 * Called when a message is sent.
 */
export async function handleIndexMessage(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    messageId: string;
    conversationId: string;
    fromId: string;
    content: string;
    protocol?: string;
    mediaType?: SearchResult['mediaType'];
    mediaUrl?: string;
    createdAt?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId || !body.fromId || !body.content) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  try {
    await indexMessageForSearch(
      env,
      body.messageId,
      body.conversationId,
      body.fromId,
      body.content,
      body.protocol,
      body.mediaType,
      body.mediaUrl,
      body.createdAt,
    );

    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Indexing failed',
      },
      500,
    );
  }
}

/**
 * GET /api/messages/search/suggestions — Get search suggestions.
 */
export async function handleSearchSuggestions(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();
  const url = new URL(request.url);
  const partial = url.searchParams.get('q') ?? '';

  try {
    const suggestions = await getSearchSuggestions(env, userId, partial);
    return noCacheJsonResponse({ suggestions });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Suggestions failed',
      },
      500,
    );
  }
}
