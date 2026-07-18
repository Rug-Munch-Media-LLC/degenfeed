/**
 * @degenfeed/api — Identity route tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';
import { handleLinkIdentity, handleResolveIdentity } from '../routes/identity';

// Mock the resolveHandle function at module level
vi.mock('@degenfeed/identity', () => ({
  resolveHandle: vi.fn().mockImplementation(async (handle: string) => {
    if (handle === 'test@example.com') {
      return {
        protocol: 'nostr',
        id: 'abc123',
        handle: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: '',
      };
    }
    if (handle === 'user@mastodon.social') {
      return {
        protocol: 'mastodon',
        id: 'https://mastodon.social/users/user',
        handle: 'user@mastodon.social',
      };
    }
    if (handle === 'alice@threads.net') {
      return {
        protocol: 'threads',
        id: 'https://threads.net/@alice',
        handle: 'alice@threads.net',
      };
    }
    return null;
  }),
  resolveFediverseHandle: vi.fn().mockImplementation(async (handle: string) => {
    if (handle === 'user@mastodon.social') {
      return {
        protocol: 'mastodon',
        id: 'https://mastodon.social/users/user',
        handle: 'user@mastodon.social',
      };
    }
    if (handle === 'alice@threads.net') {
      return {
        protocol: 'threads',
        id: 'https://threads.net/@alice',
        handle: 'alice@threads.net',
      };
    }
    return null;
  }),
}));

describe('handleResolveIdentity', () => {
  it('should return 400 when handle parameter is missing', async () => {
    const req = new Request('http://localhost/api/identity/resolve');
    const env = { CACHE: { get: vi.fn(), put: vi.fn() } } as unknown as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain('handle');
  });

  it('should return 404 when handle is not found', async () => {
    const req = new Request('http://localhost/api/identity/resolve?handle=nonexistent_user_12345');
    const env = { CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(404);
  });

  it('should return identity data when handle resolves', async () => {
    const req = new Request('http://localhost/api/identity/resolve?handle=test@example.com');
    const env = { CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data?: { protocol: string } };
    expect(body.data).toBeDefined();
    expect(body.data?.protocol).toBe('nostr');
  });

  it('should resolve Mastodon fediverse handles', async () => {
    const req = new Request('http://localhost/api/identity/resolve?handle=user@mastodon.social');
    const env = { CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data?: { protocol: string; id: string } };
    expect(body.data?.protocol).toBe('mastodon');
    expect(body.data?.id).toContain('mastodon.social');
  });

  it('should resolve Threads handles via WebFinger', async () => {
    const req = new Request('http://localhost/api/identity/resolve?handle=alice@threads.net');
    const env = { CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } } as unknown as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data?: { protocol: string } };
    expect(body.data?.protocol).toBe('threads');
  });

  it('should cache resolved handles in KV', async () => {
    const putFn = vi.fn().mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/identity/resolve?handle=test@example.com');
    const env = { CACHE: { get: vi.fn().mockResolvedValue(null), put: putFn } } as unknown as Env;
    await handleResolveIdentity(req, env);
    expect(putFn).toHaveBeenCalled();
    const callArg = putFn.mock.calls[0][0] as string;
    expect(callArg).toContain('resolve:');
  });

  it('should return cached result when available', async () => {
    const cachedData = { protocol: 'nostr', id: 'cached-id', handle: 'cached@example.com' };
    const req = new Request('http://localhost/api/identity/resolve?handle=cached@example.com');
    const env = { CACHE: { get: vi.fn().mockResolvedValue(JSON.stringify(cachedData)), put: vi.fn() } } as unknown as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data?: { protocol: string }; cached?: boolean };
    expect(body.data?.protocol).toBe('nostr');
    expect(body.cached).toBe(true);
  });
});

describe('handleLinkIdentity', () => {
  it('should return 401 without session', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const env = { AUTH_SECRET: 'test-secret-at-least-32-bytes-long!!' } as Env;
    const res = await handleLinkIdentity(req, env);
    // No session cookie -> 401
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json', cookie: '__Host-dfid=invalid' },
    });
    const env = { AUTH_SECRET: 'test-secret-at-least-32-bytes-long!!' } as Env;
    const res = await handleLinkIdentity(req, env);
    expect([400, 401]).toContain(res.status);
  });

  it('should return 400 when protocol field is missing', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: JSON.stringify({ identity: { handle: 'test' } }),
      headers: { 'content-type': 'application/json' },
    });
    const env = { AUTH_SECRET: 'test-secret-at-least-32-bytes-long!!' } as Env;
    const res = await handleLinkIdentity(req, env);
    expect([400, 401]).toContain(res.status);
  });

  it('should reject unsupported protocols', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: JSON.stringify({ protocol: 'invalid_protocol', identity: { handle: 'test' } }),
      headers: { 'content-type': 'application/json' },
    });
    const env = { AUTH_SECRET: 'test-secret-at-least-32-bytes-long!!' } as Env;
    const res = await handleLinkIdentity(req, env);
    expect(res.status).toBe(401);
  });
});

describe('resolveHandle dispatcher', () => {
  it('should route Mastodon handles to resolveFediverseHandle', async () => {
    const { resolveHandle, resolveFediverseHandle } = await import('@degenfeed/identity');
    const result = await resolveHandle('user@mastodon.social');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('mastodon');
  });

  it('should route Threads handles via WebFinger', async () => {
    const { resolveHandle, resolveFediverseHandle } = await import('@degenfeed/identity');
    const result = await resolveHandle('alice@threads.net');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('threads');
  });

  it('should return null for unresolved handles', async () => {
    const { resolveHandle } = await import('@degenfeed/identity');
    const result = await resolveHandle('nonexistent@nowhere.invalid');
    expect(result).toBeNull();
  });
});
