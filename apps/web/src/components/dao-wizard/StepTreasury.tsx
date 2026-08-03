'use client';

import type { DAOFormState, SignerEntry } from './types';

interface StepTreasuryProps {
  form: DAOFormState;
  update: <K extends keyof DAOFormState>(key: K, value: DAOFormState[K]) => void;
  updateSigner: (index: number, entry: SignerEntry) => void;
  addSigner: () => void;
  removeSigner: (index: number) => void;
}

export default function StepTreasury({
  form,
  update,
  updateSigner,
  addSigner,
  removeSigner,
}: StepTreasuryProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Treasury Multi-Sig</h2>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Initial Treasury Funding (ETH/SOL)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.initialFunding}
                onChange={(e) => update('initialFunding', e.target.value.replace(/[^0-9.]/g, ''))}
                className="input text-sm w-32 font-mono"
              />
              <span className="text-[10px] text-[var(--color-muted)]">
                ETH (Base) or SOL (Solana)
              </span>
            </div>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-fg)]">
                Signers{' '}
                <span className="ml-1 text-[10px] text-[var(--color-muted)]">
                  ({form.signers.length}/10)
                </span>
              </span>
            </div>
            <div className="space-y-2">
              {form.signers.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-[10px] font-mono text-[var(--color-muted)]">
                    #{i + 1}
                  </span>
                  <div className="flex flex-1 gap-2">
                    <input
                      type="text"
                      placeholder="0x..."
                      value={entry.address}
                      onChange={(e) => updateSigner(i, { ...entry, address: e.target.value })}
                      className="input flex-[3] text-[11px] font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Label"
                      value={entry.label}
                      onChange={(e) => updateSigner(i, { ...entry, label: e.target.value })}
                      className="input flex-[2] text-[11px]"
                    />
                  </div>
                  {form.signers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSigner(i)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-[10px] text-[var(--color-muted)] hover:border-red-500/30 hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.signers.length < 10 && (
              <button
                type="button"
                onClick={addSigner}
                className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                + Add signer
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
              <span>Threshold Required</span>
              <span className="text-[var(--color-accent)]">
                {Math.min(form.threshold, form.signers.length)} of {form.signers.length || 1}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={Math.max(form.signers.length, 1)}
              step={1}
              value={Math.min(form.threshold, form.signers.length)}
              onChange={(e) => update('threshold', Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Treasury Allocation</h2>
        <div className="space-y-4">
          {[
            {
              key: 'opsPercent' as const,
              label: '⚙️ Operations',
              desc: 'Operating expenses, contributor pay, tools',
            },
            {
              key: 'grantsPercent' as const,
              label: '🏗️ Grants',
              desc: 'Community grants, bounties, incentives',
            },
            {
              key: 'reservePercent' as const,
              label: '🏦 Reserve',
              desc: 'Emergency fund, long-term holdings',
            },
          ].map(({key, label}) => (            <label key={key} className="block">
              <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-fg)]">
                <span>{label}</span>
                <span className="text-[var(--color-accent)]">{form[key]}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form[key]}
                onChange={(e) => update(key, Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </label>
          ))}
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="flex h-6 overflow-hidden rounded-lg">
              {[
                { pct: form.opsPercent, color: '#06b6d4', label: 'Ops' },
                { pct: form.grantsPercent, color: '#10b981', label: 'Grants' },
                { pct: form.reservePercent, color: '#8b5cf6', label: 'Reserve' },
              ]
                .filter((s) => s.pct > 0)
                .map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-center text-[8px] font-bold text-black transition-all"
                    style={{
                      width: `${(s.pct / Math.max(form.opsPercent + form.grantsPercent + form.reservePercent, 1)) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  >
                    {s.pct > 15 ? s.label : ''}
                  </div>
                ))}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-[9px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
                <span className="text-[var(--color-muted)]">Ops {form.opsPercent}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
                <span className="text-[var(--color-muted)]">Grants {form.grantsPercent}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
                <span className="text-[var(--color-muted)]">Reserve {form.reservePercent}%</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Advanced Features</h2>
        <div className="space-y-4">
          {[
            {
              key: 'streamingEnabled' as const,
              icon: '💧',
              label: 'Streaming Payments',
              desc: 'Real-time payment streaming, pause/resume',
            },
            {
              key: 'grantProgramEnabled' as const,
              icon: '🏗️',
              label: 'Grant Program',
              desc: 'Milestone payouts, community review',
            },
          ].map(({ key, icon, label, desc }) => (
            <label key={key} className="flex items-center justify-between">
              <div>
                <div className="flex items-center text-xs font-medium text-[var(--color-fg)]">
                  <span className="mr-1.5">{icon}</span> {label}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => update(key, !form[key])}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form[key] ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-glass-border)]'}`}
                role="switch"
                aria-checked={form[key]}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form[key] ? 'translate-x-4' : ''}`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
