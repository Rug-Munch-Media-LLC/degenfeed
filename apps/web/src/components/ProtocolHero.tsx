'use client';

import type { ProtocolFeedConfig } from './ProtocolFeedPage';

interface ProtocolHeroProps {
  config: ProtocolFeedConfig;
}

export function ProtocolHero({ config }: ProtocolHeroProps) {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl border transition-all"
      style={{
        borderColor: `${config.color}33`,
        background: `linear-gradient(145deg, ${config.color}18 0%, ${config.color}06 50%, transparent 100%)`,
      }}
    >
      {/* Decorative elements */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-15 blur-3xl"
        style={{ backgroundColor: config.color }}
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: config.color }}
      />
      <div
        className="pointer-events-none absolute right-1/4 top-1/3 h-0.5 w-32 rotate-45 opacity-20"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        }}
      />

      <div className="relative px-5 py-6 sm:px-7 sm:py-8">
        {/* Top row: icon + title */}
        <div className="mb-5 flex items-start gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl sm:h-20 sm:w-20 sm:text-3xl"
            style={{
              backgroundColor: `${config.color}22`,
              color: config.color,
              boxShadow: `0 0 30px ${config.color}33, inset 0 1px 0 ${config.color}22`,
            }}
          >
            {config.icon}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ color: 'var(--color-fg)' }}
              >
                {config.name}
              </h1>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: `${config.color}22`, color: config.color }}
              >
                {config.id}
              </span>
            </div>
            <p className="mt-1 max-w-lg text-sm" style={{ color: 'var(--color-muted)' }}>
              {config.description}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {config.stats.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: config.color, opacity: 0.6 }}
              />
              <div>
                <span
                  className="text-base font-bold tabular-nums sm:text-lg"
                  style={{ color: config.color }}
                >
                  {s.value}
                </span>
                <span className="ml-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {s.label}
                </span>
              </div>
              {i < config.stats.length - 1 && (
                <div
                  className="hidden h-6 w-px sm:block"
                  style={{ backgroundColor: `${config.color}22` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
