/**
 * @degenfeed/web — Formatting utilities
 * Re-export from @degenfeed/utils with additional web-specific formatters.
 */

export {
  formatCount,
  formatDate,
  formatDuration,
  formatTimestamp,
} from '@degenfeed/utils';

export { formatTimeAgo } from '@degenfeed/utils';

import { formatTimeAgo as timeAgo } from '@degenfeed/utils';

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export { timeAgo };

/** Build a URL query string from an object */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

/** Safely parse JSON with fallback */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
