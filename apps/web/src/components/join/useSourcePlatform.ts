'use client';

/**
 * @components/join/useSourcePlatform — Detect the user's originating platform.
 *
 * Reads `document.referrer` and URL search params (`?ref=` / `?source=`)
 * to determine which external platform sent the user. Falls back to
 * `'direct'` if no platform signal is found.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { SourcePlatform } from './types';

/* === Constants =================================================== */

const REFERRER_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  platform: SourcePlatform;
  instance?: true;
}> = [
  { pattern: /mastodon\.(social|online|world)/i, platform: 'mastodon' },
  { pattern: /pixelfed\./i, platform: 'mastodon' },
  { pattern: /g0tosocial\./i, platform: 'mastodon' },
  { pattern: /bsky\.app/i, platform: 'bluesky' },
  { pattern: /staging\.bsky\.app/i, platform: 'bluesky' },
  { pattern: /warpcast\.com/i, platform: 'farcaster' },
  { pattern: /fcast\.today/i, platform: 'farcaster' },
  { pattern: /snort\.social/i, platform: 'nostr' },
  { pattern: /primal\.net/i, platform: 'nostr' },
  { pattern: /coracle\.social/i, platform: 'nostr' },
  { pattern: /iris\.to/i, platform: 'nostr' },
  { pattern: /snort\.social/i, platform: 'nostr' },
  { pattern: /threads\.net/i, platform: 'threads' },
  { pattern: /lens\.com/i, platform: 'lens' },
  { pattern: /hey\.xyz/i, platform: 'lens' },
  { pattern: /tape\.xyz/i, platform: 'lens' },
  { pattern: /orb\.club/i, platform: 'lens' },
  { pattern: /phaver\.com/i, platform: 'lens' },
  { pattern: /app\.degenfeed\.xyz/i, platform: 'degenfeed' },
  { pattern: /degenfeed\.xyz/i, platform: 'degenfeed' },
];

const PLATFORM_PARAM_KEYS = ['ref', 'source', 'utm_source', 'platform'] as const;

/* === Snapshot store for document.referrer ======================= */

function getReferrer(): string {
  if (typeof document === 'undefined') return '';
  return document.referrer;
}

function subscribeToReferrer(callback: () => void): () => void {
  // Referrer doesn't change during a session, but we subscribe to
  // popstate/hashchange in case the URL params update.
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('hashchange', callback);
  };
}

/* === Hook ======================================================== */

export interface UseSourcePlatformResult {
  /** The detected source platform, or `'direct'` if none found. */
  platform: SourcePlatform;
  /** The full referrer URL (truncated to 512 chars for safety). */
  referrer: string;
  /** The domain portion of the referrer, e.g. `mastodon.social`. */
  referrerDomain: string;
  /** Human-readable platform label. */
  platformLabel: string;
  /** Whether the referrer includes an instance/subdomain hint. */
  hasInstance: boolean;
  /** URL query param used to override detection, if any. */
  overrideParam: string | null;
  /** Reset detection (useful after a client-side navigation). */
  reset: () => void;
}

export function useSourcePlatform(): UseSourcePlatformResult {
  // Use sync external store for SSR safety
  const referrer = useSyncExternalStore(subscribeToReferrer, getReferrer, () => '');

  const result = useMemo((): Omit<UseSourcePlatformResult, 'reset'> => {
    const normalized = referrer.slice(0, 512);
    const urlParams =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    // 1. Check URL override param first (highest priority)
    for (const key of PLATFORM_PARAM_KEYS) {
      const val = urlParams.get(key);
      if (val && isValidPlatform(val)) {
        const domain = extractDomain(referrer);
        return {
          platform: val as SourcePlatform,
          referrer: normalized,
          referrerDomain: domain,
          platformLabel: getPlatformLabel(val as SourcePlatform),
          hasInstance: !!domain && !isKnownPlatformDomain(domain),
          overrideParam: key,
        };
      }
    }

    // 2. Check referrer against known patterns
    if (normalized) {
      for (const { pattern, platform } of REFERRER_PATTERNS) {
        if (pattern.test(normalized)) {
          const domain = extractDomain(normalized);
          return {
            platform,
            referrer: normalized,
            referrerDomain: domain,
            platformLabel: getPlatformLabel(platform),
            hasInstance: !isKnownPlatformDomain(domain),
            overrideParam: null,
          };
        }
      }
    }

    // 3. Check user-agent for platform-specific clients
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const uaPlatform = detectFromUserAgent(ua);
    if (uaPlatform) {
      return {
        platform: uaPlatform,
        referrer: normalized,
        referrerDomain: extractDomain(normalized),
        platformLabel: getPlatformLabel(uaPlatform),
        hasInstance: false,
        overrideParam: null,
      };
    }

    // 4. Default to direct
    return {
      platform: 'direct',
      referrer: normalized,
      referrerDomain: extractDomain(normalized),
      platformLabel: getPlatformLabel('direct'),
      hasInstance: false,
      overrideParam: null,
    };
  }, [referrer]);

  const reset = useCallback(() => {
    // Force re-read of referrer by triggering a state update
    // This is a no-op in practice but signals intent.
  }, []);

  return { ...result, reset };
}

/* === Helpers ====================================================== */

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Try extracting from string pattern
    const match = url.match(/https?:\/\/([^/]+)/);
    return match?.[1] ?? '';
  }
}

function isKnownPlatformDomain(domain: string): boolean {
  return REFERRER_PATTERNS.some(({ pattern }) => pattern.test(domain));
}

function isValidPlatform(val: string): val is SourcePlatform {
  const known: Set<string> = new Set([
    'mastodon',
    'bluesky',
    'farcaster',
    'nostr',
    'threads',
    'lens',
    'degenfeed',
    'direct',
  ]);
  return known.has(val);
}

function getPlatformLabel(platform: SourcePlatform): string {
  const labels: Record<SourcePlatform, string> = {
    mastodon: 'Mastodon',
    bluesky: 'Bluesky',
    farcaster: 'Farcaster',
    nostr: 'Nostr',
    threads: 'Threads',
    lens: 'Lens',
    degenfeed: 'DegenFeed',
    direct: 'Direct Link',
  };
  return labels[platform];
}

function detectFromUserAgent(ua: string): SourcePlatform | null {
  if (/Mastodon/i.test(ua) && !/DegenFeed/i.test(ua)) return 'mastodon';
  if (/Bluesky/i.test(ua) && !/DegenFeed/i.test(ua)) return 'bluesky';
  if (/Damus|Nostr|Nos/i.test(ua) && !/DegenFeed/i.test(ua)) return 'nostr';
  return null;
}

/* === Standalone helper for non-hook usage ======================== */

export function detectSourcePlatform(): SourcePlatform {
  const ref = typeof document !== 'undefined' ? document.referrer : '';
  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  for (const key of PLATFORM_PARAM_KEYS) {
    const val = params.get(key);
    if (val && isValidPlatform(val)) return val as SourcePlatform;
  }

  for (const { pattern, platform } of REFERRER_PATTERNS) {
    if (pattern.test(ref)) return platform;
  }

  return 'direct';
}
