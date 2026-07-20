'use client';

/**
 * useNotifications — shared notification state hook.
 *
 * Reads from <NotificationProvider> context (rendered in root layout).
 * All consumers (LeftSidebar, BottomNav, NotificationsPage) share the
 * same state — badge counts are always in sync and react instantly to
 * markAllRead and WebSocket events.
 *
 * The `enabled` parameter is accepted for backwards compatibility with
 * existing call sites but is ignored — the provider derives its own
 * enabled state from useAuth. Existing callers can keep passing it;
 * it's a no-op.
 */

import { useContext } from 'react';
import { NotificationContext, type NotificationContextValue } from './NotificationProvider';

/* === Hook =================================================== */

export function useNotifications(_enabled?: boolean): NotificationContextValue {
  const ctx = useContext(NotificationContext);

  // The provider is always mounted in the root layout, so this should
  // never be null in production.  Return a safe fallback for edge cases
  // (testing, landing page, SSR).
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: () => {},
      markRead: () => {},
      markAllRead: () => {},
      notificationPrefs: null,
      saveNotificationPrefs: () => {},
    };
  }

  return ctx;
}
