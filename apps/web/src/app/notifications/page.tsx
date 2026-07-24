'use client';

import { getProtocolColor, getProtocolLabel } from '@degenfeed/ui';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useNotifications } from '../../hooks/useNotifications';

/* === Type helpers =========================================== */

const TYPE_ICON: Record<string, string> = {
  like: '❤️',
  repost: '🔄',
  mirror: '🔄',
  reply: '💬',
  follow: '➕',
  mention: '@',
  collect: '⚡',
  tip: '⚡',
};

const TYPE_LABEL: Record<string, string> = {
  like: 'Liked your post',
  repost: 'Reposted your post',
  mirror: 'Mirrored your post',
  reply: 'Replied to you',
  follow: 'Followed you',
  mention: 'Mentioned you',
  collect: 'Collected your post',
  tip: 'Tipped you',
};

const PROTOCOLS = [
  { id: 'all', label: 'All' },
  { id: 'nostr', label: 'Nostr' },
  { id: 'farcaster', label: 'Farcaster' },
  { id: 'lens', label: 'Lens' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'tip', label: 'Tips' },
] as const;

/* === Helpers ================================================ */

function getTypeIcon(type: string): string {
  return TYPE_ICON[type] || '💬';
}

function getTypeLabel(type: string): string {
  return TYPE_LABEL[type] || 'Interacted with you';
}

function timeAgo(ts: number): string {
  const tsMs = ts > 1e12 ? ts : ts * 1000;
  const diff = Date.now() - tsMs;
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getActorInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/* === Loading Skeleton ======================================= */

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
      <div className="skeleton-shimmer h-10 w-10 flex-shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-3 w-32 rounded" />
        <div className="skeleton-shimmer h-2.5 w-48 rounded" />
        <div className="skeleton-shimmer h-2 w-20 rounded" />
      </div>
      <div className="skeleton-shimmer h-5 w-14 rounded-full" />
    </div>
  );
}

/* === Notification Row ====================================== */

interface NotificationRowProps {
  id: string;
  type: string;
  protocol: string;
  sourceProtocol?: string;
  actorName: string;
  actorHandle?: string;
  actorAvatar?: string;
  postText?: string;
  createdAt: number;
  read: boolean;
  amount?: string;
  currency?: string;
  onMarkRead: (id: string) => void;
}

