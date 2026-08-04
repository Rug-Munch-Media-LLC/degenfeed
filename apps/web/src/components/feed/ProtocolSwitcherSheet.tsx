'use client';

/**
 * @degenfeed/web — ProtocolSwitcherSheet
 *
 * Mobile bottom-sheet protocol picker. Opened from the quick-switcher
 * button in the mobile nav; groups every protocol by category (same
 * grouping as the desktop sidebar) and navigates with client-side
 * router.push so switching feels instant — no page reload.
 *
 * Only rendered for the current route; selection closes the sheet and
 * pushes the target route.
 */

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import {
  CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_PROTOCOLS,
  PROTOCOL_LIST,
  type ProtocolCategory,
} from './feed-protocols';

interface ProtocolMeta {
  label: string;
  color: string;
  icon: string;
  route: string;
  category: ProtocolCategory;
}

const PROTOCOL_META: Record<string, ProtocolMeta> = {};
for (const p of PROTOCOL_LIST) {
  PROTOCOL_META[p.id] = {
    label: p.label,
    color: p.color,
    icon: p.icon,
    route: p.route,
    category: p.category,
  };
}

const EXTRA_LINKS = [
  { id: 'discord', label: 'Discord', icon: '💬', color: '#5865f2', href: '/feed/discord' },
  { id: 'telegram', label: 'Telegram', icon: '✈', color: '#26a5e4', href: '/feed/telegram' },
  { id: 'github', label: 'GitHub', icon: '◉', color: '#6e40c9', href: '/feed/github' },
  { id: 'hive', label: 'Hive', icon: '◆', color: '#e31337', href: '/feed/hive' },
];

export function ProtocolSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  // Lock body scroll while the sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [router, onClose],
  );

  if (!open) return null;

  const renderRow = (pid: string, href: string, color: string, icon: string, label: string) => {
    const isActive = pathname === href;
    return (
      <button
        key={pid}
        type="button"
        onClick={() => go(href)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[var(--color-overlay)] text-[var(--color-fg)]'
            : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
        }`}
        style={isActive ? { backgroundColor: `${color}14`, color } : undefined}
        aria-current={isActive ? 'true' : undefined}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ backgroundColor: `${color}18`, color }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex-1 truncate">{label}</span>
        {isActive && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:hidden"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl border border-b-0 border-[var(--color-glass-border)] bg-[var(--color-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Switch protocol"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-3">
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Switch protocol</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close protocol picker"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {/* All / unified feed */}
          {renderRow('all', '/feed', '#1d9bf0', '◆', 'All Sources')}

          {/* Quick links */}
          <p
            className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]"
            aria-hidden="true"
          >
            Quick Links
          </p>
          {EXTRA_LINKS.map((p) => renderRow(p.id, p.href, p.color, p.icon, p.label))}

          {/* Protocols grouped by category */}
          {CATEGORY_DISPLAY_ORDER.map((catId) => {
            const catInfo = CATEGORIES[catId];
            const protocolIds = CATEGORY_PROTOCOLS[catId];
            if (!protocolIds || protocolIds.length === 0) return null;
            return (
              <div key={catId}>
                <p
                  className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]"
                  aria-hidden="true"
                >
                  {catInfo.icon} {catInfo.label}
                </p>
                {protocolIds.map((pid) => {
                  const meta = PROTOCOL_META[pid];
                  if (!meta) return null;
                  return renderRow(pid, meta.route, meta.color, meta.icon, meta.label);
                })}
              </div>
            );
          })}
        </div>

        <div className="border-t border-[var(--color-glass-border)] p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-[var(--color-glass-border)] py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
