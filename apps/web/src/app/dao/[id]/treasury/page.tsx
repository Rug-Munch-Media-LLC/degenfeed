'use client';

import { useMemo, useState } from 'react';
import { formatTimeAgo, MOCK_DAO, shortAddr } from '../layout';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TokenBalance {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
  color: string;
  location: 'treasury' | 'investment' | 'streaming' | 'grants';
}

interface Transaction {
  id: string;
  date: number;
  type: 'transfer' | 'stream' | 'grant' | 'swap' | 'investment';
  amount: string;
  usdValue: number;
  recipient: string;
  status: 'completed' | 'pending' | 'failed';
  description: string;
}

interface StreamCard {
  id: string;
  recipient: string;
  label: string;
  tokenSymbol: string;
  flowRateFormatted: string;
  monthlyFormatted: string;
  totalStreamed: string;
  totalStreamedUsd: number;
  duration: number | null;
  startedAt: number;
  paused: boolean;
}

interface GrantCard {
  id: string;
  title: string;
  applicant: string;
  requestedAmount: string;
  category: string;
  status: string;
  progress: number;
  submittedAt: number;
}

interface IncomeExpense {
  month: string;
  income: number;
  expenses: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_TOKENS: TokenBalance[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    amount: 180.5,
    usdValue: 613_700,
    color: '#627EEA',
    location: 'treasury',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    amount: 320_000,
    usdValue: 320_000,
    color: '#2775CA',
    location: 'treasury',
  },
  {
    symbol: 'DEGEN',
    name: 'DegenFeed Token',
    amount: 1_200_000,
    usdValue: 180_000,
    color: '#FF6B35',
    location: 'treasury',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    amount: 1_200,
    usdValue: 128_000,
    color: '#9945FF',
    location: 'treasury',
  },
  {
    symbol: 'stETH',
    name: 'Lido Staked ETH',
    amount: 50.2,
    usdValue: 170_680,
    color: '#00A3FF',
    location: 'investment',
  },
  {
    symbol: 'AERO',
    name: 'Aerodrome LP',
    amount: 12_500,
    usdValue: 45_000,
    color: '#0052FF',
    location: 'investment',
  },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    date: Date.now() - 7200000,
    type: 'stream',
    amount: '250 USDC',
    usdValue: 250,
    recipient: '0x742d35Cc6634C0532925a3b844Bc4aD1',
    status: 'completed',
    description: 'Contributor stream payment',
  },
  {
    id: '2',
    date: Date.now() - 86400000,
    type: 'grant',
    amount: '5,000 USDC',
    usdValue: 5000,
    recipient: '0x8fC5bD2E6cBc5AaD6fB6fC5',
    status: 'completed',
    description: 'Q3 Development Grant',
  },
  {
    id: '3',
    date: Date.now() - 172800000,
    type: 'swap',
    amount: '10 ETH → 34,000 USDC',
    usdValue: 34000,
    recipient: '---',
    status: 'completed',
    description: 'Treasury rebalancing via Aerodrome',
  },
  {
    id: '4',
    date: Date.now() - 259200000,
    type: 'transfer',
    amount: '2.5 ETH',
    usdValue: 8500,
    recipient: '0x1FcE9FcB6cFfDF1234',
    status: 'completed',
    description: 'Security audit payment',
  },
  {
    id: '5',
    date: Date.now() - 345600000,
    type: 'investment',
    amount: '50 ETH',
    usdValue: 170_000,
    recipient: 'Lido Staking',
    status: 'completed',
    description: 'Stake 50 ETH in Lido',
  },
  {
    id: '6',
    date: Date.now() - 432000000,
    type: 'stream',
    amount: '1,200 USDC',
    usdValue: 1200,
    recipient: '0xAbcDeF1234567890',
    status: 'pending',
    description: 'Monthly contributor payroll',
  },
  {
    id: '7',
    date: Date.now() - 518400000,
    type: 'grant',
    amount: '10,000 USDC',
    usdValue: 10000,
    recipient: '0xFfGgHh123456',
    status: 'pending',
    description: 'Marketing Grant — Awaiting approval',
  },
  {
    id: '8',
    date: Date.now() - 604800000,
    type: 'swap',
    amount: '5 ETH → 1,250 DEGEN',
    usdValue: 17000,
    recipient: '---',
    status: 'failed',
    description: 'DEGEN buy — slippage exceeded',
  },
];

