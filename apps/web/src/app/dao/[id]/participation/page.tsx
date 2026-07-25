'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReputationRecord {
  userId: string;
  total: number;
  level: string;
  lastActiveAt: number;
  joinedAt: number;
  consecutiveVotes: number;
}

interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  awardedAt: number | null;
}

interface LeaderboardEntry {
  userId: string;
  rank: number;
  score: number;
  level: string;
  change: number;
  displayName?: string;
}

interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
}

interface ChallengeState {
  progress: Record<string, number>;
  completed: string[];
  allDone: boolean;
}

interface ActivityFeed {
  activities: Array<{
    id: string;
    type: string;
    display: string;
    actorLabel: string;
    timestamp: number;
  }>;
  total: number;
  page: number;
  hasMore: boolean;
}

type TimePeriod = 'weekly' | 'monthly' | 'alltime';

// ─── Level config ──────────────────────────────────────────────────────────

const LEVELS = [
  {
    id: 'contributor',
    label: 'Contributor',
    icon: '🥉',
    minScore: 0,
    maxScore: 100,
    color: '#CD7F32',
  },
  {
    id: 'active_member',
    label: 'Active Member',
    icon: '🥈',
    minScore: 101,
    maxScore: 300,
    color: '#C0C0C0',
  },
  {
    id: 'core_member',
    label: 'Core Member',
    icon: '🥇',
    minScore: 301,
    maxScore: 600,
    color: '#FFD700',
  },
  { id: 'guardian', label: 'Guardian', icon: '💎', minScore: 601, maxScore: 900, color: '#00CED1' },
  { id: 'steward', label: 'Steward', icon: '👑', minScore: 901, maxScore: 1000, color: '#8A2BE2' },
];

function getLevel(score: number) {
  for (const l of LEVELS) {
    if (score >= l.minScore && score <= l.maxScore) return l;
  }
  return LEVELS[0]!;
}

// ─── Daily challenge pool ──────────────────────────────────────────────────

const CHALLENGE_POOL: ChallengeDef[] = [
  {
    id: 'vote-3-proposals',
    title: 'Vote in 3 Proposals',
    description: 'Cast your vote on 3 proposals this week',
    icon: '🗳️',
    target: 3,
  },
  {
    id: 'create-proposal',
    title: 'Create a Proposal',
    description: 'Create your first proposal',
    icon: '📝',
    target: 1,
  },
  {
    id: 'invite-friend',
    title: 'Invite a Friend',
    description: 'Invite someone to join the DAO',
    icon: '📢',
    target: 1,
  },
  {
    id: 'discuss-topics',
    title: 'Join the Discussion',
    description: 'Comment on 5 discussion threads',
    icon: '💬',
    target: 5,
  },
  {
    id: 'delegate-votes',
    title: 'Delegate',
    description: 'Delegate your voting power to someone',
    icon: '🔄',
    target: 1,
  },
  {
    id: 'treasury-vote',
    title: 'Treasury Voter',
    description: 'Vote on a treasury proposal',
    icon: '💰',
    target: 1,
  },
  {
    id: 'quadratic-vote',
    title: 'Go Quadratic',
    description: 'Cast a quadratic vote',
    icon: '📐',
    target: 1,
  },
  {
    id: 'streak-7',
    title: '7-Day Streak',
    description: 'Stay active for 7 days straight',
    icon: '🔥',
    target: 7,
  },
];

function pickDailyChallenges(seed: string): ChallengeDef[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const shuffled = [...CHALLENGE_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = Math.abs(hash);
    const j = hash % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    hash = ((hash >> 1) * 1103515245 + 12345) | 0;
  }
  return shuffled.slice(0, 3);
}

// ─── Formatting helpers ───────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Mock Data ────────────────────────────────────────────────────────────

