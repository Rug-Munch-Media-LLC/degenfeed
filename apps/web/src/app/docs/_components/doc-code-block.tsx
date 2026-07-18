'use client';

import { useCallback, useState } from 'react';

interface CodeBlockProps {
  children: string;
  lang?: string;
  title?: string;
}

export function CodeBlock({ children, lang = 'bash', title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-wider text-[var(--color-muted)] uppercase">
            {lang}
          </span>
          {title && (
            <>
              <span className="text-gray-600">|</span>
              <span className="font-mono text-[10px] text-[var(--color-muted)]">{title}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-[10px] text-[var(--color-muted)] opacity-0 transition-all hover:text-[var(--color-fg)] group-hover:opacity-100"
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? 'Copied!' : 'Copy'}
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

interface CodeTabsProps {
  tabs: { label: string; lang?: string; code: string }[];
}

export function CodeTabs({ tabs }: CodeTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = tabs[activeIndex];

  return (
    <div className="my-3">
      <div className="flex overflow-x-auto rounded-t-lg border border-[var(--color-glass-border)] border-b-0 bg-[var(--color-card)]">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`px-3 py-2 text-[11px] font-medium transition-colors ${
              i === activeIndex
                ? 'border-b-2 border-degen-400 text-degen-400 bg-degen-500/5'
                : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active && (
        <CodeBlock lang={active.lang ?? tabLabelToLang(active.label)}>{active.code}</CodeBlock>
      )}
    </div>
  );
}

function tabLabelToLang(label: string): string {
  const map: Record<string, string> = {
    JavaScript: 'javascript',
    TypeScript: 'typescript',
    Python: 'python',
    curl: 'bash',
    Shell: 'bash',
    Solidity: 'solidity',
    JSON: 'json',
  };
  return map[label] ?? 'text';
}
