import type { ReactNode } from 'react';

const styles: Record<string, { border: string; bg: string; icon: string; label: string }> = {
  info: { border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: 'ℹ', label: 'Info' },
  warning: { border: 'border-yellow-500/20', bg: 'bg-yellow-500/5', icon: '⚠', label: 'Warning' },
  tip: { border: 'border-degen-500/20', bg: 'bg-degen-500/5', icon: '💡', label: 'Tip' },
  danger: { border: 'border-red-500/20', bg: 'bg-red-500/5', icon: '✕', label: 'Danger' },
};

export function Callout({
  type = 'info',
  children,
}: {
  type?: keyof typeof styles;
  children: ReactNode;
}) {
  const s = styles[type] ?? styles.info;
  return (
    <div className={`my-4 rounded-lg border ${s.border} ${s.bg} p-4`}>
      <div className="flex gap-3">
        <span className="mt-0.5 flex-shrink-0 text-sm">{s.icon}</span>
        <div className="min-w-0 text-sm text-gray-300 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-degen-400 [&_code]:text-xs">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            {s.label}
          </span>
          {children}
        </div>
      </div>
    </div>
  );
}
