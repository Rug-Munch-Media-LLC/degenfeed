import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';
import { handleInteractionStatus, handleUnifiedInteraction } from '../routes/unified-interaction';

// ─── SDK mocks (avoid real network calls) ────────────────────────────────

vi.mock('@degenfeed/mastodon-sdk', () => ({
  GtSClient: class {
    like = vi
      .fn()
      .mockResolvedValue({ id: 'mastodon-status-1', url: 'https://social.degenfeed.xyz/@a/1' });
    unlike = vi.fn().mockResolvedValue({ id: 'mastodon-status-1' });
    repost = vi
      .fn()
      .mockResolvedValue({ id: 'mastodon-reblog-1', url: 'https://social.degenfeed.xyz/@a/1' });
    unrepost = vi.fn().mockResolvedValue({ id: 'mastodon-status-1' });
    publish = vi
      .fn()
      .mockResolvedValue({ id: 'mastodon-reply-1', url: 'https://social.degenfeed.xyz/@a/1' });
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

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: class {
    publish = vi.fn();
    disconnectAll = vi.fn();
  },
  createReaction: vi
    .fn()
    .mockReturnValue({
      id: 'react-id',
      pubkey: 'p',
      created_at: 1,
      kind: 7,
      tags: [],
      content: '+',
      sig: 's',
    }),
  createTextNote: vi
    .fn()
    .mockReturnValue({
      id: 'note-id',
      pubkey: 'p',
      created_at: 1,
      kind: 1,
      tags: [],
      content: '',
      sig: 's',
    }),
  getPublicKey: vi.fn().mockReturnValue('pubkey'),
  signEvent: vi
    .fn()
    .mockReturnValue({
      id: 'signed-id',
      pubkey: 'p',
      created_at: 1,
      kind: 1,
      tags: [],
      content: '',
      sig: 's',
    }),
}));

// ─── In-memory KV mock ───────────────────────────────────────────────────

function createMockKv() {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
      delete: async (key: string) => {
        store.delete(key);
      },
      list: async (opts?: { prefix?: string; cursor?: string; limit?: number }) => {
        const prefix = opts?.prefix ?? '';
        const keys = [...store.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name }));
        return { keys, list_complete: true, cursor: undefined, cacheStatus: null };
      },
      getWithMetadata: async () => ({
        value: null,
        metadata: null,
        cacheStatus: null,
      }),
    } as unknown as KVNamespace,
  };
}

let mock: ReturnType<typeof createMockKv>;
let env: Env;

beforeEach(() => {
  mock = createMockKv();
  env = { CACHE: mock.kv };
});

function post(path: string, body: unknown): Promise<Response> {
  return handleUnifiedInteraction(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );
}

// ─── Validation ──────────────────────────────────────────────────────────

