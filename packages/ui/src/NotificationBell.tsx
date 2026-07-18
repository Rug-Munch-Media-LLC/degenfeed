'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROTOCOL_ICONS, getProtocolColor, getProtocolLabel } from './ProtocolBadge';

export interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'mirror' | 'collect' | 'tip';
  protocol: string;
  sourceProtocol?: string;
  actorName: string;
  actorHandle: string;
  actorAvatar?: string;
  postId?: string;
  postText?: string;
  createdAt: number;
  read: boolean;
  /** Tip-specific fields */
  amount?: string;
  currency?: string;
}

export interface NotificationGroup {
  key: string;
  type: string;
  postId?: string;
  postText?: string;
  actors: { name: string; protocol: string }[];
  protocols: string[];
  count: number;
  latestAt: number;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    like: 'liked your post',
    repost: 'reposted your post',
    reply: 'replied to you',
    follow: 'followed you',
    mention: 'mentioned you',
    mirror: 'mirrored your post',
    collect: 'collected your post',
    tip: 'tipped you',
  };
  return labels[type] || 'interacted with you';
}

function getTypePlural(type: string): string {
  const plurals: Record<string, string> = {
    like: 'people liked your post',
    repost: 'people reposted your post',
    reply: 'people replied',
    follow: 'people followed you',
    mention: 'people mentioned you',
    mirror: 'people mirrored your post',
    tip: 'people tipped you',
  };
  return plurals[type] || 'people interacted with your post';
}

function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const n of notifications) {
    const key = `${n.type}:${n.postId || 'no-post'}`;
    const existing = groups.get(key);
    if (existing) {
      existing.actors.push({ name: n.actorName, protocol: n.protocol });
      if (!existing.protocols.includes(n.protocol)) {
        existing.protocols.push(n.protocol);
      }
      existing.count += 1;
      existing.latestAt = Math.max(existing.latestAt, n.createdAt);
    } else {
      groups.set(key, {
        key,
        type: n.type,
        postId: n.postId,
        postText: n.postText,
        actors: [{ name: n.actorName, protocol: n.protocol }],
        protocols: [n.protocol],
        count: 1,
        latestAt: n.createdAt,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.latestAt - a.latestAt);
}

export interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onFetch: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead?: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onFetch,
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch on first open
  const handleToggle = useCallback(() => {
    if (!open) onFetch();
    setOpen(!open);
  }, [open, onFetch]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          role="img"
          aria-label="Notifications icon"
        >
          <title>Notifications</title>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-[var(--color-fg)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
          <div className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Notifications</h3>
            <div className="flex items-center gap-2">
              {onMarkAllRead && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMarkAllRead(); }}
                  className="text-[10px] text-degen-400 hover:text-degen-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setGrouped((v) => !v); }}
                className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                {grouped ? 'Ungroup' : 'Group'}
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No notifications yet</div>
            ) : grouped ? (
              groups.slice(0, 30).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className="flex w-full items-start gap-3 border-b border-[var(--color-border)]/50 px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]"
                >
                  <div className="flex-shrink-0 flex -space-x-1">
                    {g.protocols.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: `${getProtocolColor(p)}22`,
                          color: getProtocolColor(p),
                          border: '1.5px solid var(--color-card)',
                        }}
                        title={getProtocolLabel(p)}
                      >
                        {PROTOCOL_ICONS[p] || p[0]}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--color-fg)]">
                      {g.count === 1
                        ? `${g.actors[0]?.name} ${getTypeLabel(g.type)}`
                        : `${g.count} ${getTypePlural(g.type)}`}
                    </div>
                    {g.count > 1 && g.actors.length <= 3 && (
                      <div className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
                        {g.actors.map((a) => a.name).join(', ')}
                      </div>
                    )}
                    {g.protocols.length > 1 && (
                      <div className="mt-0.5 text-[10px] text-gray-600">
                        across {g.protocols.map((p) => getProtocolLabel(p)).join(', ')}
                      </div>
                    )}
                    {g.postText && (
                      <div className="mt-1 text-xs text-gray-600 truncate">{g.postText}</div>
                    )}
                    <div className="mt-0.5 text-[10px] text-gray-700">{timeAgo(g.latestAt)}</div>
                  </div>
                </button>
              ))
            ) : (
              notifications.slice(0, 30).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`flex w-full items-start gap-3 border-b border-[var(--color-border)]/50 px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)] ${n.read ? 'opacity-50' : ''}`}
                  onClick={() => onMarkRead(n.id)}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-bold"
                    style={{ color: getProtocolColor(n.protocol) }}
                  >
                    {PROTOCOL_ICONS[n.protocol] || (n.protocol[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--color-fg)] truncate">{n.actorName}</div>
                    <div className="text-xs text-gray-500">{getTypeLabel(n.type)}</div>
                    {n.postText && (
                      <div className="mt-1 text-xs text-gray-600 truncate">{n.postText}</div>
                    )}
                    <div className="mt-0.5 text-[10px] text-gray-700">{timeAgo(n.createdAt)}</div>
                  </div>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${getProtocolColor(n.protocol)}22`,
                      color: getProtocolColor(n.protocol),
                    }}
                  >
                    {getProtocolLabel(n.protocol)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
