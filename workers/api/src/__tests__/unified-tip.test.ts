import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../index';
import {
  handleUnifiedTipActivity,
  handleUnifiedTipLeaderboard,
  handleUnifiedTipStats,
  periodBucket,
  recordUnifiedTip,
} from '../routes/unified-tip';

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
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
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

function readJson<T>(key: string): T | null {
  const raw = mock.store.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

// ─── recordUnifiedTip ────────────────────────────────────────────────────

describe('recordUnifiedTip', () => {
  it('writes entity, sender, recipient, leaderboard, and activity records', async () => {
    const activity = await recordUnifiedTip(env, {
      platform: 'lemmy',
      entityId: 'lemmy:12345',
      entityType: 'post',
      amountUsd: 5,
      fromUserId: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      toUserId: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      method: 'eth',
    });

    expect(activity).not.toBeNull();
    expect(activity?.platform).toBe('lemmy');
    expect(activity?.amountUsd).toBe(5);

    const entity = readJson<{
      totalUsd: number;
      tips: unknown[];
      lastTipAt: number;
    }>('tip:lemmy:lemmy:12345');
    expect(entity?.totalUsd).toBe(5);
    expect(entity?.tips).toHaveLength(1);
    expect(entity?.lastTipAt).toBeGreaterThan(0);

    const sent = readJson<{
      totalUsd: number;
      count: number;
      byPlatform: Record<string, { totalUsd: number }>;
    }>('tip:user:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:sent');
    expect(sent?.totalUsd).toBe(5);
    expect(sent?.count).toBe(1);
    expect(sent?.byPlatform.lemmy?.totalUsd).toBe(5);

    const received = readJson<{
      totalUsd: number;
      count: number;
      tippers: string[];
    }>('tip:user:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:received');
    expect(received?.totalUsd).toBe(5);
    expect(received?.tippers).toHaveLength(1);

    for (const period of ['daily', 'weekly', 'monthly', 'alltime'] as const) {
      const board = readJson<{
        entries: { userId: string; totalUsd: number }[];
      }>(`tip:leaderboard:${period}`);
      expect(board?.entries[0]?.userId).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(board?.entries[0]?.totalUsd).toBe(5);
    }

    const feed = readJson<unknown[]>('tip:activity:recent');
    expect(feed).toHaveLength(1);
  });

  it('accumulates totals across platforms for the same user', async () => {
    const to = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'post-1',
      entityType: 'post',
      amountUsd: 80,
      fromUserId: 'alice',
      toUserId: to,
    });
    await recordUnifiedTip(env, {
      platform: 'lemmy',
      entityId: 'lemmy:1',
      entityType: 'comment',
      amountUsd: 25,
      fromUserId: 'alice',
      toUserId: to,
    });
    await recordUnifiedTip(env, {
      platform: 'peertube',
      entityId: 'vid-1',
      entityType: 'video',
      amountUsd: 15,
      fromUserId: 'bob',
      toUserId: to,
    });

    const received = readJson<{
      totalUsd: number;
      count: number;
      tippers: string[];
      byPlatform: Record<string, { totalUsd: number; count: number }>;
    }>(`tip:user:${to.toLowerCase()}:received`);
    expect(received?.totalUsd).toBe(120);
    expect(received?.count).toBe(3);
    expect(received?.tippers).toHaveLength(2);
    expect(received?.byPlatform.degenfeed?.totalUsd).toBe(80);
    expect(received?.byPlatform.lemmy?.totalUsd).toBe(25);
    expect(received?.byPlatform.peertube?.totalUsd).toBe(15);

    const sent = readJson<{ totalUsd: number; count: number }>('tip:user:alice:sent');
    expect(sent?.totalUsd).toBe(105);
    expect(sent?.count).toBe(2);
  });

  it('rejects invalid amounts and platforms', async () => {
    expect(
      await recordUnifiedTip(env, {
        platform: 'lemmy',
        entityId: 'x',
        entityType: 'post',
        amountUsd: -5,
      }),
    ).toBeNull();
    expect(
      await recordUnifiedTip(env, {
        platform: 'lemmy',
        entityId: 'x',
        entityType: 'post',
        amountUsd: 999_999,
      }),
    ).toBeNull();
    expect(
      await recordUnifiedTip(env, {
        // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid input
        platform: 'myspace' as any,
        entityId: 'x',
        entityType: 'post',
        amountUsd: 5,
      }),
    ).toBeNull();
    expect(mock.store.size).toBe(0);
  });
});

// ─── Stats endpoint ──────────────────────────────────────────────────────

