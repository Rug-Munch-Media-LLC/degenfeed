'use client';

import type { SignalSource } from './types';
import { Toggle } from './WeightSliders';

/* ─── Signal Toggle ─────────────────────────────────────────── */

export default function SignalToggle({
  signal,
  onToggle,
}: {
  signal: SignalSource;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-2.5"
      style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <span className="text-base shrink-0" aria-hidden="true">
        {signal.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
          {signal.label}
        </p>
        <p className="text-[10px] truncate" style={{ color: 'var(--color-muted)' }}>
          {signal.description}
        </p>
      </div>
      <Toggle id={`signal-${signal.id}`} checked={signal.enabled} onChange={onToggle} />
    </div>
  );
}

/* ─── Signal Sources Section ────────────────────────────────── */

export function SignalSourcesSection({
  signals,
  onToggleSignal,
}: {
  signals: SignalSource[];
  onToggleSignal: (signalId: string) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">📡</span>
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
        >
          Signal Sources
        </h2>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
        Toggle which data signals the algorithm uses to rank content.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {signals.map((signal) => (
          <SignalToggle key={signal.id} signal={signal} onToggle={() => onToggleSignal(signal.id)} />
        ))}
      </div>
    </section>
  );
}
