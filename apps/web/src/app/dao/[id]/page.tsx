'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatTimeAgo, MOCK_DAO, shortAddr } from './layout';

// ─── Types ─────────────────────────────────────────────────────────────

interface Proposal {
  id: string;
  title: string;
  type: 'standard' | 'treasury' | 'constitutional' | 'signaling';
  status: 'active' | 'passed' | 'failed' | 'executed';
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  totalVotes: number;
  endTime: number;
  createdTime: number;
  proposer: string;
  proposerAvatar: string;
}

interface ActivityEntry {
  id: string;
  type: 'proposal_created' | 'vote_cast' | 'treasury_payment' | 'member_joined';
  message: string;
  timestamp: number;
  actor: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: 'DIP-12: Fund Cross-Protocol Bridge Development',
    type: 'treasury',
    status: 'active',
    forVotes: 1_240_000,
    againstVotes: 320_000,
    abstainVotes: 80_000,
    quorum: 1_000_000,
    totalVotes: 1_640_000,
    endTime: Date.now() + 86400000 * 3,
    createdTime: Date.now() - 86400000 * 4,
    proposer: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b',
    proposerAvatar: '🧠',
  },
  {
    id: '2',
    title: 'DIP-11: Update Quorum Threshold to 15%',
    type: 'constitutional',
    status: 'active',
    forVotes: 890_000,
    againstVotes: 610_000,
    abstainVotes: 45_000,
    quorum: 1_000_000,
    totalVotes: 1_545_000,
    endTime: Date.now() + 86400000 * 5,
    createdTime: Date.now() - 86400000 * 2,
    proposer: '0x8f3Cf7ad23Cd3CaDbD9735AFf958D2D3a8b8b8b8b',
    proposerAvatar: '⚡',
  },
  {
    id: '3',
    title: 'DIP-10: Community Grant for DegenFeed Mobile App',
    type: 'treasury',
    status: 'active',
    forVotes: 520_000,
    againstVotes: 480_000,
    abstainVotes: 120_000,
    quorum: 1_000_000,
    totalVotes: 1_120_000,
    endTime: Date.now() + 86400000 * 1.5,
    createdTime: Date.now() - 86400000 * 6,
    proposer: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    proposerAvatar: '🎨',
  },
  {
    id: '4',
    title: 'DIP-9: Tip Protocol Standardization v2',
    type: 'standard',
    status: 'passed',
    forVotes: 1_800_000,
    againstVotes: 150_000,
    abstainVotes: 30_000,
    quorum: 1_000_000,
    totalVotes: 1_980_000,
    endTime: Date.now() - 86400000 * 2,
    createdTime: Date.now() - 86400000 * 9,
    proposer: '0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    proposerAvatar: '🔧',
  },
  {
    id: '5',
    title: 'DIP-8: Should We Support Injective Chain?',
    type: 'signaling',
    status: 'passed',
    forVotes: 950_000,
    againstVotes: 400_000,
    abstainVotes: 60_000,
    quorum: 1_000_000,
    totalVotes: 1_410_000,
    endTime: Date.now() - 86400000 * 5,
    createdTime: Date.now() - 86400000 * 12,
    proposer: '0x9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    proposerAvatar: '🌐',
  },
  {
    id: '6',
    title: 'DIP-7: Reduce Voting Period to 5 Days',
    type: 'constitutional',
    status: 'failed',
    forVotes: 420_000,
    againstVotes: 780_000,
    abstainVotes: 50_000,
    quorum: 1_000_000,
    totalVotes: 1_250_000,
    endTime: Date.now() - 86400000 * 10,
    createdTime: Date.now() - 86400000 * 17,
    proposer: '0x2b3a4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
    proposerAvatar: '⏱️',
  },
];

