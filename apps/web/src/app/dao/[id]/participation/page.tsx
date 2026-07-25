'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getLevel, LEVELS, timeAgo, type ReputationRecord, type ActivityItem } from '@/components/dao-participation/types';
import { ReputationCard } from '@/components/dao-participation/ReputationCard';
import { BadgeGrid } from '@/components/dao-participation/BadgeGrid';
import { ParticipationLeaderboard } from '@/components/dao-participation/ParticipationLeaderboard';
import { ChallengeList, pickDailyChallenges } from '@/components/dao-participation/ChallengeList';
import { VotingStreak } from '@/components/dao-participation/VotingStreak';

const MOCK_REPUTATION: ReputationRecord = { userId: '0xabc…def', total: 485, level: 'core_member', lastActiveAt: Date.now() - 3600000, joinedAt: Date.now() - 86400000 * 120, consecutiveVotes: 7 };
const MOCK_ACTIVITY_ITEMS: ActivityItem[] = [
  { id: '1', type: 'vote_cast', display: '🔵 You voted FOR — Proposal #12: Fund Developer Grant', timestamp: Date.now() - 3600000 },
  { id: '2', type: 'proposal_created', display: '📝 builder.eth created — Proposal #13: Adjust Quorum', timestamp: Date.now() - 7200000 },
  { id: '3', type: 'delegation', display: '🔄 defi.eth delegated 5K votes to you', timestamp: Date.now() - 14400000 },
  { id: '4', type: 'treasury_tx', display: '💰 Treasury sent 5 ETH to 0x123... (Milestone #3)', timestamp: Date.now() - 28800000 },
  { id: '5', type: 'member_joined', display: '👋 newb.eth joined the DAO', timestamp: Date.now() - 57600000 },
  { id: '6', type: 'proposal_passed', display: '✅ Proposal #10: Marketing Budget — PASSED', timestamp: Date.now() - 86400000 },
];

export default function ParticipationPage({ params }: { params: { id: string } }) {
  const challenges = useMemo(() => pickDailyChallenges(new Date().toISOString().slice(0, 10)), []);
  const level = useMemo(() => getLevel(MOCK_REPUTATION.total), []);
  const nextLevel = useMemo(() => { const idx = LEVELS.findIndex((l) => l.id === level.id); return idx < LEVELS.length - 1 ? LEVELS[idx + 1]! : null; }, [level]);
  const progressToNext = nextLevel ? (MOCK_REPUTATION.total - level.minScore) / (nextLevel.minScore - level.minScore) : 1;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-black text-[var(--color-fg)]">Participation</h1><p className="text-sm text-[var(--color-muted)] mt-0.5">Your contribution score and DAO activity</p></div>
        <Link href={`/dao/${params.id}`} className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors">← Back to DAO</Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ReputationCard reputation={MOCK_REPUTATION} level={level} nextLevel={nextLevel} progressToNext={progressToNext} />
          <BadgeGrid />
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-fg)] mb-4">Recent Activity</h2>
            <div className="space-y-2">{MOCK_ACTIVITY_ITEMS.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 rounded-xl bg-[var(--color-bg)] px-3 py-2 text-sm">
                <span className="shrink-0">{item.display}</span><span className="shrink-0 ml-auto text-[10px] text-[var(--color-muted)] whitespace-nowrap">{timeAgo(item.timestamp)}</span>
              </div>
            ))}</div>
          </div>
        </div>
        <div className="space-y-6">
          <ParticipationLeaderboard />
          <ChallengeList challenges={challenges} />
          <VotingStreak />
        </div>
      </div>
    </div>
  );
}
