'use client';

import type { NewsStory } from './types';

export function NewsTrendingBar({ stories }: { stories: NewsStory[] }) {
  const breaking = stories.filter((s) => s.isBreaking || s.velocity > 2)
    .sort((a, b) => b.velocity - a.velocity).slice(0, 8);
  if (breaking.length === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-red-900/40 bg-gradient-to-r from-red-950/50 via-red-900/25 to-red-950/50">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-2.5 scrollbar-thin scrollbar-thumb-red-900/30">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          Breaking
        </span>
        <div className="flex gap-2">
          {breaking.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener"
              className="group flex shrink-0 items-center gap-2 rounded-lg bg-red-950/40 px-3 py-1.5 text-xs text-gray-300 transition-all hover:bg-red-900/40 hover:text-white hover:shadow-[0_0_12px_rgba(239,68,68,0.2)]">
              {s.heroImage && (
                <span className="h-5 w-5 shrink-0 overflow-hidden rounded">
                  <img src={s.heroImage} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </span>
              )}
              <span className="line-clamp-1 max-w-[200px]">{s.title}</span>
              <span className="shrink-0 text-[10px] text-red-400/60">
                {(s.alsoCoveredByCount ?? s.alsoCoveredBy.length - 1) > 1 ? `+${s.alsoCoveredByCount ?? s.alsoCoveredBy.length - 1}` : ''}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
