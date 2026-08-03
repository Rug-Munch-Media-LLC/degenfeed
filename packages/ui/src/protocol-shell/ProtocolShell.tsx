'use client';

/**
 * ProtocolShell — Full-page DegenFeed shell wrapper for headless protocols
 *
 * Composes ProtocolHeader + ProtocolSidebar + ProtocolFrame + footer into
 * a cohesive page layout that applies our cyberpunk design over any
 * federated / headless protocol.
 *
 * Supports: PeerTube, Pixelfed, Lemmy, Mastodon/GTS, BookWyrm,
 *           Mobilizon, WriteFreely, and any future headless protocol.
 */

import { useCallback, useState } from 'react';
import {
  ProtocolHeader,
  type ProtocolHeaderNavItem,
  type ProtocolHeaderStats,
} from './ProtocolHeader';
import {
  ProtocolSidebar,
  type ProtocolSidebarSection,
} from './ProtocolSidebar';
import { ProtocolFrame } from './ProtocolFrame';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolShellProps {
  /** Protocol identifier */
  protocol: string;
  /** Protocol display name */
  protocolLabel: string;
  /** Protocol brand color (hex) */
  color: string;
  /** Logo emoji or text */
  logo?: string;
  /** URL to embed in the main frame */
  embedUrl: string;
  /** Title for the page / header */
  title: string;
  /** Description / subtitle */
  description?: string;
  /** Navigation items for the header */
  navItems?: ProtocolHeaderNavItem[];
  /** Stats for the header */
  headerStats?: ProtocolHeaderStats[];
  /** Sidebar sections */
  sidebarSections?: ProtocolSidebarSection[];
  /** Sidebar quick stats */
  sidebarStats?: { label: string; value: string | number }[];
  /** Sidebar collapsed state toggle */
  defaultSidebarCollapsed?: boolean;
  /** Custom actions rendered in the header */
  actions?: React.ReactNode;
  /** Custom bottom content (sidebar footer) */
  sidebarBottom?: React.ReactNode;
  /** Aspect ratio for the embedded frame */
  frameAspectRatio?: number;
  /** If true uses a sandboxed iframe */
  sandboxed?: boolean;
  /** If true, disables the sidebar entirely (mobile-first) */
  noSidebar?: boolean;
  /** If provided, renders custom main content instead of ProtocolFrame */
  children?: React.ReactNode;
  /** Breadcrumb items */
  breadcrumbs?: { label: string; href?: string }[];
  /** Feature flags for this protocol instance */
  featureFlags?: Record<string, boolean>;
}

// ─── Known protocols lookup ─────────────────────────────────────────────

export const PROTOCOL_META: Record<
  string,
  { label: string; color: string; logo: string; description: string }
> = {
  peertube: {
    label: 'PeerTube',
    color: '#e74c3c',
    logo: '▶',
    description: 'Decentralized video hosting',
  },
  pixelfed: {
    label: 'Pixelfed',
    color: '#c44a8b',
    logo: '📷',
    description: 'Federated image sharing',
  },
  lemmy: {
    label: 'Lemmy',
    color: '#00b868',
    logo: '🧩',
    description: 'Federated link aggregator',
  },
  mastodon: {
    label: 'Mastodon',
    color: '#6364ff',
    logo: '🐘',
    description: 'Federated microblogging',
  },
  gotosocial: {
    label: 'GoToSocial',
    color: '#6364ff',
    logo: '🐢',
    description: 'Lightweight federated social',
  },
  bookwyrm: {
    label: 'BookWyrm',
    color: '#4a90d9',
    logo: '📚',
    description: 'Federated book cataloging',
  },
  mobilizon: {
    label: 'Mobilizon',
    color: '#f5821f',
    logo: '📅',
    description: 'Federated event management',
  },
  writefreely: {
    label: 'WriteFreely',
    color: '#3b82f6',
    logo: '✎',
    description: 'Federated publishing',
  },
  farcaster: {
    label: 'Farcaster',
    color: '#8a63d2',
    logo: '🟣',
    description: 'On-chain social network',
  },
};

