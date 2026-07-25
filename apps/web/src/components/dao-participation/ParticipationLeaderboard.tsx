'use client';

import { useState } from 'react';
import type { LeaderboardEntry, TimePeriod } from './types';
import { getLevel, formatScore } from './types';

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { userId: 'vitalik.eth', rank: 1, score: 920, level: 'steward', change: 0, displayName: 'vitalik.eth' },
  { userId: '0xabc…def', rank: 2, score: 485, level: 'core_member', change: 1, displayName: 'you' },
  { userId: 'defi.eth', rank: 3, score: 412, level: 'core_member', change: -1, displayName: 'defi.eth' },
  { userId: 'builder.eth', rank: 4, score: 378, level: 'core_member', change: 3, displayName: 'builder.eth' },
  { userId: 'degensol.eth', rank: 5, score: 290, level: 'active_member', change: 0, displayName: 'degensol.eth' },
  { userId: 'nftmaxi.eth', rank: 6, score: 245, level: 'active_member', change: 2, displayName: 'nftmaxi.eth' },
  { userId: 'govnerd.eth', rank: 7, score: 210, level: 'active_member', change: -3, displayName: 'govnerd.eth' },
  { userId: 'newb.eth', rank: 8, score: 85, level: 'contributor', change: 5, displayName: 'newb.eth' },
  { userId: 'whale23.eth', rank: 9, score: 780, level: 'guardian', change: -2, displayName: 'whale23.eth' },
  { userId: 'delegator.eth', rank: 10, score: 630, level: 'guardian', change: 1, displayName: 'delegator.eth' },
];

const MOCK_MOST_ACTIVE = [{ userId: 'builder.eth', score: 142 }, { userId: 'defi.eth', score: 98 }, { userId: 'vitalik.eth', score: 87 }, { userId: '0xabc…def', score: 76 }, { userId: 'degensol.eth', score: 54 }];

export function ParticipationLeaderboard() {
  const [period, setPeriod] = useState<TimePeriod>('weekly');
  const myRank = MOCK_LEADERBOARD.find((e) => e.displayName === 'you');
  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Leaderboard</h2>
          <div className="flex gap-1">{(['weekly', 'monthly', 'alltime'] as TimePeriod[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${period === p ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)]'}`}>{p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : 'All'}</button>
          ))}</div>
        </div>
        <div className="space-y-1">
          {MOCK_LEADERBOARD.filter((e) => period === 'weekly' || (period === 'monthly' && e.score > 200) || period === 'alltime').slice(0, 8).map((entry) => { const isMe = entry.displayName === 'you'; const lvl = getLevel(entry.score);
            return <div key={entry.userId} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${isMe ? 'bg-degen-500/15 ring-1 ring-degen-500/30' : 'hover:bg-[var(--color-muted)]'}`}>
              <span className={`w-5 text-center text-xs font-bold ${entry.rank <= 3 ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}>#{entry.rank}</span>
              <span className="text-sm">{lvl.icon}</span>
              <span className={`flex-1 font-medium truncate ${isMe ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}>{entry.displayName}</span>
              <span className="text-xs font-bold tabular-nums text-[var(--color-muted)]">{formatScore(entry.score)}</span>
              <span className={`text-[10px] ${entry.change > 0 ? 'text-green-500' : entry.change < 0 ? 'text-red-500' : 'text-[var(--color-muted)]'}`}>{entry.change > 0 ? `↑${entry.change}` : entry.change < 0 ? `↓${Math.abs(entry.change)}` : '—'}</span>
            </div>; })}
        </div>
        {myRank && <div className="mt-3 pt-3 border-t border-[var(--color-border)]"><div className="text-center text-[10px] text-[var(--color-muted)]">Your rank: <span className="font-bold text-degen-400">#{myRank.rank}</span> · Score: <span className="font-bold">{myRank.score}</span></div></div>}
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-bold text-[var(--color-fg)] mb-3">🔥 Most Active This Week</h2>
        <div className="space-y-2">{MOCK_MOST_ACTIVE.map((member, i) => <div key={member.userId} className="flex items-center gap-2 text-sm"><span className="w-5 text-center text-xs font-bold text-[var(--color-muted)]">{i + 1}</span><span className="flex-1 truncate">{member.userId}</span><span className="text-xs font-bold tabular-nums text-[var(--color-muted)]">{member.score} pts</span></div>)}</div>
      </div>
    </>
  );
}
