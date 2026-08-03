'use client';

/**
 * usePushNotifications — DegenChat push notifications hook.
 *
 * Wraps the existing `pushService` (Capacitor + Web Push) with a chat-focused
 * API: register for push, receive incoming DM/group notifications, and show
 * foreground web notifications when the tab isn't focused.
 *
 *   const { register, supported, notifyNewMessage } = usePushNotifications();
 *   useEffect(() => { register(); }, [register]);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pushService,
  type NotificationHandler,
  type PushPayload,
  type PushToken,
} from '../lib/capacitorPush';

export interface UsePushNotificationsResult {
  /** Whether push is available on this device. */
  supported: boolean;
  /** The registered push token (null until registered). */
  token: PushToken | null;
  /** Notification permission state. */
  permission: NotificationPermission | 'unsupported';
  /** Register for push notifications. Returns the token or null. */
  register: () => Promise<PushToken | null>;
  /** Register a handler for incoming push notifications (returns unsubscribe). */
  onNotification: (handler: NotificationHandler) => () => void;
  /** Show a foreground web notification for a new chat message. */
  notifyNewMessage: (payload: { fromName: string; body: string; url?: string }) => void;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [token, setToken] = useState<PushToken | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported',
  );
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !pushService.isAvailable) {
      setSupported(false);
      setPermission('unsupported');
      return;
    }
    setSupported(true);
    setPermission(
      'Notification' in window ? Notification.permission : 'unsupported',
    );

    // Track existing token
    if (pushService.currentToken) setToken(pushService.currentToken);

    // Listen for tokens arriving asynchronously
    return pushService.onToken((t) => setToken(t));
  }, []);

  const register = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    const t = await pushService.register();
    setToken(t);
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
    return t;
  }, []);

  const onNotification = useCallback((handler: NotificationHandler) => {
    return pushService.onNotification(handler);
  }, []);

  const notifyNewMessage = useCallback(
    (payload: { fromName: string; body: string; url?: string }) => {
      if (typeof window === 'undefined') return;
      const focused = document.visibilityState === 'visible';
      if (focused && !('Notification' in window)) return;
      if (focused && Notification.permission === 'granted') {
        // Show a foreground notification when the user isn't looking at the tab
        if (document.hasFocus()) return;
        try {
          const notification = new Notification(payload.fromName, {
            body: payload.body,
            icon: '/icon.svg',
            tag: 'degenchat-dm',
          });
          notification.onclick = () => {
            window.focus();
            if (payload.url) window.location.href = payload.url;
            notification.close();
          };
        } catch {
          // best-effort foreground notification
        }
      }
    },
    [],
  );

  return { supported, token, permission, register, onNotification, notifyNewMessage };
}

export type { PushPayload };
