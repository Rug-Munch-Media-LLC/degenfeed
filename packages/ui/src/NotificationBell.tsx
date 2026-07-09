'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention';
  protocol: string;
  actorName: string;
  actorHandle: string;
  actorAvatar?: string;
  postId?: string;
  postText?: string;
  createdAt: number;
  read: boolean;
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
  };
  return labels[type] || 'interacted with you';
}

export interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onFetch: () => void;
  onMarkRead: (id: string) => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onFetch,
  onMarkRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
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
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-gray-800 bg-gray-950 shadow-2xl">
          <div className="border-b border-gray-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No notifications yet</div>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`flex w-full items-start gap-3 border-b border-gray-800/50 px-4 py-3 text-left transition-colors hover:bg-gray-800/30 ${n.read ? 'opacity-50' : ''}`}
                  onClick={() => onMarkRead(n.id)}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-bold"
                    style={{ color: getProtocolColor(n.protocol) }}
                  >
                    {(n.protocol[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{n.actorName}</div>
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
                    {n.protocol}
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

function getProtocolColor(p: string): string {
  const c: Record<string, string> = {
    nostr: '#8e30eb',
    farcaster: '#8a63d2',
    lens: '#abfe2c',
    bluesky: '#1185fe',
    threads: '#888',
    mastodon: '#6364ff',
    rss: '#ffa500',
  };
  return c[p] ?? '#666';
}