const MOCK_ACTIVITIES: ActivityEntry[] = [
  {
    id: 'a1',
    type: 'proposal_created',
    message: 'New proposal created: DIP-12 — Fund Cross-Protocol Bridge',
    timestamp: Date.now() - 3600000 * 4,
    actor: '0x742d...8b8b',
  },
  {
    id: 'a2',
    type: 'vote_cast',
    message: 'alice.eth voted FOR proposal DIP-12',
    timestamp: Date.now() - 3600000 * 3,
    actor: 'alice.eth',
  },
  {
    id: 'a3',
    type: 'treasury_payment',
    message: 'Treasury paid 5 ETH to @builder.eth for Q3 grant',
    timestamp: Date.now() - 3600000 * 6,
    actor: 'dao.treasury.eth',
  },
  {
    id: 'a4',
    type: 'member_joined',
    message: 'New member joined: degen_trader.sol',
    timestamp: Date.now() - 86400000,
    actor: 'degen_trader.sol',
  },
  {
    id: 'a5',
    type: 'vote_cast',
    message: 'bob_onchain.eth voted AGAINST proposal DIP-11',
    timestamp: Date.now() - 86400000 * 1.5,
    actor: 'bob_onchain.eth',
  },
  {
    id: 'a6',
    type: 'proposal_created',
    message: 'New proposal created: DIP-11 — Update Quorum Threshold',
    timestamp: Date.now() - 86400000 * 2,
    actor: '0x8f3C...8b8b',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────

type FilterTab = 'active' | 'passed' | 'failed' | 'all';

function getProposalStatusInfo(
  status: Proposal['status'],
  forVotes: number,
  againstVotes: number,
  endTime: number,
) {
  if (status === 'passed')
    return { label: 'Passed', color: 'text-degen-400', bg: 'bg-degen-500/15' };
  if (status === 'failed') return { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/15' };
  if (status === 'executed')
    return { label: 'Executed', color: 'text-purple-400', bg: 'bg-purple-500/15' };

  // Active — determine if passing or failing
  const total = forVotes + againstVotes;
  if (total === 0) return { label: 'Active', color: 'text-amber-400', bg: 'bg-amber-500/15' };
  const ratio = forVotes / total;
  if (ratio >= 0.6) return { label: 'Passing', color: 'text-degen-400', bg: 'bg-degen-500/15' };
  if (ratio <= 0.4) return { label: 'Failing', color: 'text-red-400', bg: 'bg-red-500/15' };
  return { label: 'Close', color: 'text-amber-400', bg: 'bg-amber-500/15' };
}

function getTypeBadge(type: Proposal['type']): { label: string; color: string } {
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
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

function ProgressBar({
  forPct,
  againstPct,
  abstainPct,
  tall = false,
}: {
  forPct: number;
  againstPct: number;
  abstainPct: number;
  tall?: boolean;
}) {
  const total = forPct + againstPct + abstainPct || 1;
  const f = (forPct / total) * 100;
  const a = (againstPct / total) * 100;
  const ab = (abstainPct / total) * 100;

  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-[var(--color-muted-bg)] ${tall ? 'h-3' : 'h-2'}`}
      role="progressbar"
      aria-valuenow={forPct}
      aria-valuemin={0}
      aria-valuemax={forPct + againstPct + abstainPct}
    >
      <div
        className="h-full bg-degen-500 transition-all duration-500"
        style={{ width: `${f}%` }}
        title={`For: ${forPct.toLocaleString()}`}
      />
      <div
        className="h-full bg-red-500/70 transition-all duration-500"
        style={{ width: `${a}%` }}
        title={`Against: ${againstPct.toLocaleString()}`}
      />
      <div
        className="h-full bg-[var(--color-muted)]/40 transition-all duration-500"
        style={{ width: `${ab}%` }}
        title={`Abstain: ${abstainPct.toLocaleString()}`}
      />
    </div>
  );
}

function SimplePieChart({
  segments,
}: {
  segments: { value: number; color: string; label: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const paths = segments.map((seg) => {
    const pct = seg.value / total;
    const length = pct * circumference;
    const path = (
      <circle
        key={seg.label}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth="16"
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
      viewBox="0 0 100 100"
      className="h-full w-full"
      role="img"
      aria-label="Treasury token distribution pie chart"
    >
      {paths}
    </svg>
  );
}

// ─── Proposal Card ──────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const statusInfo = getProposalStatusInfo(
    proposal.status,
    proposal.forVotes,
    proposal.againstVotes,
    proposal.endTime,
  );
  const typeBadge = getTypeBadge(proposal.type);
  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const forPct = (proposal.forVotes / total) * 100;
  const againstPct = (proposal.againstVotes / total) * 100;
  const abstainPct = (proposal.abstainVotes / total) * 100;

  return (
    <Link
      href={`/dao/${MOCK_DAO.id}/proposals/${proposal.id}`}
      className="group block rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.04)]"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[9px] font-semibold ${typeBadge.color}`}>
            {typeBadge.label}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-[9px] font-semibold ${statusInfo.bg} ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--color-muted)]">
          {shortAddr(proposal.proposer)}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
        {proposal.title}
      </h3>

      <div className="mb-3">
        <ProgressBar
          forPct={proposal.forVotes}
          againstPct={proposal.againstVotes}
          abstainPct={proposal.abstainVotes}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3">
          <span className="text-degen-400 font-medium">
            {proposal.forVotes.toLocaleString()} FOR
          </span>
          <span className="text-red-400 font-medium">
            {proposal.againstVotes.toLocaleString()} AGAINST
          </span>
          <span className="text-[var(--color-muted)]">
            {proposal.abstainVotes.toLocaleString()} ABSTAIN
          </span>
        </div>
        <span className="font-mono text-[var(--color-muted)]">
          {formatCountdown(proposal.endTime)}
        </span>
      </div>
    </Link>
  );
}

