'use client';

import type { PublishTarget } from './types';
import { PUBLISH_TARGETS } from './types';

export default function PublishTargetPills({
  selected,
  onToggle,
}: {
  selected: Set<PublishTarget>;
  onToggle: (target: PublishTarget) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PUBLISH_TARGETS.map((p) => {
        const isSelected = selected.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              isSelected
                ? 'text-white shadow-sm'
                : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-white/20 hover:text-[var(--color-fg)]'
            }`}
            style={
              isSelected
                ? { backgroundColor: `${p.color}30`, color: p.color, borderColor: `${p.color}50` }
                : {}
            }
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
            {isSelected && <span className="ml-0.5 text-[8px]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
