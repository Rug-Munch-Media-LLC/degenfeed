/**
 * @degenfeed/api — Identity Extension route tests
 *
 * Tests for AT Protocol, Zora, Telegram linking and resolution.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// In-memory store for mock KV behaviour (used by CSRF, session, cache)
const mockKvStore = new Map<string, string>();

// Mock fetch globally for DID resolution tests
const _originalFetch = globalThis.fetch;

// ─── Helpers ───────────────────────────────────────────────────────────

function makeMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    AUTH_SECRET: 'test-secret-at-least-32-bytes-long!!',
    IDENTITIES: {
      get: vi.fn().mockImplementation(async (key: string) => mockKvStore.get(key) ?? null),
      put: vi.fn().mockImplementation(async (key: string, value: string) => {
        mockKvStore.set(key, value);
      }),
      delete: vi.fn().mockImplementation(async (key: string) => {
        mockKvStore.delete(key);
      }),
    },
    CACHE: {
      get: vi.fn().mockImplementation(async (key: string) => mockKvStore.get(key) ?? null),
      put: vi.fn().mockImplementation(async (key: string, value: string) => {
        mockKvStore.set(key, value);
      }),
      delete: vi.fn().mockImplementation(async (key: string) => {
        mockKvStore.delete(key);
      }),
    },
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    RATE_LIMIT_DISABLED: 'true',
    ...overrides,
  } as unknown as Env;
}

/** Extract the raw cookie value (after `__Host-dfid=`) from a full Set-Cookie string */
function parseCookieValue(setCookieHeader: string): string {
  const match = setCookieHeader.match(/__Host-dfid=([^;]+)/);
  return match ? match[1] : '';
}

async function createTestSessionCookie(env: Env): Promise<{
  setCookie: string;
  cookieValue: string;
  csrfToken: string;
}> {
  const { createSession, storeCsrfToken } = await import('../session');
  const { setCookie } = await createSession(
    '0x1234567890abcdef1234567890abcdef12345678',
    'ethereum',
    env.AUTH_SECRET || 'test-secret-at-least-32-bytes-long!!',
  );
  const cookieValue = parseCookieValue(setCookie);
  const csrfToken = await storeCsrfToken(cookieValue, env);
  return { setCookie, cookieValue, csrfToken };
}

