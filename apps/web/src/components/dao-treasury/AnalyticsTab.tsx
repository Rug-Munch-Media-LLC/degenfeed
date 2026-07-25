'use client';

import { formatUsd, MiniBarChart, StatCard, type IncomeExpense } from './_helpers';

interface AnalyticsTabProps {
  data: IncomeExpense[];
}

export function AnalyticsTab({ data }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-1 text-base font-bold">Income vs Expenses</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">Last 6 months</p>
        <MiniBarChart data={data} height={120} />
        <div className="mt-3 flex gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.8 }} /> Income
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: 'var(--color-error)', opacity: 0.7 }} /> Expenses
          </span>
        </div>
      </div>

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
            {data.map((row) => {
              const net = row.income - row.expenses;
              return (
                <tr key={row.month} className="border-t border-[var(--color-border)]">
                  <td className="py-2.5 font-medium">{row.month}</td>
                  <td className="py-2.5 text-right tabular-nums text-green-400">{formatUsd(row.income)}</td>
                  <td className="py-2.5 text-right tabular-nums text-red-400">{formatUsd(row.expenses)}</td>
                  <td className={`py-2.5 text-right tabular-nums font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatUsd(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue Growth (MoM)" value="+15.3%" color="var(--color-success)" />
        <StatCard label="Avg. Monthly Income" value={formatUsd(23950)} />
        <StatCard label="Yield from Investments" value={formatUsd(4200)} sub="This month" />
        <StatCard label="Stream vs. One-time" value="35/65" sub="Stream / One-time ratio" />
      </div>
    </div>
  );
}
