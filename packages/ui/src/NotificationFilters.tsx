'use client';

/**
 * @degenfeed/ui — NotificationFilters
 *
 * Filter panel for the notification center.
 * Supports: protocol filter, type filter, unread/read/all filter.
 */

import { memo } from 'react';
import { getProtocolColor, getProtocolLabel } from './ProtocolBadge';

/* ─── Types ────────────────────────────────────────────────── */

export type NotificationTypeFilter =
  | 'all'
  | 'like'
  | 'repost'
  | 'reply'
  | 'follow'
  | 'mention'
  | 'tip'
  | 'collect';

export type NotificationStatusFilter = 'all' | 'unread' | 'read';

export interface NotificationFilterState {
  type: NotificationTypeFilter;
  protocol: string; // 'all' or protocol id
  status: NotificationStatusFilter;
}

/* ─── Constants ────────────────────────────────────────────── */

const PROTOCOLS = [
  { id: 'all', label: 'All' },
  { id: 'nostr', label: 'Nostr' },
  { id: 'farcaster', label: 'Farcaster' },
  { id: 'lens', label: 'Lens' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'tip', label: 'Tips' },
] as const;

const TYPE_FILTERS: { id: NotificationTypeFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'like', label: 'Likes', icon: '❤' },
  { id: 'repost', label: 'Reposts', icon: '🔄' },
  { id: 'reply', label: 'Replies', icon: '💬' },
  { id: 'follow', label: 'Follows', icon: '➕' },
  { id: 'mention', label: 'Mentions', icon: '@' },
  { id: 'tip', label: 'Tips', icon: '⚡' },
  { id: 'collect', label: 'Collects', icon: '📦' },
];

/* ─── Props ────────────────────────────────────────────────── */

export interface NotificationFiltersProps {
  filter: NotificationFilterState;
  onChange: (filter: NotificationFilterState) => void;
  unreadCount: number;
}

export const NotificationFilters = memo(function NotificationFilters({
  filter,
  onChange,
  unreadCount,
}: NotificationFiltersProps) {
  return (
    <div className="notification-filters" role="region" aria-label="Notification filters">
      {/* Protocol filter */}
      <div className="notif-filter-row">
        <label className="notif-filter-label">Protocol</label>
        <div className="notif-filter-chips" role="tablist" aria-label="Filter by protocol">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={filter.protocol === p.id}
              className={`notif-filter-chip ${filter.protocol === p.id ? 'active' : ''}`}
              style={
                filter.protocol === p.id && p.id !== 'all'
                  ? {
                      color: getProtocolColor(p.id),
                      borderColor: getProtocolColor(p.id),
                      backgroundColor: `${getProtocolColor(p.id)}15`,
                    }
                  : undefined
              }
              onClick={() => onChange({ ...filter, protocol: p.id })}
            >
              {p.id !== 'all' && (
                <span
                  className="notif-filter-dot"
                  style={{ backgroundColor: getProtocolColor(p.id) }}
                />
              )}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div className="notif-filter-row">
        <label className="notif-filter-label">Type</label>
        <div className="notif-filter-chips">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`notif-filter-chip ${filter.type === t.id ? 'active' : ''}`}
              onClick={() => onChange({ ...filter, type: t.id })}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="notif-filter-row">
        <label className="notif-filter-label">Status</label>
        <div className="notif-filter-chips">
          {(['all', 'unread', 'read'] as NotificationStatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`notif-filter-chip ${filter.status === s ? 'active' : ''}`}
              onClick={() => onChange({ ...filter, status: s })}
            >
              {s === 'all' ? 'All' : s === 'unread' ? `Unread (${unreadCount})` : 'Read'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