describe('handleUnifiedInteraction — validation', () => {
  it('rejects missing fields', async () => {
    const res = await post('/api/interaction', { action: 'like' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('required');
  });

  it('rejects unsupported action', async () => {
    const res = await post('/api/interaction', {
      action: 'ban',
      protocol: 'mastodon',
      postId: 'mastodon:123',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toContain('Unsupported action');
  });

  it('rejects unsupported protocol', async () => {
    const res = await post('/api/interaction', {
      action: 'like',
      protocol: 'threads',
      postId: 'threads:123',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toContain('Unsupported protocol');
  });

  it('rejects suspicious payload', async () => {
    const res = await post('/api/interaction', {
      action: 'reply',
      protocol: 'mastodon',
      postId: 'mastodon:123',
      content: '<script>alert(1)</script>',
    });
    expect(res.status).toBe(400);
  });

  it('rejects reply without content', async () => {
    const res = await post('/api/interaction', {
      action: 'reply',
      protocol: 'mastodon',
      postId: 'mastodon:123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects tip without amountUsd', async () => {
    const res = await post('/api/interaction', {
      action: 'tip',
      protocol: 'mastodon',
      postId: 'mastodon:123',
      currency: 'eth',
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid tip amount', async () => {
    const res = await post('/api/interaction', {
      action: 'tip',
      protocol: 'mastodon',
      postId: 'mastodon:123',
      amountUsd: 50000,
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 for POST method on GET-only status endpoint', async () => {
    const res = await handleInteractionStatus(
      new Request('http://localhost/api/interaction/status', { method: 'POST' }),
      env,
    );
    expect(res.status).toBe(405);
  });
});

// ─── Mastodon native interaction ─────────────────────────────────────────

describe('handleUnifiedInteraction — mastodon', () => {
  it('likes a post natively and records ledger + native reference', async () => {
    const res = await post('/api/interaction', {
      action: 'like',
      protocol: 'mastodon',
      postId: 'df://mastodon:12345',
      target: { authorId: 'mastodonuser' },
      auth: { mastodon: 'token', mastodon_instance: 'https://social.degenfeed.xyz' },
      walletAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      nativeReference?: { protocol: string; nativeId: string; url?: string };
    };
    expect(body.ok).toBe(true);
    expect(body.nativeReference?.protocol).toBe('mastodon');
    expect(body.nativeReference?.nativeId).toBe('mastodon-status-1');
    expect(body.nativeReference?.url).toBe('https://social.degenfeed.xyz/@a/1');

    // Ledger entry stored
    const hasLedger = [...mock.store.keys()].some((k) =>
      k.startsWith('interaction:df://mastodon:12345:mastodon:like:'),
    );
    expect(hasLedger).toBe(true);
    // Active like record stored for unlike
    const activeRaw = mock.store.get('interaction:df://mastodon:12345:mastodon:like:active');
    expect(activeRaw).toBeTruthy();
  });

  it('returns 502 when auth is missing (no native account)', async () => {
    const res = await post('/api/interaction', {
      action: 'like',
      protocol: 'mastodon',
      postId: 'mastodon:12345',
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('replies to a post with in_reply_to_id semantics', async () => {
    const res = await post('/api/interaction', {
      action: 'reply',
      protocol: 'mastodon',
      postId: 'mastodon:777',
      content: 'Great post!',
      auth: { mastodon: 'token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nativeReference?: { nativeId: string } };
    expect(body.nativeReference?.nativeId).toBe('mastodon-reply-1');
  });

  it('records a tip in the unified ledger', async () => {
    const res = await post('/api/interaction', {
      action: 'tip',
      protocol: 'mastodon',
      postId: 'mastodon:888',
      amountUsd: 5,
      currency: 'eth',
      target: { authorId: 'mastodonuser' },
      auth: { mastodon: 'token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; activityId?: string };
    expect(body.ok).toBe(true);
    expect(body.activityId).toBeTruthy();

    // Tip ledger + interaction ledger both written
    const tipEntity = mock.store.get('tip:mastodon:df://mastodon:888');
    expect(tipEntity).toBeTruthy();
    const parsed = JSON.parse(tipEntity!) as { totalUsd: number };
    expect(parsed.totalUsd).toBe(5);
  });
});

// ─── Lens native interaction ─────────────────────────────────────────────

describe('handleUnifiedInteraction — lens', () => {
  it('likes a publication when access token is present', async () => {
    const res = await post('/api/interaction', {
      action: 'like',
      protocol: 'lens',
      postId: 'lens:0x01-0x02',
      auth: { lens: 'token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; nativeReference?: { protocol: string } };
    expect(body.ok).toBe(true);
    expect(body.nativeReference?.protocol).toBe('lens');
  });

  it('mirrors (boosts) a publication', async () => {
    const res = await post('/api/interaction', {
      action: 'boost',
      protocol: 'lens',
      postId: 'lens:0x01-0x03',
      auth: { lens: 'token' },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });
});

// ─── Status aggregator ───────────────────────────────────────────────────

describe('handleInteractionStatus', () => {
  it('aggregates interaction counts by protocol and action', async () => {
    await post('/api/interaction', {
      action: 'like',
      protocol: 'mastodon',
      postId: 'mastodon:123',
      auth: { mastodon: 'token' },
    });
    await post('/api/interaction', {
      action: 'boost',
      protocol: 'mastodon',
      postId: 'mastodon:123',
      auth: { mastodon: 'token' },
    });

    const res = await handleInteractionStatus(
      new Request('http://localhost/api/interaction/status?postUri=df://mastodon:123'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      byProtocol: Record<string, { total: number; actions: Record<string, number> }>;
    };
    expect(body.total).toBe(2);
    expect(body.byProtocol.mastodon?.total).toBe(2);
    expect(body.byProtocol.mastodon?.actions.like).toBe(1);
    expect(body.byProtocol.mastodon?.actions.boost).toBe(1);
  });

  it('requires postUri query param', async () => {
    const res = await handleInteractionStatus(
      new Request('http://localhost/api/interaction/status'),
      env,
    );
    expect(res.status).toBe(400);
  });
});
