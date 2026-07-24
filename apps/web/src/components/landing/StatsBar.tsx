'use client';

import { useEffect, useState } from 'react';

/**
 * StatsBar — Key platform metrics with counting animation and "Built in public" link.
 */

const MILESTONES = [
  { label: 'Tweets Posted', value: 10427, suffix: '+', icon: '✧' },
  { label: 'Protocols Bridged', value: 18, suffix: '', icon: '⬡' },
  { label: 'Identities Linked', value: 2847, suffix: '+', icon: '◈' },
] as const;

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(target / 60);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(start);
      }
    }, duration / 60);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export function StatsBar() {
  return (
    <section
      className="border-y px-4 py-14 md:py-18"
      id="stats"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 grid gap-6 sm:grid-cols-3">
          {MILESTONES.map((m) => (
            <div key={m.label} className="text-center">
              <div className="mb-2 text-2xl" aria-hidden="true">
                {m.icon}
              </div>
              <div
                className="text-3xl font-black md:text-4xl"
                style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-heading)' }}
              >
                <AnimatedCounter target={m.value} suffix={m.suffix} />
              </div>
              <div
                className="mt-1 text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--color-muted)' }}
              >
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* Built in public */}
        <div className="text-center">
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-semibold transition-all duration-200 hover:bg-[var(--color-accent-soft)]"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-fg-secondary)',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
            </svg>
            Built in public — star on Forgejo
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
