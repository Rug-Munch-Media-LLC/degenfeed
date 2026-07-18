'use client';

import type { ProposalData, VoteChoice, VoteResults } from '@degenfeed/ui';
import { ErrorBoundary, ProposalModal, VotingPanel } from '@degenfeed/ui';
import type { CrossProtocolCommunity } from '@degenfeed/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../../components/AuthProvider';
import { useToast } from '../../../../components/Toast';

type Tab = 'active' | 'past';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  text: { label: 'Text', color: '#8b5cf6' },
  rule_change: { label: 'Rule Change', color: '#f59e0b' },
  mod_action: { label: 'Mod Action', color: '#ef4444' },
  treasury: { label: 'Treasury', color: '#10b981' },
};

interface ProposalWithMeta extends ProposalData {
  voteTotals?: VoteResults;
  yourVote?: VoteChoice | null;
  quorumPct?: number;
}

export default function ProposalsPage() {
  const params = useParams();
  const name = typeof params.name === 'string' ? params.name : '';
  const { openSignIn, ready } = useAuth();
  const { showToast } = useToast();

  const [community, setCommunity] = useState<CrossProtocolCommunity | null>(null);
  const [proposals, setProposals] = useState<ProposalWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_isMember, _setIsMember] = useState(false);

  // Fetch community data
  useEffect(() => {
    if (!name) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/community/${encodeURIComponent(name)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setError('Community not found');
          return;
        }
        const data = (await res.json()) as { community: CrossProtocolCommunity };
        if (!cancelled) setCommunity(data.community);
      } catch {
        if (!cancelled) setError('Failed to load community');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Fetch proposals
  const fetchProposals = useCallback(async () => {
    if (!name) return;
    try {
      const res = await fetch(`/api/community/${encodeURIComponent(name)}/proposals`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { data: ProposalData[] };

      // Fetch results for all proposals in parallel
      const results = await Promise.all(
        data.data.map(async (p) => {
          try {
            const r = await fetch(
              `/api/community/${encodeURIComponent(name)}/proposals/${p.id}/results`,
              { cache: 'no-store' },
            );
            if (!r.ok) return null;
            const rd = (await r.json()) as {
              results: { totals: VoteResults };
              meta: { quorumPct: number };
            };
            return {
              id: p.id,
              ...rd.results.totals,
              quorumPct: rd.meta.quorumPct,
            };
          } catch {
            return null;
          }
        }),
      );

      const enriched: ProposalWithMeta[] = data.data.map((p, i) => {
        const r = results[i];
        return {
          ...p,
          voteTotals: r ? { for: r.for, against: r.against, abstain: r.abstain } : undefined,
          quorumPct: r?.quorumPct,
        };
      });

      setProposals(enriched);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Filter proposals
  const activeProposals = proposals.filter((p) => p.status === 'active');
  const pastProposals = proposals.filter((p) => p.status !== 'active');

  const handleProposalCreated = useCallback(
    (_proposalId: string) => {
      setShowCreateModal(false);
      showToast('success', 'Proposal created!');
      setLoading(true);
      fetchProposals();
    },
    [fetchProposals, showToast],
  );

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mb-4 text-4xl">🔍</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Community Not Found</h1>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <Link href="/c" className="mt-6 inline-block btn-primary text-sm">
          Browse Communities
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/c/${name}`}
                className="text-sm text-gray-500 transition-colors hover:text-[var(--color-fg)]"
              >
                ← Back to {community?.displayName || 'community'}
              </Link>
              <h1 className="mt-1 text-xl font-bold text-[var(--color-fg)]">Proposals</h1>
              <p className="text-sm text-gray-500">
                Vote on community governance proposals
                {community && ` — ${community.memberCount.toLocaleString()} members`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!ready) {
                  openSignIn();
                  return;
                }
                setShowCreateModal(true);
              }}
              className="btn-primary text-sm"
            >
              + Create Proposal
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex border-b border-white/10">
          {(['active', 'past'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'text-[var(--color-fg)]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
              {tab === 'active' && activeProposals.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-degen-500/20 px-1.5 text-[10px] text-degen-400">
                  {activeProposals.length}
                </span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-degen-500" />
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-32" />
            ))}
          </div>
        )}

        {/* Active tab */}
        {!loading &&
          activeTab === 'active' &&
          (activeProposals.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-3 text-3xl">🗳️</div>
              <p className="text-gray-400">No active proposals</p>
              <p className="mt-1 text-xs text-gray-600">Create one to start the discussion!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeProposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} communityName={name} />
              ))}
            </div>
          ))}

        {/* Past tab */}
        {!loading &&
          activeTab === 'past' &&
          (pastProposals.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-3 text-3xl">📜</div>
              <p className="text-gray-400">No past proposals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pastProposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} communityName={name} />
              ))}
            </div>
          ))}

        {/* Create modal */}
        {showCreateModal && (
          <ProposalModal
            communityName={name}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleProposalCreated}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

// ─── Proposal Card ─────────────────────────────────────────────────

function ProposalCard({
  proposal,
  communityName,
}: {
  proposal: ProposalWithMeta;
  communityName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeMeta = TYPE_LABELS[proposal.type] ?? TYPE_LABELS.text;

  const statusColors: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: '#22c55e' },
    passed: { label: 'Passed', color: '#22c55e' },
    rejected: { label: 'Rejected', color: '#ef4444' },
    cancelled: { label: 'Cancelled', color: '#6b7280' },
  };

  const statusMeta = statusColors[proposal.status] ?? statusColors.cancelled;
  const totalVotes = proposal.voteTotals
    ? proposal.voteTotals.for + proposal.voteTotals.against + proposal.voteTotals.abstain
    : 0;

  return (
    <div className="card transition-all hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Meta row */}
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${typeMeta.color}22`, color: typeMeta.color }}
            >
              {typeMeta.label}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${statusMeta.color}22`,
                color: statusMeta.color,
              }}
            >
              {statusMeta.label}
            </span>
            {proposal.quorumPct !== undefined && (
              <span className="text-[11px] text-gray-500">{proposal.quorumPct}% quorum</span>
            )}
          </div>

          {/* Title */}
          <h3
            className="cursor-pointer text-sm font-semibold text-[var(--color-fg)] hover:text-degen-400"
            onClick={() => setExpanded(!expanded)}
          >
            {proposal.title}
          </h3>

          {/* Creator + time */}
          <p className="mt-1 text-xs text-gray-500">
            by {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)} &middot;{' '}
            {new Date(proposal.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Vote stats */}
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-[var(--color-fg)]">{totalVotes}</div>
          <div className="text-[11px] text-gray-500">votes</div>
        </div>
      </div>

      {/* Vote bars (always visible) */}
      {proposal.voteTotals && totalVotes > 0 && (
        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(proposal.voteTotals.for / totalVotes) * 100}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(proposal.voteTotals.against / totalVotes) * 100}%` }}
          />
          <div
            className="bg-gray-500 transition-all"
            style={{ width: `${(proposal.voteTotals.abstain / totalVotes) * 100}%` }}
          />
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <VotingPanel
            proposal={proposal}
            communityName={communityName}
            canVote={proposal.status === 'active'}
            initialTotals={proposal.voteTotals}
            initialYourVote={proposal.yourVote ?? null}
          />
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-gray-500 transition-colors hover:text-[var(--color-fg)]"
      >
        {expanded ? '▲ Show less' : '▼ View details & vote'}
      </button>
    </div>
  );
}
