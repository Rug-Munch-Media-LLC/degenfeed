'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface IdentityResult {
  id: string;
  protocol: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
}

function protocolColor(p: string): string {
  const c: Record<string, string> = {
    nostr: '#8e30eb', farcaster: '#8a63d2', lens: '#abfe2c',
    bluesky: '#1185fe', threads: '#888', mastodon: '#6364ff', rss: '#ffa500',
  };
  return c[p] ?? '#666';
}

export function IdentityLinker({ onSignIn }: { onSignIn?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IdentityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/identity?q=${encodeURIComponent(q)}&limit=5`, { credentials: 'include' });
      const data = await res.json() as { data?: IdentityResult[] };
      setResults(data.data ?? []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleChange = useCallback((val: string) => {
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }, [doSearch]);

  const handleSelect = useCallback((_result: IdentityResult) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSignIn?.();
  }, [onSignIn]);

  return (
    <div className="relative">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">
        Link Another Identity
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search by handle, address, or name..."
          className="input pr-10"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">⟳</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-800 bg-gray-950 shadow-2xl">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => handleSelect(r)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: `${protocolColor(r.protocol)}22`, color: protocolColor(r.protocol) }}
              >
                {r.displayName?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{r.displayName || r.handle || r.id}</div>
                <div className="text-xs text-gray-500">{r.handle || r.protocol}</div>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${protocolColor(r.protocol)}22`, color: protocolColor(r.protocol) }}
              >
                {r.protocol}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-800 bg-gray-950 p-4 text-center text-xs text-gray-500">
          No identities found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
