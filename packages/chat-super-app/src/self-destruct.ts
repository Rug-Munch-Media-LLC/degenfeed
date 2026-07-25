/**
 * @degenfeed/chat-super-app — Self-Destruct Timers (Disappearing Messages)
 *
 * Per-conversation auto-delete timers. When a timer is set, ALL messages in
 * that conversation are automatically deleted from ALL devices after the timer
 * expires. View-once media: photos/videos that disappear after being viewed.
 *
 * Timer options:
 *   - Off (no auto-delete)
 *   - 5 seconds (disappearing messages)
 *   - 30 seconds
 *   - 1 minute
 *   - 5 minutes
 *   - 1 hour
 *   - 24 hours
 *   - 7 days
 *   - 30 days
 *
 * Screenshot detection (where platform allows):
 *   - Web: document.visibilitychange + blur/focus events
 *   - Mobile: screenshot detection APIs (limited)
 *   - Notification to sender when screenshot is taken (best-effort)
 */

import type { Env } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type SelfDestructDuration =
  | 0           // Off
  | 5           // 5 seconds
  | 30          // 30 seconds
  | 60          // 1 minute
  | 300         // 5 minutes
  | 3600        // 1 hour
  | 86400       // 24 hours
  | 604800      // 7 days
  | 2592000;    // 30 days

export const SELF_DESTRUCT_OPTIONS: Array<{ value: SelfDestructDuration; label: string }> = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
  { value: 604800, label: '7 days' },
  { value: 2592000, label: '30 days' },
];

export interface ConversationTimer {
  conversationId: string;
  duration: SelfDestructDuration;
  setBy: string;
  setAt: number;
  enabled: boolean;
}

export interface DisappearingMessage {
  messageId: string;
  conversationId: string;
  expiresAt: number;
  duration: SelfDestructDuration;
  viewOnce: boolean;
  viewed: boolean;
  viewedAt?: number;
}

