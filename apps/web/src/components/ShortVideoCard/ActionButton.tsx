'use client';

import { memo } from 'react';
import { formatCount } from './helpers';

export interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}

export const ActionButton = memo(function ActionButton({
  icon,
  label,
  count,
  active = false,
  onClick,
  color,
}: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-0.5 transition-transform active:scale-90"
      aria-label={`${label}${count != null ? ` — ${formatCount(count)}` : ''}`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all
        ${
          active
            ? 'bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
            : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
        }`}
        style={active && color ? { backgroundColor: `${color}22`, color } : undefined}
      >
        {icon}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] font-medium text-white/70">{formatCount(count)}</span>
      )}
    </button>
  );
});
