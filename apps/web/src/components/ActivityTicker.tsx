'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ActivityEvent {
  type: string;
  actor: string;
  target?: string;
  at: number;
}

const ACTIVITY_ICONS: Record<string, string> = {
  post: '✍️',
  tip: '⚡',
  reply: '💬',
  join: '👋',
  like: '❤️',
};

const ACTIVITY_LABELS: Record<string, string> = {
  post: 'posted',
  tip: 'tipped',
  reply: 'replied',
  join: 'joined',
  like: 'liked',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function ActivityTicker() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/gamification/activity/recent', { credentials: 'include' });
      if (!res.ok) return;
      const json = (await res.json()) as { activities: ActivityEvent[] };
      setActivities(json.activities ?? []);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    intervalRef.current = setInterval(() => {
      if (!paused) fetchActivities();
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchActivities, paused]);

  if (activities.length === 0) return null;

  const displayActivities = activities.slice(0, 5);

  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <h3 className="text-xs font-semibold text-[var(--color-muted)] mb-2 uppercase tracking-wider">
        Live Activity
      </h3>
      <div className="space-y-1.5">
        {displayActivities.map((a, i) => (
          <div
            key={`${a.at}-${i}`}
            className="flex items-center gap-2 text-xs text-[var(--color-muted)] animate-slide-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span>{ACTIVITY_ICONS[a.type] ?? '•'}</span>
            <span className="truncate">
              <span className="font-medium text-[var(--color-fg)]">{a.actor.slice(0, 6)}...</span>{' '}
              {ACTIVITY_LABELS[a.type] ?? a.type}
              {a.target ? (
                <span className="text-[var(--color-muted)]"> {a.target.slice(0, 20)}</span>
              ) : null}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-[var(--color-muted)]">{timeAgo(a.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
