/**
 * Registration prompt logic — pure functions for the anonymous-browsing
 * registration nudge. Kept free of JSX/DOM so it is trivially unit-testable.
 *
 * Flow:
 *   1. Every page view increments a localStorage counter.
 *   2. At BANNER_THRESHOLD views a subtle banner may appear (unless dismissed).
 *   3. At MODAL_THRESHOLD views a modal appears once (unless already seen).
 * Content is never blocked: both surfaces are dismissible.
 */

export const PAGE_VIEW_KEY = 'df_pv_count';
export const BANNER_DISMISSED_KEY = 'df_pv_banner_dismissed';
export const MODAL_SEEN_KEY = 'df_pv_modal_seen';

export const BANNER_THRESHOLD = 5;
export const MODAL_THRESHOLD = 10;

export interface RegistrationPromptFlags {
  bannerDismissed: boolean;
  modalSeen: boolean;
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Current anonymous page-view count (0 when unknown). */
export function readPageViewCount(): number {
  const raw = safeGet(PAGE_VIEW_KEY);
  const n = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Increment the page-view counter and return the new value. */
export function incrementPageView(): number {
  const next = readPageViewCount() + 1;
  safeSet(PAGE_VIEW_KEY, String(next));
  return next;
}

/** Read the persisted dismissal/seen flags. */
export function readFlags(): RegistrationPromptFlags {
  return {
    bannerDismissed: safeGet(BANNER_DISMISSED_KEY) === '1',
    modalSeen: safeGet(MODAL_SEEN_KEY) === '1',
  };
}

export function dismissBanner(): void {
  safeSet(BANNER_DISMISSED_KEY, '1');
}

export function markModalSeen(): void {
  safeSet(MODAL_SEEN_KEY, '1');
}

export type PromptSurface = 'none' | 'banner' | 'modal';

/**
 * Decide which (if any) prompt surface should show for an anonymous user.
 * The modal always takes priority and is shown only once.
 */
export function decidePromptSurface(count: number, flags: RegistrationPromptFlags): PromptSurface {
  if (flags.modalSeen) return 'none';
  if (count >= MODAL_THRESHOLD) return 'modal';
  if (count >= BANNER_THRESHOLD && !flags.bannerDismissed) return 'banner';
  return 'none';
}
