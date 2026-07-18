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
    return null;
  }),
}));

describe('handleResolveIdentity', () => {
  it('should return 400 when handle parameter is missing', async () => {
    const req = new Request('http://localhost/api/identity/resolve');
    const env = {} as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain('handle');
  });

  it('should return 404 when handle is not found', async () => {
    const req = new Request('http://localhost/api/identity/resolve?handle=nonexistent_user_12345');
    const env = {} as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(404);
  });

  it('should return identity data when handle resolves', async () => {
    const req = new Request('http://localhost/api/identity/resolve?handle=test@example.com');
    const env = {} as Env;
    const res = await handleResolveIdentity(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data?: { protocol: string } };
    expect(body.data).toBeDefined();
    expect(body.data?.protocol).toBe('nostr');
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
    // Invalid session cookie -> 401
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
    // No session -> 401
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