function NotificationRow({
  id,
  type,
  protocol,
  sourceProtocol,
  actorName,
  actorHandle,
  actorAvatar,
  postText,
  createdAt,
  read,
  amount,
  currency,
  onMarkRead,
}: NotificationRowProps) {
  // Use sourceProtocol for display badge when present (tips from specific chain), else protocol
  const displayProtocol = sourceProtocol || protocol;
  const protocolColor = getProtocolColor(displayProtocol);
  const icon = getTypeIcon(type);
  const label = getTypeLabel(type);

  return (
    <button
      type="button"
      onClick={() => onMarkRead(id)}
      aria-label={`${label} from ${actorName}${postText ? `: ${postText}` : ''}`}
      className={`group flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-overlay)] ${
        read ? 'opacity-60' : ''
      }`}
    >
      {/* Unread indicator dot */}
      {!read && (
        <span
          role="img"
          aria-label="Unread"
          className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-degen-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
        />
      )}

      {/* Type icon */}
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: `${protocolColor}18` }}
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-sm font-medium ${read ? 'text-[var(--color-muted)]' : 'text-[var(--color-fg)]'}`}
          >
            {actorAvatar ? (
              <Image
                src={actorAvatar}
                alt="Notification avatar"
                width={20}
                height={20}
                className="-ml-1 mr-1 inline h-5 w-5 rounded-full object-cover align-middle"
              />
            ) : (
              <span
                className="-ml-1 mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
                style={{ backgroundColor: `${protocolColor}22`, color: protocolColor }}
              >
                {getActorInitials(actorName)}
              </span>
            )}
            <span>{actorName}</span>
            {amount && (
              <span className="rounded bg-degen-500/20 px-1.5 py-0.5 text-[10px] font-bold text-degen-400">
                {amount}{' '}
                {currency?.toUpperCase() === 'BASE'
                  ? 'ETH'
                  : currency?.toUpperCase() === 'SOLANA'
                    ? 'SOL'
                    : currency?.toUpperCase()}
              </span>
            )}
          </span>
          {actorHandle && (
            <span className="hidden truncate text-xs text-[var(--color-muted)] sm:inline">
              @{actorHandle}
            </span>
          )}
        </div>
        <span
          className={`text-xs ${read ? 'text-[var(--color-muted)]' : 'text-[var(--color-muted)]'}`}
        >
          {label}
        </span>
        {postText && (
          <span className="mt-0.5 line-clamp-1 text-xs text-[var(--color-muted)] italic">
            &ldquo;{postText}&rdquo;
          </span>
        )}
        <span className="mt-0.5 text-[10px] text-[var(--color-muted)]">{timeAgo(createdAt)}</span>
      </div>

      {/* Protocol badge — shows sourceProtocol if available */}
      <span
        className="mt-1 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-normal"
        style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
      >
        {getProtocolLabel(displayProtocol)}
      </span>
    </button>
  );
}

/* === Empty State ============================================ */

function EmptyState({ hasSignedIn }: { hasSignedIn: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <span className="mb-4 text-4xl opacity-30" aria-hidden="true">
        🔔
      </span>
      <p className="text-base font-medium text-[var(--color-muted)]">No notifications yet</p>
      {hasSignedIn ? (
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          When someone likes, reposts, or replies, it will show up here.
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Sign in with a social account to see your notifications.
        </p>
      )}
    </div>
  );
}

/* === Not Signed-in State ==================================== */

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="mx-4 mt-6 rounded-2xl border border-degen-500/30 bg-gradient-to-br from-degen-500/5 to-transparent p-6 text-center">
      <span className="mb-3 inline-block text-3xl" aria-hidden="true">
        🔔
      </span>
      <h2 className="mb-1 text-lg font-semibold text-[var(--color-fg)]">Stay in the loop</h2>
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        Sign in to receive notifications when someone likes, reposts, or replies across all
        networks.
      </p>
      <button type="button" onClick={onSignIn} className="btn-primary text-sm">
        Connect Wallet to Get Started
      </button>
    </div>
  );
}

/* === Notification Preferences Panel ========================= */

// biome-ignore lint/suspicious/noExplicitAny: notification prefs are a dynamic key/value map
type PrefsRecord = Record<string, any>;

interface NotificationPrefsPanelProps {
  prefs: PrefsRecord | null;
  onSave: (prefs: PrefsRecord) => void | Promise<void>;
  onClose: () => void;
}

function NotificationPrefsPanel({ prefs, onSave, onClose }: NotificationPrefsPanelProps) {
  const [local, setLocal] = useState<PrefsRecord>(prefs || {});
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Check existing push subscription on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushEnabled(!!sub))
        .catch(() => {});
    }
  }, []);

  // Sync when prefs load
  useEffect(() => {
    if (prefs) setLocal(prefs);
  }, [prefs]);

  const setProtocolType = (protocol: string, type: string, value: boolean) => {
    setLocal((prev) => {
      const current = (prev[protocol] as Record<string, boolean>) || {};
      return { ...prev, [protocol]: { ...current, [type]: value } };
    });
  };

  const setTipEnabled = (value: boolean) => {
    setLocal((prev) => ({ ...prev, tip: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(local);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    setPushLoading(true);
    setPushError(null);
    try {
      if (enabled) {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushError('Permission denied. Enable notifications in your browser settings.');
          setPushEnabled(false);
          return;
        }

        // Subscribe
        const reg = await navigator.serviceWorker.ready;
        const vapidKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          'BAd4N4H0oOxUeARX0mSTKScYh_bJlBIas4OQPV7sWjyzRGR-6_w17whjR-DMpfrd7rF8YR8GnTFu5TOHUQNM3Cc';
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as string,
        });

        // Send subscription to server
        const subJson = sub.toJSON();
        const res = await fetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh ?? '',
                auth: subJson.keys?.auth ?? '',
              },
            },
          }),
        });

        if (!res.ok) throw new Error('Failed to register push subscription');

        setPushEnabled(true);
      } else {
        // Unsubscribe
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();

        // Tell server to remove
        await fetch('/api/notifications/push', { method: 'DELETE' });

        setPushEnabled(false);
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Push subscription failed');
      setPushEnabled(!enabled);
    } finally {
      setPushLoading(false);
    }
  };

  /** Convert a base64url-encoded string to Uint8Array for the applicationServerKey. */
  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  const protocols = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] as const;
  const types = ['likes', 'reposts', 'replies', 'follows', 'mentions'] as const;
  const typeLabels: Record<string, string> = {
    likes: 'Likes',
    reposts: 'Reposts',
    replies: 'Replies',
    follows: 'Follows',
    mentions: 'Mentions',
  };

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Notification Preferences</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          aria-label="Close preferences"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {protocols.map((protocol) => {
          const protoPrefs = (local[protocol] as Record<string, boolean>) || {};
          const color = getProtocolColor(protocol);
          return (
            <div key={protocol} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="mb-2 text-xs font-semibold" style={{ color }}>
                {getProtocolLabel(protocol)}
              </div>
              <div className="flex flex-wrap gap-2">
                {types.map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor:
                        protoPrefs[type] !== false ? `${color}18` : 'var(--color-card)',
                      color: protoPrefs[type] !== false ? color : 'var(--color-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={protoPrefs[type] !== false}
                      onChange={(e) => setProtocolType(protocol, type, e.target.checked)}
                      className="sr-only"
                    />
                    {protoPrefs[type] !== false ? '✓ ' : '✗ '}
                    {typeLabels[type]}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* Tips toggle */}
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
          <span className="text-xs font-medium text-[var(--color-fg)]">⚡ Tips</span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={local.tip !== false}
              onChange={(e) => setTipEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-[var(--color-card)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-[var(--color-muted)] after:transition-all peer-checked:bg-degen-500/30 peer-checked:after:translate-x-full peer-checked:after:bg-degen-400" />
          </label>
        </div>

        {/* Push notifications toggle */}
        {'PushManager' in window && (
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex-1">
              <span className="text-xs font-medium text-[var(--color-fg)]">
                📲 Push Notifications
              </span>
              <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                Receive alerts even when DegenFeed is closed
              </p>
              {pushError && <p className="mt-1 text-[10px] text-red-400">{pushError}</p>}
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={pushEnabled}
                disabled={pushLoading}
                onChange={(e) => void handlePushToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div
                className={`h-5 w-9 rounded-full after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:transition-all peer-checked:after:translate-x-full ${
                  pushEnabled
                    ? 'bg-degen-500/30 after:bg-degen-400'
                    : 'bg-[var(--color-card)] after:bg-[var(--color-muted)]'
                } ${pushLoading ? 'animate-pulse opacity-60' : ''}`}
              />
            </label>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 w-full rounded-lg bg-degen-500/20 px-3 py-2 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/30 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}

/* === Page =================================================== */

export default function NotificationsPage() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    notificationPrefs,
    saveNotificationPrefs,
  } = useNotifications(hasSignedIn);

  const [activeProtocol, setActiveProtocol] = useState<string>('all');
  const [activeTypeGroup, setActiveTypeGroup] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(30);
  const [showPrefs, setShowPrefs] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  /* == Type grouping — grouped by notification type ============ */
  const TYPE_GROUPS = [
    { id: 'all', label: 'All', icon: '🔔' },
    { id: 'like', label: 'Likes', icon: '❤️' },
    { id: 'repost', label: 'Reposts', icon: '🔄' },
    { id: 'mirror', label: 'Mirrors', icon: '🔄' },
    { id: 'reply', label: 'Replies', icon: '💬' },
    { id: 'follow', label: 'Follows', icon: '➕' },
    { id: 'mention', label: 'Mentions', icon: '@' },
    { id: 'tip', label: 'Tips', icon: '⚡' },
    { id: 'collect', label: 'Collects', icon: '📦' },
  ] as const;

  /* == Filter =============================================== */
  const filtered = useMemo(() => {
    let f = activeProtocol === 'all'
      ? notifications
      : notifications.filter((n) => n.protocol === activeProtocol);
    if (activeTypeGroup !== 'all') {
      f = f.filter((n) => n.type === activeTypeGroup);
    }
    return f;
  }, [notifications, activeProtocol, activeTypeGroup]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  /* == Grouped notifications by type for accordion view ====== */
  const groupedByType = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const n of filtered) {
      const key = n.type || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(n);
    }
    return groups;
  }, [filtered]);

  /* == Unread counts per protocol =========================== */
  const unreadByProtocol = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of PROTOCOLS) {
      if (p.id === 'all') continue;
      map[p.id] = notifications.filter((n) => !n.read && n.protocol === p.id).length;
    }
    return map;
  }, [notifications]);

  const filteredUnread = filtered.filter((n) => !n.read).length;

  /* == Infinite scroll ====================================== */
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  /* == Handlers ============================================= */
  const handleProtocolClick = useCallback((id: string) => {
    setActiveProtocol((prev) => {
      if (prev === id) return 'all';
      setVisibleCount(30);
      return id;
    });
  }, []);

  const refresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 px-3 py-3 sm:px-4 lg:grid-cols-12">
      {/* Left rail — hidden, just spacing */}
      <aside className="hidden lg:col-span-3 xl:col-span-3 lg:block" />

      {/* Main column */}
      <main className="lg:col-span-6 xl:col-span-6">
        {/* Sticky header */}
        <div className="sticky top-16 z-30 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                🔔
              </span>
              <div>
                <h1 className="text-lg font-bold text-[var(--color-fg)] leading-none">
                  Notifications
                </h1>
                <p className="text-[10px] text-[var(--color-muted)]">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Notification preferences toggle */}
              <button
                type="button"
                onClick={() => setShowPrefs(!showPrefs)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                aria-label="Notification preferences"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={refresh}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                aria-label="Refresh notifications"
                disabled={loading}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={loading ? 'animate-spin' : ''}
                  aria-hidden="true"
                >
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
                </svg>
              </button>

              {filteredUnread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-degen-500/20 hover:text-degen-400"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Type group filter — unified by notification type */}
          <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-4 py-2 overflow-x-auto scrollbar-none">
            {TYPE_GROUPS.map((g) => {
              const active = activeTypeGroup === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setActiveTypeGroup((prev) => (prev === g.id ? 'all' : g.id));
                    setVisibleCount(30);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
                  }`}
                >
                  <span aria-hidden="true">{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* Protocol filter pills */}
          <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none">
            {PROTOCOLS.map((p) => {
              const unread = p.id === 'all' ? unreadCount : (unreadByProtocol[p.id] ?? 0);
              const active = activeProtocol === p.id;
              const color = p.id === 'all' ? 'var(--color-fg)' : getProtocolColor(p.id);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProtocolClick(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
                  }`}
                  style={active ? { backgroundColor: `${color}18`, color } : undefined}
                >
                  {p.label}
                  {unread > 0 && (
                    <span
                      className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-[var(--color-fg)]"
                      style={{ backgroundColor: color }}
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification preferences panel */}
        {showPrefs && (
          <NotificationPrefsPanel
            prefs={notificationPrefs}
            onSave={saveNotificationPrefs}
            onClose={() => setShowPrefs(false)}
          />
        )}

        {/* Notification list */}
        {!hasSignedIn ? (
          <SignInPrompt onSignIn={openSignIn} />
        ) : loading && notifications.length === 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <NotificationSkeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeletons
                key={i}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState hasSignedIn={hasSignedIn} />
        ) : (
          <>
            {/* Grouped by type with collapsible sections */}
            {Object.entries(groupedByType).map(([typeKey, groupItems]) => {
              const groupLabel = TYPE_GROUPS.find((g) => g.id === typeKey)?.label || typeKey;
              const groupIcon = TYPE_GROUPS.find((g) => g.id === typeKey)?.icon || '💬';
              const groupUnread = groupItems.filter((n) => !n.read).length;
              if (groupItems.length === 0) return null;
              return (
                <details key={typeKey} className="group border-b border-[var(--color-border)] last:border-b-0" open>
                  <summary className="sticky top-[180px] z-10 flex cursor-pointer items-center gap-2 bg-[var(--color-bg)] px-4 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors select-none">
                    <span className="text-sm" aria-hidden="true">{groupIcon}</span>
                    <span>{groupLabel}</span>
                    {groupUnread > 0 && (
                      <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold text-black">
                        {groupUnread}
                      </span>
                    )}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div className="divide-y divide-[var(--color-border)]">
                    {groupItems.slice(0, visibleCount).map((n) => (
                      <NotificationRow
                        key={n.id}
                        id={n.id}
                        type={n.type}
                        protocol={n.protocol}
                        sourceProtocol={n.sourceProtocol}
                        actorName={n.actorName}
                        actorHandle={n.actorHandle}
                        actorAvatar={n.actorAvatar}
                        postText={n.postText}
                        createdAt={n.createdAt}
                        read={n.read}
                        amount={(n as { amount?: string }).amount}
                        currency={(n as { currency?: string }).currency}
                        onMarkRead={markRead}
                      />
                    ))}
                  </div>
                </details>
              );
            })}

            {/* Infinite scroll sentinel */}
            <div ref={loaderRef} className="h-px" />

            {loading && (
              <div className="divide-y divide-[var(--color-border)]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <NotificationSkeleton
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeletons
                    key={`loading-${i}`}
                  />
                ))}
              </div>
            )}

            {!hasMore && visible.length > 0 && (
              <div className="py-8 text-center text-xs text-[var(--color-muted)]">
                All notifications loaded
              </div>
            )}
          </>
        )}

        {/* Bottom spacing for mobile nav */}
        <div className="h-12 lg:hidden" />
      </main>

      {/* Right rail — hidden */}
      <aside className="hidden lg:col-span-3 xl:col-span-3 lg:block" />
    </div>
  );
}