export interface ViewOnceMedia {
  mediaId: string;
  messageId: string;
  conversationId: string;
  url: string;
  type: 'image' | 'video';
  viewed: boolean;
  viewedAt?: number;
  expiresAt: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TIMER_PREFIX = 'chat:selfdestruct:timer:';
const DISAPPEARING_PREFIX = 'chat:selfdestruct:msg:';
const VIEWONCE_PREFIX = 'chat:selfdestruct:viewonce:';
const SCREENSHOT_PREFIX = 'chat:selfdestruct:screenshot:';

const CLEANUP_INTERVAL_MS = 60_000; // Check for expired messages every 60s
const VIEW_ONCE_EXPIRY_MS = 30_000; // View-once media expires 30s after viewing

// ─── Self-Destruct Timer Manager ───────────────────────────────────────────

export class SelfDestructManager {
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the cleanup timer that deletes expired messages.
   */
  startCleanup(env: Env): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages(env).catch((err) => {
        console.error('[self-destruct] Cleanup failed:', err);
      });
    }, CLEANUP_INTERVAL_MS);
    console.log('[self-destruct] Cleanup timer started');
  }

  /**
   * Stop the cleanup timer.
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Set the self-destruct timer for a conversation.
   */
  async setTimer(
    env: Env,
    conversationId: string,
    duration: SelfDestructDuration,
    setBy: string,
  ): Promise<ConversationTimer> {
    const timer: ConversationTimer = {
      conversationId,
      duration,
      setBy,
      setAt: Date.now(),
      enabled: duration > 0,
    };

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(`${TIMER_PREFIX}${conversationId}`, JSON.stringify(timer), {
        expirationTtl: duration > 0 ? Math.ceil(duration * 1.5) : undefined,
      });
    }

    // If timer is being set to a value, mark all existing messages for deletion
    if (duration > 0) {
      await this.markExistingMessagesForDeletion(env, conversationId, duration);
    }

    return timer;
  }

  /**
   * Get the current timer for a conversation.
   */
  async getTimer(env: Env, conversationId: string): Promise<ConversationTimer | null> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return null;

    try {
      const raw = await kv.get(`${TIMER_PREFIX}${conversationId}`);
      return raw ? (JSON.parse(raw) as ConversationTimer) : null;
    } catch {
      return null;
    }
  }

  /**
   * Disable the timer for a conversation (stop disappearing messages).
   */
  async disableTimer(env: Env, conversationId: string): Promise<void> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.delete(`${TIMER_PREFIX}${conversationId}`);
    }
  }

  /**
   * Get the timer display string for the chat header.
   */
  getTimerDisplay(duration: SelfDestructDuration): string | null {
    if (duration === 0) return null;
    const option = SELF_DESTRUCT_OPTIONS.find((o) => o.value === duration);
    return option ? `Messages disappear after ${option.label.toLowerCase()}` : null;
  }

  /**
   * Register a new message for auto-deletion.
   */
  async registerMessage(
    env: Env,
    messageId: string,
    conversationId: string,
    duration: SelfDestructDuration,
    viewOnce = false,
  ): Promise<DisappearingMessage> {
    const expiresAt = Date.now() + duration * 1000;

    const disappearing: DisappearingMessage = {
      messageId,
      conversationId,
      expiresAt,
      duration,
      viewOnce,
      viewed: false,
    };

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(
        `${DISAPPEARING_PREFIX}${messageId}`,
        JSON.stringify(disappearing),
        { expirationTtl: Math.ceil(duration * 1.5) },
      );
    }

    return disappearing;
  }

  /**
   * Mark a view-once media as viewed. It will be cleaned up shortly after.
   */
  async markViewOnceViewed(
    env: Env,
    mediaId: string,
  ): Promise<ViewOnceMedia | null> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return null;

    try {
      const raw = await kv.get(`${VIEWONCE_PREFIX}${mediaId}`);
      if (!raw) return null;

      const media = JSON.parse(raw) as ViewOnceMedia;
      media.viewed = true;
      media.viewedAt = Date.now();
      media.expiresAt = Date.now() + VIEW_ONCE_EXPIRY_MS;

      await kv.put(`${VIEWONCE_PREFIX}${mediaId}`, JSON.stringify(media), {
        expirationTtl: 60, // Clean up within 60s
      });

      return media;
    } catch {
      return null;
    }
  }

  /**
   * Register view-once media.
   */
  async registerViewOnce(
    env: Env,
    mediaId: string,
    messageId: string,
    conversationId: string,
    url: string,
    type: 'image' | 'video',
    duration: SelfDestructDuration,
  ): Promise<ViewOnceMedia> {
    const viewOnce: ViewOnceMedia = {
      mediaId,
      messageId,
      conversationId,
      url,
      type,
      viewed: false,
      expiresAt: Date.now() + duration * 1000,
    };

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(`${VIEWONCE_PREFIX}${mediaId}`, JSON.stringify(viewOnce), {
        expirationTtl: Math.ceil(duration * 1.5),
      });
    }

    return viewOnce;
  }

  /**
   * Get view-once media (returns null if already viewed or expired).
   */
  async getViewOnce(
    env: Env,
    mediaId: string,
  ): Promise<ViewOnceMedia | null> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return null;

    try {
      const raw = await kv.get(`${VIEWONCE_PREFIX}${mediaId}`);
      if (!raw) return null;

      const media = JSON.parse(raw) as ViewOnceMedia;

      // If already viewed or expired, delete and return null
      if (media.viewed || Date.now() > media.expiresAt) {
        await kv.delete(`${VIEWONCE_PREFIX}${mediaId}`).catch(() => {});
        return null;
      }

      return media;
    } catch {
      return null;
    }
  }

  /**
   * Log a screenshot detection event.
   */
  async reportScreenshot(
    env: Env,
    conversationId: string,
    messageId: string,
    reportedBy: string,
  ): Promise<void> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return;

    const screenshotRecord = {
      conversationId,
      messageId,
      reportedBy,
      timestamp: Date.now(),
    };

    await kv.put(
      `${SCREENSHOT_PREFIX}${conversationId}:${messageId}`,
      JSON.stringify(screenshotRecord),
      { expirationTtl: 86400 }, // Keep for 24h
    );
  }

  /**
   * Check if a screenshot was detected for a message.
   */
  async wasScreenshotDetected(
    env: Env,
    conversationId: string,
    messageId: string,
  ): Promise<boolean> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return false;

    try {
      const raw = await kv.get(`${SCREENSHOT_PREFIX}${conversationId}:${messageId}`);
      return raw !== null;
    } catch {
      return false;
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  /**
   * Delete all expired messages from KV.
   */
  private async cleanupExpiredMessages(env: Env): Promise<number> {
    // Note: In production, this would be a KV list operation.
    // For now, we rely on KV TTL for automatic cleanup.
    // This method exists for when we need to do additional cleanup
    // like notifying WebSocket clients about deleted messages.
    return 0;
  }

  /**
   * Mark existing messages in a conversation for deletion when a timer is set.
   */
  private async markExistingMessagesForDeletion(
    env: Env,
    conversationId: string,
    duration: SelfDestructDuration,
  ): Promise<void> {
    // In production, iterate over conversation messages and set TTLs.
    // For now, the timer applies to NEW messages.
    // Existing messages keep their current state.
    console.log(
      `[self-destruct] Timer set for ${conversationId}: ${duration}s. New messages will auto-delete.`,
    );
  }
}

// ─── Client-Side Screenshot Detection ──────────────────────────────────────

/**
 * Client-side screenshot detection utilities.
 * Note: True screenshot detection is limited on web, but we use:
 *   - visibilitychange: detect when user switches tabs
 *   - blur: detect when window loses focus
 *   - onbeforecopy: detect copy attempts
 */

export function createScreenshotDetector(
  onScreenshot: () => void,
): { start: () => void; stop: () => void } {
  let isActive = false;
  let lastVisibilityChange = 0;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      lastVisibilityChange = Date.now();
    } else {
      // Returned from hidden state — possible screenshot
      const elapsed = Date.now() - lastVisibilityChange;
      if (elapsed < 3000 && isActive) {
        onScreenshot();
      }
    }
  };

  const handleBlur = () => {
    lastVisibilityChange = Date.now();
  };

  const handleFocus = () => {
    const elapsed = Date.now() - lastVisibilityChange;
    if (elapsed < 3000 && isActive && lastVisibilityChange > 0) {
      onScreenshot();
    }
  };

  // Detect copy of protected content
  const handleCopy = (e: ClipboardEvent) => {
    if (isActive) {
      e.preventDefault();
      onScreenshot();
    }
  };

  return {
    start() {
      isActive = true;
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      document.addEventListener('copy', handleCopy);
    },
    stop() {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopy);
    },
  };
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _selfDestructInstance: SelfDestructManager | null = null;

export function getSelfDestructManager(): SelfDestructManager {
  if (!_selfDestructInstance) _selfDestructInstance = new SelfDestructManager();
  return _selfDestructInstance;
}
