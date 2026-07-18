'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SocialProofData {
  activeReaders: number;
  joinedToday: number;
  recentCount: number;
}

export function SocialProofBar() {
  const [data, setData] = useState<SocialProofData | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProof = useCallback(async () => {
    try {
      const res = await fetch('/api/gamification/social-proof', { credentials: 'include' });
      if (!res.ok) return;
      const json = (await res.json()) as SocialProofData;
      setData(json);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchProof();
    intervalRef.current = setInterval(fetchProof, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchProof]);

  if (!data) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
      <span className="inline-flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-degen-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-degen-500" />
        </span>
        {data.activeReaders} reading now
      </span>
      <span>·</span>
      <span>{data.joinedToday} joined today</span>
    </div>
  );
}

/** Inline "X people are reading this" — attach to individual posts */
export function LiveReaderCount({ count }: { count?: number }) {
  const [live] = useState(() => count ?? Math.floor(Math.random() * 15 + 3));
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-degen-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-degen-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-degen-500" />
      </span>
      {live} reading now
    </span>
  );
}

/** "X people you follow liked this" */
export function FollowLiked({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-[10px] text-degen-400">
      {count} {count === 1 ? 'person' : 'people'} you follow liked this
    </span>
  );
}

/** Trending in your network label */
export function TrendingNetworkLabel({ topic }: { topic: string }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(topic)}`}
      className="inline-flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
    >
      <span>🔥</span>
      <span>Trending in your network</span>
    </Link>
  );
}

/** "X new posts since your last visit" — shown on refresh */
export function NewPostsSinceVisit({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-center py-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-degen-500/15 px-3 py-1 text-xs text-degen-400">
        <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
        {count} new posts since your last visit
      </span>
    </div>
  );
}

/** "Joined by X others today" on community cards */
export function JoinedTodayBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-[10px] text-degen-400">
      +{count} joined today
    </span>
  );
}
