import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../index';
import { createSession, parseSessionCookie } from '../session';

const secret = 'test-secret-must-be-at-least-32-bytes';
const env: Env = { AUTH_SECRET: secret };

async function signedRequest(url: string, method = 'GET', body?: BodyInit): Promise<Request> {
  const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
  const cookieValue = parseSessionCookie(setCookie);
  if (!cookieValue) throw new Error('missing cookie');
  const headers: Record<string, string> = {
    cookie: `__Host-dfid=${cookieValue}`,
    origin: 'https://app.degenfeed.xyz',
  };
  if (body) headers['content-type'] = 'application/json';
  return new Request(url, { method, headers, body });
}

describe('GET /api/preferences', () => {
  it('returns defaults when none stored', async () => {
    const req = await signedRequest('http://localhost/api/preferences');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hideLowQuality: boolean;
      diversityBoost: boolean;
    };
    expect(body.hideLowQuality).toBe(false);
    expect(body.diversityBoost).toBe(true);
  });

  it('rejects without session', async () => {
    const req = new Request('http://localhost/api/preferences');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/preferences', () => {
  it('persists hideLowQuality and returns sanitized payload', async () => {
    const req = await signedRequest(
      'http://localhost/api/preferences',
      'POST',
      JSON.stringify({ hideLowQuality: true, recencyWeight: 2.5 }),
    );
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      preferences: {
        hideLowQuality: boolean;
        recencyWeight: number;
        hideLowQualityThreshold: number;
        allowNonCrypto: boolean;
      };
    };
    expect(body.ok).toBe(true);
    expect(body.preferences.hideLowQuality).toBe(true);
    expect(body.preferences.recencyWeight).toBe(2.5);
    expect(body.preferences.hideLowQualityThreshold).toBe(1.0);
    expect(body.preferences.allowNonCrypto).toBe(false);
  });

  it('persists threshold and allowNonCrypto', async () => {
    const req = await signedRequest(
      'http://localhost/api/preferences',
      'POST',
      JSON.stringify({ hideLowQualityThreshold: 3.5, allowNonCrypto: true }),
    );
    const res = await worker.fetch(req, env);
    const body = (await res.json()) as {
      preferences: { hideLowQualityThreshold: number; allowNonCrypto: boolean };
    };
    expect(body.preferences.hideLowQualityThreshold).toBe(3.5);
    expect(body.preferences.allowNonCrypto).toBe(true);
  });

  it('clamps out-of-range recencyWeight', async () => {
    const req = await signedRequest(
      'http://localhost/api/preferences',
      'POST',
      JSON.stringify({ recencyWeight: 99 }),
    );
    const res = await worker.fetch(req, env);
    const body = (await res.json()) as {
      preferences: { recencyWeight: number };
    };
    expect(body.preferences.recencyWeight).toBe(5);
  });

  it('returns 405 on PUT', async () => {
    const req = await signedRequest('http://localhost/api/preferences', 'PUT');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(405);
  });
});
