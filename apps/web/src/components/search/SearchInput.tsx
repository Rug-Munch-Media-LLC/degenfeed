'use client';

import { getProtocolColor } from '@degenfeed/ui';
import { useCallback, useRef, useState } from 'react';

export interface AutocompleteSuggestion {
  text: string;
  type: 'query' | 'creator' | 'community' | 'coin' | 'trending';
  source?: string;
  score: number;
}

interface SearchInputProps {
  query: string;
  loading: boolean;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  onAutocompleteSelect: (suggestion: AutocompleteSuggestion) => void;
}

export function SearchInput({
  query,
  loading,
  onChange,
  onSubmit,
  onAutocompleteSelect,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>(
    [],
  );
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<AbortController | null>(null);

  const fetchAutocomplete = useCallback(async (q: string) => {
    if (q.length < 2) {
      setAutocompleteSuggestions([]);
      setShowAutocomplete(false);
      return;
    }
    if (autocompleteRef.current) {
      autocompleteRef.current.abort();
    }
    const controller = new AbortController();
    autocompleteRef.current = controller;
    try {
      const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { suggestions: AutocompleteSuggestion[] };
      setAutocompleteSuggestions(data.suggestions ?? []);
      setShowAutocomplete(data.suggestions?.length > 0);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
      fetchAutocomplete(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSubmit(val), 250);
    },
    [onChange, onSubmit, fetchAutocomplete],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onSubmit(query);
      }
    },
    [query, onSubmit],
  );

  return (
    <div className="relative">
      <label htmlFor="search-input" className="sr-only">
        Search
      </label>
      <input
        ref={inputRef}
        id="search-input"
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search posts, people, topics..."
        className="input h-12 pl-12 pr-4 text-base"
      />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
        {loading ? '⟳' : '⌕'}
      </span>
      {showAutocomplete && autocompleteSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
          {autocompleteSuggestions.map((s, i) => {
            const typeIcon =
              s.type === 'creator'
                ? '👤'
                : s.type === 'community'
                  ? '🏘️'
                  : s.type === 'coin'
                    ? '🪙'
                    : s.type === 'trending'
                      ? '🔥'
                      : '⌕';
            return (
              <button
                key={`${s.text}-${i}`}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-overlay)]"
                onClick={() => onAutocompleteSelect(s)}
              >
                <span className="text-base">{typeIcon}</span>
                <span className="flex-1 text-[var(--color-fg)]">{s.text}</span>
                {s.source && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                    style={{
                      backgroundColor: `${getProtocolColor(s.source)}18`,
                      color: getProtocolColor(s.source),
                    }}
                  >
                    {s.source}
                  </span>
                )}
                <span className="text-[10px] text-[var(--color-muted)]">{s.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
