'use client';

/**
 * ProtocolHeader — Protocol-colored branded header bar
 *
 * Renders the top navigation bar for any headless protocol embedded in
 * DegenFeed. Applies the protocol's brand color as an accent while
 * keeping our typography, spacing, and glass-morphism shell.
 */

import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolHeaderNavItem {
  label: string;
  href: string;
  active?: boolean;
  icon?: string;
}

export interface ProtocolHeaderStats {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface ProtocolHeaderProps {
  /** Protocol identifier (e.g. 'peertube', 'pixelfed', 'farcaster') */
  protocol: string;
  /** Protocol display name */
  protocolLabel: string;
  /** Brand color in hex (e.g. '#8a63d2') */
  color: string;
  /** Protocol logo emoji or URL */
  logo?: string;
  /** Navigation items for the protocol */
  navItems?: ProtocolHeaderNavItem[];
  /** Stats to display in the header */
  stats?: ProtocolHeaderStats[];
  /** Whether this is a headless embed (show back-to-DegenFeed nav) */
  isEmbed?: boolean;
  /** Custom title override */
  title?: string;
  /** Action buttons rendered on the right */
  actions?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────

export function ProtocolHeader({
  protocol,
  protocolLabel,
  color,
  logo,
  navItems = [],
  stats = [],
  isEmbed = false,
  title,
  actions,
}: ProtocolHeaderProps) {
  const protocolInitial = protocolLabel.charAt(0).toUpperCase();

  return (
    <header
      className="relative overflow-hidden rounded-2xl border p-5"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(135deg, ${color}08 0%, var(--color-card) 100%)`,
      }}
    >
      {/* Subtle glow dot */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.07] blur-3xl"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {/* Top row: logo + title + actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Protocol logo */}
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold shadow-lg"
            style={{
              backgroundColor: `${color}18`,
              color,
              boxShadow: `0 0 24px ${color}15`,
            }}
          >
            {logo || protocolInitial}
          </div>

          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
              {title || protocolLabel}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase"
                style={{
                  backgroundColor: `${color}15`,
                  color,
                }}
              >
                {isEmbed ? '⚡ Embedded' : protocol}
              </span>
              {isEmbed && (
                <Link
                  href="/feed"
                  className="rounded-full px-2.5 py-0.5 text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  style={{ border: '1px solid var(--color-glass-border)' }}
                >
                  ← Back to DegenFeed
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Right-side actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Stats row */}
      {stats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-5">
          {stats.map((stat, i) => (
            <StatBadge key={`${stat.label}-${i}`} stat={stat} color={color} />
          ))}
        </div>
      )}

      {/* Navigation items */}
      {navItems.length > 0 && (
        <nav className="mt-5 flex flex-wrap gap-1.5" aria-label={`${protocolLabel} navigation`}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-[var(--duration-fast)]"
              style={{
                backgroundColor: item.active ? `${color}15` : 'transparent',
                color: item.active ? color : 'var(--color-muted)',
              }}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.icon && <span className="text-base">{item.icon}</span>}
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

// ─── Stat Badge ─────────────────────────────────────────────────────────

function StatBadge({ stat, color }: { stat: ProtocolHeaderStats; color: string }) {
  const trendIcon = stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→';
  const trendColor =
    stat.trend === 'up'
      ? 'var(--color-success)'
      : stat.trend === 'down'
        ? 'var(--color-danger)'
        : 'var(--color-muted)';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-muted)]">{stat.label}</span>
      <span className="font-semibold" style={{ color }}>
        {stat.value}
      </span>
      {stat.trend && (
        <span className="text-[11px]" style={{ color: trendColor }}>
          {trendIcon}
        </span>
      )}
    </div>
  );
}
