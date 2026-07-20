'use client';

import { useState } from 'react';
import { DEFAULT_EMOTES, type Emote } from './types';

interface StreamEmotesProps {
  onSelect?: (emote: Emote) => void;
}

export function StreamEmotes({ onSelect }: StreamEmotesProps) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? DEFAULT_EMOTES.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : DEFAULT_EMOTES;

  return (
    <div className="space-y-2">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search emotes..."
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-degen-500/40"
        aria-label="Search emotes"
      />

      {/* Emote grid */}
      <div className="grid grid-cols-6 gap-1" role="listbox" aria-label="Emotes">
        {filtered.map((emote) => (
          <button
            key={emote.id}
            type="button"
            onClick={() => onSelect?.(emote)}
            className="flex aspect-square items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10"
            title={emote.name}
            role="option"
            aria-label={emote.name}
          >
            {emote.src}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-[10px] text-white/30">No emotes found</p>
      )}
    </div>
  );
}

/* ─── Emote Autocomplete Suggestion ──────────────────────────── */

interface EmoteSuggestionProps {
  query: string;
  onSelect: (emote: Emote) => void;
}

export function EmoteSuggestion({ query, onSelect }: EmoteSuggestionProps) {
  const matches = DEFAULT_EMOTES.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase()) ||
    (e.category ?? '').includes(query.toLowerCase()),
  );

  if (matches.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 p-1">
      {matches.slice(0, 5).map((emote) => (
        <button
          key={emote.id}
          type="button"
          onClick={() => onSelect(emote)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/10"
        >
          <span className="text-base">{emote.src}</span>
          <span className="text-[9px] text-white/40">{emote.name}</span>
        </button>
      ))}
    </div>
  );
}