const MOCK_REPUTATION: ReputationRecord = {
  userId: '0xabc…def',
  total: 485,
  level: 'core_member',
  lastActiveAt: Date.now() - 3600000,
  joinedAt: Date.now() - 86400000 * 120,
  consecutiveVotes: 7,
};

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

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    userId: 'vitalik.eth',
    rank: 1,
    score: 920,
    level: 'steward',
    change: 0,
    displayName: 'vitalik.eth',
  },
  { userId: '0xabc…def', rank: 2, score: 485, level: 'core_member', change: 1, displayName: 'you' },
  {
    userId: 'defi.eth',
    rank: 3,
    score: 412,
    level: 'core_member',
    change: -1,
    displayName: 'defi.eth',
  },
  {
    userId: 'builder.eth',
    rank: 4,
    score: 378,
    level: 'core_member',
    change: 3,
    displayName: 'builder.eth',
  },
  {
    userId: 'degensol.eth',
    rank: 5,
    score: 290,
    level: 'active_member',
    change: 0,
    displayName: 'degensol.eth',
  },
  {
    userId: 'nftmaxi.eth',
    rank: 6,
    score: 245,
    level: 'active_member',
    change: 2,
    displayName: 'nftmaxi.eth',
  },
  {
    userId: 'govnerd.eth',
    rank: 7,
    score: 210,
    level: 'active_member',
    change: -3,
    displayName: 'govnerd.eth',
  },
  {
    userId: 'newb.eth',
    rank: 8,
    score: 85,
    level: 'contributor',
    change: 5,
    displayName: 'newb.eth',
  },
  {
    userId: 'whale23.eth',
    rank: 9,
    score: 780,
    level: 'guardian',
    change: -2,
    displayName: 'whale23.eth',
  },
  {
    userId: 'delegator.eth',
    rank: 10,
    score: 630,
    level: 'guardian',
    change: 1,
    displayName: 'delegator.eth',
  },
];

const MOCK_MOST_ACTIVE = [
  { userId: 'builder.eth', score: 142 },
  { userId: 'defi.eth', score: 98 },
  { userId: 'vitalik.eth', score: 87 },
  { userId: '0xabc…def', score: 76 },
  { userId: 'degensol.eth', score: 54 },
];

// ─── Main Component ───────────────────────────────────────────────────────

