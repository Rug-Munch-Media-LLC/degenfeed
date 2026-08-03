'use client';

import { formatSize } from '../constants';
import type { StorageForecast } from '../types';

export function StoragePrediction({ forecast }: { forecast: StorageForecast }) {
  const projectedReadable30d = formatSize(forecast.projectedBytes30d);
  const projectedReadable90d = formatSize(forecast.projectedBytes90d);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h4 className="mb-3 text-xs font-semibold text-[var(--color-fg)]">📈 Storage Prediction</h4>

      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Current</span>
            <span className="tabular-nums">{formatSize(forecast.currentBytes ?? 0)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Projected (30d)</span>
            <span className="tabular-nums">{projectedReadable30d}</span>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Projected (90d)</span>
            <span className="tabular-nums font-medium text-degen-400">{projectedReadable90d}</span>
          </div>
        </div>

        {forecast.daysUntilFull !== null && (
          <div
            className={`rounded-lg px-3 py-2 text-[10px] ${
              forecast.daysUntilFull <= 0
                ? 'bg-red-500/10 text-red-400'
                : forecast.daysUntilFull <= 30
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : forecast.daysUntilFull <= 90
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-green-500/10 text-green-400'
            }`}
          >
            {forecast.daysUntilFull <= 0
              ? '⚠️ Free tier exceeded'
              : `📊 Free tier full in ~${forecast.daysUntilFull} days`}
          </div>
        )}

        <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
          {forecast.recommendation}
        </p>
      </div>
    </div>
  );
}
