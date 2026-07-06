import { describe, expect, it } from 'vitest';
import type { Env } from '../index';
import worker from '../index';
import { createSession, parseSessionCookie, verifySessionCookie } from '../session';

const secret = 'test-secret-must-be-at-least-32-bytes';
const env: Env = { AUTH_SECRET: secret };

describe('session cookie', () => {
  it('creates an HttpOnly Secure SameSite=Lax cookie', async () => {
    const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
    expect(setCookie).toContain('__Host-dfid=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
  });

  it('verifies a valid cookie and rejects tampering', async () => {
    const { setCookie, payload } = await createSession('0xAbCd', 'ethereum', secret);
    const value = parseSessionCookie(setCookie);
    expect(value).toBeTruthy();
    if (!value) throw new Error('missing cookie');

    const verified = await verifySessionCookie(value, secret);
    expect(verified?.address).toBe(payload.address);
    expect(verified?.chain).toBe(payload.chain);

    const tampered = value.replace(/^[^.]+/, 'tampered');
    expect(await verifySessionCookie(tampered, secret)).toBeNull();
  });

  it('rejects expired cookies', async () => {
    const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
    const value = parseSessionCookie(setCookie);
    expect(value).toBeTruthy();
    if (!value) throw new Error('missing cookie');

    const [data = '', signature = ''] = value.split('.');
    const payload = JSON.parse(atob(data)) as { exp: number };
    payload.exp = Date.now() - 1000;
    const expired = `${btoa(JSON.stringify(payload))}.${signature}`;
    expect(await verifySessionCookie(expired, secret)).toBeNull();
  });
});

describe('GET /api/auth/session', () => {
  it('returns 401 without a cookie', async () => {
    const req = new Request('http://localhost/api/auth/session');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it('returns the session payload when cookie is valid', async () => {
    const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
    const cookieValue = parseSessionCookie(setCookie);
    expect(cookieValue).toBeTruthy();
    if (!cookieValue) throw new Error('missing cookie');

    const req = new Request('http://localhost/api/auth/session', {
      headers: { cookie: `__Host-dfid=${cookieValue}` },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { address: string; chain: string };
    expect(body.address).toBe('0xabcd');
    expect(body.chain).toBe('ethereum');
  });
});

describe('protected routes', () => {
  it('rejects POST /api/tip/create without a session', async () => {
    const req = new Request('http://localhost/api/tip/create', {
      method: 'POST',
      headers: {
        origin: 'https://app.degenfeed.xyz',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        method: 'ethereum',
        amount: '0.01',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it('allows POST /api/tip/create with a valid session', async () => {
    const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
    const cookieValue = parseSessionCookie(setCookie);
    expect(cookieValue).toBeTruthy();
    if (!cookieValue) throw new Error('missing cookie');

    const req = new Request('http://localhost/api/tip/create', {
      method: 'POST',
      headers: {
        origin: 'https://app.degenfeed.xyz',
        'content-type': 'application/json',
        cookie: `__Host-dfid=${cookieValue}`,
      },
      body: JSON.stringify({
        recipient: '0x1234567890123456789012345678901234567890',
        method: 'ethereum',
        amount: '0.01',
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { method: string };
    expect(body.method).toBe('ethereum');
  });
});
