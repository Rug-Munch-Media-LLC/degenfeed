import { describe, expect, it } from 'vitest';
import type { Env } from '../index';
import worker from '../index';

const env: Env = { AUTH_SECRET: 'test-secret-must-be-at-least-32-bytes' };

describe('CORS wrapper', () => {
  it('returns 204 preflight for allowed origin', async () => {
    const req = new Request('http://localhost/api/publish', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.degenfeed.xyz' },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.degenfeed.xyz');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('content-type');
  });

  it('returns preflight without credentials for disallowed origin', async () => {
    const req = new Request('http://localhost/api/publish', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.com' },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('adds CORS headers to normal responses', async () => {
    const req = new Request('http://localhost/', {
      headers: { origin: 'https://degenfeed.xyz' },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://degenfeed.xyz');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

describe('CSRF origin check', () => {
  it('rejects state-changing POST without origin', async () => {
    const req = new Request('http://localhost/api/tip/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        method: 'ethereum',
        amount: '0.01',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(403);
  });

  it('rejects state-changing POST from disallowed origin', async () => {
    const req = new Request('http://localhost/api/tip/create', {
      method: 'POST',
      headers: {
        origin: 'https://evil.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        method: 'ethereum',
        amount: '0.01',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(403);
  });

  it('skips origin check for GTS callback', async () => {
    const req = new Request('http://localhost/api/auth/gotosocial/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    });
    const res = await worker.fetch(req, env);
    expect([200, 400, 500]).toContain(res.status);
  });
});
