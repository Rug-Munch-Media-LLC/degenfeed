/**
 * @degenfeed/utils — Shared test utilities for the DegenFeed test suite.
 *
 * Provides mock builders, fixture factories, and helper functions used
 * across unit, component, and integration tests.
 */

import type { Embed, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

// ─── Mock identity builder ─────────────────────────────────────────

export function makeMockIdentity(overrides: Partial<UnifiedIdentity> = {}): UnifiedIdentity {
  return {
    id: 'nostr:test',
    primary: { protocol: 'nostr', id: 'test' },
    handles: {
      nostr: '@test',
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: 'Test User',
    bio: 'A test user',
    avatarUrl: '',
    verified: [],
    followerCount: 100,
    followingCount: 50,
    links: [],
    keys: {},
    ...overrides,
  };
}

// ─── Mock post builder ─────────────────────────────────────────────

export function makeMockPost(
  id: string,
  overrides: Partial<UnifiedPost> = {},
): UnifiedPost {
  return {
    id,
    protocol: 'nostr',
    author: makeMockIdentity(),
    text: `Post body ${id}`,
    html: undefined,
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
    niches: [],
    parentId: undefined,
    rootId: undefined,
    dfUri: `df://nostr:${id}`,
    ...overrides,
  };
}

// ─── Mock embed builder ────────────────────────────────────────────

export function makeMockEmbed(overrides: Partial<Embed> = {}): Embed {
  return {
    kind: 'link',
    url: 'https://example.com',
    ...overrides,
  };
}

// ─── Mock fetch helper ─────────────────────────────────────────────

type MockResponse = {
  status: number;
  body: unknown;
  ok?: boolean;
  headers?: Record<string, string>;
};

const mockHandlers = new Map<string, MockResponse>();

/**
 * Register a mock response for a URL pattern (string prefix match).
 */
export function mockFetch(urlPrefix: string, response: MockResponse): void {
  mockHandlers.set(urlPrefix, { ...response, ok: response.ok ?? (response.status >= 200 && response.status < 300) });
}

/**
 * Clear all registered mock responses.
 */
export function clearMockFetch(): void {
  mockHandlers.clear();
}

/**
 * A drop-in replacement for global fetch that returns registered mock responses.
 * Call `mockFetch()` to register responses before using this in tests.
 *
 * Usage:
 * ```ts
 * import { mockFetch, clearMockFetch, mockFetchHandler } from '@degenfeed/utils/test-utils';
 *
 * beforeEach(() => {
 *   mockFetch('https://api.dexscreener.com', { status: 200, body: { pairs: [] } });
 *   globalThis.fetch = vi.fn().mockImplementation(mockFetchHandler);
 * });
 * afterEach(() => {
 *   clearMockFetch();
 * });
 * ```
 */
export async function mockFetchHandler(
  input: RequestInfo | URL,
  _init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  for (const [prefix, response] of mockHandlers) {
    if (url.startsWith(prefix)) {
      return new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: response.headers ?? { 'content-type': 'application/json' },
      });
    }
  }
  return new Response(JSON.stringify({ error: 'unmocked URL' }), { status: 404 });
}

// ─── Mock wallet helper ────────────────────────────────────────────

export interface MockWallet {
  address: string;
  chain: string;
  balance: number;
  isConnected: boolean;
}

/**
 * Create a mock wallet object for testing wallet-dependent components.
 */
export function makeMockWallet(overrides: Partial<MockWallet> = {}): MockWallet {
  return {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'ethereum',
    balance: 1.5,
    isConnected: true,
    ...overrides,
  };
}

// ─── Mock protocol data ────────────────────────────────────────────

export interface MockProtocolData {
  protocol: string;
  displayName: string;
  handle: string;
  followerCount: number;
  verified: boolean;
}

/**
 * Create a mock protocol data object for testing protocol-specific features.
 */
export function makeMockProtocolData(
  overrides: Partial<MockProtocolData> = {},
): MockProtocolData {
  return {
    protocol: 'nostr',
    displayName: 'Nostr',
    handle: '@test_user',
    followerCount: 100,
    verified: false,
    ...overrides,
  };
}
