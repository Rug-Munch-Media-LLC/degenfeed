'use client';

import { SettingsSection } from './SettingsSection';

export interface GovernanceParam {
  key: string;
  label: string;
  value: string;
  description: string;
  requiresConstitutional: boolean;
}

export function GovernanceSection({ params }: { params: GovernanceParam[] }) {
  return (
    <SettingsSection
      title="Governance Parameters"
      description="DAO-wide governance rules. Changes to these parameters require a constitutional proposal."
    >
      <div className="space-y-3">
        {params.map((param) => (
          <div
            key={param.key}
            className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--color-fg)]">{param.label}</span>
                {param.requiresConstitutional && (
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[8px] text-purple-400">
                    Constitutional
                  </span>
                )}
              </div>
              <p className="text-[9px] text-[var(--color-muted)] mt-0.5">{param.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums text-[var(--color-fg)] font-mono">
                {param.value}
              </span>
              <button
                type="button"
                className="rounded-lg bg-purple-500/10 px-2.5 py-1 text-[9px] font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                {param.requiresConstitutional ? 'Propose Change' : 'Edit'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
