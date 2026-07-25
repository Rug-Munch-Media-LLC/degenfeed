'use client';

import type { CoinFormState } from './types';

interface StepBenefitsProps {
  form: CoinFormState;
  update: <K extends keyof CoinFormState>(key: K, value: CoinFormState[K]) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
      role="switch" aria-checked={checked}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function StepBenefits({ form, update }: StepBenefitsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Token Holder Benefits</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-xs font-medium text-[var(--color-fg)]"><span className="mr-1.5">🔐</span> Token-Gated Content</div>
              <div className="text-[10px] text-[var(--color-muted)]">Holders of X $TICKER can access exclusive posts</div>
            </div>
            <Toggle checked={form.tokenGatedContent} onChange={() => update('tokenGatedContent', !form.tokenGatedContent)} />
          </label>
          {form.tokenGatedContent && (
            <div className="ml-5">
              <label className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-muted)]">Min tokens for access:</span>
                <input type="text" value={form.minTokensForAccess} onChange={(e) => update('minTokensForAccess', e.target.value)} className="input w-24 text-[10px] font-mono" />
                <span className="text-[10px] text-[var(--color-muted)]">${form.symbol || 'TICKER'}</span>
              </label>
            </div>
          )}

          <label className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-xs font-medium text-[var(--color-fg)]"><span className="mr-1.5">💰</span> Revenue Share</div>
              <div className="text-[10px] text-[var(--color-muted)]">X% of tips go to token holders proportionally</div>
            </div>
            <Toggle checked={form.revenueShare} onChange={() => update('revenueShare', !form.revenueShare)} />
          </label>
          {form.revenueShare && (
            <div className="ml-5">
              <label className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-muted)]">Share %:</span>
                <input type="range" min={1} max={50} value={form.revenueSharePercent}
                  onChange={(e) => update('revenueSharePercent', Number(e.target.value))} className="w-24 accent-degen-400" />
                <span className="text-[10px] text-degen-400 font-mono">{form.revenueSharePercent}%</span>
              </label>
            </div>
          )}

          <label className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-xs font-medium text-[var(--color-fg)]"><span className="mr-1.5">🗳️</span> Governance</div>
              <div className="text-[10px] text-[var(--color-muted)]">Holders vote on coin parameters</div>
            </div>
            <Toggle checked={form.governanceEnabled} onChange={() => update('governanceEnabled', !form.governanceEnabled)} />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-xs font-medium text-[var(--color-fg)]"><span className="mr-1.5">💬</span> Community Access</div>
              <div className="text-[10px] text-[var(--color-muted)]">Holders join a private Telegram/Discord</div>
            </div>
            <Toggle checked={form.communityAccess} onChange={() => update('communityAccess', !form.communityAccess)} />
          </label>
          {form.communityAccess && (
            <div className="ml-5">
              <label className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-muted)]">Invite link:</span>
                <input type="text" placeholder="https://t.me/..." value={form.communityLink}
                  onChange={(e) => update('communityLink', e.target.value)} className="input flex-1 text-[10px]" />
              </label>
            </div>
          )}

          <label className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-xs font-medium text-[var(--color-fg)]"><span className="mr-1.5">🎙️</span> Live AMA Scheduling</div>
              <div className="text-[10px] text-[var(--color-muted)]">Schedule live audio/video events for holders</div>
            </div>
            <Toggle checked={form.amaScheduling} onChange={() => update('amaScheduling', !form.amaScheduling)} />
          </label>
        </div>
      </div>
    </div>
  );
}
