'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface StreakData {
  streak: number;
  maxStreak: number;
  flameTier: string;
  milestones: { bronze: boolean; silver: boolean; gold: boolean; diamond: boolean };
}

export function StreakFlame() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch('/api/gamification/streak', { credentials: 'include' });
      if (!res.ok) { setLoading(false); return; }
      const json = (await res.json()) as StreakData;
      setData(json);
    } catch { /* non-critical */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStreak();
    intervalRef.current = setInterval(fetchStreak, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStreak]);

  if (loading || !data || data.streak < 1) return null;

  const milestoneColors = getMilestoneColor(data.streak);

  return (
    <div
      className="group relative"
      title={`${data.streak}-day streak! Max: ${data.maxStreak}`}
    >
      <span
        className={`inline-flex cursor-default items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold transition-all hover:scale-105 ${milestoneColors.bg} ${milestoneColors.text}`}
      >
        <span className="animate-pulse">{data.flameTier || '🔥'}</span>
        <span>{data.streak}</span>
      </span>

      {/* Tooltip */}
      <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-xl opacity-0 transition-opacity group-hover:opacity-100">
        <div className="text-xs font-semibold text-[var(--color-fg)] mb-2">
          {data.flameTier} {data.streak}-day Streak
        </div>
        <div className="space-y-1">
          <MilestoneRow label="3 days" achieved={data.milestones.bronze} tier="bronze" />
          <MilestoneRow label="7 days" achieved={data.milestones.silver} tier="silver" />
          <MilestoneRow label="30 days" achieved={data.milestones.gold} tier="gold" />
          <MilestoneRow label="100 days" achieved={data.milestones.diamond} tier="diamond" />
        </div>
        <div className="mt-2 text-[10px] text-[var(--color-muted)]">
          Best: {data.maxStreak} days
        </div>
      </div>
    </div>
  );
}

function MilestoneRow({ label, achieved, tier }: { label: string; achieved: boolean; tier: string }) {
  const colors: Record<string, string> = {
    bronze: achieved ? 'text-amber-500' : 'text-gray-600',
    silver: achieved ? 'text-gray-300' : 'text-gray-600',
    gold: achieved ? 'text-yellow-400' : 'text-gray-600',
    diamond: achieved ? 'text-cyan-400' : 'text-gray-600',
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={achieved ? 'text-degen-400' : 'text-gray-600'}>
        {achieved ? '◆' : '◇'}
      </span>
      <span className={colors[tier] ?? 'text-gray-500'}>{label}</span>
    </div>
  );
}

function getMilestoneColor(streak: number): { bg: string; text: string } {
  if (streak >= 100) return { bg: 'bg-cyan-500/20', text: 'text-cyan-400' };
  if (streak >= 30) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
  if (streak >= 7) return { bg: 'bg-gray-300/20', text: 'text-gray-300' };
  if (streak >= 3) return { bg: 'bg-amber-500/15', text: 'text-amber-400' };
  return { bg: 'bg-orange-500/10', text: 'text-orange-400' };
}
