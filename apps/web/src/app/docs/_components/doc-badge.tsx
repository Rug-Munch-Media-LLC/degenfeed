import type { ReactNode } from 'react';

const colors: Record<string, string> = {
  green: 'bg-green-900/30 text-green-400 border-green-500/20',
  yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/20',
  purple: 'bg-purple-900/30 text-purple-400 border-purple-500/20',
  blue: 'bg-blue-900/30 text-blue-400 border-blue-500/20',
  red: 'bg-red-900/30 text-red-400 border-red-500/20',
  gray: 'bg-[var(--color-muted)]/20 text-[var(--color-muted)] border-[var(--color-border)]/30',
};

export function Badge({
  children,
  color = 'gray',
}: {
  children: ReactNode;
  color?: keyof typeof colors;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium ${colors[color] ?? colors.gray}`}
    >
      {children}
    </span>
  );
}
