/**
 * Test setup for Cloudflare Worker tests.
 * Mocks CF-specific globals that don't exist in Node.js.
 */

// Mock fetch — each test sets up its own responses
import { vi } from 'vitest';

// Mock global fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL, opts?: RequestInit) => {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

// Mock WebSocket (used by Nostr SDK)
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 3; // CLOSED
  constructor(url: string) { this.url = url; }
  close() {}
  send() {}
}

(globalThis as any).WebSocket = MockWebSocket;

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});
