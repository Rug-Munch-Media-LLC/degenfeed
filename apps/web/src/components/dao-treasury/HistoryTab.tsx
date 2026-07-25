'use client';

import {
  FilterBar,
  formatDate,
  getStatusBadge,
  getTransactionIcon,
  type Transaction,
} from './_helpers';

interface HistoryTabProps {
  transactions: Transaction[];
  filter: string;
  setFilter: (v: string) => void;
}

export function HistoryTab({ transactions, filter, setFilter }: HistoryTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          options={['All', 'Transfer', 'Stream', 'Grant', 'Swap', 'Investment']}
          selected={filter}
          onSelect={setFilter}
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
            {transactions.map((tx) => {
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
                      {tx.recipient.length > 15
                        ? `${tx.recipient.slice(0, 6)}...${tx.recipient.slice(-4)}`
                        : tx.recipient}
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
  );
}
