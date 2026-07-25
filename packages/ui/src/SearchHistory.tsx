'use client';

/**
 * @degenfeed/ui — SearchHistory / RecentSearches / SavedSearches / TrendingSearches
 *
 * Manages recent searches (localStorage), saved searches (localStorage),
 * and fetches trending searches from the API.
 */

import { memo, useCallback, useEffect, useState } from 'react';

/* ─── Types ────────────────────────────────────────────────── */

export interface SavedSearch {
  id: string;
  query: string;
  filters?: Record<string, string>;
  label?: string;
  savedAt: number;
}

export interface TrendingSearch {
  text: string;
  count: number;
}

/* ─── Constants ────────────────────────────────────────────── */

const RECENT_KEY = 'df:search:recent';
const SAVED_KEY = 'df:search:saved';
const MAX_RECENT = 20;

/* ─── Hook: useRecentSearches ──────────────────────────────── */

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const addRecent = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const removeRecent = useCallback((query: string) => {
    setRecent((prev) => {
      const next = prev.filter((q) => q !== query);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { recent, addRecent, removeRecent, clearRecent };
}

/* ─── Hook: useSavedSearches ───────────────────────────────── */

export function useSavedSearches() {
  const [saved, setSaved] = useState<SavedSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedSearch[]);
    } catch {
      /* ignore */
    }
  }, []);

  const saveSearch = useCallback(
    (query: string, filters?: Record<string, string>, label?: string) => {
      const item: SavedSearch = {
        id: `saved-${Date.now()}`,
        query,
        filters,
        label: label || query,
        savedAt: Date.now(),
      };
      setSaved((prev) => {
        const next = [item, ...prev.filter((s) => s.query !== query)];
        try {
          localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const removeSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { saved, saveSearch, removeSaved };
}

/* ─── Hook: useTrendingSearches ────────────────────────────── */

export function useTrendingSearches() {
  const [trending, setTrending] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/search/trending?limit=12');
      if (res.ok) {
        const data = (await res.json()) as { data: TrendingSearch[] };
        setTrending(data.data ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return { trending, loading, refresh: fetchTrending };
}

/* ─── Recent Searches Component ────────────────────────────── */

export interface RecentSearchesProps {
  searches: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
}

export const RecentSearches = memo(function RecentSearches({
  searches,
  onSelect,
  onRemove,
  onClear,
}: RecentSearchesProps) {
  if (searches.length === 0) return null;

  return (
    <div className="search-history-section" role="region" aria-label="Recent searches">
      <div className="search-history-header">
        <h3 className="search-history-title">Recent</h3>
        <button type="button" className="search-history-clear" onClick={onClear}>
          Clear all
        </button>
      </div>
      <div className="search-history-list">
        {searches.map((q) => (
          <div key={q} className="search-history-item">
            <button type="button" className="search-history-query" onClick={() => onSelect(q)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <span>{q}</span>
            </button>
            <button
              type="button"
              className="search-history-remove"
              onClick={() => onRemove(q)}
              aria-label={`Remove ${q} from recent searches`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─── Saved Searches Component ─────────────────────────────── */

export interface SavedSearchesProps {
  searches: SavedSearch[];
  onSelect: (s: SavedSearch) => void;
  onRemove: (id: string) => void;
}

export const SavedSearches = memo(function SavedSearches({
  searches,
  onSelect,
  onRemove,
}: SavedSearchesProps) {
  if (searches.length === 0) return null;

  return (
    <div className="search-history-section" role="region" aria-label="Saved searches">
      <div className="search-history-header">
        <h3 className="search-history-title">Saved</h3>
      </div>
      <div className="search-history-list">
        {searches.map((s) => (
          <div key={s.id} className="search-history-item">
            <button type="button" className="search-history-query" onClick={() => onSelect(s)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              <span>{s.label ?? s.query}</span>
            </button>
            <button
              type="button"
              className="search-history-remove"
              onClick={() => onRemove(s.id)}
              aria-label={`Remove saved search ${s.label}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─── Trending Searches Component ──────────────────────────── */

export interface TrendingSearchesProps {
  trending: TrendingSearch[];
  loading: boolean;
  onSelect: (query: string) => void;
}

export const TrendingSearches = memo(function TrendingSearches({
  trending,
  loading,
  onSelect,
}: TrendingSearchesProps) {
  if (loading || trending.length === 0) return null;

  return (
    <div className="search-history-section" role="region" aria-label="Trending searches">
      <div className="search-history-header">
        <h3 className="search-history-title">🔥 Trending</h3>
      </div>
      <div className="search-history-list">
        {trending.map((t) => (
          <button
            key={t.text}
            type="button"
            className="search-trending-item"
            onClick={() => onSelect(t.text)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span className="search-trending-text">{t.text}</span>
            <span className="search-trending-count">{t.count.toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

/* ─── Save Search Button ───────────────────────────────────── */

export interface SaveSearchButtonProps {
  query: string;
  onSave: (query: string) => void;
}

export const SaveSearchButton = memo(function SaveSearchButton({
  query,
  onSave,
}: SaveSearchButtonProps) {
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    onSave(query);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [query, onSave]);

  return (
    <button
      type="button"
      className={`save-search-btn ${saved ? 'save-search-btn-saved' : ''}`}
      onClick={handleSave}
      aria-label={saved ? 'Search saved' : 'Save this search'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
});
