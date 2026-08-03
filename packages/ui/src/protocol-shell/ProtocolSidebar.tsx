'use client';

/**
 * ProtocolSidebar — Protocol-specific navigation sidebar
 *
 * Renders a compact vertical sidebar with protocol links, quick stats,
 * and a "Powered by DegenFeed" footer. Designed for desktop layouts
 * alongside embedded protocol content.
 */

import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolSidebarLink {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  active?: boolean;
  external?: boolean;
}

export interface ProtocolSidebarSection {
  title: string;
  links: ProtocolSidebarLink[];
}

export interface ProtocolSidebarProps {
  /** Protocol identifier */
  protocol: string;
  /** Protocol brand color */
  color: string;
  /** Protocol display name */
  protocolLabel: string;
  /** Sidebar sections */
  sections: ProtocolSidebarSection[];
  /** Quick stats at the top */
  stats?: { label: string; value: string | number }[];
  /** If true, renders a narrower collapsed variant */
  collapsed?: boolean;
  /** Custom bottom content */
  bottomContent?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────

export function ProtocolSidebar({
  protocol: _protocol,
  color,
  protocolLabel,
  sections,
  stats = [],
  collapsed = false,
  bottomContent,
}: ProtocolSidebarProps) {
  return (
    <aside
      className="flex flex-col overflow-hidden rounded-xl border"
      style={{
        borderColor: `${color}22`,
        backgroundColor: 'var(--color-card)',
        width: collapsed ? '64px' : '240px',
        transition: 'width var(--duration-normal) var(--ease-out)',
      }}
      aria-label={`${protocolLabel} sidebar`}
    >
      {/* DegenFeed branding bar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        {!collapsed && (
          <>
            <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: 'var(--color-accent)' }}>
              DegenFeed
            </span>
            <span className="text-[10px]" style={{ color: `${color}99` }}>
              /&nbsp;{protocolLabel}
            </span>
          </>
        )}
      </div>

      {/* Stats */}
      {stats.length > 0 && !collapsed && (
        <div
          className="grid grid-cols-2 gap-2 px-3 py-3"
          style={{ borderBottom: '1px solid var(--color-glass-border)' }}
        >
          {stats.map((stat, i) => (
            <div key={`stat-${i}`}>
              <div className="text-[18px] font-bold font-mono leading-none tracking-tight" style={{ color }}>
                {stat.value}
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--color-muted)] truncate">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed stat summary */}
      {stats.length > 0 && collapsed && (
        <div className="flex flex-col items-center gap-1 px-2 py-3" style={{ borderBottom: '1px solid var(--color-glass-border)' }}>
          <span className="font-mono text-sm font-bold" style={{ color }}>
            {stats.reduce((sum, s) => sum + Number(s.value), 0)}
          </span>
        </div>
      )}

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={`${protocolLabel} sections`}>
        {sections.map((section, si) => (
          <div key={`section-${si}`} className="mb-4">
            {!collapsed && (
              <h3
                className="mb-1.5 px-2 text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
                {section.title}
              </h3>
            )}
            <ul className="space-y-0.5" role="list">
              {section.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-overlay-hover)]"
                      style={{
                        color: link.active ? color : 'var(--color-fg-secondary)',
                        backgroundColor: link.active ? `${color}10` : 'transparent',
                      }}
                      aria-current={link.active ? 'page' : undefined}
                    >
                      {link.icon && <span className="w-5 text-center text-base">{link.icon}</span>}
                      {!collapsed && (
                        <span className="flex-1 truncate text-[13px]">{link.label}</span>
                      )}
                      {!collapsed && link.badge !== undefined && (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium"
                          style={{
                            backgroundColor: `${color}15`,
                            color,
                          }}
                        >
                          {link.badge}
                        </span>
                      )}
                      {collapsed && link.icon && (
                        <span className="sr-only">{link.label}</span>
                      )}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-overlay-hover)]"
                      style={{
                        color: link.active ? color : 'var(--color-fg-secondary)',
                        backgroundColor: link.active ? `${color}10` : 'transparent',
                      }}
                      aria-current={link.active ? 'page' : undefined}
                    >
                      {link.icon && <span className="w-5 text-center text-base">{link.icon}</span>}
                      {!collapsed && (
                        <span className="flex-1 truncate text-[13px]">{link.label}</span>
                      )}
                      {!collapsed && link.badge !== undefined && (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium"
                          style={{
                            backgroundColor: `${color}15`,
                            color,
                          }}
                        >
                          {link.badge}
                        </span>
                      )}
                      {collapsed && link.icon && (
                        <span className="sr-only">{link.label}</span>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom branding */}
      {!collapsed && (
        <div
          className="px-3 py-2.5"
          style={{ borderTop: '1px solid var(--color-glass-border)' }}
        >
          {bottomContent || (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--color-accent)' }}
                aria-hidden="true"
              />
              <span className="text-[10px] font-medium tracking-wide text-[var(--color-muted)]">
                Powered by DegenFeed
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
