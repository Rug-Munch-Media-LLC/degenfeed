'use client';

import type { DAOFormState } from './types';
import { VOTING_MODEL_DESCRIPTIONS, TIMELOCK_OPTIONS, VOTING_PERIOD_OPTIONS, MOCK_USER_COINS } from './constants';

interface StepGovernanceProps {
  form: DAOFormState;
  update: <K extends keyof DAOFormState>(key: K, value: DAOFormState[K]) => void;
}

export default function StepGovernance({ form, update }: StepGovernanceProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Voting Token</h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => update('votingTokenType', 'existing')}
              className={`flex-1 rounded-lg border p-3 text-left transition-all ${form.votingTokenType === 'existing' ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]' : 'border-[var(--color-glass-border)] hover:border-[var(--color-accent)]/20'}`}
            >
              <div className="text-xs font-semibold text-[var(--color-fg)]">Use my creator coin</div>
              <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">Existing token becomes governance token</div>
            </button>
            <button type="button" onClick={() => update('votingTokenType', 'new')}
              className={`flex-1 rounded-lg border p-3 text-left transition-all ${form.votingTokenType === 'new' ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]' : 'border-[var(--color-glass-border)] hover:border-[var(--color-accent)]/20'}`}
            >
              <div className="text-xs font-semibold text-[var(--color-fg)]">Create new governance token</div>
              <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">Deploy a new ERC-20 / SPL token</div>
            </button>
          </div>

          {form.votingTokenType === 'existing' && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">Select your creator coin:</span>
              <div className="space-y-1">
                {MOCK_USER_COINS.map((coin) => (
                  <button key={coin.id} type="button" onClick={() => update('existingCoinId', coin.id)}
                    className={`w-full rounded-lg border p-2.5 text-left text-xs transition-all ${form.existingCoinId === coin.id ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]' : 'border-[var(--color-glass-border)]'}`}
                  >
                    <span className="font-semibold text-[var(--color-fg)]">${coin.symbol}</span>
                    <span className="ml-2 text-[var(--color-muted)]">{coin.name}</span>
                    <span className="ml-2 text-[var(--color-muted)]">{Number(coin.balance).toLocaleString()} balance</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.votingTokenType === 'new' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Token Name</span>
                <input type="text" value={form.newTokenName} placeholder="Governance Token"
                  onChange={(e) => update('newTokenName', e.target.value)} className="input text-sm w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Symbol</span>
                <input type="text" value={form.newTokenSymbol} placeholder="GOV"
                  onChange={(e) => update('newTokenSymbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                  className="input text-sm w-full font-mono" maxLength={7}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">Initial Supply</span>
                <input type="text" value={form.newTokenSupply}
                  onChange={(e) => update('newTokenSupply', e.target.value.replace(/[^0-9]/g, ''))}
                  className="input text-sm w-full font-mono"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Voting Model</h2>
        <div className="flex gap-2">
          {(['token', 'quadratic'] as const).map((model) => (
            <button key={model} type="button" onClick={() => update('votingModel', model)}
              className={`flex-1 rounded-lg border p-3 text-left transition-all ${form.votingModel === model ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]' : 'border-[var(--color-glass-border)]'}`}
            >
              <div className="text-xs font-semibold text-[var(--color-fg)]">{VOTING_MODEL_DESCRIPTIONS[model].label}</div>
              <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">{VOTING_MODEL_DESCRIPTIONS[model].description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Voting Parameters</h2>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
              <span>Proposal Threshold</span>
              <span className="text-[var(--color-accent)]">{form.proposalThreshold}%</span>
            </span>
            <input type="range" min={0} max={5} step={0.1} value={form.proposalThreshold}
              onChange={(e) => update('proposalThreshold', Number(e.target.value))} className="w-full accent-[var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-fg)]">
              <span>Quorum</span>
              <span className="text-[var(--color-accent)]">{form.quorumPercent}%</span>
            </span>
            <input type="range" min={1} max={75} step={1} value={form.quorumPercent}
              onChange={(e) => update('quorumPercent', Number(e.target.value))} className="w-full accent-[var(--color-accent)]"
            />
          </label>
          <div>
            <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">Voting Period</span>
            <div className="flex flex-wrap gap-2">
              {VOTING_PERIOD_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => update('votingPeriodDays', opt.value)}
                  className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${form.votingPeriodDays === opt.value ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">Timelock Delay</span>
            <div className="flex flex-wrap gap-2">
              {TIMELOCK_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => update('timelockDelayHours', opt.value)}
                  className={`rounded-lg border px-4 py-2 text-[11px] font-medium transition-all ${form.timelockDelayHours === opt.value ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'border-[var(--color-glass-border)] text-[var(--color-muted)]'}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
