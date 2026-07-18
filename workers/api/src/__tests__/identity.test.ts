/**
 * @degenfeed/api — Identity route tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';
import { handleLinkIdentity, handleResolveIdentity } from '../routes/identity';

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
    // Mock resolveHandle to return a known identity
    vi.doMock('@degenfeed/identity', () => ({
      resolveHandle: vi.fn().mockResolvedValue({
        protocol: 'nostr',
        id: 'abc123',
        displayName: 'Test User',
        avatarUrl: '',
      }),
    }));

    // Re-import the handler to pick up the mock
    const { handleResolveIdentity: resolve } = await import('../routes/identity');
    const req = new Request('http://localhost/api/identity/resolve?handle=test@example.com');
    const env = {} as Env;
    const res = await resolve(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data?: { protocol: string } };
    expect(body.data).toBeDefined();
    expect(body.data?.protocol).toBe('nostr');
  });
});

describe('handleLinkIdentity', () => {
  it('should return 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const env = {} as Env;
    const res = await handleLinkIdentity(req, env);
    expect(res.status).toBe(400);
  });

  it('should return 400 when protocol field is missing', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: JSON.stringify({ identity: { handle: 'test' } }),
      headers: { 'content-type': 'application/json' },
    });
    const env = {} as Env;
    const res = await handleLinkIdentity(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain('protocol');
  });

  it('should reject unsupported protocols', async () => {
    const req = new Request('http://localhost/api/identity/link', {
      method: 'POST',
      body: JSON.stringify({ protocol: 'invalid_protocol', identity: { handle: 'test' } }),
      headers: { 'content-type': 'application/json' },
    });
    const env = {} as Env;
    const res = await handleLinkIdentity(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain('Unsupported protocol');
  });
});