export default function ParticipationPage({ params }: { params: { id: string } }) {
  const daoId = params.id;
  const today = new Date().toISOString().slice(0, 10);
  const challenges = useMemo(() => pickDailyChallenges(today), [today]);
  const [challengeState, setChallengeState] = useState<ChallengeState>(() => ({
    completed: [],
    progress: {},
    allDone: false,
  }));
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<TimePeriod>('weekly');
  const [showAllBadges, setShowAllBadges] = useState(false);

  const level = useMemo(() => getLevel(MOCK_REPUTATION.total), []);
  const nextLevel = useMemo(() => {
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    return idx < LEVELS.length - 1 ? LEVELS[idx + 1]! : null;
  }, [level]);

  const progressToNext = nextLevel
    ? (MOCK_REPUTATION.total - level.minScore) / (nextLevel.minScore - level.minScore)
    : 1;

  const myRank = MOCK_LEADERBOARD.find((e) => e.displayName === 'you');

  // Filter badges to show
  const displayedBadges = showAllBadges ? MOCK_BADGES : MOCK_BADGES.filter((b) => b.unlocked);

  // ─── Challenge handlers ────────────────────────────────────────────
  const updateProgress = useCallback(
    (challengeId: string) => {
      setChallengeState((prev) => {
        const current = prev.progress[challengeId] ?? 0;
        const challenge = CHALLENGE_POOL.find((c) => c.id === challengeId);
        if (!challenge || prev.completed.includes(challengeId)) return prev;

        const newProgress = current + 1;
        const nowCompleted = newProgress >= challenge.target;
        return {
          ...prev,
          progress: { ...prev.progress, [challengeId]: newProgress },
          completed: nowCompleted ? [...prev.completed, challengeId] : prev.completed,
          allDone: nowCompleted
            ? challenges.every((c) => [...prev.completed, challengeId].includes(c.id))
            : prev.allDone,
        };
      });
    },
    [challenges],
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ══ Header ══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-fg)]">Participation</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Your contribution score and DAO activity
          </p>
        </div>
        <Link
          href={`/dao/${daoId}`}
          className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
        >
          ← Back to DAO
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ══ LEFT COLUMN: My Stats + Badges ══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Reputation Card ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                  Reputation Score
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black tabular-nums" style={{ color: level.color }}>
                    {MOCK_REPUTATION.total}
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">/ 1000</span>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-4xl">{level.icon}</span>
                <span className="text-xs font-bold mt-0.5" style={{ color: level.color }}>
                  {level.label}
                </span>
              </div>
            </div>

            {/* Level progress bar */}
            {nextLevel && (
              <div className="mb-4">
                <div className="flex justify-between text-[10px] text-[var(--color-muted)] mb-1">
                  <span>{level.label}</span>
                  <span>Next: {nextLevel.label}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round(progressToNext * 100))}%`,
                      backgroundColor: level.color,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <StatBox label="Votes" value="23" />
              <StatBox label="Proposals" value="3" sub="1 passed" />
              <StatBox
                label="Streak"
                value={`${MOCK_REPUTATION.consecutiveVotes}`}
                sub="consecutive"
              />
              <StatBox
                label="Joined"
                value={formatDate(MOCK_REPUTATION.joinedAt)}
                sub="4 months ago"
              />
            </div>
          </div>

          {/* ── Badge Collection ────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Badge Collection</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted)]">
                  {MOCK_BADGES.filter((b) => b.unlocked).length}/{MOCK_BADGES.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllBadges(!showAllBadges)}
                  className="text-[10px] font-medium text-degen-400 hover:text-degen-300 transition-colors"
                >
                  {showAllBadges ? 'Earned only' : 'Show all'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {displayedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-colors ${
                    badge.unlocked ? 'bg-degen-500/10' : 'bg-[var(--color-border)]/30 opacity-50'
                  }`}
                  title={badge.description}
                >
                  <span className={`text-xl ${badge.unlocked ? '' : 'grayscale'}`}>
                    {badge.icon}
                  </span>
                  <span className="text-[8px] text-center font-medium text-[var(--color-muted)] leading-tight">
                    {badge.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Activity Feed ──────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-fg)] mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {[
                {
                  type: 'vote_cast',
                  display: '🔵 You voted FOR — Proposal #12: Fund Developer Grant',
                  ts: Date.now() - 3600000,
                },
                {
                  type: 'proposal_created',
                  display: '📝 builder.eth created — Proposal #13: Adjust Quorum',
                  ts: Date.now() - 7200000,
                },
                {
                  type: 'delegation',
                  display: '🔄 defi.eth delegated 5K votes to you',
                  ts: Date.now() - 14400000,
                },
                {
                  type: 'treasury_tx',
                  display: '💰 Treasury sent 5 ETH to 0x123... (Milestone #3)',
                  ts: Date.now() - 28800000,
                },
                {
                  type: 'member_joined',
                  display: '👋 newb.eth joined the DAO',
                  ts: Date.now() - 57600000,
                },
                {
                  type: 'proposal_passed',
                  display: '✅ Proposal #10: Marketing Budget — PASSED',
                  ts: Date.now() - 86400000,
                },
              ].map((item) => (
                <div
                  key={item.ts}
                  className="flex items-start gap-2.5 rounded-xl bg-[var(--color-bg)] px-3 py-2 text-sm"
                >
                  <span className="shrink-0">{item.display}</span>
                  <span className="shrink-0 ml-auto text-[10px] text-[var(--color-muted)] whitespace-nowrap">
                    {timeAgo(item.ts)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN: Leaderboard + Challenges + DAO Stats ══ */}
        <div className="space-y-6">
          {/* ── Leaderboard ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Leaderboard</h2>
              <div className="flex gap-1">
                {(['weekly', 'monthly', 'alltime'] as TimePeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setLeaderboardPeriod(p)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${
                      leaderboardPeriod === p
                        ? 'bg-degen-500/20 text-degen-400'
                        : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)]'
                    }`}
                  >
                    {p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              {MOCK_LEADERBOARD.filter(
                (e) =>
                  leaderboardPeriod === 'weekly' ||
                  (leaderboardPeriod === 'monthly' && e.score > 200) ||
                  leaderboardPeriod === 'alltime',
              )
                .slice(0, 8)
                .map((entry) => {
                  const isMe = entry.displayName === 'you';
                  const lvl = getLevel(entry.score);
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                        isMe
                          ? 'bg-degen-500/15 ring-1 ring-degen-500/30'
                          : 'hover:bg-[var(--color-muted)]'
                      }`}
                    >
                      <span
                        className={`w-5 text-center text-xs font-bold ${
                          entry.rank <= 3 ? 'text-degen-400' : 'text-[var(--color-muted)]'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <span className="text-sm">{lvl.icon}</span>
                      <span
                        className={`flex-1 font-medium truncate ${isMe ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
                      >
                        {entry.displayName}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-[var(--color-muted)]">
                        {formatScore(entry.score)}
                      </span>
                      <span
                        className={`text-[10px] ${
                          entry.change > 0
                            ? 'text-green-500'
                            : entry.change < 0
                              ? 'text-red-500'
                              : 'text-[var(--color-muted)]'
                        }`}
                      >
                        {entry.change > 0
                          ? `↑${entry.change}`
                          : entry.change < 0
                            ? `↓${Math.abs(entry.change)}`
                            : '—'}
                      </span>
                    </div>
                  );
                })}
            </div>

            {myRank && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-center text-[10px] text-[var(--color-muted)]">
                  Your rank: <span className="font-bold text-degen-400">#{myRank.rank}</span> ·
                  Score: <span className="font-bold">{myRank.score}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Most Active This Week ───────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-fg)] mb-3">
              🔥 Most Active This Week
            </h2>
            <div className="space-y-2">
              {MOCK_MOST_ACTIVE.map((member, i) => (
                <div key={member.userId} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center text-xs font-bold text-[var(--color-muted)]">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{member.userId}</span>
                  <span className="text-xs font-bold tabular-nums text-[var(--color-muted)]">
                    {member.score} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Challenges ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">⚡ Challenges</h2>
              {challengeState.allDone && (
                <span className="text-[10px] font-bold text-green-500">All done! 🎉</span>
              )}
            </div>
            <div className="space-y-3">
              {challenges.map((challenge) => {
                const progress = challengeState.progress[challenge.id] ?? 0;
                const completed = challengeState.completed.includes(challenge.id);
                const pct = Math.min(100, Math.round((progress / challenge.target) * 100));

                return (
                  <div key={challenge.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{challenge.icon}</span>
                        <div>
                          <div
                            className={`font-medium ${completed ? 'text-green-500 line-through' : 'text-[var(--color-fg)]'}`}
                          >
                            {challenge.title}
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)]">
                            {challenge.description}
                          </div>
                        </div>
                      </div>
                      {!completed && (
                        <button
                          type="button"
                          onClick={() => updateProgress(challenge.id)}
                          className="shrink-0 rounded-lg bg-degen-500/20 px-2 py-1 text-[10px] font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
                        >
                          +1
                        </button>
                      )}
                      {completed && <span className="text-sm">✅</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          completed ? 'bg-green-500' : 'bg-degen-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-right text-[10px] text-[var(--color-muted)]">
                      {progress}/{challenge.target}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="text-center text-[10px] text-[var(--color-muted)]">
                Rewards: 🎖️ Badges + ⬆️ Reputation boost for completing challenges
              </div>
            </div>
          </div>

          {/* ── Quadratic Voting Power ──────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-fg)] mb-3">📐 Quadratic Voting</h2>
            <div className="text-center py-2">
              <div className="text-3xl font-black tabular-nums text-degen-400">√10,000</div>
              <div className="text-lg font-bold text-[var(--color-fg)]">= 100 votes</div>
              <div className="text-[10px] text-[var(--color-muted)] mt-1">
                Your voting power with quadratic weighting
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[var(--color-bg)] p-2.5 text-center">
                <div className="text-sm font-bold text-[var(--color-fg)]">10K</div>
                <div className="text-[9px] text-[var(--color-muted)]">Token Balance</div>
              </div>
              <div className="rounded-xl bg-[var(--color-bg)] p-2.5 text-center">
                <div className="text-sm font-bold text-[var(--color-fg)]">100</div>
                <div className="text-[9px] text-[var(--color-muted)]">Voting Credits</div>
              </div>
            </div>
          </div>

          {/* ── DAO Stats ───────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-bold text-[var(--color-fg)] mb-3">📊 DAO Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted)]">Proposal Pass Rate</span>
                <span className="font-bold text-green-500">78%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted)]">Voter Turnout</span>
                <span className="font-bold">42%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted)]">Avg Votes/Proposal</span>
                <span className="font-bold">156</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-muted)]">Active Members</span>
                <span className="font-bold">342</span>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[10px] text-[var(--color-muted)] text-center">
                  Voter Turnout Over Time
                </div>
                {/* Simple bar chart */}
                <div className="flex items-end gap-1.5 h-16 mt-2">
                  {[35, 42, 38, 55, 48, 62, 58, 45, 52, 60, 42, 47].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          i === 6 ? 'bg-degen-400' : 'bg-degen-400/40'
                        }`}
                        style={{ height: `${v}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[8px] text-[var(--color-muted)] mt-1">
                  <span>Jan</span>
                  <span>Dec</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat box sub-component ─────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg)] p-2.5">
      <div className="text-xs font-bold text-[var(--color-fg)]">{value}</div>
      <div className="text-[9px] text-[var(--color-muted)]">{label}</div>
      {sub && <div className="text-[8px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}
