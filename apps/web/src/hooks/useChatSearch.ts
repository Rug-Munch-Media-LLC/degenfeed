'use client';

/**
 * useChatSearch — Advanced message search composable
 *
 * Features:
 *   - Search messages by text content
 *   - Search by sender
 *   - Search by date range
 *   - Search by media type
 *   - Highlight search matches
 *   - Jump to message in conversation
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { retryFetchJson } from '../lib/retryFetch';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  conversationId?: string;
  fromId: string;
  content: string;
  rawContent: string;
  protocol?: string;
  createdAt: number;
  mediaType?: 'image' | 'video' | 'audio' | 'file' | 'link';
  mediaUrl?: string;
  matches: Array<{ start: number; end: number }>;
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

// ─── Highlight rendering ──────────────────────────────────────────────────

/**
 * Render content with search highlight markers.
 * Markers: <<hl>>text<</hl>>
 */
export function renderHighlightedContent(
  content: string,
): Array<{ text: string; highlighted: boolean }> {
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  const regex = /<<hl>>(.*?)<</hl>>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Text before highlight
    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), highlighted: false });
    }
    // Highlighted text
    parts.push({ text: match[1]!, highlighted: true });
    lastIndex = regex.lastIndex;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), highlighted: false });
  }

  return parts;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useChatSearch(conversationId?: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ── Search by text ──────────────────────────────────────────────────

  const searchByText = useCallback(
    async (query: string, options?: { limit?: number; offset?: number }) => {
      // Cancel previous search
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      if (!query.trim()) {
        setResults([]);
        setTotal(0);
        setSuggestions([]);
        return;
      }

      setSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query });
        if (conversationId) params.set('conversationId', conversationId);
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const data = await retryFetchJson<{
          results: SearchResult[];
          total: number;
          query: string;
          hasMore?: boolean;
        }>(`/api/messages/search?${params.toString()}`, {
          maxRetries: 1,
          fetchOptions: { signal: abort.signal },
        });

        if (!abort.signal.aborted) {
          setResults(data.results ?? []);
          setTotal(data.total ?? 0);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        if (!abort.signal.aborted) {
          setSearching(false);
        }
      }
    },
    [conversationId],
  );

  // ── Advanced search ─────────────────────────────────────────────────

  const advancedSearch = useCallback(async (params: AdvancedSearchParams) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setSearching(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params.query) searchParams.set('q', params.query);
      if (params.conversationId) searchParams.set('conversationId', params.conversationId);
      if (params.senderId) searchParams.set('sender', params.senderId);
      if (params.dateFrom) searchParams.set('dateFrom', String(params.dateFrom));
      if (params.dateTo) searchParams.set('dateTo', String(params.dateTo));
      if (params.mediaType) searchParams.set('mediaType', params.mediaType);
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.offset) searchParams.set('offset', String(params.offset));

      const data = await retryFetchJson<{ results: SearchResult[]; total: number }>(
        `/api/messages/search/advanced?${searchParams.toString()}`,
        { maxRetries: 1, fetchOptions: { signal: abort.signal } },
      );

      if (!abort.signal.aborted) {
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Advanced search failed');
    } finally {
      if (!abort.signal.aborted) setSearching(false);
    }
  }, []);

  // ── Search by media type ────────────────────────────────────────────

  const searchByMediaType = useCallback(
    async (
      type: 'image' | 'video' | 'audio' | 'file' | 'link',
      options?: { limit?: number; offset?: number },
    ) => {
      if (!conversationId) return;

      setSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({ type });
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const data = await retryFetchJson<{ results: SearchResult[]; total: number }>(
          `/api/messages/search/media/${encodeURIComponent(conversationId)}?${params.toString()}`,
          { maxRetries: 1 },
        );

        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Media search failed');
      } finally {
        setSearching(false);
      }
    },
    [conversationId],
  );

  // ── Get suggestions ─────────────────────────────────────────────────

  const getSuggestions = useCallback(async (partial: string) => {
    if (!partial.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const data = await retryFetchJson<{ suggestions: SearchSuggestion[] }>(
        `/api/messages/search/suggestions?q=${encodeURIComponent(partial)}`,
        { maxRetries: 1 },
      );
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  // ── Jump to message ─────────────────────────────────────────────────

  const jumpToMessage = useCallback(
    (messageId: string) => {
      // Dispatch a custom event that the chat view listens to
      const event = new CustomEvent('chat:jump-to-message', {
        detail: { messageId, conversationId },
      });
      window.dispatchEvent(event);
    },
    [conversationId],
  );

  // ── Clear ───────────────────────────────────────────────────────────

  const clearSearch = useCallback(() => {
    setResults([]);
    setTotal(0);
    setError(null);
    setSuggestions([]);
    abortRef.current?.abort();
  }, []);

  // ── Memoized highlighted results ────────────────────────────────────

  const highlightedResults = useMemo(
    () =>
      results.map((r) => ({
        ...r,
        parts: renderHighlightedContent(r.content),
      })),
    [results],
  );

  return {
    // State
    results,
    highlightedResults,
    total,
    searching,
    error,
    suggestions,

    // Actions
    searchByText,
    advancedSearch,
    searchByMediaType,
    getSuggestions,
    jumpToMessage,
    clearSearch,
  };
}
