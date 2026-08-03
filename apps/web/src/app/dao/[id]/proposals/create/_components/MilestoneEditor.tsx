'use client';

import { MOCK_TOKENS } from '../constants';
import type { Milestone } from '../types';

export function MilestoneEditor({
  milestones,
  onChange,
}: {
  milestones: Milestone[];
  onChange: (ms: Milestone[]) => void;
}) {
  const addMilestone = () => {
    const newMs: Milestone = {
      id: crypto.randomUUID?.() || String(Date.now()),
      description: '',
      amount: '',
      token: 'USDC',
    };
    onChange([...milestones, newMs]);
  };

  const removeMilestone = (id: string) => onChange(milestones.filter((m) => m.id !== id));

  const updateMilestone = (id: string, field: keyof Milestone, value: string) => {
    onChange(milestones.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-fg)]">Milestones</span>
        <button
          type="button"
          onClick={addMilestone}
          className="rounded-lg bg-degen-500/15 px-2.5 py-1 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-colors"
        >
          + Add Milestone
        </button>
      </div>
      {milestones.length === 0 && (
        <p className="text-[10px] text-[var(--color-muted)]">
          No milestones added. Add at least one milestone to proceed.
        </p>
      )}
      {milestones.map((ms, i) => (
        <div
          key={ms.id}
          className="relative rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
              Milestone {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeMilestone(ms.id)}
              className="text-[9px] text-red-400 hover:text-red-300 transition-colors"
            >
              Remove
            </button>
          </div>
          <div className="mb-2">
            <label
              className="mb-1 block text-[9px] text-[var(--color-muted)]"
              htmlFor="field-446391c6"
            >
              Description
            </label>
            <input
              id="field-446391c6"
              type="text"
              value={ms.description}
              onChange={(e) => updateMilestone(ms.id, 'description', e.target.value)}
              placeholder="What gets delivered at this milestone?"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label
                className="mb-1 block text-[9px] text-[var(--color-muted)]"
                htmlFor="field-4bc1830a"
              >
                Amount
              </label>
              <input
                id="field-4bc1830a"
                type="text"
                value={ms.amount}
                onChange={(e) => updateMilestone(ms.id, 'amount', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/50 outline-none focus:border-degen-500 transition-colors font-mono"
              />
            </div>
            <div className="w-24">
              <label
                className="mb-1 block text-[9px] text-[var(--color-muted)]"
                htmlFor="field-daa7761e"
              >
                Token
              </label>
              <select
                id="field-daa7761e"
                value={ms.token}
                onChange={(e) => updateMilestone(ms.id, 'token', e.target.value)}
                className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
              >
                {MOCK_TOKENS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