describe('handleUnifiedTipStats', () => {
  it('requires userId', async () => {
    const res = await handleUnifiedTipStats(
      new Request('http://localhost/api/tip/unified/stats'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('returns zeroed stats for unknown users', async () => {
    const res = await handleUnifiedTipStats(
      new Request('http://localhost/api/tip/unified/stats?userId=nobody'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sent: { totalUsd: number };
      received: { totalUsd: number; tipperCount: number };
      history: unknown[];
    };
    expect(body.sent.totalUsd).toBe(0);
    expect(body.received.tipperCount).toBe(0);
    expect(body.history).toHaveLength(0);
  });

  it('returns merged sent/received history', async () => {
    await recordUnifiedTip(env, {
      platform: 'peertube',
      entityId: 'vid-9',
      entityType: 'video',
      amountUsd: 10,
      fromUserId: 'carol',
      toUserId: 'dave',
    });
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'post-9',
      entityType: 'post',
      amountUsd: 3,
      fromUserId: 'dave',
      toUserId: 'carol',
    });

    const res = await handleUnifiedTipStats(
      new Request('http://localhost/api/tip/unified/stats?userId=dave'),
      env,
    );
    const body = (await res.json()) as {
      sent: { totalUsd: number; count: number };
      received: { totalUsd: number; count: number };
      history: { direction: string; platform: string }[];
    };
    expect(body.received.totalUsd).toBe(10);
    expect(body.sent.totalUsd).toBe(3);
    expect(body.history).toHaveLength(2);
    const directions = body.history.map((h) => h.direction).sort();
    expect(directions).toEqual(['received', 'sent']);
  });
});

// ─── Leaderboard endpoint ────────────────────────────────────────────────

describe('handleUnifiedTipLeaderboard', () => {
  it('ranks recipients by USD received and supports platform filtering', async () => {
    await recordUnifiedTip(env, {
      platform: 'lemmy',
      entityId: 'l1',
      entityType: 'post',
      amountUsd: 50,
      fromUserId: 'a',
      toUserId: 'big-earner',
    });
    await recordUnifiedTip(env, {
      platform: 'peertube',
      entityId: 'v1',
      entityType: 'video',
      amountUsd: 20,
      fromUserId: 'a',
      toUserId: 'small-earner',
    });

    const res = await handleUnifiedTipLeaderboard(
      new Request('http://localhost/api/tip/unified/leaderboard?period=weekly'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      period: string;
      entries: {
        rank: number;
        userId: string;
        totalUsd: number;
        platform: string;
      }[];
    };
    expect(body.period).toBe('weekly');
    expect(body.entries[0]?.userId).toBe('big-earner');
    expect(body.entries[0]?.rank).toBe(1);
    expect(body.entries[0]?.platform).toBe('lemmy');
    expect(body.entries[1]?.userId).toBe('small-earner');

    const filtered = await handleUnifiedTipLeaderboard(
      new Request('http://localhost/api/tip/unified/leaderboard?period=weekly&platform=peertube'),
      env,
    );
    const filteredBody = (await filtered.json()) as {
      entries: { userId: string }[];
    };
    expect(filteredBody.entries).toHaveLength(1);
    expect(filteredBody.entries[0]?.userId).toBe('small-earner');
  });

  it('falls back to weekly for invalid periods', async () => {
    const res = await handleUnifiedTipLeaderboard(
      new Request('http://localhost/api/tip/unified/leaderboard?period=hourly'),
      env,
    );
    const body = (await res.json()) as { period: string; entries: unknown[] };
    expect(body.period).toBe('weekly');
    expect(body.entries).toHaveLength(0);
  });
});

// ─── Activity endpoint ───────────────────────────────────────────────────

describe('handleUnifiedTipActivity', () => {
  it('returns newest-first activity with platform filter support', async () => {
    await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'p1',
      entityType: 'post',
      amountUsd: 1,
      fromLabel: 'Eve',
      toLabel: 'Frank',
    });
    await recordUnifiedTip(env, {
      platform: 'lemmy',
      entityId: 'l2',
      entityType: 'post',
      amountUsd: 5,
      fromLabel: 'Alice',
      toLabel: 'Bob',
    });

    const res = await handleUnifiedTipActivity(
      new Request('http://localhost/api/tip/unified/activity'),
      env,
    );
    const body = (await res.json()) as {
      activity: {
        platform: string;
        fromLabel: string;
        toLabel: string;
        amountUsd: number;
      }[];
    };
    expect(body.activity).toHaveLength(2);
    expect(body.activity[0]?.platform).toBe('lemmy');
    expect(body.activity[0]?.fromLabel).toBe('Alice');
    expect(body.activity[0]?.toLabel).toBe('Bob');

    const filtered = await handleUnifiedTipActivity(
      new Request('http://localhost/api/tip/unified/activity?platform=degenfeed'),
      env,
    );
    const filteredBody = (await filtered.json()) as {
      activity: { platform: string }[];
    };
    expect(filteredBody.activity).toHaveLength(1);
    expect(filteredBody.activity[0]?.platform).toBe('degenfeed');
  });
});

// ─── Period buckets ──────────────────────────────────────────────────────

describe('periodBucket', () => {
  it('produces stable bucket ids', () => {
    const date = new Date(Date.UTC(2026, 6, 18)); // 2026-07-18, ISO week 29
    expect(periodBucket('daily', date)).toBe('2026-07-18');
    expect(periodBucket('weekly', date)).toBe('2026-W29');
    expect(periodBucket('monthly', date)).toBe('2026-07');
    expect(periodBucket('alltime', date)).toBe('all');
  });
});
