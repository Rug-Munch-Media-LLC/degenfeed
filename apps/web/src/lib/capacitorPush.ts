/**
 * Capacitor Push Notification wrapper
 *
 * Abstracts over Capacitor's native PushNotifications plugin and the
 * Web Push API (for PWA / non-Capacitor environments).  The existing
 * service worker at /sw.js already handles push events and
 * notificationclick — this module handles the registration side
 * (permission, token, subscribing) and routes incoming native events
 * to the same handlers.
 *
 * Usage:
 *   import { pushService } from '@/lib/capacitorPush';
 *   const token = await pushService.register();
 *   pushService.onNotification((data) => { ... });
 */

// ── Types ──────────────────────────────────────────────────────

export interface PushToken {
  /** The push token string (APNs device token, FCM registration token, or Web Push subscription endpoint). */
  value: string;
  /** Platform this token was generated on. */
  platform: 'ios' | 'android' | 'web';
}

export interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  badge?: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export type NotificationHandler = (payload: PushPayload) => void;
export type TokenHandler = (token: PushToken) => void;

// ── Environment detection ──────────────────────────────────────

function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor injects the `Capacitor` global at runtime on native devices
  const cap = (window as unknown as Record<string, unknown>)['Capacitor'] as
    | { isNative?: boolean }
    | undefined;
  return !!cap?.isNative;
}

function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

const VAPID_PUBLIC_KEY: string | undefined =
  typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
        .NEXT_PUBLIC_VAPID_KEY
    : undefined;

// ── Push service singleton ─────────────────────────────────────

class CapacitorPushService {
  private token: PushToken | null = null;
  private nativeHandlers = new Set<NotificationHandler>();
  private webHandlers = new Set<NotificationHandler>();
  private tokenHandlers = new Set<TokenHandler>();
  private registered = false;
  private _messageListener: ((event: MessageEvent) => void) | null = null;

  /**
   * Register for push notifications.
   *
   * - **Capacitor (native)**:  Requests permission and registers with
   *   APNs (iOS) or FCM (Android).  The token is emitted via
   *   `onToken()`.
   * - **Web / PWA**:  Registers a service worker and subscribes via
   *   the Web Push API (requires a VAPID key).  Falls back silently if
   *   unsupported or permission is denied.
   *
   * @returns The push token, or `null` if registration failed / was
   *          denied.
   */
  async register(): Promise<PushToken | null> {
    if (this.registered && this.token) return this.token;
    this.registered = true;

    if (isNative()) {
      return this.registerNative();
    }
    return this.registerWeb();
  }

  // ── Native (Capacitor) registration ───────────────────────

  private async registerNative(): Promise<PushToken | null> {
    try {
      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );

      // Request permission (iOS shows system dialog)
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive === 'denied') {
        console.warn('[CapPush] Push notification permission denied');
        return null;
      }

      // Listen for token
      PushNotifications.addListener('registration', (result) => {
        const token: PushToken = {
          value: result.value,
          platform: this.detectPlatform(),
        };
        this.token = token;
        this.tokenHandlers.forEach((h) => h(token));
      });

      // Listen for errors
      PushNotifications.addListener('registrationError', (err) => {
        console.error('[CapPush] Registration error:', err);
      });

      // Listen for incoming notifications (foreground)
      PushNotifications.addListener(
        'pushNotificationReceived',
        (event) => {
          const payload = this.normalizeCapacitorPayload(event);
          this.nativeHandlers.forEach((h) => h(payload));
        },
      );

      // Listen for notification tap (background → foreground)
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (event) => {
          const payload = this.normalizeCapacitorPayload(event.notification);
          // Navigate to the URL from the notification payload
          if (payload.url) {
            window.location.href = payload.url;
          }
          this.nativeHandlers.forEach((h) => h(payload));
        },
      );

      // Register with APNs / FCM
      await PushNotifications.register();
    } catch (err) {
      console.error('[CapPush] Native registration failed:', err);
      return null;
    }

    // Wait briefly for the token — if none arrives, caller can retry
    if (!this.token) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return this.token;
  }

  // ── Web (PWA) registration ────────────────────────────────

  private async registerWeb(): Promise<PushToken | null> {
    if (!isWebPushSupported()) {
      console.info('[CapPush] Web Push not supported');
      return null;
    }

    // Notification permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.info('[CapPush] Web Push permission not granted');
      return null;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn(
        '[CapPush] NEXT_PUBLIC_VAPID_KEY not set — cannot subscribe Web Push',
      );
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // biome-ignore lint/suspicious/noExplicitAny: Uint8Array is the correct format for VAPID key
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      });

      const token: PushToken = {
        value: JSON.stringify(subscription),
        platform: 'web',
      };
      this.token = token;
      this.tokenHandlers.forEach((h) => h(token));

      // Web push notifications are handled by the SW (push event →
      // showNotification).  We don't need to duplicate that handler.
      // But we DO listen for tap-to-open from the service worker
      // via a custom event bridge.
      this._messageListener = (event: MessageEvent) => {
        if (event.data?.type === 'degenfeed-notification-tap') {
          this.webHandlers.forEach((h) => h(event.data.payload));
          if (event.data.payload?.url) {
            window.location.href = event.data.payload.url;
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', this._messageListener);

      return token;
    } catch (err) {
      console.error('[CapPush] Web Push subscription failed:', err);
      return null;
    }
  }

  // ── Event handlers ────────────────────────────────────────

  /** Called when a push notification is received (foreground or tap-to-open). */
  onNotification(handler: NotificationHandler): () => void {
    this.nativeHandlers.add(handler);
    this.webHandlers.add(handler);
    return () => {
      this.nativeHandlers.delete(handler);
      this.webHandlers.delete(handler);
    };
  }

  /** Called when a push token is obtained (for sending to your server). */
  onToken(handler: TokenHandler): () => void {
    this.tokenHandlers.add(handler);
    // Fire immediately if we already have a token
    if (this.token) handler(this.token);
    return () => this.tokenHandlers.delete(handler);
  }

  /** Send the current token to a server endpoint. */
  async syncTokenToServer(
    endpoint = '/api/push/register',
  ): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: this.token.value,
          platform: this.token.platform,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** The current token, if registered. */
  get currentToken(): PushToken | null {
    return this.token;
  }

  /** Clean up service worker message listener to prevent memory leaks. */
  dispose(): void {
    if (this._messageListener && typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', this._messageListener);
      this._messageListener = null;
    }
  }

  /** Whether the device supports push (any method). */
  get isAvailable(): boolean {
    return isNative() || isWebPushSupported();
  }

  // ── Helpers ───────────────────────────────────────────────

  private detectPlatform(): 'ios' | 'android' {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('android') ? 'android' : 'ios';
  }

  /** Normalise Capacitor's notification shape into our PushPayload. */
  private normalizeCapacitorPayload(
    event: { title?: string; body?: string; data?: Record<string, unknown> },
  ): PushPayload {
    const data = event.data ?? {};
    return {
      title: event.title || (data.title as string | undefined),
      body: event.body || (data.body as string | undefined),
      url: (data.url as string) || (data.link as string) || '/',
      tag: data.tag as string | undefined,
      data,
    };
  }

  /** Convert a VAPID base64 public key to Uint8Array for Web Push. */
  private urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
}

/** Singleton instance */
export const pushService = new CapacitorPushService();
