export const DEFAULT_USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';
export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_RETRIES = 1;
export const DEFAULT_CONCURRENCY = 4;

export interface FetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
  headers: Headers;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
    void promise.finally(() => clearTimeout(id)).catch(() => {});
  });
  return Promise.race([promise, timeout]);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = DEFAULT_RETRIES,
  delayMs = 250,
): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr ?? new Error('Retry exhausted');
}

export async function fetchRaw(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    throw new FetchError(`HTTP ${res.status} ${res.statusText}`, res.status, url);
  }
  return res;
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchRaw(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'user-agent': DEFAULT_USER_AGENT,
      ...init?.headers,
    },
  });
  return res.json() as Promise<T>;
}

/**
 * Like fetchJson, but also runs a runtime type guard on the returned data.
 * If the guard returns false, the promise is rejected with a descriptive
 * error, preventing silent feed breakage when external APIs change shape.
 */
export async function fetchJsonWithGuard<T>(
  url: string,
  name: string,
  guard: (data: unknown) => data is T,
  init?: RequestInit,
): Promise<T> {
  const data = await fetchJson<T>(url, init);
  if (!guard(data)) {
    throw new FetchError(
      `Provider ${name}: response failed runtime schema guard. API may have changed shape.`,
      undefined,
      url,
    );
  }
  return data;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetchRaw(url, {
    ...init,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': DEFAULT_USER_AGENT,
      ...init?.headers,
    },
  });
  return res.text();
}

export async function fetchRss(url: string, init?: RequestInit): Promise<string> {
  const res = await fetchRaw(url, {
    ...init,
    headers: {
      accept:
        'application/rss+xml, application/atom+xml, application/json, application/feed+json, text/xml, */*',
      'user-agent': DEFAULT_USER_AGENT,
      ...init?.headers,
    },
  });
  return res.text();
}

export async function fetchWithFallbacks<T>(
  endpoints: string[],
  fetcher: (url: string) => Promise<T>,
): Promise<T> {
  if (endpoints.length === 0) throw new FetchError('No endpoints provided');
  let lastErr: Error | undefined;
  for (const url of endpoints) {
    try {
      return await fetcher(url);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new FetchError('All fallback endpoints failed');
}

export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));
  const runners = new Set<Promise<void>>();

  while (queue.length > 0 || runners.size > 0) {
    while (runners.size < limit && queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const { item, index } = next;
      const promise = fn(item)
        .then((result) => {
          results[index] = result;
        })
        .catch(() => {})
        .finally(() => {
          runners.delete(promise);
        });
      runners.add(promise);
    }
    if (runners.size > 0) {
      await Promise.race(runners);
    }
  }

  return results;
}

export function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}
