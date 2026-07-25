'use client';

import { useState } from 'react';
import type { BadgeInfo } from './types';

const MOCK_BADGES: BadgeInfo[] = [
  {
    id: 'first_vote',
    name: 'First Vote',
    description: 'Voted in your first proposal',
    icon: '🗳️',
    category: 'voting',
    unlocked: true,
    awardedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'consistent_voter',
    name: 'Consistent Voter',
    description: 'Voted in 10 consecutive proposals',
    icon: '✅',
    category: 'voting',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'first_proposal',
    name: 'First Proposal',
    description: 'Created your first proposal',
    icon: '📝',
    category: 'proposal',
    unlocked: true,
    awardedAt: Date.now() - 86400000 * 15,
  },
  {
    id: 'passed_proposal',
    name: 'Passed!',
    description: 'Your proposal passed',
    icon: '🎉',
    category: 'proposal',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'treasurer',
    name: 'Treasurer',
    description: 'Executed a treasury transaction',
    icon: '💰',
    category: 'treasury',
    unlocked: true,
    awardedAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'quadratic_voter',
    name: 'Quadratic Voter',
    description: 'Participated in quadratic voting',
    icon: '📐',
    category: 'voting',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'recruiter',
    name: 'Recruiter',
    description: 'Invited 5+ members',
    icon: '📢',
    category: 'community',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'og',
    name: 'OG',
    description: 'Member for 6+ months',
    icon: '👴',
    category: 'community',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'mentor',
    name: 'Mentor',
    description: 'Someone delegated to you',
    icon: '🧑‍🏫',
    category: 'community',
    unlocked: true,
    awardedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'gasless_goat',
    name: 'Gasless Goat',
    description: 'Used gasless voting',
    icon: '🐐',
    category: 'special',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'early_voter',
    name: 'Early Voter',
    description: 'Voted within first hour of 5 proposals',
    icon: '⏰',
    category: 'voting',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'whale',
    name: 'Whale',
    description: 'Top 10% voting power',
    icon: '🐋',
    category: 'special',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'bipartisan',
    name: 'Bipartisan',
    description: "Voted FOR a proposal you didn't create",
    icon: '🤝',
    category: 'proposal',
    unlocked: true,
    awardedAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'grant_reviewer',
    name: 'Grant Reviewer',
    description: 'Reviewed 5 grant proposals',
    icon: '🔍',
    category: 'treasury',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'diplomat',
    name: 'Diplomat',
    description: 'Voted in 3+ different DAOs',
    icon: '🌐',
    category: 'community',
    unlocked: true,
    awardedAt: Date.now() - 86400000 * 20,
  },
  {
    id: 'swing_voter',
    name: 'Swing Voter',
    description: 'Cast deciding vote on a tie',
    icon: '⚖️',
    category: 'voting',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'quadratic_champion',
    name: 'Quadratic Champion',
    description: 'Used quadratic voting optimally',
    icon: '🏆',
    category: 'special',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'streamer',
    name: 'Streamer',
    description: 'Set up a streaming payment',
    icon: '🌊',
    category: 'treasury',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'constitutional',
    name: 'Constitutional',
    description: 'Created a constitutional proposal',
    icon: '📜',
    category: 'proposal',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'multi_sig_signer',
    name: 'Multi-sig Signer',
    description: 'Treasury signer',
    icon: '✍️',
    category: 'treasury',
    unlocked: false,
    awardedAt: null,
  },
  {
    id: 'helpful',
    name: 'Helpful',
    description: 'Answered 10+ forum questions',
    icon: '💡',
    category: 'community',
    unlocked: false,
    awardedAt: null,
  },
];

export function BadgeGrid() {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? MOCK_BADGES : MOCK_BADGES.filter((b) => b.unlocked);
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">Badge Collection</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">
            {MOCK_BADGES.filter((b) => b.unlocked).length}/{MOCK_BADGES.length}
          </span>
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] font-medium text-degen-400 hover:text-degen-300 transition-colors"
          >
            {showAll ? 'Earned only' : 'Show all'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {displayed.map((badge) => (
          <div
            key={badge.id}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-colors ${badge.unlocked ? 'bg-degen-500/10' : 'bg-[var(--color-border)]/30 opacity-50'}`}
            title={badge.description}
          >
            <span className={`text-xl ${badge.unlocked ? '' : 'grayscale'}`}>{badge.icon}</span>
            <span className="text-[8px] text-center font-medium text-[var(--color-muted)] leading-tight">
              {badge.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
