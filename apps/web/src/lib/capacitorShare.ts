/**
 * Capacitor Share wrapper
 *
 * Abstracts over Capacitor's native Share plugin and the Web Share API
 * (navigator.share).  Provides a consistent `share()` interface that
 * works in both native (iOS/Android) and PWA / desktop environments.
 *
 * Usage:
 *   import { share } from '@/lib/capacitorShare';
 *   await share({ url: 'https://app.degenfeed.xyz/post/abc', title: 'Check this out' });
 */

// == Types ======================================================

export interface ShareOptions {
  /** URL to share. */
  url?: string;
  /** Title / subject line. */
  title?: string;
  /** Body text or description. */
  text?: string;
  /** Dialog title (Android native only; ignored on iOS & Web). */
  dialogTitle?: string;
  /** List of files to share (web only; requires user gesture). */
  files?: File[];
}

export type ShareResult =
  | { completed: true; method: 'native' | 'web' }
  | { completed: false; method?: 'native' | 'web'; error?: string };

// == Environment detection ======================================

function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const global = window as unknown as Record<string, unknown>;
  return !!(global.Capacitor as Record<string, unknown> | undefined)?.isNative;
}

function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

// == Share =======================================================

/**
 * Share content using the native share sheet (Capacitor) or the
 * Web Share API as a fallback.
 *
 * @returns An object describing whether sharing was completed and
 *          which method was used.
 */
export async function share(options: ShareOptions): Promise<ShareResult> {
  const { url, title, text, dialogTitle } = options;

  if (isNative()) {
    return shareNative({ url, title, text, dialogTitle });
  }

  if (isWebShareSupported()) {
    return shareWeb({ url, title, text, files: options.files });
  }

  // Fallback: no share capability available
  console.info('[CapShare] Neither native nor Web Share API available');
  return {
    completed: false,
    error: 'Share not supported on this device',
  };
}

// == Native (Capacitor) =========================================

async function shareNative(options: ShareOptions): Promise<ShareResult> {
  try {
    const { Share } = await import('@capacitor/share');

    await Share.share({
      url: options.url,
      title: options.title,
      text: options.text,
      dialogTitle: options.dialogTitle,
    });

    return { completed: true, method: 'native' };
  } catch (err: unknown) {
    // Capacitor throws if the user dismissed the share sheet
    if (
      err instanceof Error &&
      (err.message?.includes('cancel') ||
        err.message?.includes('abort') ||
        err.message?.includes('dismissed'))
    ) {
      return { completed: false, method: 'native' };
    }
    return {
      completed: false,
      method: 'native',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// == Web (navigator.share) =====================================

async function shareWeb(options: ShareOptions): Promise<ShareResult> {
  try {
    await navigator.share({
      url: options.url,
      title: options.title,
      text: options.text,
    });

    return { completed: true, method: 'web' };
  } catch (err: unknown) {
    // AbortError means the user cancelled — not a failure
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { completed: false, method: 'web' };
    }
    return {
      completed: false,
      method: 'web',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check whether sharing is available on the current device.
 * Does NOT trigger a permission prompt.
 */
export function isShareAvailable(): boolean {
  return isNative() || isWebShareSupported();
}
