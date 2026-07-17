'use client';

import { MiniLeaderboard, type LeaderboardCardEntry } from '@degenfeed/ui';
import { useAuth } from './AuthProvider';
import { useEffect, useState } from 'react';

interface ProtocolSummary {
  id: string;
  label: string;
  color: string;
  count: number;
}

interface FeedSidebarProps {
  trending?: { topic: string; count: number; score: number }[];
  protocolSummaries?: ProtocolSummary[];
  activeProtocolFilter?: string | null;
  onProtocolClick?: (id: string) => void;
}

const NETWORK_HINTS: Record<string, string> = {
  nostr: 'Decentralized notes',
  farcaster: 'Sufficiently decentralized',
  lens: 'User-owned graph',
  bluesky: 'AT Protocol',
  mastodon: 'Fediverse (GotoSocial)',
  threads: 'Meta AT Protocol',
  reddit: 'Crypto subreddits',
  rss: '30+ news sources',
};

export function FeedSidebar({
  trending,
  protocolSummaries,
  activeProtocolFilter,
  onProtocolClick,
}: FeedSidebarProps) {
  const { walletAddress, signOut, openSignIn } = useAuth();
  const items = trending ?? [];
  const protocols = protocolSummaries ?? [];
  const totalPosts = protocols.reduce((sum, p) => sum + p.count, 0);

  // Mini leaderboard state
  const [topCreators, setTopCreators] = useState<LeaderboardCardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchTop = async () => {
      try {
        const res = await fetch('/api/leaderboard/creators?period=weekly&limit=3');
        if (!res.ok) return;
        const data = (await res.json()) as { entries: LeaderboardCardEntry[] };
        if (!cancelled) setTopCreators(data.entries ?? []);
      } catch {
        // Silently fail — widget is optional
      }
    };
    void fetchTop();
    const interval = setInterval(fetchTop, 120_000); // refresh every 2 min
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search */}
      <a
        href="/home/all"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-[var(--color-card)] px-4 py-2.5 text-sm text-gray-400 backdrop-blur-xl transition-colors hover:border-degen-500/30 hover:text-[var(--color-fg)]"
      >
        <span className="text-lg text-degen-400">⌕</span>
        <span>Search posts, topics, tokens…</span>
      </a>

      {/* Wallet card */}
      {walletAddress ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/20 font-mono text-sm text-degen-400">
              {walletAddress.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </p>
              <p className="text-xs text-gray-500">Wallet connected</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-[var(--color-fg)]"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-degen-500/30 bg-gradient-to-br from-degen-500/15 to-degen-500/5 p-4 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-degen-400">◆</span>
            <p className="text-sm font-semibold text-[var(--color-fg)]">Read free, post with one click</p>
          </div>
          <p className="mb-3 text-xs text-gray-400">
            No account needed to browse. Sign in with a wallet to post across all networks.
          </p>
          <button type="button" onClick={openSignIn} className="btn-primary w-full text-sm">
            Sign in
          </button>
        </div>
      )}

      {/* Live protocol status */}
      <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Live networks</h2>
          <span className="text-[10px] text-gray-500">{totalPosts} posts</span>
        </div>
        {protocols.length === 0 ? (
          <p className="text-xs text-gray-500">Warming up…</p>
        ) : (
          <ul className="space-y-1">
            {protocols.slice(0, 8).map((p) => {
              const active = activeProtocolFilter === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onProtocolClick?.(p.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      active ? 'bg-white/5' : 'hover:bg-white/5'
                    }`}
                    title={NETWORK_HINTS[p.id] ?? p.label}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        active ? 'font-semibold text-[var(--color-fg)]' : 'text-gray-300'
                      }`}
                    >
                      {p.label}
                    </span>
                    <span className="text-xs tabular-nums text-gray-500">{p.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {activeProtocolFilter && (
          <button
            type="button"
            onClick={() => onProtocolClick?.(activeProtocolFilter)}
            className="mt-2 text-[11px] text-degen-400 hover:text-degen-300"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Trending */}
      <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
        <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Trending now</h2>
        {items.length === 0 ? (
          <p className="text-xs text-gray-500">Trending topics appear as you browse.</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 8).map((t) => (
              <a
                key={t.topic}
                href={`/home/${encodeURIComponent(t.topic.toLowerCase().replace(/\s+/g, '-'))}`}
                className="block rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
              >
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Trending</div>
                <div className="text-sm font-medium text-[var(--color-fg)]">{t.topic}</div>
                <div className="text-xs text-gray-500">{t.count} posts</div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Mini Leaderboard */}
      <MiniLeaderboard entries={topCreators} title="🏆 Top Creators" />

      {/* Premium CTA */}
      <div className="rounded-2xl border border-degen-500/20 bg-degen-500/5 p-4 backdrop-blur-xl">
        <h2 className="mb-1 text-sm font-bold text-[var(--color-fg)]">DegenFeed Premium</h2>
        <p className="mb-3 text-xs text-gray-400">
          Cross-posting, algorithm controls, analytics, and creator tools.
        </p>
        <a href="/premium" className="btn-primary block text-center text-sm">
          See plans
        </a>
      </div>

      <p className="px-2 text-[10px] text-gray-700">
        © {new Date().getFullYear()} DegenFeed · No account required to browse
      </p>
    </div>
  );
}
