import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/mastodon-sdk', () => ({
  GtSClient: class {
    like = vi.fn().mockResolvedValue({});
    unlike = vi.fn().mockResolvedValue({});
    repost = vi.fn().mockResolvedValue({});
    unrepost = vi.fn().mockResolvedValue({});
    bookmark = vi.fn().mockResolvedValue({});
    unbookmark = vi.fn().mockResolvedValue({});
    publish = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: class {
    publish = vi.fn();
    disconnectAll = vi.fn();
  },
  createReaction: vi.fn().mockReturnValue({ id: 'react-id' }),
  createTextNote: vi.fn().mockReturnValue({ id: 'reply-id' }),
  getPublicKey: vi.fn().mockReturnValue('pubkey'),
  signEvent: vi.fn().mockReturnValue({ id: 'signed-id' }),
}));

vi.mock('@degenfeed/farcaster-sdk', () => ({
  HubClient: class {
    submitMessage = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@degenfeed/lens-sdk', () => ({
  LensClient: class {
    setAuth = vi.fn();
    like = vi.fn().mockResolvedValue(undefined);
    unlike = vi.fn().mockResolvedValue(undefined);
    mirror = vi.fn().mockResolvedValue(undefined);
    unmirror = vi.fn().mockResolvedValue(undefined);
    comment = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@degenfeed/bluesky-sdk', () => ({
  BskyClient: class {
    setAuth = vi.fn();
    like = vi.fn().mockResolvedValue(undefined);
    unlike = vi.fn().mockResolvedValue(undefined);
    repost = vi.fn().mockResolvedValue(undefined);
    unrepost = vi.fn().mockResolvedValue(undefined);
    reply = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@degenfeed/threads-sdk', () => ({
  ThreadsClient: class {
    setAuth = vi.fn();
    like = vi.fn().mockResolvedValue(undefined);
    unlike = vi.fn().mockResolvedValue(undefined);
    repost = vi.fn().mockResolvedValue(undefined);
    unrepost = vi.fn().mockResolvedValue(undefined);
    reply = vi.fn().mockResolvedValue(undefined);
  },
}));

import type { Env } from '../index';
import worker from '../index';
import { createSession, parseSessionCookie } from '../session';

const secret = 'test-secret-must-be-at-least-32-bytes';
const env: Env = { AUTH_SECRET: secret };

async function makeRequest(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    origin: 'https://app.degenfeed.xyz',
    'content-type': 'application/json',
  };
  if (cookie) headers.cookie = cookie;
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    env,
  );
}

async function sessionCookie(): Promise<string> {
  const { setCookie } = await createSession('0xAbCd', 'ethereum', secret);
  const value = parseSessionCookie(setCookie);
  if (!value) throw new Error('missing cookie');
  return `__Host-dfid=${value}`;
}

describe('POST /api/engage', () => {
  it('rejects requests without a session', async () => {
    const res = await makeRequest('/api/engage', {
      action: 'like',
      postId: 'mastodon:123',
      protocol: 'mastodon',
      auth: { mastodon: 'token' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects invalid action', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'invalid',
        postId: 'mastodon:123',
        protocol: 'mastodon',
        auth: { mastodon: 'token' },
      },
      cookie,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('required');
  });

  it('likes a mastodon post when auth token is present', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'like',
        postId: 'mastodon:123',
        protocol: 'mastodon',
        auth: { mastodon: 'token' },
      },
      cookie,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('replies to a mastodon post', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'reply',
        postId: 'mastodon:123',
        protocol: 'mastodon',
        content: 'nice post',
        auth: { mastodon: 'token' },
      },
      cookie,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns no-account error for mastodon without token', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'like',
        postId: 'mastodon:123',
        protocol: 'mastodon',
        auth: {},
      },
      cookie,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('No social account linked for mastodon');
  });

  it('publishes a nostr reaction when nsec is provided', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'like',
        postId: 'nostr:event1',
        protocol: 'nostr',
        target: { authorId: 'pubkey1' },
        auth: { nostr: 'nsechex' },
      },
      cookie,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns no-account error for nostr without nsec', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'like',
        postId: 'nostr:event1',
        protocol: 'nostr',
        auth: {},
      },
      cookie,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('No social account linked for nostr');
  });

  it('returns no-account error for farcaster without signed message', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'like',
        postId: 'farcaster:0xabc',
        protocol: 'farcaster',
        auth: {},
      },
      cookie,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('No social account linked for farcaster');
  });

  it('returns no-account error for bluesky without jwt/did', async () => {
    const cookie = await sessionCookie();
    const res = await makeRequest(
      '/api/engage',
      {
        action: 'like',
        postId: 'bluesky:at://did/app.bsky.feed.post/rkey',
        protocol: 'bluesky',
        auth: {},
      },
      cookie,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('No social account linked for bluesky');
  });
});
