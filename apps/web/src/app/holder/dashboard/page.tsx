'use client';

/**
 * Holder Dashboard — For token holders
 *
 * Features:
 * - Portfolio: all creator coins held
 * - Performance: P&L per coin
 * - Upcoming unlocks: vesting schedule for held coins
 * - Community: access to token-gated content
 * - Voting: active proposals
 */

import Link from 'next/link';
import { useState } from 'react';

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════

interface HeldCoin {
  symbol: string;
  name: string;
  chain: string;
  balance: number;
  valueUsd: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
  locked: number;
  unlocking: number;
  unlocked: number;
  nextUnlockDate?: string;
  thumbnail: string;
  graduated: boolean;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'failed' | 'pending';
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  endsAt: string;
  coin: string;
  voted?: 'for' | 'against';
}

interface GatedContent {
  id: string;
  title: string;
  type: 'video' | 'post' | 'stream' | 'chat';
  coin: string;
  minHold: number;
  thumbnail: string;
  unlocked: boolean;
}

// ══════════════════════════════════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════════════════════════════════

const MOCK_PORTFOLIO: HeldCoin[] = [
  {
    symbol: 'ALICE',
    name: 'Alice Coin',
    chain: 'base',
    balance: 500000,
    valueUsd: 625,
    entryPrice: 0.001,
    currentPrice: 0.00125,
    pnl: 125,
    pnlPercent: 25,
    allocation: 15,
    locked: 0,
    unlocking: 0,
    unlocked: 500000,
    thumbnail: 'A',
    graduated: false,
  },
  {
    symbol: 'BOB',
    name: 'Bob Protocol',
    chain: 'solana',
    balance: 1200000,
    valueUsd: 3840,
    entryPrice: 0.004,
    currentPrice: 0.0032,
    pnl: -960,
    pnlPercent: -20,
    allocation: 35,
    locked: 800000,
    unlocking: 200000,
    unlocked: 200000,
    nextUnlockDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    thumbnail: 'B',
    graduated: true,
  },
  {
    symbol: 'CRE8',
    name: 'Creator Token',
    chain: 'base',
    balance: 250000,
    valueUsd: 525,
    entryPrice: 0.0018,
    currentPrice: 0.0021,
    pnl: 75,
    pnlPercent: 16.7,
    allocation: 8,
    locked: 0,
    unlocking: 0,
    unlocked: 250000,
    thumbnail: 'C',
    graduated: false,
  },
  {
    symbol: 'DEGEN',
    name: 'DegenFeed Token',
    chain: 'solana',
    balance: 80000,
    valueUsd: 4160,
    entryPrice: 0.045,
    currentPrice: 0.052,
    pnl: 560,
    pnlPercent: 15.6,
    allocation: 22,
    locked: 0,
    unlocking: 0,
    unlocked: 80000,
    thumbnail: 'D',
    graduated: true,
  },
  {
    symbol: 'EVE',
    name: 'Eve Finance',
    chain: 'base',
    balance: 750000,
    valueUsd: 2340,
    entryPrice: 0.0035,
    currentPrice: 0.00312,
    pnl: -285,
    pnlPercent: -10.9,
    allocation: 20,
    locked: 500000,
    unlocking: 150000,
    unlocked: 100000,
    nextUnlockDate: new Date(Date.now() + 86400000 * 14).toISOString(),
    thumbnail: 'E',
    graduated: true,
  },
];

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'p1',
    title: 'Reduce Creator Fee to 0.5%',
    description:
      'Proposal to lower the creator fee from 1.0% to 0.5% to encourage more trading volume.',
    status: 'active',
    votesFor: 245,
    votesAgainst: 98,
    totalVotes: 343,
    endsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    coin: 'ALICE',
  },
  {
    id: 'p2',
    title: 'Treasury Grant: Marketing Fund',
    description: 'Allocate 2M tokens from treasury for a 3-month marketing campaign.',
    status: 'active',
    votesFor: 189,
    votesAgainst: 67,
    totalVotes: 256,
    endsAt: new Date(Date.now() + 86400000 * 4).toISOString(),
    coin: 'BOB',
  },
  {
    id: 'p3',
    title: 'Extend Vesting Cliff',
    description: 'Extend the creator vesting cliff from 30 days to 60 days.',
    status: 'passed',
    votesFor: 312,
    votesAgainst: 89,
    totalVotes: 401,
    endsAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    coin: 'ALICE',
  },
  {
    id: 'p4',
    title: 'Add Liquidity Incentives',
    description: 'Allocate 500K tokens as LP incentives for the next quarter.',
    status: 'failed',
    votesFor: 134,
    votesAgainst: 201,
    totalVotes: 335,
    endsAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    coin: 'EVE',
  },
];

