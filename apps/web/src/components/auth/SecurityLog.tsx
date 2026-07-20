'use client';

import { useCallback, useEffect, useState } from 'react';

/* === Types =================================================== */

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  address: string;
  ip: string;
  location: string;
  userAgent: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

/* === Severity styles ======================================== */

const SEVERITY_CONFIG: Record<string, { dot: string; label: string }> = {
  low: { dot: 'bg-blue-400', label: 'Info' },
  medium: { dot: 'bg-yellow-400', label: 'Notice' },
  high: { dot: 'bg-orange-400', label: 'Warning' },
  critical: { dot: 'bg-red-400', label: 'Critical' },
};

/* === Event icon map ========================================= */

function getEventIcon(type: string): string {
  if (type.startsWith('login')) return '🔑';
  if (type.startsWith('logout')) return '🚪';
  if (type.startsWith('session')) return '🔐';
  if (type.startsWith('passkey')) return '🔑';
  if (type.startsWith('totp')) return '📱';
  if (type.startsWith('hardware')) return '🔒';
  if (type.startsWith('recovery')) return '🆘';
  if (type.startsWith('password')) return '🔑';
  if (type.startsWith('email')) return '✉️';
  if (type.startsWith('wallet')) return '💳';
  if (type.startsWith('account')) return '⚠️';
  if (type.startsWith('api_key')) return '🔌';
  return '🔔';
}

/* === Format helpers ========================================== */

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskIp(ip: string): string {
  if (!ip) return '';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 4) return `${parts.slice(0, 4).join(':')}:****`;
    return `${parts[0]}****`;
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  return ip;
}

/* === Day separator =========================================== */

function DaySeparator({ date }: { date: Date }) {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  let label: string;
  if (isToday) label = 'Today';
  else if (isYesterday) label = 'Yesterday';
  else
    label = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });

  return (
    <div className="relative my-4 first:mt-0">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-[var(--color-glass-border)]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[var(--color-card)] px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
      </div>
    </div>
  );
}

/* === Event row =============================================== */

function EventRow({ event }: { event: SecurityEvent }) {
  const severity = SEVERITY_CONFIG[event.severity];
  const config = severity ?? { dot: 'bg-gray-400', label: 'Info' };

  return (
    <div className="flex items-start gap-3 px-1 py-2.5 transition-colors hover:bg-[var(--color-overlay)] rounded-lg">
      <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">
        {getEventIcon(event.type)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm text-[var(--color-fg)]">{event.description}</p>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${config.dot}`}
          >
            {config.label}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-muted)]">
          {event.ip && <span>{maskIp(event.ip)}</span>}
          {event.location && <span>{event.location}</span>}
          <span>{formatTimestamp(event.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

/* === Security Log ============================================ */

export function SecurityLog() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/security-log', {
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in required');
          return;
        }
        throw new Error(`Failed to fetch security log (${res.status})`);
      }
      const data = (await res.json()) as { events: SecurityEvent[] };
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* === Loading skeleton ================================== */

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map((key) => (
          <div key={key} className="flex items-center gap-3 px-1 py-2.5">
            <div className="skeleton h-6 w-6 rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-4 w-56 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* === Error state ======================================= */

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={fetchEvents}
          className="mt-3 rounded-lg bg-[var(--color-overlay)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)]"
        >
          Try again
        </button>
      </div>
    );
  }

  /* === Empty state ======================================= */

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
        <div className="text-2xl mb-2">🛡️</div>
        <p className="text-sm font-medium text-[var(--color-fg)]">No security events yet</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Security events will appear here as they occur.
        </p>
      </div>
    );
  }

  /* === Group events by day =============================== */

  const groups: { date: Date; events: SecurityEvent[] }[] = [];
  for (const event of events) {
    const eventDate = new Date(event.timestamp);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date.toDateString() === eventDate.toDateString()) {
      lastGroup.events.push(event);
    } else {
      groups.push({ date: eventDate, events: [event] });
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3">
      {groups.map((group) => (
        <div key={group.date.toISOString()}>
          <DaySeparator date={group.date} />
          <div className="space-y-0.5">
            {group.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
