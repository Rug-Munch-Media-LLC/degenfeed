/**
 * Test setup for Cloudflare Worker tests.
 * Mocks CF-specific globals that don't exist in Node.js.
 */

// Mock fetch — each test sets up its own responses
import { afterEach, vi } from 'vitest';

// Mock global fetch
globalThis.fetch = vi.fn().mockImplementation(async (_url: string | URL, _opts?: RequestInit) => {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

// Mock Cache API (caches.default) — edge-cache.ts wraps all Cache API calls
// in try/catch, so tests still pass without this, but an in-memory mock keeps
// cache reads deterministic and lets cache-backed paths be exercised.
const edgeCacheStore = new Map<string, Response>();
const edgeCache: Cache = {
  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const url =
      typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
    const hit = edgeCacheStore.get(url);
    return hit ? hit.clone() : undefined;
  },
  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const url =
      typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
    edgeCacheStore.set(url, response.clone());
  },
  async delete(_request: RequestInfo | URL): Promise<boolean> {
    return false;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async add(_request: RequestInfo | URL): Promise<void> {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async addAll(_requests: RequestInfo[]): Promise<void> {},
  async keys(_request?: RequestInfo | URL, _options?: CacheQueryOptions): Promise<ReadonlyArray<Request>> {
    return Array.from(edgeCacheStore.keys()).map((k) => new Request(k));
  },
  async matchAll(_request?: RequestInfo | URL, _options?: CacheQueryOptions): Promise<ReadonlyArray<Response>> {
    return [];
  },
};
(globalThis as unknown as { caches: { default: Cache } }).caches = { default: edgeCache };

// Mock WebSocket (used by Nostr SDK)
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 3; // CLOSED
  constructor(url: string) {
    this.url = url;
  }
  close() {}
  send() {}
}

(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
  MockWebSocket as unknown as typeof WebSocket;

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});
