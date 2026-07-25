'use client';

import { useCallback, useState } from 'react';
import type { ChallengeDef, ChallengeState } from './types';

const CHALLENGE_POOL: ChallengeDef[] = [
  { id: 'vote-3-proposals', title: 'Vote in 3 Proposals', description: 'Cast your vote on 3 proposals this week', icon: '🗳️', target: 3 },
  { id: 'create-proposal', title: 'Create a Proposal', description: 'Create your first proposal', icon: '📝', target: 1 },
  { id: 'invite-friend', title: 'Invite a Friend', description: 'Invite someone to join the DAO', icon: '📢', target: 1 },
  { id: 'discuss-topics', title: 'Join the Discussion', description: 'Comment on 5 discussion threads', icon: '💬', target: 5 },
  { id: 'delegate-votes', title: 'Delegate', description: 'Delegate your voting power to someone', icon: '🔄', target: 1 },
  { id: 'treasury-vote', title: 'Treasury Voter', description: 'Vote on a treasury proposal', icon: '💰', target: 1 },
  { id: 'quadratic-vote', title: 'Go Quadratic', description: 'Cast a quadratic vote', icon: '📐', target: 1 },
  { id: 'streak-7', title: '7-Day Streak', description: 'Stay active for 7 days straight', icon: '🔥', target: 7 },
];

export function pickDailyChallenges(seed: string): ChallengeDef[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
  const shuffled = [...CHALLENGE_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) { hash = Math.abs(hash); const j = hash % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]; hash = ((hash >> 1) * 1103515245 + 12345) | 0; }
  return shuffled.slice(0, 3);
}

export function ChallengeList({ challenges }: { challenges: ChallengeDef[] }) {
  const [state, setState] = useState<ChallengeState>(() => ({ completed: [], progress: {}, allDone: false }));
  const updateProgress = useCallback((challengeId: string) => {
    setState((prev) => {
      const current = prev.progress[challengeId] ?? 0;
      const challenge = CHALLENGE_POOL.find((c) => c.id === challengeId);
      if (!challenge || prev.completed.includes(challengeId)) return prev;
      const newProgress = current + 1;
      const nowCompleted = newProgress >= challenge.target;
      return { ...prev, progress: { ...prev.progress, [challengeId]: newProgress }, completed: nowCompleted ? [...prev.completed, challengeId] : prev.completed, allDone: nowCompleted ? challenges.every((c) => [...prev.completed, challengeId].includes(c.id)) : prev.allDone };
    });
  }, [challenges]);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">⚡ Challenges</h2>
        {state.allDone && <span className="text-[10px] font-bold text-green-500">All done! 🎉</span>}
      </div>
      <div className="space-y-3">
        {challenges.map((challenge) => {
          const progress = state.progress[challenge.id] ?? 0;
          const completed = state.completed.includes(challenge.id);
          const pct = Math.min(100, Math.round((progress / challenge.target) * 100));
          return (
            <div key={challenge.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span>{challenge.icon}</span>
                  <div><div className={`font-medium ${completed ? 'text-green-500 line-through' : 'text-[var(--color-fg)]'}`}>{challenge.title}</div><div className="text-[10px] text-[var(--color-muted)]">{challenge.description}</div></div>
                </div>
                {!completed ? <button type="button" onClick={() => updateProgress(challenge.id)} className="shrink-0 rounded-lg bg-degen-500/20 px-2 py-1 text-[10px] font-medium text-degen-400 hover:bg-degen-500/30 transition-colors">+1</button> : <span className="text-sm">✅</span>}
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden"><div className={`h-full rounded-full transition-all duration-300 ${completed ? 'bg-green-500' : 'bg-degen-400'}`} style={{ width: `${pct}%` }} /></div>
              <div className="text-right text-[10px] text-[var(--color-muted)]">{progress}/{challenge.target}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]"><div className="text-center text-[10px] text-[var(--color-muted)]">Rewards: 🎖️ Badges + ⬆️ Reputation boost for completing challenges</div></div>
    </div>
  );
}
