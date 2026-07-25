'use client';

export interface TokenBalance {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
  color: string;
  location: 'treasury' | 'investment' | 'streaming' | 'grants';
}

export interface Transaction {
  id: string;
  date: number;
  type: 'transfer' | 'stream' | 'grant' | 'swap' | 'investment';
  amount: string;
  usdValue: number;
  recipient: string;
  status: 'completed' | 'pending' | 'failed';
  description: string;
}

export interface StreamCard {
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

export interface GrantCard {
  id: string;
  title: string;
  applicant: string;
  requestedAmount: string;
  category: string;
  status: string;
  progress: number;
  submittedAt: number;
}

export interface IncomeExpense {
  month: string;
  income: number;
  expenses: number;
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getTransactionIcon(type: string): string {
  const icons: Record<string, string> = {
    transfer: '↗️', stream: '🌊', grant: '🎁', swap: '🔄', investment: '📈',
  };
  return icons[type] || '💳';
}

export function getStatusBadge(status: string): { label: string; cls: string } {
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

export function totalTreasuryValue(tokens: TokenBalance[]): number {
  return tokens.reduce((sum, t) => sum + t.usdValue, 0);
}

export function MiniBarChart({ data, height = 40 }: { data: IncomeExpense[]; height?: number }) {
  const max = Math.max(...data.map((d) => Math.max(d.income, d.expenses)));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-0.5">
          <div className="w-full rounded-t-sm" style={{ height: `${(d.income / max) * 100}%`, backgroundColor: 'var(--color-accent)', opacity: 0.8 }} />
          <div className="w-full rounded-t-sm" style={{ height: `${(d.expenses / max) * 100}%`, backgroundColor: 'var(--color-error)', opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}

export function TokenDonut({ tokens }: { tokens: TokenBalance[] }) {
  const total = tokens.reduce((s, t) => s + t.usdValue, 0);
  let cumulativePercent = 0;
  const segs = tokens.map((t) => {
    const percent = (t.usdValue / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...t, percent, startPercent };
  });
  const gradientParts = segs.filter((s) => s.percent > 0.5).map((s) => {
    const start = (s.startPercent / 100) * 360;
    const end = ((s.startPercent + s.percent) / 100) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  });
  const gradient = gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(', ')})` : 'var(--color-muted)';
  return (
    <div className="flex items-center gap-4">
      <div className="h-24 w-24 shrink-0 rounded-full" style={{ background: gradient }} />
      <div className="space-y-1.5">
        {segs.map((t) => (
          <div key={t.symbol} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            <span className="text-[var(--color-muted)]">{t.symbol}</span>
            <span className="font-medium">{t.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onSelect(opt)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === opt ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-1 text-xs font-medium text-[var(--color-muted)]">{label}</div>
      <div className="text-xl font-black tabular-nums" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}
