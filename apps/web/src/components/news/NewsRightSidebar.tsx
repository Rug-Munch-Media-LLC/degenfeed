'use client';

import { useState } from 'react';
import type { NewsStory, NewsMeta, StoryCluster } from './types';
import { copyToClipboard, formatTime, sentimentColor, sentimentEmoji } from './types';
import { ClusterCard } from './NewsMasonryGrid';

export function ShareModal({ story, onClose }: { story: NewsStory; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopyLink = async () => { await copyToClipboard(story.url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-white">Share</h3>
        <p className="mb-4 text-xs text-gray-400 line-clamp-1">{story.title}</p>
        <div className="space-y-2">
          <button type="button" onClick={handleCopyLink}
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700">
            <span>🔗</span>{copied ? 'Copied!' : 'Copy Link'}
          </button>
          <a href={`https://warpcast.com/~/compose?text=${encodeURIComponent(story.title)}&embeds%5B%5D=${encodeURIComponent(story.url)}`}
            target="_blank" rel="noopener"
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700">
            <span>🟣</span>Share to Farcaster
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(story.title)}&url=${encodeURIComponent(story.url)}`}
            target="_blank" rel="noopener"
            className="flex w-full items-center gap-3 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-gray-300 transition-colors hover:bg-gray-700">
            <span>🐦</span>Share to Twitter/X
          </a>
        </div>
        <button type="button" onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-800 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-700">Close</button>
      </div>
    </div>
  );
}

export function NewsRightSidebar({ stories, meta, clusters, onQueryChange, onClusterClick }: {
  stories: NewsStory[]; meta: NewsMeta | null; clusters: StoryCluster[];
  onQueryChange: (query: string) => void; onClusterClick?: (id: string) => void;
}) {
  const sentiment = meta?.sentiment;
  const total = sentiment ? sentiment.bullish + sentiment.bearish + sentiment.neutral : 0;
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  const handleClusterClick = (id: string) => {
    setExpandedCluster(expandedCluster === id ? null : id);
    onClusterClick?.(id);
  };

  return (
    <aside className="space-y-4">
      {/* Source count */}
      {meta && (
        <div className="rounded-xl border border-purple-800/20 bg-gradient-to-r from-purple-950/30 to-gray-900/60 p-3">
          <p className="text-xs text-purple-300">
            📡 <span className="font-bold">{meta.sourcedCount || meta.sourceCount || 200}</span> sources
          </p>
        </div>
      )}

      {/* Sentiment */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Sentiment</h3>
        {sentiment ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400">🟢 Bullish</span>
              <span className="font-mono text-green-400">{sentiment.bullish}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">⚪ Neutral</span>
              <span className="font-mono text-gray-400">{sentiment.neutral}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-400">🔴 Bearish</span>
              <span className="font-mono text-red-400">{sentiment.bearish}</span>
            </div>
            {total > 0 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-700/50">
                <div className="flex h-full">
                  <div className="bg-green-500" style={{ width: `${(sentiment.bullish / total) * 100}%` }} />
                  <div className="bg-gray-500" style={{ width: `${(sentiment.neutral / total) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(sentiment.bearish / total) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        ) : <p className="text-xs text-gray-500">Loading...</p>}
      </div>

      {/* Most covered */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">📰 Most Covered</h3>
        <div className="space-y-2">
          {stories.filter((s) => (s.alsoCoveredByCount ?? s.alsoCoveredBy.length - 1) > 0)
            .sort((a, b) => (b.alsoCoveredByCount ?? b.alsoCoveredBy.length - 1) - (a.alsoCoveredByCount ?? a.alsoCoveredBy.length - 1))
            .slice(0, 5).map((story) => (
              <a key={story.id} href={story.url} target="_blank" rel="noopener"
                className="group block rounded-lg p-2 text-xs transition-colors hover:bg-gray-800">
                <p className="font-medium text-white group-hover:text-degen-400 line-clamp-2">{story.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[9px] text-gray-500">
                  <span>{(story.alsoCoveredByCount ?? story.alsoCoveredBy.length - 1) + 1} sources</span>
                  <span>{formatTime(story.publishedAt)}</span>
                </div>
              </a>
            ))}
        </div>
      </div>

      {/* Story Clusters — "5 sources covering this story" */}
      {clusters.length > 0 && (
        <div className="rounded-xl border border-purple-800/20 bg-gray-900/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">📊 Story Clusters</h3>
          <div className="space-y-2">
            {clusters.slice(0, 5).map((c) => (
              <ClusterCard key={c.id} cluster={c} onClick={() => handleClusterClick(c.id)} />
            ))}
          </div>
          {expandedCluster && (
            <div className="mt-3 rounded-lg border border-purple-800/20 bg-purple-950/20 p-3">
              <p className="mb-2 text-[10px] text-gray-400">Related coverage:</p>
              {stories.filter((s) => clusters.find((c) => c.id === expandedCluster)
                ?.topCategories.some((ct) => s.niches?.includes(ct))
              ).slice(0, 3).map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noopener"
                  className="block rounded px-2 py-1 text-xs text-gray-300 hover:bg-purple-900/20 line-clamp-1">
                  📰 {s.source}: {s.title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Token mentions */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Token Mentions</h3>
        <div className="flex flex-wrap gap-1.5">
          {Array.from(new Map(stories.flatMap((s) => s.entities?.tokens || []).map((t) => [t, stories.filter((s) => s.entities?.tokens?.includes(t)).length])).entries())
            .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([token, count]) => (
              <button key={token} type="button" onClick={() => onQueryChange(token)}
                className="rounded-lg bg-yellow-500/10 px-2 py-1 text-xs font-mono text-yellow-400 ring-1 ring-yellow-500/20 transition-colors hover:bg-yellow-500/20">
                ${token}<span className="ml-1 text-[9px] text-gray-500">{count}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Trending topics */}
      {meta?.trending && meta.trending.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">🔥 Trending</h3>
          <div className="flex flex-wrap gap-1.5">
            {meta.trending.slice(0, 10).map((t) => (
              <button key={t.topic} type="button" onClick={() => onQueryChange(t.topic)}
                className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white">
                #{t.topic} <span className="ml-1 text-[9px] text-gray-500">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Creator newsletter CTA */}
      <div className="rounded-xl border border-degen-500/10 bg-gradient-to-br from-degen-500/5 to-gray-900/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-degen-400">📝 Creator Newsletters</h3>
        <p className="mb-3 text-xs text-gray-400">Publish your newsletter on DegenFeed or subscribe to creators.</p>
        <a href="/newsletter/create" className="mb-2 block rounded-lg bg-degen-500 px-3 py-2 text-center text-xs font-medium text-black hover:bg-degen-400">
          Create Newsletter →
        </a>
        <a href="/news/newsletter/issues" className="block rounded-lg bg-gray-800 px-3 py-2 text-center text-xs text-gray-300 hover:bg-gray-700">
          Browse Issues →
        </a>
      </div>

      {/* About */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">About</h3>
        <ul className="space-y-1 text-[10px] text-gray-400">
          <li>• {meta?.sourcedCount || meta?.sourceCount || '200+'} sources — RSS, Newsletters, Research</li>
          <li>• 4-layer dedup: URL → Content Hash → Title → Jaccard</li>
          <li>• Levenshtein similarity (&gt;85% = duplicate)</li>
          <li>• Story clustering groups related coverage</li>
          <li>• Breaking news boosted 3× in first hour</li>
        </ul>
      </div>
    </aside>
  );
}