const MOCK_STREAMS: StreamCard[] = [
  {
    id: 's1',
    recipient: '0x742d35Cc6634C0532925a3b844Bc4aD1',
    label: 'Lead Developer',
    tokenSymbol: 'USDC',
    flowRateFormatted: '0.001157/sec',
    monthlyFormatted: '3,000 USDC/mo',
    totalStreamed: '12,500',
    totalStreamedUsd: 12500,
    duration: 7776000000,
    startedAt: Date.now() - 7776000000,
    paused: false,
  },
  {
    id: 's2',
    recipient: '0x8fC5bD2E6cBc5AaD6fB6fC5',
    label: 'Community Manager',
    tokenSymbol: 'USDC',
    flowRateFormatted: '0.000579/sec',
    monthlyFormatted: '1,500 USDC/mo',
    totalStreamed: '4,500',
    totalStreamedUsd: 4500,
    duration: null,
    startedAt: Date.now() - 2592000000,
    paused: false,
  },
  {
    id: 's3',
    recipient: '0xAbcDeF1234567890',
    label: 'Designer',
    tokenSymbol: 'ETH',
    flowRateFormatted: '0.000002/sec',
    monthlyFormatted: '5 ETH/mo',
    totalStreamed: '8.2',
    totalStreamedUsd: 27880,
    duration: 5184000000,
    startedAt: Date.now() - 5184000000,
    paused: true,
  },
];

const MOCK_GRANTS: GrantCard[] = [
  {
    id: 'g1',
    title: 'Cross-Chain Bridge Development',
    applicant: '0x7a2E...cF41',
    requestedAmount: '25,000 USDC',
    category: 'Development',
    status: 'Funded',
    progress: 66,
    submittedAt: Date.now() - 7776000000,
  },
  {
    id: 'g2',
    title: 'Community Growth Campaign',
    applicant: '0x3F1b...9A02',
    requestedAmount: '10,000 USDC',
    category: 'Marketing',
    status: 'Under Review',
    progress: 0,
    submittedAt: Date.now() - 2592000000,
  },
  {
    id: 'g3',
    title: 'Protocol Research Paper',
    applicant: '0x9D8e...4B77',
    requestedAmount: '5,000 USDC',
    category: 'Research',
    status: 'Approved',
    progress: 0,
    submittedAt: Date.now() - 864000000,
  },
  {
    id: 'g4',
    title: 'Bug Bounty Program',
    applicant: '0xE5f6...1C33',
    requestedAmount: '15,000 USDC',
    category: 'Development',
    status: 'Completed',
    progress: 100,
    submittedAt: Date.now() - 15552000000,
  },
];

