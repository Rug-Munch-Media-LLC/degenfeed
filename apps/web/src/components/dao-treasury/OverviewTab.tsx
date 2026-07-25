'use client';

import { useMemo } from 'react';
import { formatUsd, TokenDonut, StatCard, totalTreasuryValue, type TokenBalance, type IncomeExpense } from './_helpers';

interface OverviewTabProps {
  tokens: TokenBalance[];
  incomeExpense: IncomeExpense[];
  treasuryAssetCount: number;
}

export function OverviewTab({ tokens, incomeExpense, treasuryAssetCount }: OverviewTabProps) {
  const totalValue = useMemo(() => totalTreasuryValue(tokens), [tokens]);
  const lastMonth = incomeExpense[incomeExpense.length - 1];
  const monthlyIncome = lastMonth?.income ?? 0;
  const monthlyExpenses = lastMonth?.expenses ?? 0;
  const burnRate = monthlyExpenses;
  const runway = burnRate > 0 ? Math.round(totalValue / burnRate) : 999;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-degen-500/10 to-purple-500/5 p-6">
        <div className="text-xs font-medium text-[var(--color-muted)]">Total Treasury Value</div>
        <div className="mt-1 text-4xl font-black tabular-nums text-degen-400">{formatUsd(totalValue)}</div>
        <div className="mt-2 flex items-center gap-4 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-1 text-green-400">↑ {(totalValue * 0.032).toFixed(1)}% 24h</span>
          <span>{treasuryAssetCount} assets</span>
          <span>Multi-sig Treasury</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Monthly Income" value={formatUsd(monthlyIncome)} color="var(--color-accent)" />
        <StatCard label="Monthly Expenses" value={formatUsd(monthlyExpenses)} color="var(--color-error)" />
        <StatCard label="Burn Rate" value={formatUsd(burnRate)} sub="Monthly operating costs" />
        <StatCard label="Runway" value={`${runway} months`} sub="At current burn rate" />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-base font-bold">Asset Breakdown</h2>
        <div className="flex flex-col gap-6 sm:flex-row">
          <TokenDonut tokens={tokens} />
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
                {tokens.map((t) => (
                  <tr key={t.symbol} className="border-t border-[var(--color-border)]">
                    <td className="flex items-center gap-2 py-2.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="font-medium">{t.symbol}</span>
                      <span className="text-[var(--color-muted)]">{t.name}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{t.amount.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{formatUsd(t.usdValue)}</td>
                    <td className="py-2.5 text-right tabular-nums text-[var(--color-muted)]">{((t.usdValue / totalValue) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