async function makeLinkRequest(
  body: unknown,
  env: Env,
): Promise<Request & { _csrfToken?: string }> {
  const { setCookie, csrfToken } = await createTestSessionCookie(env);
  const req = new Request('http://localhost/api/identity/extensions/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      cookie: setCookie,
      'X-CSRF-Token': csrfToken,
    },
  }) as Request & { _csrfToken?: string };
  req._csrfToken = csrfToken;
  return req;
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('handleLinkAtproto', () => {
  it('should require authentication', async () => {
    const { handleLinkAtproto } = await import('../routes/identity-extensions');
    const req = new Request('http://localhost/api/identity/extensions/link/atproto', {
      method: 'POST',
      body: JSON.stringify({ handle: 'test.bsky.social' }),
      headers: { 'content-type': 'application/json' },
    });
    const env = makeMockEnv();
    const res = await handleLinkAtproto(req, env);
    expect(res.status).toBe(401);
  });

  it('should validate handle or did is provided', async () => {
    const { handleLinkAtproto } = await import('../routes/identity-extensions');
    const env = makeMockEnv();
    const req = await makeLinkRequest({ handle: '' }, env);
    const res = await handleLinkAtproto(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('Missing');
  });

  it('should validate DID format', async () => {
    const { handleLinkAtproto } = await import('../routes/identity-extensions');
    const env = makeMockEnv();
    const req = await makeLinkRequest({ did: 'not-a-did' }, env);
    const res = await handleLinkAtproto(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('DID format');
  });
});

describe('handleLinkZora', () => {
  it('should require authentication', async () => {
    const { handleLinkZora } = await import('../routes/identity-extensions');
    const req = new Request('http://localhost/api/identity/extensions/link/zora', {
      method: 'POST',
      body: JSON.stringify({ coinAddress: '0x1234' }),
      headers: { 'content-type': 'application/json' },
    });
    const env = makeMockEnv();
    const res = await handleLinkZora(req, env);
    expect(res.status).toBe(401);
  });

  it('should validate coinAddress parameter', async () => {
    const { handleLinkZora } = await import('../routes/identity-extensions');
    const env = makeMockEnv();
    const req = await makeLinkRequest({ coinAddress: '' }, env);
    const res = await handleLinkZora(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('coinAddress');
  });

  it('should validate coinAddress starts with 0x', async () => {
    const { handleLinkZora } = await import('../routes/identity-extensions');
    const env = makeMockEnv();
    const req = await makeLinkRequest({ coinAddress: 'invalid' }, env);
    const res = await handleLinkZora(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('coinAddress');
  });
});

describe('handleLinkTelegram', () => {
  it('should require authentication', async () => {
    const { handleLinkTelegram } = await import('../routes/identity-extensions');
    const req = new Request('http://localhost/api/identity/extensions/link/telegram', {
      method: 'POST',
      body: JSON.stringify({ telegramUserId: 12345 }),
      headers: { 'content-type': 'application/json' },
    });
    const env = makeMockEnv();
    const res = await handleLinkTelegram(req, env);
    expect(res.status).toBe(401);
  });

  it('should validate telegramUserId parameter', async () => {
    const { handleLinkTelegram } = await import('../routes/identity-extensions');
    const env = makeMockEnv();
    const req = await makeLinkRequest({ telegramUserId: '' }, env);
    const res = await handleLinkTelegram(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('telegramUserId');
  });
});

describe('handleResolveWallet', () => {
  it('should return 400 when wallet parameter is missing', async () => {
    const { handleResolveWallet } = await import('../routes/identity-extensions');
    const req = makeGetRequest('http://localhost/api/identity/extensions/resolve/wallet');
    const env = makeMockEnv();
    const res = await handleResolveWallet(req, env);
    expect(res.status).toBe(400);
  });

  it('should return null data when wallet has no identity', async () => {
    const { handleResolveWallet } = await import('../routes/identity-extensions');
    const req = makeGetRequest(
      'http://localhost/api/identity/extensions/resolve/wallet?wallet=0x1234',
    );
    const env = makeMockEnv();
    const res = await handleResolveWallet(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: unknown };
    expect(body.data).toBeNull();
  });
});

describe('handleResolveDid', () => {
  it('should return 400 when did parameter is missing', async () => {
    const { handleResolveDid } = await import('../routes/identity-extensions');
    const req = makeGetRequest('http://localhost/api/identity/extensions/resolve/did');
    const env = makeMockEnv();
    const res = await handleResolveDid(req, env);
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid DID format', async () => {
    const { handleResolveDid } = await import('../routes/identity-extensions');
    const req = makeGetRequest(
      'http://localhost/api/identity/extensions/resolve/did?did=not-a-did',
    );
    const env = makeMockEnv();
    const res = await handleResolveDid(req, env);
    expect(res.status).toBe(400);
  });

  it('should accept valid DID prefix', async () => {
    const { handleResolveDid } = await import('../routes/identity-extensions');
    const req = makeGetRequest(
      'http://localhost/api/identity/extensions/resolve/did?did=did:plc:abc123def456',
    );
    const env = makeMockEnv();
    const res = await handleResolveDid(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { did?: string };
    expect(body.did).toBe('did:plc:abc123def456');
  });
});

describe('handleResolveZora', () => {
  it('should return 400 when wallet parameter is missing', async () => {
    const { handleResolveZora } = await import('../routes/identity-extensions');
    const req = makeGetRequest('http://localhost/api/identity/extensions/resolve/zora');
    const env = makeMockEnv();
    const res = await handleResolveZora(req, env);
    expect(res.status).toBe(400);
  });
});

describe('handleStatus', () => {
  it('should return protocol status with all expected protocols', async () => {
    const { handleStatus } = await import('../routes/identity-extensions');
    const req = makeGetRequest('http://localhost/api/identity/extensions/status');
    const env = makeMockEnv();
    const res = await handleStatus(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { protocols?: Record<string, unknown> };
    expect(body.protocols).toBeDefined();
    expect(body.protocols?.atproto).toBeDefined();
    expect(body.protocols?.zora).toBeDefined();
    expect(body.protocols?.telegram).toBeDefined();
    expect(body.protocols?.nostr).toBeDefined();
    expect(body.protocols?.farcaster).toBeDefined();
  });
});