const MOCK_GATED_CONTENT: GatedContent[] = [
  {
    id: 'g1',
    title: 'Alice AMA Recording',
    type: 'video',
    coin: 'ALICE',
    minHold: 100000,
    thumbnail: '🎥',
    unlocked: true,
  },
  {
    id: 'g2',
    title: 'Bob Community Call',
    type: 'stream',
    coin: 'BOB',
    minHold: 500000,
    thumbnail: '📺',
    unlocked: false,
  },
  {
    id: 'g3',
    title: 'Early Access: CRE8 Roadmap',
    type: 'post',
    coin: 'CRE8',
    minHold: 100000,
    thumbnail: '📄',
    unlocked: true,
  },
  {
    id: 'g4',
    title: 'Degen Holder Chat',
    type: 'chat',
    coin: 'DEGEN',
    minHold: 50000,
    thumbnail: '💬',
    unlocked: true,
  },
  {
    id: 'g5',
    title: 'Eve Strategy Session',
    type: 'stream',
    coin: 'EVE',
    minHold: 1000000,
    thumbnail: '📺',
    unlocked: false,
  },
];

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════

/* ── Portfolio Card ──────────────────────────────── */
function PortfolioCard({ coin }: { coin: HeldCoin }) {
  return (
    <Link
      href={`/coins/${coin.symbol.toLowerCase()}`}
      className="block rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.04)]"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-sm font-bold text-degen-400">
          {coin.thumbnail}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-[var(--color-fg)]">${coin.symbol}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${coin.graduated ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}
            >
              {coin.graduated ? 'Graduated' : 'Bonding'}
            </span>
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">{coin.name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            ${coin.valueUsd.toLocaleString()}
          </div>
          <div
            className={`text-[9px] font-semibold ${coin.pnl >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            {coin.pnl >= 0 ? '+' : ''}
            {coin.pnlPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Mini details */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div>
          <span className="text-[var(--color-muted)]">Balance</span>
          <p className="font-mono text-[var(--color-fg)]">{formatCompact(coin.balance)}</p>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Entry</span>
          <p className="font-mono text-[var(--color-fg)]">${coin.entryPrice.toFixed(4)}</p>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Current</span>
          <p className="font-mono text-[var(--color-fg)]">${coin.currentPrice.toFixed(4)}</p>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">P&L</span>
          <p
            className={`font-mono font-semibold ${coin.pnl >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            {coin.pnl >= 0 ? '+' : ''}${Math.abs(coin.pnl).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Vesting bar */}
      {coin.locked > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--color-glass-border)]">
          <div className="flex items-center justify-between text-[8px] text-[var(--color-muted)] mb-1">
            <span>🔒 Vesting</span>
            <span>
              {formatCompact(coin.unlocked)} unlocked /{' '}
              {formatCompact(coin.locked + coin.unlocking + coin.unlocked)} total
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-degen-400"
              style={{
                width: `${(coin.unlocked / (coin.locked + coin.unlocking + coin.unlocked)) * 100}%`,
              }}
            />
          </div>
          {coin.nextUnlockDate && (
            <p className="mt-1 text-[7px] text-degen-400">
              Next unlock: {new Date(coin.nextUnlockDate).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

/* ── Proposal Card ───────────────────────────────── */
function ProposalCard({
  proposal,
  onVote,
}: {
  proposal: Proposal;
  onVote: (id: string, vote: 'for' | 'against') => void;
}) {
  const total = proposal.votesFor + proposal.votesAgainst;
  const forPct = total > 0 ? (proposal.votesFor / total) * 100 : 50;
  const isEnded = new Date(proposal.endsAt) < new Date();
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
            proposal.status === 'active'
              ? 'bg-degen-500/15 text-degen-400'
              : proposal.status === 'passed'
                ? 'bg-green-500/15 text-green-400'
                : proposal.status === 'failed'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {proposal.status === 'active'
            ? '🟢 Active'
            : proposal.status === 'passed'
              ? '✅ Passed'
              : proposal.status === 'failed'
                ? '❌ Failed'
                : '⏳ Pending'}
        </span>
        <span className="text-[8px] text-[var(--color-muted)]">${proposal.coin}</span>
      </div>
      <h4 className="text-xs font-semibold text-[var(--color-fg)] mb-1">{proposal.title}</h4>
      <p className="text-[9px] text-[var(--color-muted)] mb-2">{proposal.description}</p>

      {/* Vote bar */}
      <div className="h-2 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
        <div className="h-full rounded-full bg-degen-400" style={{ width: `${forPct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[8px] text-[var(--color-muted)] mt-1">
        <span className="text-degen-400">
          {proposal.votesFor} for ({forPct.toFixed(0)}%)
        </span>
        <span className="text-red-400">
          {proposal.votesAgainst} against ({(100 - forPct).toFixed(0)}%)
        </span>
      </div>

      {/* Vote actions */}
      {proposal.status === 'active' && !proposal.voted && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onVote(proposal.id, 'for')}
            className="flex-1 rounded-lg bg-degen-500/15 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-all"
          >
            Vote For
          </button>
          <button
            type="button"
            onClick={() => onVote(proposal.id, 'against')}
            className="flex-1 rounded-lg bg-red-500/15 py-1.5 text-[9px] font-semibold text-red-400 hover:bg-red-500/25 transition-all"
          >
            Vote Against
          </button>
        </div>
      )}
      {proposal.voted && (
        <p className="mt-2 text-[8px] text-degen-400">
          ✓ You voted {proposal.voted === 'for' ? 'For' : 'Against'}
        </p>
      )}
      {!isEnded && proposal.status === 'active' && (
        <p className="mt-1 text-[8px] text-[var(--color-muted)]">
          Ends {new Date(proposal.endsAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

/* ── Gated Content Card ──────────────────────────── */
function GatedContentCard({ item }: { item: GatedContent }) {
  return (
    <div
      className={`rounded-xl border p-3 transition-all ${item.unlocked ? 'border-[var(--color-glass-border)] bg-[var(--color-card)]' : 'border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/50 opacity-60'}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{item.thumbnail}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-[var(--color-fg)]">{item.title}</span>
            {item.unlocked && (
              <span className="rounded bg-degen-500/15 px-1 py-0.5 text-[7px] text-degen-400">
                Unlocked
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[8px] text-[var(--color-muted)]">
            <span>${item.coin}</span>
            <span>·</span>
            <span>{item.type}</span>
            {!item.unlocked && (
              <span>
                · Need {formatCompact(item.minHold)} ${item.coin}
              </span>
            )}
          </div>
        </div>
        {item.unlocked && (
          <Link
            href={`/coins/${item.coin.toLowerCase()}/community`}
            className="rounded-lg bg-degen-500/15 px-2 py-1 text-[8px] font-medium text-degen-400 hover:bg-degen-500/25 transition-colors"
          >
            Access →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Portfolio Summary ───────────────────────────── */
function PortfolioSummary({ coins }: { coins: HeldCoin[] }) {
  const totalValue = coins.reduce((s, c) => s + c.valueUsd, 0);
  const totalPnl = coins.reduce((s, c) => s + c.pnl, 0);
  const totalPnlPct = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
  const winners = coins.filter((c) => c.pnl >= 0).length;
  const losers = coins.filter((c) => c.pnl < 0).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="text-[10px] text-[var(--color-muted)]">Portfolio Value</div>
        <div className="text-xl font-black tabular-nums text-[var(--color-fg)]">
          ${totalValue.toLocaleString()}
        </div>
        <div
          className={`text-[10px] font-semibold mt-1 ${totalPnl >= 0 ? 'text-degen-400' : 'text-red-400'}`}
        >
          {totalPnl >= 0 ? '+' : ''}
          {totalPnlPct.toFixed(1)}% all time
        </div>
      </div>
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="text-[10px] text-[var(--color-muted)]">Total P&L</div>
        <div
          className={`text-xl font-black tabular-nums ${totalPnl >= 0 ? 'text-degen-400' : 'text-red-400'}`}
        >
          {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toLocaleString()}
        </div>
        <div className="text-[10px] text-[var(--color-muted)] mt-1">
          {winners} winners / {losers} losers
        </div>
      </div>
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="text-[10px] text-[var(--color-muted)]">Coins Held</div>
        <div className="text-xl font-black tabular-nums text-[var(--color-fg)]">{coins.length}</div>
        <div className="text-[10px] text-[var(--color-muted)] mt-1">
          Across {new Set(coins.map((c) => c.chain)).size} chains
        </div>
      </div>
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="text-[10px] text-[var(--color-muted)]">Locked Value</div>
        <div className="text-xl font-black tabular-nums text-amber-400">
          $
          {coins
            .reduce(
              (s, c) => s + (c.locked / (c.locked + c.unlocking + c.unlocked || 1)) * c.valueUsd,
              0,
            )
            .toLocaleString()}
        </div>
        <div className="text-[10px] text-[var(--color-muted)] mt-1">In vesting</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

type HolderTab = 'portfolio' | 'voting' | 'content' | 'vesting';

export default function HolderDashboardPage() {
  const [activeTab, setActiveTab] = useState<HolderTab>('portfolio');
  const [portfolio] = useState<HeldCoin[]>(MOCK_PORTFOLIO);
  const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS);
  const [gatedContent] = useState<GatedContent[]>(MOCK_GATED_CONTENT);

  const handleVote = (id: string, vote: 'for' | 'against') => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              voted: vote,
              votesFor: vote === 'for' ? p.votesFor + 1 : p.votesFor,
              votesAgainst: vote === 'against' ? p.votesAgainst + 1 : p.votesAgainst,
              totalVotes: p.totalVotes + 1,
            }
          : p,
      ),
    );
  };

  const activeProposals = proposals.filter((p) => p.status === 'active');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            🏦 Holder Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Your portfolio, P&L tracking, token-gated content, and community voting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-xl bg-degen-500/10 px-3 py-1.5 text-[10px] font-semibold text-degen-400">
            <span className="h-1.5 w-1.5 rounded-full bg-degen-400 animate-pulse" />
            {activeProposals.length} Active Votes
          </span>
          <Link
            href="/coins"
            className="rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[10px] font-medium text-[var(--color-muted)] hover:text-degen-400 transition-all"
          >
            Browse Coins →
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 scrollbar-none"
        role="tablist"
      >
        {[
          { id: 'portfolio' as HolderTab, label: 'Portfolio', icon: '🏦' },
          { id: 'vesting' as HolderTab, label: 'Vesting', icon: '🔒' },
          { id: 'voting' as HolderTab, label: 'Voting', icon: '🗳️' },
          { id: 'content' as HolderTab, label: 'Gated Content', icon: '🎁' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-medium capitalize transition-all ${
              activeTab === tab.id
                ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ PORTFOLIO ═══ */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <PortfolioSummary coins={portfolio} />

          {/* Holdings breakdown */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">📊 Allocation by Coin</h3>
            <div className="space-y-2">
              {portfolio
                .sort((a, b) => b.valueUsd - a.valueUsd)
                .map((coin) => (
                  <div key={coin.symbol} className="flex items-center gap-2 text-[9px]">
                    <span className="w-12 font-semibold text-[var(--color-fg)]">
                      ${coin.symbol}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${coin.pnl >= 0 ? 'bg-degen-400' : 'bg-red-400'}`}
                        style={{
                          width: `${(coin.valueUsd / portfolio.reduce((s, c) => s + c.valueUsd, 0)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono text-[var(--color-muted)]">
                      {coin.allocation.toFixed(0)}%
                    </span>
                    <span
                      className={`w-16 text-right font-mono font-semibold ${coin.pnl >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                    >
                      {coin.pnl >= 0 ? '+' : ''}${coin.pnl.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Coin cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {portfolio.map((coin) => (
              <PortfolioCard key={coin.symbol} coin={coin} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ VESTING ═══ */}
      {activeTab === 'vesting' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">🔒 Vesting Overview</h3>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[var(--color-glass-border)]">
                    <th className="text-left py-2 font-semibold text-[var(--color-muted)]">Coin</th>
                    <th className="text-right py-2 font-semibold text-[var(--color-muted)]">
                      Total
                    </th>
                    <th className="text-right py-2 font-semibold text-[var(--color-muted)]">
                      Locked
                    </th>
                    <th className="text-right py-2 font-semibold text-[var(--color-muted)]">
                      Unlocking
                    </th>
                    <th className="text-right py-2 font-semibold text-[var(--color-muted)]">
                      Unlocked
                    </th>
                    <th className="text-right py-2 font-semibold text-[var(--color-muted)]">
                      Next Unlock
                    </th>
                    <th className="text-right py-2 font-semibold text-[var(--color-muted)]">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-glass-border)]">
                  {portfolio
                    .filter((c) => c.locked > 0 || c.unlocking > 0)
                    .map((coin) => {
                      const total = coin.locked + coin.unlocking + coin.unlocked;
                      const unlockedPct = (coin.unlocked / total) * 100;
                      return (
                        <tr key={coin.symbol} className="hover:bg-[var(--color-overlay)]">
                          <td className="py-2 font-semibold text-[var(--color-fg)]">
                            ${coin.symbol}
                          </td>
                          <td className="py-2 text-right font-mono text-[var(--color-fg)]">
                            {formatCompact(total)}
                          </td>
                          <td className="py-2 text-right font-mono text-red-400">
                            {formatCompact(coin.locked)}
                          </td>
                          <td className="py-2 text-right font-mono text-amber-400">
                            {formatCompact(coin.unlocking)}
                          </td>
                          <td className="py-2 text-right font-mono text-degen-400">
                            {formatCompact(coin.unlocked)}
                          </td>
                          <td className="py-2 text-right font-mono text-[var(--color-fg)]">
                            {coin.nextUnlockDate
                              ? new Date(coin.nextUnlockDate).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-2">
                            <div className="h-1.5 rounded-full bg-[var(--color-glass-border)] overflow-hidden w-16 ml-auto">
                              <div
                                className="h-full rounded-full bg-degen-400"
                                style={{ width: `${unlockedPct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {portfolio.filter((c) => c.locked > 0 || c.unlocking > 0).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-[var(--color-muted)]">
                        No vesting schedules
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VOTING ═══ */}
      {activeTab === 'voting' && (
        <div className="space-y-4">
          {/* Active proposals */}
          {activeProposals.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">🟢 Active Proposals</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeProposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} onVote={handleVote} />
                ))}
              </div>
            </div>
          )}

          {/* Past proposals */}
          <div>
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">📋 Past Proposals</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {proposals
                .filter((p) => p.status !== 'active')
                .map((p) => (
                  <ProposalCard key={p.id} proposal={p} onVote={handleVote} />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ GATED CONTENT ═══ */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">
              🎁 Token-Gated Content
            </h3>
            <p className="text-[9px] text-[var(--color-muted)] mb-4">
              Hold tokens to unlock exclusive content from creators. Your current holdings determine
              access.
            </p>
            <div className="space-y-2">
              {gatedContent.map((item) => (
                <GatedContentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
