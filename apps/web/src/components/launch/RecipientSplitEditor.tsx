'use client';

import { useCallback } from 'react';

export interface RevenueRecipient {
  id: string;
  address: string;
  name: string;
  percentage: number;
}

interface RecipientSplitEditorProps {
  recipients: RevenueRecipient[];
  onChange: (recipients: RevenueRecipient[]) => void;
  maxRecipients?: number;
  className?: string;
}

function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function RecipientSplitEditor({
  recipients,
  onChange,
  maxRecipients = 5,
  className = '',
}: RecipientSplitEditorProps) {
  const totalPercentage = recipients.reduce((sum, r) => sum + r.percentage, 0);
  const remaining = Math.max(0, 100 - totalPercentage);
  const isValid = totalPercentage <= 100;
  const canAdd = recipients.length < maxRecipients;

  const addRecipient = useCallback(() => {
    if (!canAdd) return;
    const newRec: RevenueRecipient = {
      id: generateId(),
      address: '',
      name: '',
      percentage: 0,
    };
    onChange([...recipients, newRec]);
  }, [recipients, onChange, canAdd]);

  const removeRecipient = useCallback(
    (id: string) => {
      onChange(recipients.filter((r) => r.id !== id));
    },
    [recipients, onChange],
  );

  const updateRecipient = useCallback(
    (id: string, updates: Partial<RevenueRecipient>) => {
      onChange(recipients.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    },
    [recipients, onChange],
  );

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Revenue Splits</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Distribute your creator fee among multiple recipients
          </p>
        </div>
        <span
          className={`text-xs font-medium tabular-nums ${
            isValid ? 'text-degen-400' : 'text-red-400'
          }`}
        >
          {totalPercentage}% / 100%
        </span>
      </div>

      {/* Recipient list */}
      <div className="space-y-2.5">
        {recipients.map((recipient, i) => (
          <div
            key={recipient.id}
            className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Name */}
                <div>
                  <label
                    className="mb-0.5 block text-[10px] font-medium text-[var(--color-muted)]"
                    htmlFor="field-0b8c6a13"
                  >
                    Name
                  </label>
                  <input
                    id="field-0b8c6a13"
                    type="text"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                    placeholder="Label (e.g. Treasury)"
                    className="input py-2 sm:py-1.5 text-sm"
                    maxLength={32}
                  />
                </div>

                {/* Percentage */}
                <div>
                  <label
                    className="mb-0.5 block text-[10px] font-medium text-[var(--color-muted)]"
                    htmlFor="field-b2ef7ced"
                  >
                    Split %
                  </label>
                  <input
                    id="field-b2ef7ced"
                    type="number"
                    value={recipient.percentage}
                    onChange={(e) => {
                      const val = Number.parseFloat(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateRecipient(recipient.id, {
                          percentage: Math.max(0, Math.min(100, val)),
                        });
                      }
                    }}
                    min={0}
                    max={100}
                    step={0.1}
                    className="input py-2 sm:py-1.5 text-right text-sm tabular-nums"
                  />
                </div>
              </div>

              {/* Address — full width */}
              <div>
                <label
                  className="mb-0.5 block text-[10px] font-medium text-[var(--color-muted)]"
                  htmlFor="field-d3588639"
                >
                  Wallet Address
                </label>
                <input
                  id="field-d3588639"
                  type="text"
                  value={recipient.address}
                  onChange={(e) => updateRecipient(recipient.id, { address: e.target.value })}
                  placeholder="0x... or SOL..."
                  className="input py-2 sm:py-1.5 font-mono text-xs"
                />
              </div>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeRecipient(recipient.id)}
              className="mt-2 sm:mt-5 flex h-8 w-8 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400 touch-target"
              aria-label={`Remove ${recipient.name || `recipient ${i + 1}`}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add recipient */}
      {canAdd && (
        <button
          type="button"
          onClick={addRecipient}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Recipient ({recipients.length}/{maxRecipients})
        </button>
      )}

      {/* Distribution bar */}
      {recipients.length > 0 && (
        <div className="mt-4">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
            {recipients.map((r) => (
              <div
                key={r.id}
                className="h-full transition-all duration-300"
                style={{
                  width: `${r.percentage}%`,
                  backgroundColor: `hsl(${recipients.indexOf(r) * 60}, 70%, 50%)`,
                }}
                title={`${r.name || shortenAddress(r.address)}: ${r.percentage}%`}
              />
            ))}
            {remaining > 0 && (
              <div
                className="h-full bg-[var(--color-muted-bg)]"
                style={{ width: `${remaining}%` }}
                title={`Unallocated: ${remaining}%`}
              />
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
            </span>
            <span className={isValid ? 'text-degen-400' : 'text-red-400'}>
              {isValid ? `${remaining}% unallocated` : `${Math.abs(remaining)}% over limit`}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {recipients.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-xs text-[var(--color-muted)]">
            No recipients configured. All fees will go directly to you.
          </p>
        </div>
      )}
    </div>
  );
}
