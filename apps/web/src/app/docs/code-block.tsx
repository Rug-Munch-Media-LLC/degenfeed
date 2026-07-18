'use client';

export function CodeBlock({ children }: { children: string }) {
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-2">
        <span className="font-mono text-[10px] tracking-wider text-[var(--color-muted)] uppercase">
          bash
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(children)}
          className="rounded px-2 py-0.5 text-[10px] text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-fg)] group-hover:opacity-100"
          aria-label="Copy code to clipboard"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-xs leading-relaxed text-[var(--color-muted)]">
          {children}
        </code>
      </pre>
    </div>
  );
}
