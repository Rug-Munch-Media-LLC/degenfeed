'use client';

/**
 * @degenfeed/ui — NostrRelayBadge
 *
 * Shows which Nostr relays a post came from.
 * Purple badge with relay count: "🟣 3 relays".
 * Click to expand and show relay URLs with connection status.
 *
 * Design: compact purple pill that expands into a list.
 * Tonal reference: Nostr's purple brand, relay-centric architecture.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface NostrRelayBadgeProps {
  /** List of relay URLs (e.g. "wss://relay.damus.io") */
  relays: string[];
  /** Optional: show relay connection status (default: true) */
  showStatus?: boolean;
  /** Optional: label override */
  label?: string;
}

// ─── Connection status tracing ──────────────────────────────────────

type RelayStatus = 'checking' | 'connected' | 'disconnected' | 'error';

// ─── Component ───────────────────────────────────────────────────────

export const NostrRelayBadge = memo(function NostrRelayBadge({
  relays,
  showStatus = true,
  label,
}: NostrRelayBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, RelayStatus>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const uniqueRelays = [...new Set(relays.filter(Boolean))];

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // Check relay connectivity when expanded
  useEffect(() => {
    if (!expanded || !showStatus || uniqueRelays.length === 0) return;

    const initial: Record<string, RelayStatus> = {};
    for (const r of uniqueRelays) initial[r] = 'checking';
    setStatuses(initial);

    for (const relay of uniqueRelays) {
      checkRelay(relay)
        .then((ok) => {
          setStatuses((prev) => ({ ...prev, [relay]: ok ? 'connected' : 'disconnected' }));
        })
        .catch(() => {
          setStatuses((prev) => ({ ...prev, [relay]: 'error' }));
        });
    }
  }, [expanded, showStatus, uniqueRelays.length, uniqueRelays]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpanded((v) => !v);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded((v) => !v);
    }
    if (e.key === 'Escape') {
      setExpanded(false);
    }
  }, []);

  if (uniqueRelays.length === 0) return null;

  const displayLabel = label ?? `${uniqueRelays.length} relay${uniqueRelays.length > 1 ? 's' : ''}`;

  return (
    <div ref={panelRef} className="relative inline-flex">
      {/* ── Badge button ── */}
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
        style={{
          backgroundColor: expanded ? '#8e30eb33' : '#8e30eb22',
          color: expanded ? '#c084fc' : '#a855f7',
        }}
        aria-expanded={expanded}
        aria-haspopup="true"
        aria-label={`Nostr relays: ${displayLabel}`}
      >
        {/* Purple dot */}
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: '#a855f7' }}
          aria-hidden="true"
        />
        {displayLabel}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* ── Expanded relay list ── */}
      {expanded && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border shadow-2xl"
          style={{ borderColor: '#8e30eb33', backgroundColor: '#111827' }}
          role="listbox"
          aria-label="Relay list"
        >
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Relays
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {uniqueRelays.map((relay) => {
              const status = statuses[relay] ?? 'checking';

              return (
                <div
                  key={relay}
                  className="flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/[0.03]"
                >
                  {/* Status indicator */}
                  {showStatus && (
                    <span className="flex-shrink-0" role="img" aria-label={status}>
                      {status === 'connected' && (
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                      )}
                      {status === 'disconnected' && (
                        <span className="inline-block h-2 w-2 rounded-full bg-gray-600" />
                      )}
                      {status === 'error' && (
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                      )}
                      {status === 'checking' && (
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                      )}
                    </span>
                  )}

                  {/* Relay URL */}
                  <code className="flex-1 truncate font-mono text-[var(--color-muted)]">{relay}</code>

                  {/* Status label */}
                  {showStatus && (
                    <span
                      className="flex-shrink-0 text-[10px] font-medium"
                      style={{
                        color:
                          status === 'connected'
                            ? '#4ade80'
                            : status === 'disconnected'
                              ? '#9ca3af'
                              : status === 'error'
                                ? '#f87171'
                                : '#eab308',
                      }}
                    >
                      {status === 'connected'
                        ? 'Live'
                        : status === 'disconnected'
                          ? 'Offline'
                          : status === 'error'
                            ? 'Error'
                            : '...'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="border-t border-[var(--color-border)] px-3 py-1.5 text-[10px] text-gray-700">
            Relays that relayed this event
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Relay connectivity check ───────────────────────────────────────

async function checkRelay(url: string): Promise<boolean> {
  try {
    // Use WebSocket to check relay availability with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    // Try HTTP-based relay info endpoint first (faster, no CORS issues usually)
    const httpUrl = url.replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'https://' : 'http://'));
    const infoUrl = `${httpUrl.replace(/\/$/, '')}/.well-known/nostr.json`;

    try {
      const res = await fetch(infoUrl, {
        signal: controller.signal,
        method: 'HEAD',
      });
      clearTimeout(timeout);
      // A 200 or even a 404 suggests the relay is reachable
      return res.ok || res.status === 404;
    } catch {
      clearTimeout(timeout);
      // Fallback: try WebSocket
      return checkWebSocket(url);
    }
  } catch {
    return false;
  }
}

function checkWebSocket(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
