'use client';

import { getProtocolColor } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  id: string;
  protocol: string;
  author: { displayName: string; avatarUrl?: string };
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Search returned ${res.status}`);
      const data = (await res.json()) as { data?: SearchResult[]; meta?: { total: number } };
      setResults(data.data ?? []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Search failed');
    }
    setLoading(false);
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleChange = useCallback(
    (val: string) => {
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 300);
    },
    [doSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-2xl px-4">
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search posts, topics, tokens..."
            className="input h-12 pl-12 pr-12 text-base"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            {loading ? '⟳' : '⌕'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            ESC
          </button>
        </div>

        {loading && (
          <div className="mb-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full bg-gray-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-gray-800" />
                  <div className="h-3 w-full rounded bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="card border-red-900/50 bg-red-900/10 py-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {searched && !loading && !error && results.length === 0 && (
          <div className="card py-8 text-center">
            <p className="text-sm text-gray-500">No results for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  router.push(`/post/${encodeURIComponent(r.id)}`);
                  onClose();
                }}
                className="card-hover flex w-full items-start gap-3 p-3 text-left"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: `${getProtocolColor(r.protocol)}22`,
                    color: getProtocolColor(r.protocol),
                  }}
                >
                  {r.author.displayName[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-white truncate">{r.author.displayName}</span>
                    <span className="text-gray-500" style={{ color: getProtocolColor(r.protocol) }}>
                      {r.protocol}
                    </span>
                    <span className="ml-auto text-gray-600">{formatTime(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-400 line-clamp-2">{r.text}</p>
                  <div className="mt-1 flex gap-3 text-[10px] text-gray-600">
                    <span>♥ {r.metrics.likes}</span>
                    <span>↻ {r.metrics.reposts}</span>
                    <span>✎ {r.metrics.replies}</span>
                  </div>
                </div>
                {r.image && (
                  <Image
                    src={r.image}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                    unoptimized
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
