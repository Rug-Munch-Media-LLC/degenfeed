'use client';

import Link from 'next/link';
import DAOPreview from '../dao/DAOPreview';
import type { CoinFormState } from './types';

interface StepDAOProps {
  form: CoinFormState;
  update: <K extends keyof CoinFormState>(key: K, value: CoinFormState[K]) => void;
  daoDeploy: () => Promise<void>;
}

export default function StepDAO({ form, update, daoDeploy }: StepDAOProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-sm font-bold text-[var(--color-fg)]">
              🏛️ DAO for ${form.symbol || 'TICKER'}
            </h2>
            <p className="text-[11px] text-[var(--color-muted)]">
              Give your coin holders the power to govern.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update('daoEnabled', !form.daoEnabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.daoEnabled ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
            role="switch"
            aria-checked={form.daoEnabled}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-md ${form.daoEnabled ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
      </div>

      {form.daoEnabled && (
        <>
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Governance Parameters</h2>
            <div className="space-y-4">
              <div>
                <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                  Voting Model
                </span>
                <div className="flex gap-2">
                  {[
                    {
                      key: 'token' as const,
                      label: '1 Token = 1 Vote',
                      desc: 'Standard weighted voting',
                    },
                    {
                      key: 'quadratic' as const,
                      label: 'Quadratic Voting',
                      desc: 'Reduces whale dominance',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => update('daoVotingModel', opt.key)}
                      className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                        form.daoVotingModel === opt.key
                          ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        {opt.label}
                      </div>
                      <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                  <span>Proposal Threshold</span>
                  <span className="text-degen-400">{form.daoProposalThreshold}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.daoProposalThreshold}
                  onChange={(e) => update('daoProposalThreshold', Number(e.target.value))}
                  className="w-full accent-degen-400"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                  <span>Quorum</span>
                  <span className="text-degen-400">{form.daoQuorumPercent}%</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={75}
                  step={1}
                  value={form.daoQuorumPercent}
                  onChange={(e) => update('daoQuorumPercent', Number(e.target.value))}
                  className="w-full accent-degen-400"
                />
              </label>
              <div>
                <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                  Voting Period
                </span>
                <div className="flex flex-wrap gap-2">
                  {([1, 3, 7, 14] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => update('daoVotingPeriodDays', days)}
                      className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${
                        form.daoVotingPeriodDays === days
                          ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'
                      }`}
                    >
                      {days} day{days > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">
                  Timelock Delay
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: 'None' },
                    { value: 24, label: '24h' },
                    { value: 48, label: '48h' },
                    { value: 168, label: '7 days' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        update('daoTimelockDelayHours', opt.value as 0 | 24 | 48 | 168)
                      }
                      className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${
                        form.daoTimelockDelayHours === opt.value
                          ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Treasury Multi-Sig</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                  <span>Signers</span>
                  <span className="text-degen-400">{form.daoSingerCount}</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={form.daoSingerCount}
                  onChange={(e) => {
                    const c = Number(e.target.value);
                    update('daoSingerCount', c);
                    if (form.daoThreshold > c) update('daoThreshold', c);
                  }}
                  className="w-full accent-degen-400"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
                  <span>Threshold Required</span>
                  <span className="text-degen-400">
                    {form.daoThreshold} of {form.daoSingerCount}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={form.daoSingerCount}
                  step={1}
                  value={Math.min(form.daoThreshold, form.daoSingerCount)}
                  onChange={(e) => update('daoThreshold', Number(e.target.value))}
                  className="w-full accent-degen-400"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Coin + DAO Preview</h2>
            <DAOPreview
              state={{
                name: `${form.name} DAO`,
                description: `Governance DAO for ${form.name} ($${form.symbol}) token holders.`,
                avatarUrl: form.imagePreview,
                tags: form.tags,
                category: form.tags[0] || 'general',
                votingModel: form.daoVotingModel,
                proposalThreshold: form.daoProposalThreshold,
                quorumPercent: form.daoQuorumPercent,
                votingPeriodDays: form.daoVotingPeriodDays,
                timelockDelayHours: form.daoTimelockDelayHours,
                signerCount: form.daoSingerCount,
                threshold: Math.min(form.daoThreshold, form.daoSingerCount),
                twitter: '',
                discord: '',
                telegram: '',
                website: '',
              }}
              coinSymbol={form.symbol}
              sidebar
            />
          </div>

          {form.daoDeploying && (
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <div className="mb-2 flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Creating DAO...</span>
                <span className="text-degen-400">{Math.round(form.daoDeployProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500"
                  style={{ width: `${form.daoDeployProgress}%` }}
                />
              </div>
            </div>
          )}

          {form.daoDeployed && (
            <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span className="text-sm font-bold text-degen-400">DAO Created Successfully!</span>
              </div>
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)]">DAO:</span>
                  <span className="text-[var(--color-fg)]">
                    {form.daoAddress.slice(0, 20)}...{form.daoAddress.slice(-8)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)]">Tx:</span>
                  <span className="text-[var(--color-fg)]">
                    {form.daoTxHash.slice(0, 20)}...{form.daoTxHash.slice(-8)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!form.daoEnabled && (
        <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-6 text-center">
          <span className="text-3xl">🏛️</span>
          <p className="mt-2 text-sm font-medium text-[var(--color-fg)]">
            You can create a DAO later from your creator dashboard
          </p>
          <Link
            href="/dao/create"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[10px] font-semibold text-[var(--color-fg)] hover:border-degen-500/30 transition-all"
          >
            Go to DAO Creator →
          </Link>
        </div>
      )}

      {form.daoEnabled && !form.daoDeployed && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={daoDeploy}
            disabled={form.daoDeploying}
            className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-30 active:scale-[0.98]"
          >
            {form.daoDeploying ? 'Creating DAO...' : '🚀 Create DAO with Coin'}
          </button>
        </div>
      )}
    </div>
  );
}