// ─── Component ──────────────────────────────────────────────────────────

export function ProtocolShell({
  protocol,
  protocolLabel,
  color,
  logo,
  embedUrl,
  title,
  description,
  navItems = [],
  headerStats = [],
  sidebarSections = [],
  sidebarStats = [],
  defaultSidebarCollapsed = false,
  actions,
  sidebarBottom,
  frameAspectRatio,
  sandboxed = true,
  noSidebar = false,
  children,
  breadcrumbs = [],
  featureFlags = {},
}: ProtocolShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultSidebarCollapsed);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <div
      className="mx-auto min-h-screen"
      style={{
        maxWidth: 'var(--content-max-full, 1260px)',
        padding: '0 var(--space-md, 1rem)',
      }}
    >
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="mb-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-40">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="transition-colors hover:text-[var(--color-fg)]">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-[var(--color-fg-secondary)]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Protocol Header */}
      <ProtocolHeader
        protocol={protocol}
        protocolLabel={protocolLabel}
        color={color}
        logo={logo}
        navItems={navItems}
        stats={headerStats}
        isEmbed={true}
        title={title}
        actions={
          <div className="flex items-center gap-2">
            {/* Sidebar toggle */}
            {!noSidebar && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="inline-flex items-center justify-center rounded-lg p-2 text-sm transition-colors hover:bg-[var(--color-overlay-hover)]"
                style={{ color: 'var(--color-muted)' }}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? '☰' : '✕'}
              </button>
            )}
            {actions}
          </div>
        }
      />

      {/* Description */}
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-secondary)]">
          {description}
        </p>
      )}

      {/* Feature flags indicator */}
      {Object.keys(featureFlags).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(featureFlags).map(([flag, enabled]) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono"
              style={{
                backgroundColor: enabled ? `${color}12` : 'var(--color-muted-bg)',
                color: enabled ? color : 'var(--color-muted)',
              }}
            >
              {enabled ? '✓' : '○'} {flag}
            </span>
          ))}
        </div>
      )}

      {/* Body: sidebar + content */}
      <div className="mt-5 flex gap-5">
        {/* Sidebar */}
        {!noSidebar && (
          <div className="hidden shrink-0 md:block">
            <ProtocolSidebar
              protocol={protocol}
              color={color}
              protocolLabel={protocolLabel}
              sections={sidebarSections}
              stats={sidebarStats}
              collapsed={sidebarCollapsed}
              bottomContent={sidebarBottom}
            />
          </div>
        )}

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {children || (
            <ProtocolFrame
              protocol={protocol}
              color={color}
              src={embedUrl}
              protocolLabel={protocolLabel}
              title={title}
              aspectRatio={frameAspectRatio}
              sandboxed={sandboxed}
              size="full"
            />
          )}
        </div>
      </div>

      {/* Footer branding */}
      <footer
        className="mt-12 flex flex-col items-center justify-between gap-3 border-t py-6 sm:flex-row"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <a
            href="/"
            className="font-heading font-bold tracking-tight"
            style={{ color: 'var(--color-accent)' }}
          >
            DegenFeed
          </a>
          <span className="opacity-40">·</span>
          <span>
            {protocolLabel} embedded via{' '}
            <a href="/feed" className="underline underline-offset-2 hover:text-[var(--color-fg)]">
              DegenFeed
            </a>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
          <a href="/privacy" className="hover:text-[var(--color-fg)]">Privacy</a>
          <a href="/terms" className="hover:text-[var(--color-fg)]">Terms</a>
          <a href="https://{protocol}.degenfeed.xyz" className="hover:text-[var(--color-fg)]" target="_blank" rel="noopener noreferrer">
            {protocolLabel} Instance ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
