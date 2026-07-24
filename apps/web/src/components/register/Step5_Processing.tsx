'use client';

import { useMemo } from 'react';
import { PROCESSING_STEPS } from './constants';
import type { AccountResult, PlanId, ProcessingStep } from './types';

export function Step5_Processing({
  results,
  plan,
}: {
  results: Record<string, AccountResult>;
  plan: PlanId;
}) {
  const steps: ProcessingStep[] = useMemo(() => {
    const doneKeys = new Set(Object.keys(results));
    return PROCESSING_STEPS.map((step) => {
      const result = results[step.id];
      if (result) {
        return { ...step, status: result.ok ? ('done' as const) : ('failed' as const) };
      }
      if (step.id === 'ens' && plan !== 'complete') return { ...step, status: 'done' as const };
      if ((step.id === 'farcaster' || step.id === 'lens') && plan === 'free') {
        return { ...step, status: 'done' as const };
      }
      return { ...step, status: doneKeys.has(step.id) ? ('done' as const) : ('pending' as const) };
    });
  }, [results, plan]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Creating Your Accounts</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        We&apos;re setting everything up. This usually takes about 30 seconds.
      </p>

      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
              step.status === 'done'
                ? 'bg-degen-500/[0.04]'
                : step.status === 'failed'
                  ? 'bg-red-500/[0.04]'
                  : 'bg-[var(--color-card)]'
            }`}
          >
            {step.status === 'done' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-degen-500 text-[10px] text-black font-bold">
                ✓
              </span>
            )}
            {step.status === 'pending' && (
              <div className="flex h-5 w-5 items-center justify-center">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
              </div>
            )}
            {step.status === 'failed' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] text-red-400 font-bold">
                !
              </span>
            )}
            {step.status === 'pending' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[10px] text-[var(--color-muted)]">
                &middot;
              </span>
            )}
            <span
              className={`text-sm ${
                step.status === 'done'
                  ? 'text-degen-400'
                  : step.status === 'failed'
                    ? 'text-red-400'
                    : step.status === 'pending'
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)]'
              }`}
            >
              {step.label}
              {step.status === 'done' && ' ✓'}
              {step.status === 'failed' && ` — ${results[step.id]?.error || 'failed'}`}
            </span>
          </div>
        ))}
      </div>

      {Object.values(results).some((r) => !r.ok) && (
        <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            Some accounts couldn&apos;t be created automatically.{' '}
            <a
              href="https://warpcast.com/~/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Farcaster: Warpcast free signup
            </a>
            {' · '}
            <a
              href="https://lens.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Lens: lens.xyz free signup
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
