'use client';

import { useCallback, useEffect, useState } from 'react';

export type VoteChoice = 'for' | 'against' | 'abstain';
export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'cancelled';
export type ProposalType = 'text' | 'rule_change' | 'mod_action' | 'treasury';

export interface ProposalData {
  id: string;
  community: string;
  title: string;
  type: ProposalType;
  description: string;
  creator: string;
  createdAt: number;
  votingPeriod: number;
  endsAt: number;
  status: ProposalStatus;
  targetUser?: string;
}

export interface VoteResults {
  for: number;
  against: number;
  abstain: number;
}

export interface VotingPanelProps {
  proposal: ProposalData;
  communityName: string;
  /** If true, shows full voting UI. If false, shows read-only results. */
  canVote?: boolean;
  /** Pass in initial totals from server */
  initialTotals?: VoteResults;
  /** Pass in your existing vote choice */
  initialYourVote?: VoteChoice | null;
}

const TYPE_META: Record<ProposalType, { label: string; color: string }> = {
  text: { label: 'Text', color: '#8b5cf6' },
  rule_change: { label: 'Rule Change', color: '#f59e0b' },
  mod_action: { label: 'Mod Action', color: '#ef4444' },
  treasury: { label: 'Treasury', color: '#10b981' },
};

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || 'Less than 1m';
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function VoteBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--color-muted)]">{label}</span>
        <span className="text-[var(--color-fg)]">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function VotingPanel({
  proposal,
  communityName,
  canVote = false,
  initialTotals,
  initialYourVote = null,
}: VotingPanelProps) {
  const [yourVote, setYourVote] = useState<VoteChoice | null>(initialYourVote);
  const [totals, setTotals] = useState<VoteResults>(initialTotals ?? { for: 0, against: 0, abstain: 0 });
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(Math.max(0, proposal.endsAt - Date.now()));

  // Countdown timer
  useEffect(() => {
    if (proposal.status !== 'active') return;
    const interval = setInterval(() => {
      setTimeRemaining(Math.max(0, proposal.endsAt - Date.now()));
    }, 10_000);
    return () => clearInterval(interval);
  }, [proposal.endsAt, proposal.status]);

  const handleVote = useCallback(
    async (choice: VoteChoice) => {
      if (!canVote || voting) return;
      setVoting(true);
      setError('');
      try {
        const res = await fetch(
          `/api/community/${encodeURIComponent(communityName)}/proposals/${proposal.id}/vote`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ choice }),
          },
        );
        const data = (await res.json()) as {
          success?: boolean;
          totals?: VoteResults;
          yourVote?: VoteChoice;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? 'Failed to vote');
          return;
        }
        setYourVote(data.yourVote ?? choice);
        if (data.totals) setTotals(data.totals);
      } catch {
        setError('Network error');
      } finally {
        setVoting(false);
      }
    },
    [canVote, voting, communityName, proposal.id],
  );

  const totalVotes = totals.for + totals.against + totals.abstain;
  const typeMeta = TYPE_META[proposal.type] ?? TYPE_META.text;
  const isActive = proposal.status === 'active';

  return (
    <div className="card space-y-5">
      {/* Header: type badge + status */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${typeMeta.color}22`, color: typeMeta.color }}
          >
            {typeMeta.label}
          </span>
          <StatusBadge status={proposal.status} />
        </div>
        <span className="shrink-0 text-xs text-[var(--color-muted)]">
          by {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)}
        </span>
      </div>

      {/* Title & description */}
      <div>
        <h3 className="text-base font-bold text-[var(--color-fg)]">{proposal.title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{proposal.description}</p>
        {proposal.targetUser && (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Target: <span className="font-mono">{proposal.targetUser}</span>
          </p>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
        <span>
          Created {formatTimeAgo(proposal.createdAt)}
        </span>
        {isActive && (
          <span className={timeRemaining < 86_400_000 ? 'text-yellow-400' : ''}>
            {timeRemaining > 0 ? `${formatTimeRemaining(timeRemaining)} remaining` : 'Ending soon'}
          </span>
        )}
        <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
      </div>

      {/* Vote bars */}
      <div className="space-y-3">
        <VoteBar label="For" count={totals.for} total={totalVotes} color="#22c55e" />
        <VoteBar label="Against" count={totals.against} total={totalVotes} color="#ef4444" />
        <VoteBar label="Abstain" count={totals.abstain} total={totalVotes} color="#6b7280" />
      </div>

      {/* Vote actions */}
      {isActive && canVote && (
        <div>
          <div className="flex gap-2">
            {(['for', 'against', 'abstain'] as VoteChoice[]).map((choice) => {
              const colors: Record<VoteChoice, { active: string; default: string }> = {
                for: { active: 'border-green-500/50 bg-green-500/10 text-green-400', default: 'border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:text-[var(--color-muted)]' },
                against: { active: 'border-red-500/50 bg-red-500/10 text-red-400', default: 'border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:text-[var(--color-muted)]' },
                abstain: { active: 'border-gray-500/50 bg-gray-500/10 text-[var(--color-muted)]', default: 'border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:text-[var(--color-muted)]' },
              };
              const isSelected = yourVote === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleVote(choice)}
                  disabled={voting}
                  className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium capitalize transition-all disabled:opacity-50 ${
                    isSelected ? colors[choice].active : colors[choice].default
                  }`}
                >
                  {voting ? '…' : isSelected ? `✓ ${choice}` : choice}
                </button>
              );
            })}
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          {yourVote && (
            <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
              You voted <span className="font-medium text-[var(--color-fg)]">{yourVote}</span>
            </p>
          )}
        </div>
      )}

      {/* Read-only result for ended proposals */}
      {!isActive && proposal.status !== 'cancelled' && totalVotes > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center text-sm">
          {proposal.status === 'passed' ? (
            <span className="text-green-400">✓ Proposal Passed</span>
          ) : (
            <span className="text-red-400">✗ Proposal Rejected</span>
          )}
          {yourVote && (
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              — You voted <span className="font-medium text-[var(--color-fg)]">{yourVote}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const meta: Record<ProposalStatus, { label: string; color: string }> = {
    active: { label: 'Active', color: '#22c55e' },
    passed: { label: 'Passed', color: '#22c55e' },
    rejected: { label: 'Rejected', color: '#ef4444' },
    cancelled: { label: 'Cancelled', color: '#6b7280' },
  };
  const m = meta[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${m.color}22`, color: m.color }}
    >
      {m.label}
    </span>
  );
}
