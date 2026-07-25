'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatTimeAgo, shortAddr } from '../../layout';

// ─── Types ─────────────────────────────────────────────────────────────

type VoteChoice = 'for' | 'against' | 'abstain';

interface VoteEntry {
  voter: string;
  voterAvatar: string;
  choice: VoteChoice;
  votingPower: number;
  reason?: string;
  timestamp: number;
  delegated: boolean;
}

interface ProposalDetail {
  id: string;
  title: string;
  type: 'standard' | 'treasury' | 'constitutional' | 'signaling';
  status: 'active' | 'passed' | 'failed' | 'executed';
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  totalVotingPower: number;
  endTime: number;
  createdTime: number;
  proposer: string;
  proposerAvatar: string;
  description: string;
  discussionLink?: string;
  // Treasury specific
  recipient?: string;
  amount?: string;
  token?: string;
  paymentType?: string;
  // Execution
  queuedTime?: number;
  executeTime?: number;
  txHash?: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

const MOCK_DETAIL: ProposalDetail = {
  id: '1',
  title: 'DIP-12: Fund Cross-Protocol Bridge Development',
  type: 'treasury',
  status: 'active',
  forVotes: 1_240_000,
  againstVotes: 320_000,
  abstainVotes: 80_000,
  quorum: 1_000_000,
  totalVotingPower: 5_200_000,
  endTime: Date.now() + 86400000 * 3,
  createdTime: Date.now() - 86400000 * 4,
  proposer: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b',
  proposerAvatar: '🧠',
  description: `## Summary

This proposal seeks funding for the development of a cross-protocol bridge that will enable seamless communication and asset transfer between Nostr, Farcaster, Lens, and Bluesky.

## Motivation

Currently, each protocol operates in isolation. Creators and users are locked into single ecosystems. A cross-protocol bridge would:

- Allow cross-posting with identity verification
- Enable unified reputation scoring
- Facilitate cross-protocol tipping
- Create a more connected web3 social graph

## Specification

The bridge will consist of:

1. **Relayer Nodes** — Infrastructure to watch events on each protocol
2. **Verification Contract** — Smart contract on Base to verify cross-protocol messages
3. **API Layer** — Unified REST API for querying cross-protocol data
4. **SDK** — Developer toolkit for integrating the bridge

## Budget Breakdown

| Item | Amount |
|------|--------|
| Smart Contract Development | 15 ETH |
| Relayer Infrastructure (6mo) | 20 ETH |
| API & SDK Development | 10 ETH |
| Security Audit | 5 ETH |
| **Total** | **50 ETH** |

## Timeline

- Month 1-2: Smart contract development and audit
- Month 3-4: Relayer nodes and API layer
- Month 5: SDK and documentation
- Month 6: Launch and monitoring`,
  discussionLink: 'https://forum.degenfeed.xyz/t/dip-12-cross-protocol-bridge',
  recipient: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b',
  amount: '50',
  token: 'ETH',
  paymentType: 'Milestone-based',
};

const MOCK_VOTES: VoteEntry[] = [
  {
    voter: '0x1234...5678',
    voterAvatar: '🐋',
    choice: 'for',
    votingPower: 450_000,
    reason:
      'Essential infrastructure for the ecosystem. The cross-protocol bridge will unlock massive value.',
    timestamp: Date.now() - 3600000 * 12,
    delegated: false,
  },
  {
    voter: '0xabcd...ef01',
    voterAvatar: '🦊',
    choice: 'for',
    votingPower: 280_000,
    reason: 'We need this yesterday. Great proposal, well scoped.',
    timestamp: Date.now() - 3600000 * 10,
    delegated: true,
  },
  {
    voter: '0x9876...5432',
    voterAvatar: '🐻',
    choice: 'against',
    votingPower: 190_000,
    reason: 'Too expensive. We should start with an MVP at 20 ETH max.',
    timestamp: Date.now() - 3600000 * 8,
    delegated: false,
  },
  {
    voter: '0x2468...1357',
    voterAvatar: '🦅',
    choice: 'for',
    votingPower: 150_000,
    reason: '',
    timestamp: Date.now() - 3600000 * 6,
    delegated: false,
  },
  {
    voter: '0x1357...2468',
    voterAvatar: '🤖',
    choice: 'abstain',
    votingPower: 80_000,
    reason: 'Need more technical details before deciding.',
    timestamp: Date.now() - 3600000 * 4,
    delegated: true,
  },
  {
    voter: '0x1122...3344',
    voterAvatar: '👾',
    choice: 'for',
    votingPower: 60_000,
    reason: "Let's build!",
    timestamp: Date.now() - 3600000 * 2,
    delegated: false,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function getStatusBadge(status: ProposalDetail['status']): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'text-blue-400 bg-blue-500/15' },
    passed: { label: 'Passed', color: 'text-degen-400 bg-degen-500/15' },
    failed: { label: 'Failed', color: 'text-red-400 bg-red-500/15' },
    executed: { label: 'Executed', color: 'text-purple-400 bg-purple-500/15' },
  };
  return map[status] ?? { label: 'Active', color: 'text-blue-400 bg-blue-500/15' };
}

