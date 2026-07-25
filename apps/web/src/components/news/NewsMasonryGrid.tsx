'use client';

import type { StoryCluster } from './types';
import { sentimentColor, sentimentEmoji } from './types';

export function ClusterCard({ cluster, onClick }: { cluster: StoryCluster; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-purple-800/30 bg-gradient-to-r from-purple-950/30 to-gray-900/60 p-3 text-left transition-all hover:border-purple-500/30 hover:bg-purple-950/40"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-300 ring-1 ring-purple-500/20">
          📊 {cluster.storyCount} SOURCES
        </span>
        {cluster.aggregateSentiment && (
          <span
            className={`rounded-md border px-1.5 py-0.5 text-[9px] ${sentimentColor(cluster.aggregateSentiment)}`}
          >
            {sentimentEmoji(cluster.aggregateSentiment)}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-white line-clamp-2">{cluster.title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {cluster.topCategories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="rounded-full bg-gray-700/30 px-2 py-0.5 text-[8px] text-gray-400"
          >
            {cat}
          </span>
        ))}
      </div>
    </button>
  );
}

export function SentimentBar({
  sentiment,
}: {
  sentiment: { bullish: number; bearish: number; neutral: number } | undefined;
}) {
  if (!sentiment || Object.keys(sentiment).length === 0) return null;
  const total = sentiment.bullish + sentiment.bearish + sentiment.neutral;
  if (total === 0) return null;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
        <span>Market Sentiment</span>
        <span className="text-green-400">🟢 {Math.round((sentiment.bullish / total) * 100)}%</span>
        <span className="text-gray-400">⚪ {Math.round((sentiment.neutral / total) * 100)}%</span>
        <span className="text-red-400">🔴 {Math.round((sentiment.bearish / total) * 100)}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-700/50">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${(sentiment.bullish / total) * 100}%` }}
        />
        <div
          className="bg-gray-500 transition-all"
          style={{ width: `${(sentiment.neutral / total) * 100}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${(sentiment.bearish / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