const MOCK_INCOME_EXPENSE: IncomeExpense[] = [
  { month: 'Jan', income: 18500, expenses: 12500 },
  { month: 'Feb', income: 22300, expenses: 14800 },
  { month: 'Mar', income: 19100, expenses: 16200 },
  { month: 'Apr', income: 27600, expenses: 15800 },
  { month: 'May', income: 30400, expenses: 17300 },
  { month: 'Jun', income: 25800, expenses: 19100 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTransactionIcon(type: string): string {
  const icons: Record<string, string> = {
    transfer: '↗️',
    stream: '🌊',
    grant: '🎁',
    swap: '🔄',
    investment: '📈',
  };
  return icons[type] || '💳';
}

function getStatusBadge(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completed', cls: 'bg-green-500/15 text-green-400' },
    pending: { label: 'Pending', cls: 'bg-yellow-500/15 text-yellow-400' },
    failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-400' },
    funded: { label: 'Funded', cls: 'bg-green-500/15 text-green-400' },
    'Under Review': { label: 'Under Review', cls: 'bg-blue-500/15 text-blue-400' },
    approved: { label: 'Approved', cls: 'bg-purple-500/15 text-purple-400' },
  };
  return map[status] || { label: status, cls: 'bg-gray-500/15 text-gray-400' };
}

function totalTreasuryValue(): number {
  return MOCK_TOKENS.reduce((sum, t) => sum + t.usdValue, 0);
}

// ─── Mini Chart Sparkline ──────────────────────────────────────────────────

function MiniBarChart({ data, height = 40 }: { data: IncomeExpense[]; height?: number }) {
  const max = Math.max(...data.map((d) => Math.max(d.income, d.expenses)));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t-sm"
            style={{
              height: `${(d.income / max) * 100}%`,
              backgroundColor: 'var(--color-accent)',
              opacity: 0.8,
            }}
            title={`Income: ${formatUsd(d.income)}`}
          />
          <div
            className="w-full rounded-t-sm"
            style={{
              height: `${(d.expenses / max) * 100}%`,
              backgroundColor: 'var(--color-error)',
              opacity: 0.7,
            }}
            title={`Expenses: ${formatUsd(d.expenses)}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Donut Chart ───────────────────────────────────────────────────────────

function TokenDonut({ tokens }: { tokens: TokenBalance[] }) {
  const total = tokens.reduce((s, t) => s + t.usdValue, 0);
  let cumulativePercent = 0;

  const segs = tokens.map((t) => {
    const percent = (t.usdValue / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...t, percent, startPercent };
  });

  // Conic gradient from segments
  const gradientParts = segs
    .filter((s) => s.percent > 0.5)
    .map((s) => {
      const start = (s.startPercent / 100) * 360;
      const end = ((s.startPercent + s.percent) / 100) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    });

  const gradient =
    gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(', ')})` : 'var(--color-muted)';

  return (
    <div className="flex items-center gap-4">
      <div className="h-24 w-24 shrink-0 rounded-full" style={{ background: gradient }} />
      <div className="space-y-1.5">
        {segs.map((t) => (
          <div key={t.symbol} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-[var(--color-muted)]">{t.symbol}</span>
            <span className="font-medium">{t.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────

function FilterBar({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(opt)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === opt
              ? 'bg-degen-500/20 text-degen-400'
              : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-1 text-xs font-medium text-[var(--color-muted)]">{label}</div>
      <div className="text-xl font-black tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function TreasuryPage() {
  const [txFilter, setTxFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'transactions' | 'streams' | 'grants' | 'analytics'
  >('overview');

  const totalValue = useMemo(() => totalTreasuryValue(), []);
  const filteredTxs = useMemo(() => {
    if (txFilter === 'All') return MOCK_TRANSACTIONS;
    return MOCK_TRANSACTIONS.filter((tx) => tx.type === txFilter.toLowerCase());
  }, [txFilter]);

  const lastMonth = MOCK_INCOME_EXPENSE[MOCK_INCOME_EXPENSE.length - 1];
  const monthlyIncome = lastMonth?.income ?? 0;
  const monthlyExpenses = lastMonth?.expenses ?? 0;
  const burnRate = monthlyExpenses;
  const runway = burnRate > 0 ? Math.round(totalValue / burnRate) : 999;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ══ Header ══ */}
      <div>
        <h1 className="text-2xl font-black">Treasury</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Manage DAO funds, streams, grants, and investments
        </p>
      </div>

      {/* ══ Total Value Banner ══ */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-degen-500/10 to-purple-500/5 p-6">
        <div className="text-xs font-medium text-[var(--color-muted)]">Total Treasury Value</div>
        <div className="mt-1 text-4xl font-black tabular-nums text-degen-400">
          {formatUsd(totalValue)}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-1 text-green-400">
            ↑ {(totalValue * 0.032).toFixed(1)}% 24h
          </span>
          <span>{MOCK_DAO.treasuryTokens.length} assets</span>
          <span>Multi-sig Treasury</span>
        </div>
      </div>

      {/* ══ Quick Stats ══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Monthly Income"
          value={formatUsd(monthlyIncome)}
          color="var(--color-accent)"
        />
        <StatCard
          label="Monthly Expenses"
          value={formatUsd(monthlyExpenses)}
          color="var(--color-error)"
        />
        <StatCard label="Burn Rate" value={formatUsd(burnRate)} sub="Monthly operating costs" />
        <StatCard label="Runway" value={`${runway} months`} sub="At current burn rate" />
      </div>

      {/* ══ Tab Navigation ══ */}
      <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        {(['overview', 'transactions', 'streams', 'grants', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-degen-500/20 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'transactions'
                ? 'History'
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Asset Breakdown */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-base font-bold">Asset Breakdown</h2>
            <div className="flex flex-col gap-6 sm:flex-row">
              <TokenDonut tokens={MOCK_TOKENS} />
              <div className="min-w-0 flex-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--color-muted)]">
                      <th className="pb-2 text-left font-medium">Token</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                      <th className="pb-2 text-right font-medium">USD Value</th>
                      <th className="pb-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_TOKENS.map((t) => (
                      <tr key={t.symbol} className="border-t border-[var(--color-border)]">
                        <td className="flex items-center gap-2 py-2.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-medium">{t.symbol}</span>
                          <span className="text-[var(--color-muted)]">{t.name}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {t.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-medium">
                          {formatUsd(t.usdValue)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-[var(--color-muted)]">
                          {((t.usdValue / totalValue) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Wallet Addresses */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-3 text-base font-bold">Wallet Addresses</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-muted)]">Multi-sig Treasury</span>
                <span className="font-mono">
                  {shortAddr('0x1234567890abcdef1234567890abcdef12345678')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-muted)]">Hot Wallet (Ops)</span>
                <span className="font-mono">
                  {shortAddr('0xabcdef1234567890abcdef1234567890abcdef12')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-muted)]">Timelock Controller</span>
                <span className="font-mono">
                  {shortAddr('0x7890abcdef1234567890abcdef1234567890abcd')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-xs font-medium transition-colors hover:bg-[var(--color-muted)]"
            >
              ✏️ Propose Transfer
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-xs font-medium transition-colors hover:bg-[var(--color-muted)]"
            >
              🌊 Create Stream
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-xs font-medium transition-colors hover:bg-[var(--color-muted)]"
            >
              🎁 Submit Grant
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-xs font-medium transition-colors hover:bg-[var(--color-muted)]"
            >
              📈 Propose Investment
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: TRANSACTIONS */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterBar
              options={['All', 'Transfer', 'Stream', 'Grant', 'Swap', 'Investment']}
              selected={txFilter}
              onSelect={setTxFilter}
            />
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
            >
              ⬇ Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-card)] text-[var(--color-muted)]">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Recipient</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => {
                  const badge = getStatusBadge(tx.status);
                  return (
                    <tr
                      key={tx.id}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-card)]/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span>{getTransactionIcon(tx.type)}</span>
                          <span className="capitalize">{tx.type}</span>
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-[var(--color-muted)]">
                        {tx.description}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                        {tx.amount}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[var(--color-muted)]">
                          {tx.recipient.length > 15 ? shortAddr(tx.recipient) : tx.recipient}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: STREAMS */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'streams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Active Payment Streams</h2>
            <button
              type="button"
              className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
            >
              + New Stream
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_STREAMS.map((s) => {
              const remaining = s.duration
                ? Math.max(0, s.startedAt + s.duration - Date.now())
                : null;
              const totalDuration = s.duration || 1;
              const elapsed = Date.now() - s.startedAt;
              const progress = Math.min(100, (elapsed / totalDuration) * 100);

              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-4 ${
                    s.paused
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-[var(--color-border)] bg-[var(--color-card)]'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold">{s.label}</div>
                      <div className="text-xs text-[var(--color-muted)] font-mono">
                        {shortAddr(s.recipient)}
                      </div>
                    </div>
                    {s.paused && (
                      <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="mb-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Flow Rate</span>
                      <span className="font-medium">{s.monthlyFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Total Streamed</span>
                      <span className="font-medium">
                        {s.totalStreamed} {s.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">USD Value</span>
                      <span className="font-medium">{formatUsd(s.totalStreamedUsd)}</span>
                    </div>
                  </div>

                  {/* Progress bar for duration-limited streams */}
                  {s.duration && (
                    <div className="mb-3">
                      <div className="mb-1 flex justify-between text-[10px] text-[var(--color-muted)]">
                        <span>
                          {remaining && remaining > 0
                            ? `${Math.ceil(remaining / 86400000)}d remaining`
                            : 'Ended'}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
                        <div
                          className="h-full rounded-full bg-degen-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!s.paused ? (
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-green-500/30 px-3 py-1.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-500/10"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: GRANTS */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'grants' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Grant Programs</h2>
            <button
              type="button"
              className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
            >
              + Submit Grant Application
            </button>
          </div>

          {/* Grant Stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Total Distributed" value={formatUsd(55000)} />
            <StatCard label="Active Grants" value="3" />
            <StatCard label="Success Rate" value="80%" color="var(--color-accent)" />
            <StatCard label="Avg. Grant Size" value={formatUsd(13750)} />
          </div>

          {/* Grant Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {MOCK_GRANTS.map((g) => {
              const badge = getStatusBadge(g.status);
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{g.title}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {g.applicant} · {g.category}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="text-[var(--color-muted)]">
                      Requested: {g.requestedAmount}
                    </span>
                    <span className="font-medium tabular-nums">
                      {new Date(g.submittedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Milestone Progress */}
                  {g.status !== 'Under Review' && (
                    <div>
                      <div className="mb-1 flex justify-between text-[10px] text-[var(--color-muted)]">
                        <span>Milestone Progress</span>
                        <span>{g.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${g.progress}%`,
                            backgroundColor:
                              g.progress === 100 ? 'var(--color-success)' : 'var(--color-accent)',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {g.status === 'Under Review' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-green-500/20 px-3 py-1.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-500/30"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/30"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Review Queue */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-3 text-sm font-bold">Grant Review Queue</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-[var(--color-bg)] p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-sm">
                  📝
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">Community Ambassador Program</div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    0x4B2e...8F11 · Requested 8,000 USDC
                  </div>
                </div>
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                  2 reviews
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)]"
                >
                  Review
                </button>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-[var(--color-bg)] p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-sm">
                  🔬
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">MEV Protection Research</div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    0x9D8e...4B77 · Requested 5,000 USDC
                  </div>
                </div>
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                  0 reviews
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)]"
                >
                  Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: ANALYTICS */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Income vs Expenses Chart */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-1 text-base font-bold">Income vs Expenses</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">Last 6 months</p>
            <div className="flex items-end gap-3">
              <MiniBarChart data={MOCK_INCOME_EXPENSE} height={120} />
            </div>
            <div className="mt-3 flex gap-4 text-[10px]">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: 'var(--color-accent)', opacity: 0.8 }}
                />
                Income
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: 'var(--color-error)', opacity: 0.7 }}
                />
                Expenses
              </span>
            </div>
          </div>

          {/* Monthly breakdown table */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-base font-bold">Monthly Breakdown</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-muted)]">
                  <th className="pb-2 text-left font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">Income</th>
                  <th className="pb-2 text-right font-medium">Expenses</th>
                  <th className="pb-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_INCOME_EXPENSE.map((row) => {
                  const net = row.income - row.expenses;
                  return (
                    <tr key={row.month} className="border-t border-[var(--color-border)]">
                      <td className="py-2.5 font-medium">{row.month}</td>
                      <td className="py-2.5 text-right tabular-nums text-green-400">
                        {formatUsd(row.income)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-red-400">
                        {formatUsd(row.expenses)}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {formatUsd(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expense Categories */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-3 text-sm font-bold">Top Expense Categories</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Contributor Payroll', amount: 12500, pct: 42 },
                  { label: 'Grant Distributions', amount: 7500, pct: 25 },
                  { label: 'Infrastructure', amount: 3800, pct: 13 },
                  { label: 'Marketing', amount: 3200, pct: 11 },
                  { label: 'Gas & Transaction Fees', amount: 2700, pct: 9 },
                ].map((cat) => (
                  <div key={cat.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{cat.label}</span>
                      <span className="tabular-nums font-medium">{formatUsd(cat.amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
                      <div
                        className="h-full rounded-full bg-degen-500"
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-3 text-sm font-bold">Revenue Sources</h3>
              <div className="space-y-3">
                {[
                  { source: 'Creator Coin Fees', amount: 15200, pct: 51, icon: '🪙' },
                  { source: 'Tips & Donations', amount: 6800, pct: 23, icon: '💜' },
                  { source: 'Investment Yield', amount: 4200, pct: 14, icon: '📈' },
                  { source: 'Subscriptions', amount: 3500, pct: 12, icon: '🔑' },
                ].map((rev) => (
                  <div key={rev.source} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg)] text-sm">
                      {rev.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium">{rev.source}</div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        {rev.pct}% of revenue
                      </div>
                    </div>
                    <span className="text-xs font-medium tabular-nums">
                      {formatUsd(rev.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Revenue Growth (MoM)" value="+15.3%" color="var(--color-success)" />
            <StatCard label="Avg. Monthly Income" value={formatUsd(23950)} />
            <StatCard label="Yield from Investments" value={formatUsd(4200)} sub="This month" />
            <StatCard label="Stream vs. One-time" value="35/65" sub="Stream / One-time ratio" />
          </div>
        </div>
      )}
    </div>
  );
}
