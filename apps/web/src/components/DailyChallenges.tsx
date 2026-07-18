'use client';

import { useCallback, useEffect, useState } from 'react';

interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  target: number;
  icon: string;
  progress: number;
  completed: boolean;
}

interface ChallengesState {
  date: string;
  challenges: ChallengeItem[];
  allDone: boolean;
}

export function DailyChallenges() {
  const [state, setState] = useState<ChallengesState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/gamification/challenges/today', { credentials: 'include' });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = (await res.json()) as ChallengesState;
      setState(json);
    } catch {
      /* */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  if (loading || !state || state.challenges.length === 0) return null;

  const allDone = state.allDone;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">🎯 Today&apos;s Challenges</h3>
        {allDone && (
          <span className="text-[10px] font-medium text-degen-400 bg-degen-500/10 px-2 py-0.5 rounded-full">
            ✓ Complete
          </span>
        )}
      </div>

      <div className="space-y-3">
        {state.challenges.map((challenge) => {
          const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
          return (
            <div key={challenge.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{challenge.icon}</span>
                  <span
                    className={`text-xs font-medium ${challenge.completed ? 'text-degen-400 line-through' : 'text-[var(--color-fg)]'}`}
                  >
                    {challenge.title}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono ${challenge.completed ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                >
                  {challenge.progress}/{challenge.target}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-muted-bg)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${challenge.completed ? 'bg-degen-500' : 'bg-degen-500/50'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-center">
          <span className="text-xs text-degen-400 font-medium">🏆 Daily Champion! +5 XP bonus</span>
        </div>
      )}
    </div>
  );
}