function getTypeBadge(type: ProposalDetail['type']): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    standard: { label: 'Standard', color: 'text-blue-400 bg-blue-500/15' },
    treasury: { label: 'Treasury', color: 'text-degen-400 bg-degen-500/15' },
    constitutional: { label: 'Constitutional', color: 'text-purple-400 bg-purple-500/15' },
    signaling: { label: 'Signaling', color: 'text-amber-400 bg-amber-500/15' },
  };
  return map[type] ?? { label: 'Standard', color: 'text-blue-400 bg-blue-500/15' };
}

function formatCountdown(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${mins}m left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

// ─── Vote Bar (Horizontal) ────────────────────────────────────────────

function HorizontalVoteBar({
  forVotes,
  againstVotes,
  abstainVotes,
}: {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
}) {
  const total = forVotes + againstVotes + abstainVotes || 1;
  const f = (forVotes / total) * 100;
  const a = (againstVotes / total) * 100;
  const ab = (abstainVotes / total) * 100;

  return (
    <div
      className="flex h-8 w-full overflow-hidden rounded-lg bg-[var(--color-muted-bg)]"
      role="progressbar"
      aria-valuenow={forVotes}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className="flex h-full items-center justify-center bg-degen-500 text-[9px] font-bold text-black transition-all duration-700"
        style={{ width: `${f}%` }}
      >
        {f > 8 ? `${f.toFixed(0)}%` : ''}
      </div>
      <div
        className="flex h-full items-center justify-center bg-red-500/80 text-[9px] font-bold text-white transition-all duration-700"
        style={{ width: `${a}%` }}
      >
        {a > 8 ? `${a.toFixed(0)}%` : ''}
      </div>
      <div
        className="flex h-full items-center justify-center bg-[var(--color-muted)]/40 text-[9px] font-bold text-[var(--color-muted)] transition-all duration-700"
        style={{ width: `${ab}%` }}
      >
        {ab > 8 ? `${ab.toFixed(0)}%` : ''}
      </div>
    </div>
  );
}

// ─── Vote Bar Tally ────────────────────────────────────────────────────

function VoteTally({
  label,
  value,
  pct,
  color,
  bg,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-3 w-3 rounded-full ${bg}`} />
      <span className="w-16 text-xs font-medium text-[var(--color-fg)]">{label}</span>
      <div className="flex-1">
        <div className="h-3 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${bg}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="w-20 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
        {value.toLocaleString()}
      </span>
      <span className="w-12 text-right text-[10px] text-[var(--color-muted)]">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Simple Pie Chart ──────────────────────────────────────────────────

function VotePieChart({
  forVotes,
  againstVotes,
  abstainVotes,
}: {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
}) {
  const total = forVotes + againstVotes + abstainVotes || 1;
  const r = 36;
  const cx = 40;
  const cy = 40;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: forVotes, color: 'var(--color-accent)' },
    { value: againstVotes, color: '#ef4444' },
    { value: abstainVotes, color: 'var(--color-muted)' },
  ];

  let offset = 0;
  const paths = segments.map((seg, i) => {
    const pct = seg.value / total;
    const length = pct * circumference;
    const path = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth="12"
        strokeDasharray={`${length} ${circumference - length}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-700"
      />
    );
    offset += length;
    return path;
  });

  return (
    <svg
      viewBox="0 0 80 80"
      className="h-full w-full"
      role="img"
      aria-label="Vote distribution pie chart"
    >
      {paths}
    </svg>
  );
}

