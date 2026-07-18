'use client';

export interface FundingRound {
  id: string;
  project: string;
  description: string;
  amount: string;
  stage: string;
  investors: string[];
  chain?: string;
  category?: string;
  source: string;
  sourceUrl: string;
  announcedAt: number;
}

const STAGE_COLORS: Record<string, string> = {
  seed: '#8b5cf6',
  'pre-seed': '#a78bfa',
  'series a': '#3b82f6',
  'series b': '#2563eb',
  'series c': '#1d4ed8',
  strategic: '#f59e0b',
  private: '#10b981',
  public: '#ef4444',
  grant: '#6366f1',
  angel: '#ec4899',
};

function getStageColor(stage: string): string {
  const key = stage.toLowerCase();
  for (const [k, v] of Object.entries(STAGE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#6b7280';
}

export function FundingCard({ round }: { round: FundingRound }) {
  const stageColor = getStageColor(round.stage);

  return (
    <div
      className="card border-l-4 transition-all hover:bg-[var(--color-muted)]"
      style={{ borderLeftColor: stageColor }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${stageColor}22`, color: stageColor }}
        >
          {round.stage || 'Round'}
        </span>
        <span className="text-xs text-gray-500">{round.chain || 'Multi-chain'}</span>
        <span className="ml-auto text-xs font-mono font-bold text-degen-500">{round.amount}</span>
      </div>

      <h3 className="mb-1 text-base font-bold text-[var(--color-fg)]">{round.project}</h3>
      <p className="mb-3 text-sm text-gray-400 line-clamp-2">{round.description}</p>

      <div className="mb-2 flex flex-wrap gap-1">
        {round.investors.slice(0, 4).map((inv) => (
          <span key={inv} className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs text-gray-300">
            {inv}
          </span>
        ))}
        {round.investors.length > 4 && (
          <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs text-gray-500">
            +{round.investors.length - 4}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{new Date(round.announcedAt).toLocaleDateString()}</span>
        <a
          href={round.sourceUrl}
          target="_blank" rel="noopener noreferrer"
          rel="noopener noreferrer"
          className="text-degen-500 hover:underline"
        >
          {round.source}
        </a>
      </div>
    </div>
  );
}
