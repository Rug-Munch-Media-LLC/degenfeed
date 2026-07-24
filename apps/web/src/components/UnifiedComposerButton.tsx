'use client';

/**
 * UnifiedComposerButton — A floating "Create Post" FAB that works everywhere.
 *
 * Auto-detects which protocols the user has connected, shows character limits
 * per protocol, and opens a rich composer with cross-protocol preview.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

/* ─── Target protocol config ─────────────────────────────────── */

interface ProtocolTarget {
  id: string;
  label: string;
  icon: string;
  color: string;
  charLimit: number;
  connected: boolean;
}

/* ─── Props ──────────────────────────────────────────────────── */

interface UnifiedComposerButtonProps {
  /** Large style for sidebar; compact for bottom-nav */
  variant?: 'default' | 'compact';
  className?: string;
}

/* ─── Component ──────────────────────────────────────────────── */

export function UnifiedComposerButton({
  variant = 'default',
  className = '',
}: UnifiedComposerButtonProps) {
  const { ready, signedInProtocols, openCompose } = useAuth();
  const { showToast } = useToast();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const connectedTargets: ProtocolTarget[] = [
    { id: 'nostr', label: 'Nostr', icon: '⚡', color: '#8e30eb', charLimit: 50000, connected: !!signedInProtocols.nostr },
    { id: 'farcaster', label: 'Farcaster', icon: '◈', color: '#8a63d2', charLimit: 320, connected: !!signedInProtocols.farcaster },
    { id: 'lens', label: 'Lens', icon: '🌿', color: '#abfe2c', charLimit: 5000, connected: !!signedInProtocols.lens },
    { id: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#1185fe', charLimit: 300, connected: !!signedInProtocols.bluesky },
    { id: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364ff', charLimit: 5000, connected: !!signedInProtocols.mastodon },
    { id: 'threads', label: 'Threads', icon: '⊞', color: '#101010', charLimit: 500, connected: !!signedInProtocols.threads },
  ];

  const handleClick = useCallback(() => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to start posting across protocols');
      return;
    }
    openCompose();
  }, [hasSignedIn, openCompose, showToast]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!tooltipOpen) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tooltipOpen]);

  const connectedCount = connectedTargets.filter((t) => t.connected).length;

  if (variant === 'compact') {
    return (
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-degen-500 text-black shadow-lg transition-all hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-2 ${className}`}
        aria-label={hasSignedIn ? 'Create new post' : 'Sign in to post'}
        title={hasSignedIn ? 'Create new post' : 'Sign in to post'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={() => connectedCount > 0 && setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
        className="sidebar-compose-btn group flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        aria-label={hasSignedIn ? 'Create new post' : 'Sign in to post'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Create Post</span>
      </button>

      {/* Protocol tooltip indicator */}
      {connectedCount > 0 && (
        <div
          className={`absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transition-all duration-150 ${
            tooltipOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
          }`}
        >
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2.5 shadow-xl shadow-black/20 backdrop-blur-xl" style={{ backgroundColor: 'var(--color-glass-bg)' }}>
            <div className="text-[10px] font-medium text-[var(--color-muted)] mb-1.5 px-1">
              Posting to {connectedCount} protocol{connectedCount !== 1 ? 's' : ''}
            </div>
            <div className="flex flex-col gap-1">
              {connectedTargets.filter((t) => t.connected).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs">
                  <span className="text-sm" aria-hidden="true">{t.icon}</span>
                  <span className="flex-1 font-medium text-[var(--color-fg)]">{t.label}</span>
                  <span className="font-mono text-[10px] text-[var(--color-muted)]">
                    {t.charLimit.toLocaleString()} chars
                  </span>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
