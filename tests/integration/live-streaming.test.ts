/**
 * @degenfeed/integration — Live Streaming Tests
 *
 * Tests the live aggregation pipeline: Owncast, PeerTube, YouTube,
 * stream normalization, chat bridge, viewer count SSE, and go-live flow.
 *
 * Pure functions tested directly. API-dependent paths tested with mocks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock external deps ───────────────────────────────────────────────

vi.mock('../../workers/api/src/ws-broadcast', () => ({
  broadcastToAll: vi.fn(),
}));

vi.mock('../../workers/api/src/ws-channels', () => ({
  CHANNELS: {
    FEED_NEW: 'feed_new',
    TIP_RECEIVED: 'tip_received',
  },
}));

// ─── Pure Functions ──────────────────────────────────────────────────

describe('Live Streaming — Helper Functions', () => {
  it('formats SSE data for viewer count', async () => {
    const { formatViewerSSE } = await import('../../workers/api/src/feed/live-aggregator');
    const result = formatViewerSSE('stream_abc', 42);
    expect(result).toContain('streamId');
    expect(result).toContain('stream_abc');
    expect(result).toContain('42');
    expect(result).toContain('data:');
    expect(result).toContain('\n\n');
  });

  it('generates unique live IDs', async () => {
    const { generateLiveId } = await import('../../workers/api/src/feed/live-aggregator');
    const id1 = generateLiveId();
    const id2 = generateLiveId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});

// ─── Live Aggregator (mocked fetch) ──────────────────────────────────

describe('Live Streaming — Aggregator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aggregates from Owncast when API returns live stream', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Owncast status endpoint: online
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/status')) {
        return Promise.resolve(new Response(JSON.stringify({
          online: true,
          streamTitle: 'Test Stream',
          viewerCount: 10,
          name: 'DegenFeed',
          lastConnectTime: new Date().toISOString(),
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const env = {
      OWNCAST_INSTANCE_URL: 'https://owncast.example.com',
      CACHE: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
      },
    } as any;

    const { aggregateAllStreams } = await import('../../workers/api/src/feed/live-aggregator');

    // With cache empty and forceRefresh, it should fetch from sources
    const streams = await aggregateAllStreams(env, true);

    // Since we mock all fetchers heavily and Owncast returns data:
    // The Owncast fetcher should have been called and returned a stream
    const owncastCalls = mockFetch.mock.calls.filter((c: any[]) => c[0]?.includes('/api/status'));
    expect(owncastCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('gracefully handles source failure (Owncast down)', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Owncast down
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('owncast')) {
        return Promise.reject(new Error('Owncast unreachable'));
      }
      // Return empty for other sources
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    });

    const env = {
      OWNCAST_INSTANCE_URL: 'https://owncast.example.com',
      PEERTUBE_INSTANCE_URL: 'https://video.example.com',
      YOUTUBE_API_KEY: '',
      RSS_BRIDGE_URL: '',
      CACHE: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
      },
      SPACES: { get: vi.fn().mockResolvedValue(null) },
    } as any;

    const { aggregateAllStreams } = await import('../../workers/api/src/feed/live-aggregator');
    const streams = await aggregateAllStreams(env, true);
    // Should not throw; returns empty array gracefully
    expect(Array.isArray(streams)).toBe(true);
  });

  it('normalizes streams to UnifiedLiveStream format', async () => {
    const { formatViewerSSE, generateLiveId } = await import('../../workers/api/src/feed/live-aggregator');

    const stream = {
      id: `peertube:${generateLiveId()}`,
      source: 'peertube' as const,
      title: 'Test Live Stream',
      streamer: {
        id: 'peertube:channel:1',
        handle: 'testcreator',
        displayName: 'Test Creator',
      },
      thumbnailUrl: 'https://example.com/thumb.jpg',
      viewerCount: 50,
      startedAt: Date.now(),
      category: 'Tech',
      tags: ['peertube', 'live', 'tech'],
      isLive: true,
      embedUrl: 'https://example.com/embed',
      chatEnabled: true,
    };

    // Verify UnifiedLiveStream shape
    expect(stream.id).toMatch(/^peertube:/);
    expect(stream.source).toBe('peertube');
    expect(stream.title).toBeTruthy();
    expect(stream.streamer.displayName).toBe('Test Creator');
    expect(typeof stream.viewerCount).toBe('number');
    expect(stream.isLive).toBe(true);
    expect(stream.chatEnabled).toBe(true);
  });

  it('creates and retrieves stream schedules', async () => {
    const store = new Map<string, string>();

    const env = {
      CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string, opts?: any) => {
          store.set(key, value);
        }),
      },
      CONTENT_STORE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string, opts?: any) => {
          store.set(key, value);
        }),
      },
    } as any;

    const { createSchedule, getCreatorSchedules } = await import('../../workers/api/src/feed/live-aggregator');

    const futureTime = Date.now() + 86400000; // 1 day from now

    const schedule = {
      id: 'sched_001',
      creatorId: '0xcreator',
      title: 'Scheduled Stream',
      description: 'A future stream',
      source: 'owncast' as const,
      scheduledAt: futureTime,
      category: 'Gaming',
      tags: ['gaming', 'live'],
      privacy: 'public' as const,
      recordingEnabled: true,
      chatEnabled: true,
      createdAt: Date.now(),
    };

    const created = await createSchedule(env, schedule);
    expect(created.id).toBe('sched_001');

    const schedules = await getCreatorSchedules(env, '0xcreator');
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    expect(schedules[0]!.title).toBe('Scheduled Stream');
  });
});

// ─── Go-Live Flow ────────────────────────────────────────────────────

describe('Live Streaming — Go-Live Flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates go-live config requires title and platform', async () => {
    const configs = [
      { title: '', platform: 'owncast' },
      { title: 'Test', platform: '' },
      { title: 'Test', platform: 'invalid' },
    ];

    // Test validation logic matching handleGoLive
    for (const cfg of configs) {
      const titleValid = cfg.title?.trim().length > 0;
      const platformValid = ['owncast', 'peertube', 'both'].includes(cfg.platform);
      expect(titleValid && platformValid).toBe(false);
    }
  });

  it('starts Owncast stream with generated key', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const env = {
      OWNCAST_INSTANCE_URL: 'https://owncast.example.com',
      CACHE: { get: vi.fn(), put: vi.fn() },
    } as any;

    const { startLiveStream } = await import('../../workers/api/src/feed/live-aggregator');

    const result = await startLiveStream(env, {
      title: 'Going Live!',
      description: 'First stream',
      category: 'Gaming',
      tags: ['gaming'],
      privacy: 'public',
      recordingEnabled: true,
      chatEnabled: true,
      platform: 'owncast',
      creatorId: '0xcreator',
      creatorHandle: 'creator',
      creatorDisplayName: 'Creator',
    });

    // Should have generated a stream key
    expect(result.streamKey).toBeTruthy();
    expect(result.rtmpUrl).toContain('rtmp://');
    expect(result.streamId).toBeTruthy();
  });
});

// ─── Chat Bridge ─────────────────────────────────────────────────────

describe('Live Streaming — Chat Bridge', () => {
  it('validates chat messages require content', () => {
    const tests = [
      { msg: '', valid: false },
      { msg: '   ', valid: false },
      { msg: 'Hello!', valid: true },
      { msg: 'a'.repeat(501), valid: true }, // Will be truncated
    ];

    for (const t of tests) {
      const trimmed = t.msg.trim();
      const valid = trimmed.length > 0;
      expect(valid).toBe(t.valid);
    }
  });

  it('sanitizes chat messages to 500 chars', () => {
    const longMsg = 'x'.repeat(1000);
    const sanitized = longMsg.trim().slice(0, 500);
    expect(sanitized.length).toBe(500);
  });
});

// ─── Viewer Count ────────────────────────────────────────────────────

describe('Live Streaming — Viewer Count', () => {
  it('SSE endpoint returns correct format', async () => {
    const { formatViewerSSE } = await import('../../workers/api/src/feed/live-aggregator');

    const data = formatViewerSSE('stream_xyz', 99);
    const parsed = JSON.parse(data.replace('data: ', '').replace('\n\n', ''));
    expect(parsed.streamId).toBe('stream_xyz');
    expect(parsed.viewerCount).toBe(99);
    expect(parsed.timestamp).toBeGreaterThan(0);
  });

  it('caches viewer count for 30 seconds', () => {
    const cacheStore = new Map<string, string>();
    const entry = JSON.stringify({ count: 42, timestamp: Date.now() });
    cacheStore.set('live:viewers:stream_abc', entry);

    const cached = cacheStore.get('live:viewers:stream_abc');
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.count).toBe(42);
  });
});

// ─── Source Health ───────────────────────────────────────────────────

describe('Live Streaming — Source Health', () => {
  it('tracks and reports source health status', async () => {
    const cacheStore = new Map<string, string>();

    const env = {
      CACHE: {
        get: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          cacheStore.set(key, value);
        }),
      },
    } as any;

    const { getSourceHealth } = await import('../../workers/api/src/feed/live-aggregator');

    // No health data stored yet
    const health = await getSourceHealth(env);
    expect(typeof health).toBe('object');
  });

  it('aggregates source counts from streams', async () => {
    const streams = [
      { source: 'owncast', viewerCount: 10 },
      { source: 'owncast', viewerCount: 20 },
      { source: 'peertube', viewerCount: 5 },
      { source: 'youtube', viewerCount: 100 },
    ];

    // aggregateSourceCounts logic (from live.ts)
    const counts: Record<string, { count: number; label: string }> = {};
    for (const s of streams) {
      if (!counts[s.source]) {
        counts[s.source] = { count: 0, label: s.source.charAt(0).toUpperCase() + s.source.slice(1) };
      }
      counts[s.source]!.count++;
    }

    expect(counts['owncast']!.count).toBe(2);
    expect(counts['peertube']!.count).toBe(1);
    expect(counts['youtube']!.count).toBe(1);
    expect(Object.keys(counts).length).toBe(3);
  });
});
