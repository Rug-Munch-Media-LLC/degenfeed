/**
 * @degenfeed/web — feedError
 *
 * Classifies feed-fetch failures so feed pages can show the right
 * copy + recovery action instead of a raw error string.
 *
 * Kinds:
 *  - network : connection lost → "Connection lost" + retry
 *  - timeout : request exceeded budget → "Taking longer than expected" + retry
 *  - auth    : 401/403 → redirect to login
 *  - unknown : generic → friendly retry
 */

export type FeedErrorKind = 'network' | 'timeout' | 'auth' | 'unknown';

export interface ClassifiedFeedError {
  kind: FeedErrorKind;
  /** Human-facing message suitable for <FeedList error> / <ErrorState> */
  message: string;
}

const TIMEOUT_PATTERNS = [
  /timed?\s*out/i,
  /timeout/i,
  /aborted/i,
  /taking longer/i,
  /slow/i,
  /deadline/i,
];

const NETWORK_PATTERNS = [
  /network/i,
  /fetch/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /EPIPE/i,
  /DNS/i,
  /offline/i,
  /internet/i,
  /connection/i,
  /socket/i,
  /5\d{2}/,
  /failed to fetch/i,
];

const AUTH_PATTERNS = [/unauthorized/i, /401/i, /403/i, /forbidden/i, /not authorized/i, /session.*expired/i, /sign\s*in/i];

const COPY: Record<Exclude<FeedErrorKind, 'auth'>, string> = {
  network: 'Connection lost. Check your connection and try again.',
  timeout: 'Taking longer than expected. Try refreshing.',
  unknown: 'Something went wrong loading this feed.',
};

/**
 * Classify a thrown error (optionally with the HTTP status from a response).
 */
export function classifyFeedError(
  error: unknown,
  status?: number,
): ClassifiedFeedError {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (status === 401 || status === 403 || AUTH_PATTERNS.some((p) => p.test(message))) {
    return { kind: 'auth', message: COPY.network };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'timeout', message: COPY.timeout };
  }
  if (TIMEOUT_PATTERNS.some((p) => p.test(message))) {
    return { kind: 'timeout', message: COPY.timeout };
  }
  if (error instanceof TypeError || NETWORK_PATTERNS.some((p) => p.test(message))) {
    return { kind: 'network', message: COPY.network };
  }
  return { kind: 'unknown', message: COPY.unknown };
}