// ─── Vote Reason Card ──────────────────────────────────────────────────

function VoteCard({ vote }: { vote: VoteEntry }) {
  const choiceColors: Record<VoteChoice, { label: string; color: string; bg: string }> = {
    for: { label: 'FOR', color: 'text-degen-400', bg: 'bg-degen-500/15' },
    against: { label: 'AGAINST', color: 'text-red-400', bg: 'bg-red-500/15' },
    abstain: {
      label: 'ABSTAIN',
      color: 'text-[var(--color-muted)]',
      bg: 'bg-[var(--color-glass-border)]',
    },
  };
  const cc = choiceColors[vote.choice];

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-glass-border)] text-sm">
            {vote.voterAvatar}
          </span>
          <div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">{vote.voter}</div>
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-muted)]">
              <span>{vote.votingPower.toLocaleString()} votes</span>
              {vote.delegated && (
                <span className="rounded bg-amber-500/10 px-1 text-[8px] text-amber-400">
                  Delegated
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-[9px] font-bold ${cc.bg} ${cc.color}`}>
          {cc.label}
        </span>
      </div>
      {vote.reason && (
        <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">{vote.reason}</p>
      )}
      <div className="mt-2 text-[9px] font-mono text-[var(--color-muted)]">
        {formatTimeAgo(vote.timestamp)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE — Proposal Detail & Voting
// ══════════════════════════════════════════════════════════════════════

export default function ProposalDetailPage({
  params,
}: {
  params: { id: string; proposalId: string };
}) {
  const [proposal] = useState<ProposalDetail>(MOCK_DETAIL);
  const [votes] = useState<VoteEntry[]>(MOCK_VOTES);
  const [userVote, setUserVote] = useState<VoteChoice | null>(null);
  const [voteReason, setVoteReason] = useState('');
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');

  const statusInfo = getStatusBadge(proposal.status);
  const typeInfo = getTypeBadge(proposal.type);
  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

  const sortedVotes = useMemo(() => {
    const sorted = [...votes];
    if (sortBy === 'newest') sorted.sort((a, b) => b.timestamp - a.timestamp);
    if (sortBy === 'top') sorted.sort((a, b) => b.votingPower - a.votingPower);
    return sorted;
  }, [votes, sortBy]);

  // User's own voting power (mock)
  const myVotingPower = 12_500;
  const _canVote = proposal.status === 'active' && !voteSubmitted;
  const needsQuorum = total < proposal.quorum;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
          DAO
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--color-fg)]">{proposal.title.slice(0, 40)}...</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ═══ Main Content (spans 2 cols) ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <section
            aria-label="Proposal header"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2.5 py-0.5 text-[9px] font-semibold ${typeInfo.color}`}
              >
                {typeInfo.label}
              </span>
              <span
                className={`rounded-md px-2.5 py-0.5 text-[9px] font-semibold ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
              {proposal.status === 'active' && (
                <span className="ml-auto text-[10px] font-mono text-amber-400">
                  {formatCountdown(proposal.endTime)}
                </span>
              )}
            </div>

            <h1
              className="mb-4 text-xl font-black text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {proposal.title}
            </h1>

            <div className="mb-4 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{proposal.proposerAvatar}</span>
                <span className="font-mono">{shortAddr(proposal.proposer)}</span>
              </div>
              <span>·</span>
              <span>Created {formatTimeAgo(proposal.createdTime)}</span>
              {proposal.discussionLink && (
                <>
                  <span>·</span>
                  <a
                    href={proposal.discussionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-degen-400 hover:underline"
                  >
                    Discussion ↗
                  </a>
                </>
              )}
            </div>

            {/* Treasury details */}
            {proposal.type === 'treasury' && proposal.recipient && (
              <div className="mb-4 rounded-lg border border-degen-500/10 bg-degen-500/5 p-3">
                <div className="grid grid-cols-3 gap-3 text-[10px]">
                  <div>
                    <span className="text-[var(--color-muted)]">Recipient</span>
                    <div className="font-mono text-[var(--color-fg)]">
                      {shortAddr(proposal.recipient)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--color-muted)]">Amount</span>
                    <div className="font-mono text-degen-400">
                      {proposal.amount} {proposal.token}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--color-muted)]">Payment</span>
                    <div className="text-[var(--color-fg)]">{proposal.paymentType}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Description (rendered as markdown-like) */}
            <div className="prose prose-invert max-w-none">
              {proposal.description.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return (
                    <h2 key={i} className="mt-6 mb-3 text-sm font-bold text-[var(--color-fg)]">
                      {line.slice(3)}
                    </h2>
                  );
                }
                if (line.startsWith('### ')) {
                  return (
                    <h3 key={i} className="mt-4 mb-2 text-xs font-bold text-[var(--color-fg)]">
                      {line.slice(4)}
                    </h3>
                  );
                }
                if (line.startsWith('- ')) {
                  return (
                    <li key={i} className="text-xs text-[var(--color-muted)] ml-4">
                      {line.slice(2)}
                    </li>
                  );
                }
                if (line.startsWith('| ') && line.includes('|---')) return null; // skip markdown table header separator
                if (line.startsWith('| ')) {
                  const cells = line
                    .split('|')
                    .filter(Boolean)
                    .map((c) => c.trim());
                  return (
                    <div
                      key={i}
                      className="flex gap-4 text-[10px] text-[var(--color-muted)] border-b border-[var(--color-glass-border)] py-1"
                    >
                      {cells.map((cell, j) => (
                        <span key={j} className="flex-1">
                          {cell}
                        </span>
                      ))}
                    </div>
                  );
                }
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return (
                  <p key={i} className="text-xs leading-relaxed text-[var(--color-muted)]">
                    {line}
                  </p>
                );
              })}
            </div>
          </section>

          {/* ═══ Voting Section ═══ */}
          {proposal.status === 'active' && (
            <section
              aria-label="Voting"
              className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6"
            >
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Cast Your Vote</h2>

              {voteSubmitted ? (
                <div className="rounded-lg bg-degen-500/10 border border-degen-500/20 p-4 text-center">
                  <div className="mb-1 text-2xl">🗳️</div>
                  <p className="text-sm font-semibold text-degen-400">
                    You voted:{' '}
                    {userVote === 'for' ? 'FOR' : userVote === 'against' ? 'AGAINST' : 'ABSTAIN'} ✓
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)] mt-1">
                    Your voting power: {myVotingPower.toLocaleString()} votes
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setVoteSubmitted(false);
                      setUserVote(null);
                    }}
                    className="mt-3 rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Change Vote
                  </button>
                </div>
              ) : (
                <>
                  {/* Vote buttons */}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    {(['for', 'against', 'abstain'] as VoteChoice[]).map((choice) => {
                      const isSelected = userVote === choice;
                      const styles: Record<
                        VoteChoice,
                        { label: string; activeClass: string; inactiveClass: string }
                      > = {
                        for: {
                          label: 'FOR ✓',
                          activeClass:
                            'bg-degen-500 text-black border-degen-500 shadow-lg shadow-degen-500/20',
                          inactiveClass: 'border-degen-500/30 text-degen-400 hover:bg-degen-500/10',
                        },
                        against: {
                          label: 'AGAINST ✗',
                          activeClass:
                            'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20',
                          inactiveClass: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
                        },
                        abstain: {
                          label: 'ABSTAIN ○',
                          activeClass:
                            'bg-[var(--color-muted)] text-black border-[var(--color-muted)]',
                          inactiveClass:
                            'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:bg-[var(--color-overlay)]',
                        },
                      };
                      const s = styles[choice];

                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setUserVote(choice)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 text-sm font-bold transition-all active:scale-95 ${
                            isSelected ? s.activeClass : s.inactiveClass
                          }`}
                        >
                          <span className="text-base">{s.label}</span>
                          <span className="text-[9px] font-normal opacity-70">
                            {choice === 'for'
                              ? 'Support this proposal'
                              : choice === 'against'
                                ? 'Oppose this proposal'
                                : 'Skip this vote'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Vote reason */}
                  <div className="mb-4">
                    <label
                      htmlFor="vote-reason"
                      className="mb-1.5 block text-[10px] text-[var(--color-muted)]"
                    >
                      Vote Reason (optional)
                    </label>
                    <textarea
                      id="vote-reason"
                      value={voteReason}
                      onChange={(e) => setVoteReason(e.target.value)}
                      placeholder="Explain your vote... (markdown supported)"
                      rows={3}
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-[var(--color-muted)]">
                      Your voting power:{' '}
                      <strong className="text-[var(--color-fg)]">
                        {myVotingPower.toLocaleString()}
                      </strong>{' '}
                      votes
                    </div>
                    <button
                      type="button"
                      disabled={!userVote}
                      onClick={() => setShowVoteConfirm(true)}
                      className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                      Submit Vote
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ═══ Execution (for passed proposals) ═══ */}
          {(proposal.status === 'passed' || proposal.status === 'executed') && (
            <section
              aria-label="Execution"
              className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6"
            >
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                {proposal.status === 'passed' ? '⏳ Queue & Execute' : '✅ Execution Complete'}
              </h2>

              {proposal.status === 'passed' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--color-muted)]">Timelock Queue</span>
                      <span className="font-mono text-amber-400">~48 hours remaining</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: '60%' }} />
                    </div>
                    <p className="mt-2 text-[9px] text-[var(--color-muted)]">
                      Ready for execution in ~48 hours. Anyone can trigger execution after the
                      timelock expires.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl bg-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] cursor-not-allowed"
                  >
                    Execute — Available after timelock
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-degen-500/10 p-3 text-[10px]">
                    <span className="text-degen-400">✅</span>
                    <span className="text-[var(--color-fg)]">Proposal executed successfully</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                    <span>Transaction:</span>
                    <code className="font-mono text-degen-400">0x8f3c...7ad2</code>
                    <a href="#" className="text-degen-400 hover:underline">
                      View on Explorer ↗
                    </a>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ═══ Discussion / Votes ═══ */}
          <section
            aria-label="Votes and discussion"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">
                Votes & Discussion ({votes.length})
              </h2>
              <div className="flex gap-1 rounded-lg border border-[var(--color-glass-border)] p-0.5">
                {(['newest', 'top'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSortBy(s)}
                    className={`rounded-md px-2.5 py-1 text-[9px] font-medium transition-colors ${
                      sortBy === s
                        ? 'bg-degen-500/15 text-degen-400'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    {s === 'newest' ? 'Newest' : 'Top'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {sortedVotes.map((vote, i) => (
                <VoteCard key={i} vote={vote} />
              ))}
            </div>
          </section>
        </div>

        {/* ═══ Right Sidebar: Voting Analytics ═══ */}
        <div className="space-y-6">
          {/* Vote breakdown */}
          <section
            aria-label="Vote breakdown"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Vote Breakdown</h2>

            {/* Horizontal bar */}
            <div className="mb-4">
              <HorizontalVoteBar
                forVotes={proposal.forVotes}
                againstVotes={proposal.againstVotes}
                abstainVotes={proposal.abstainVotes}
              />
            </div>

            <div className="space-y-2.5">
              <VoteTally
                label="For"
                value={proposal.forVotes}
                pct={(proposal.forVotes / total) * 100}
                color="text-degen-400"
                bg="bg-degen-500"
              />
              <VoteTally
                label="Against"
                value={proposal.againstVotes}
                pct={(proposal.againstVotes / total) * 100}
                color="text-red-400"
                bg="bg-red-500"
              />
              <VoteTally
                label="Abstain"
                value={proposal.abstainVotes}
                pct={(proposal.abstainVotes / total) * 100}
                color="text-[var(--color-muted)]"
                bg="bg-[var(--color-muted)]"
              />
            </div>

            {/* Quorum */}
            <div className="mt-4 rounded-lg bg-[var(--color-glass-border)] p-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Total Votes</span>
                <span className="font-mono text-[var(--color-fg)]">{total.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Quorum Required</span>
                <span className={`font-mono ${needsQuorum ? 'text-amber-400' : 'text-degen-400'}`}>
                  {proposal.quorum.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${needsQuorum ? 'bg-amber-400' : 'bg-degen-500'}`}
                  style={{ width: `${Math.min((total / proposal.quorum) * 100, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[8px] text-[var(--color-muted)]">
                {needsQuorum
                  ? `Still needs ${(proposal.quorum - total).toLocaleString()} more votes`
                  : 'Quorum reached ✓'}
              </div>
            </div>
          </section>

          {/* Pie chart */}
          <section
            aria-label="Vote distribution"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Distribution</h2>
            <div className="flex items-center gap-4">
              <div className="h-32 w-32 shrink-0">
                <VotePieChart
                  forVotes={proposal.forVotes}
                  againstVotes={proposal.againstVotes}
                  abstainVotes={proposal.abstainVotes}
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="h-2 w-2 rounded-full bg-degen-500" />
                  <span className="text-[var(--color-fg)]">For</span>
                  <span className="ml-auto font-mono text-[var(--color-muted)]">
                    {((proposal.forVotes / total) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-[var(--color-fg)]">Against</span>
                  <span className="ml-auto font-mono text-[var(--color-muted)]">
                    {((proposal.againstVotes / total) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-muted)]" />
                  <span className="text-[var(--color-fg)]">Abstain</span>
                  <span className="ml-auto font-mono text-[var(--color-muted)]">
                    {((proposal.abstainVotes / total) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Top voters */}
          <section
            aria-label="Top voters"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Top Voters</h2>
            <div className="space-y-2">
              {[...votes]
                .sort((a, b) => b.votingPower - a.votingPower)
                .slice(0, 5)
                .map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="w-3 text-center text-[9px] font-bold text-[var(--color-muted)]">
                        {i + 1}
                      </span>
                      <span className="text-sm">{v.voterAvatar}</span>
                      <span className="font-mono text-[var(--color-fg)]">{v.voter}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-[var(--color-fg)]">
                        {v.votingPower.toLocaleString()}
                      </span>
                      <span
                        className={`rounded px-1 text-[8px] font-semibold ${
                          v.choice === 'for'
                            ? 'bg-degen-500/15 text-degen-400'
                            : v.choice === 'against'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-[var(--color-glass-border)] text-[var(--color-muted)]'
                        }`}
                      >
                        {v.choice === 'for' ? 'FOR' : v.choice === 'against' ? 'AGN' : 'ABS'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Delegation breakdown */}
          <section
            aria-label="Delegation breakdown"
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5"
          >
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Delegation</h2>
            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Direct votes</span>
                <span className="font-mono text-[var(--color-fg)]">
                  {votes.filter((v) => !v.delegated).length} voters
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Delegated votes</span>
                <span className="font-mono text-amber-400">
                  {votes.filter((v) => v.delegated).length} voters
                </span>
              </div>
              <div className="mt-3 rounded-lg bg-[var(--color-glass-border)] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted)]">Participation</span>
                  <span className="font-mono text-[var(--color-fg)]">
                    {((total / proposal.totalVotingPower) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                  <div
                    className="h-full rounded-full bg-degen-500"
                    style={{ width: `${(total / proposal.totalVotingPower) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ═══ Vote Confirm Modal ═══ */}
      {showVoteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm vote"
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl">
            <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">Confirm Vote</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              You are voting <strong className="uppercase">{userVote}</strong> with{' '}
              <strong>{myVotingPower.toLocaleString()}</strong> voting power.
            </p>

            <div className="mb-4 rounded-lg bg-[var(--color-glass-border)] p-3 text-[10px]">
              <div className="flex justify-between mb-1">
                <span className="text-[var(--color-muted)]">Gas fee</span>
                <span className="font-mono text-[var(--color-fg)]">~0.001 ETH (~$3)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">
                  Vote cannot be changed after confirmation
                </span>
                <span className="text-amber-400">⚠️</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowVoteConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingVote}
                onClick={() => {
                  setSubmittingVote(true);
                  setTimeout(() => {
                    setSubmittingVote(false);
                    setShowVoteConfirm(false);
                    setVoteSubmitted(true);
                  }, 1500);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-4 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-40 active:scale-95"
              >
                {submittingVote ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-30"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                    Confirming...
                  </span>
                ) : (
                  `Confirm ${userVote === 'for' ? 'FOR' : userVote === 'against' ? 'AGAINST' : 'ABSTAIN'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