// ─── Activity Row ───────────────────────────────────────────────────────

function ActivityRow({ activity }: { activity: ActivityEntry }) {
  const iconMap: Record<string, string> = {
    proposal_created: '📋',
    vote_cast: '🗳️',
    treasury_payment: '💰',
    member_joined: '👋',
  };

  return (
    <div className="flex items-start gap-2 py-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-glass-border)] text-[10px]">
        {iconMap[activity.type] || '📌'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-relaxed text-[var(--color-fg)]">{activity.message}</p>
        <span className="text-[9px] font-mono text-[var(--color-muted)]">
          {formatTimeAgo(activity.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE — DAO Overview Dashboard
// ══════════════════════════════════════════════════════════════════════

export default function DAOPage({ params }: { params: { id: string } }) {
  const [filter, setFilter] = useState<FilterTab>('active');
  const [proposals] = useState<Proposal[]>(MOCK_PROPOSALS);
  const [treasuryTokens] = useState(MOCK_DAO.treasuryTokens);

  const filteredProposals = useMemo(() => {
    if (filter === 'all') return proposals;
    return proposals.filter((p) => p.status === filter);
  }, [filter, proposals]);

  const tokenTotal = useMemo(
    () => treasuryTokens.reduce((s, t) => s + t.usdValue, 0),
    [treasuryTokens],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ═══ Hero Section ═══ */}
      <section aria-label="DAO overview" className="mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-degen-500/5 p-6 sm:p-8">
          {/* Glow effect */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-degen-500/5 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: DAO identity */}
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-degen-500/10 text-3xl">
                {MOCK_DAO.avatar}
              </span>
              <div>
                <div className="flex items-center gap-3">
                  <h1
                    className="text-2xl font-black text-[var(--color-fg)]"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {MOCK_DAO.name}
                  </h1>
                  <span className="flex h-2 w-2 rounded-full bg-degen-500" title="Active" />
                </div>
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
                  {MOCK_DAO.description}
                </p>

                {/* Social links */}
                <div className="mt-3 flex items-center gap-3">
                  <a
                    href={MOCK_DAO.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-xs text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-colors"
                    aria-label="Twitter"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href={MOCK_DAO.socialLinks.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-xs text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-colors"
                    aria-label="Discord"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.054C2.525 8.838 1.553 13.216 2.01 17.531a.082.082 0 00.031.057 19.9 19.9 0 005.986 3.027.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.027.077.077 0 00.032-.054c.528-4.764-.779-9.155-2.664-13.105a.063.063 0 00-.032-.054zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                    </svg>
                  </a>
                  <a
                    href={MOCK_DAO.socialLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-xs text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-colors"
                    aria-label="Telegram"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </a>
                  <a
                    href={MOCK_DAO.socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-xs text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-colors"
                    aria-label="Website"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Stats + Join button */}
            <div className="flex shrink-0 flex-col items-end gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-95"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Join DAO
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)]/50 p-3">
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Members
              </div>
              <div className="mt-0.5 text-lg font-black tabular-nums text-[var(--color-fg)]">
                {MOCK_DAO.memberCount.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)]/50 p-3">
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Treasury
              </div>
              <div className="mt-0.5 text-lg font-black tabular-nums text-degen-400">
                ${(MOCK_DAO.treasuryValueUsd / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)]/50 p-3">
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Active Proposals
              </div>
              <div className="mt-0.5 text-lg font-black tabular-nums text-[var(--color-fg)]">
                {MOCK_DAO.activeProposals}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)]/50 p-3">
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Total Proposals
              </div>
              <div className="mt-0.5 text-lg font-black tabular-nums text-[var(--color-fg)]">
                {MOCK_DAO.totalProposals}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ═══ Left: Proposals Feed (spans 2 cols) ═══ */}
        <section aria-label="Proposals" className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--color-fg)]">Proposals</h2>
            <Link
              href={`/dao/${params.id}/proposals/create`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-degen-500/15 px-3 py-1.5 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Proposal
            </Link>
          </div>

          {/* Filter tabs */}
          <div
            className="mb-4 flex gap-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1"
            role="tablist"
          >
            {(['active', 'passed', 'failed', 'all'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={filter === tab}
                onClick={() => setFilter(tab)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[10px] font-medium capitalize transition-all ${
                  filter === tab
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Proposals list */}
          <div className="space-y-2">
            {filteredProposals.length === 0 ? (
              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-8 text-center">
                <div className="mb-2 text-2xl">📋</div>
                <p className="text-xs text-[var(--color-muted)]">No proposals in this category</p>
              </div>
            ) : (
              filteredProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))
            )}
          </div>
        </section>

        {/* ═══ Right Sidebar: Treasury + Activity ═══ */}
        <div className="space-y-6">
          {/* Treasury Snapshot */}
          <section aria-label="Treasury Snapshot">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--color-fg)]">Treasury</h2>
                <span className="text-lg font-black tabular-nums text-degen-400">
                  ${tokenTotal.toLocaleString()}
                </span>
              </div>

              {/* Mini pie chart */}
              <div className="mb-4 flex items-center gap-4">
                <div className="h-24 w-24 shrink-0">
                  <SimplePieChart
                    segments={treasuryTokens.map((t) => ({
                      value: t.usdValue,
                      color: t.color,
                      label: t.symbol,
                    }))}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  {treasuryTokens.map((token) => (
                    <div
                      key={token.symbol}
                      className="flex items-center justify-between text-[10px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: token.color }}
                        />
                        <span className="font-semibold text-[var(--color-fg)]">{token.symbol}</span>
                      </div>
                      <div className="text-right">
                        <span className="tabular-nums text-[var(--color-muted)]">
                          {token.amount.toLocaleString()}
                        </span>
                        <span className="ml-1 text-[var(--color-muted)]/60">
                          (${token.usdValue.toLocaleString()})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent transactions */}
              <div className="border-t border-[var(--color-glass-border)] pt-3">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Recent Transactions
                </h3>
                <div className="space-y-2">
                  {MOCK_DAO.recentTransactions.slice(0, 3).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${tx.type === 'incoming' ? 'bg-degen-500' : 'bg-red-400'}`}
                        />
                        <span className="truncate text-[var(--color-fg)]">{tx.label}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`tabular-nums font-medium ${tx.type === 'incoming' ? 'text-degen-400' : 'text-red-400'}`}
                        >
                          {tx.type === 'incoming' ? '+' : '-'}
                          {tx.amount}
                        </span>
                        <span className="text-[var(--color-muted)]">
                          {formatTimeAgo(tx.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section aria-label="Recent Activity">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Activity</h2>
              <div className="divide-y divide-[var(--color-glass-border)]">
                {MOCK_ACTIVITIES.slice(0, 5).map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
