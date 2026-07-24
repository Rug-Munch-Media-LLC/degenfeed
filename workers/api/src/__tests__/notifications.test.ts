import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    disconnectAll: vi.fn(),
  })),
}));

import type { Env } from '../index';
import { handleNotifications } from '../routes/notifications';

import { createSession, parseSessionCookie } from '../session';

const secret = 'test-secret-must-be-at-least-32-bytes';
const env: Env = { AUTH_SECRET: secret };

async function signedRequest(url: string, method = 'GET', body?: BodyInit): Promise<Request> {
  const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
  const cookieValue = parseSessionCookie(setCookie);
  if (!cookieValue) throw new Error('missing cookie');
  const headers: Record<string, string> = {
    cookie: `__Host-dfid=${cookieValue}`,
  };
  if (body) headers['content-type'] = 'application/json';
  return new Request(url, { method, headers, body });
}

describe('handleNotifications', () => {
  it('should return notifications array', async () => {
    const req = await signedRequest('http://localhost/api/notifications?auth=%7B%7D');
    const res = await handleNotifications(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notifications: unknown[] };
    expect(Array.isArray(body.notifications)).toBe(true);
  });

  it('should handle Nostr pubkey auth via POST body', async () => {
    const req = await signedRequest(
      'http://localhost/api/notifications',
      'POST',
      JSON.stringify({ auth: { nostr_pubkey: 'abc123' } }),
    );
    const res = await handleNotifications(req, env);
    expect(res.status).toBe(200);
  });

  it('should reject without session', async () => {
    const req = new Request('http://localhost/api/notifications?auth=%7B%7D');
    const res = await handleNotifications(req, env);
    expect(res.status).toBe(401);
  });
});
