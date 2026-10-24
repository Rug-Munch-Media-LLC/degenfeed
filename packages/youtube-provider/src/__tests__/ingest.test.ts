import { describe, expect, it } from 'vitest';
import { CAPTIONS_VTT } from '../ingest/__fixtures__/captions';
import { METADATA_FIXTURE } from '../ingest/__fixtures__/metadata';
import { isReady, nextBackoff } from '../ingest/backoff';
import { createTokenBucket } from '../ingest/pacing';
import { createIngestStore } from '../ingest/store';
import { normalizeTranscript } from '../ingest/transcript';
import { ingestChannel } from '../ingest/worker';
import type { RSSEntry, YouTubeChannel } from '../youtube/types';

const metadata = METADATA_FIXTURE;
const vtt = CAPTIONS_VTT;

const channel: YouTubeChannel = {
  name: 'Coin Bureau',
  channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
  category: 'market_analysis',
  subcategory: 'daily-news',
  weight: 1,
  niches: ['crypto'],
};

const entry: RSSEntry = {
  videoId: 'aBcDeFgHiJk',
  title: 'rss title',
  link: 'https://www.youtube.com/watch?v=aBcDeFgHiJk',
  published: '2026-10-20T12:00:00.000Z',
  updated: '2026-10-20T12:00:00.000Z',
  description: 'rss description',
};

function deps(store = createIngestStore()) {
  return {
    store,
    bucket: createTokenBucket({ capacity: 10, refillPerSecond: 1 }),
    now: () => Date.parse('2026-10-25T00:00:00.000Z'),
    maxVideos: 5,
    fetchEntries: async () => [entry],
    fetchMetadata: async () => metadata,
    fetchTranscript: async () => normalizeTranscript(vtt, 'en'),
  };
}

describe('ingest idempotency', () => {
  it('replaying the same channel inserts nothing the second time', async () => {
    const store = createIngestStore();
    const first = await ingestChannel(channel, deps(store));
    expect(first.status).toBe('ok');
    expect(first.inserted).toBe(1);
    expect(store.videos()).toHaveLength(1);
    expect(store.shills()).toHaveLength(2);

    const second = await ingestChannel(channel, deps(store));
    expect(second.status).toBe('ok');
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(1);
    expect(store.videos()).toHaveLength(1);
    expect(store.shills()).toHaveLength(2);
    expect(store.stats().duplicates).toBeGreaterThanOrEqual(3);
  });

  it('resumes from a cursor and skips older uploads', async () => {
    const store = createIngestStore();
    const run = await ingestChannel(channel, {
      ...deps(store),
      sinceMs: Date.parse('2026-10-21T00:00:00.000Z'),
    });
    expect(run.inserted).toBe(0);
    expect(run.cursorMs).toBeNull();
  });
});

describe('rate limiting and backoff', () => {
  it('refuses a poll when the shared bucket is empty', async () => {
    const store = createIngestStore();
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 0 });
    const first = await ingestChannel(channel, { ...deps(store), bucket });
    expect(first.status).toBe('ok');
    const blocked = await ingestChannel(channel, { ...deps(store), bucket });
    expect(blocked.status).toBe('rate_limited');
    expect(store.videos()).toHaveLength(1);
  });

  it('records an error and backs off when the feed fails', async () => {
    const store = createIngestStore();
    const result = await ingestChannel(channel, {
      ...deps(store),
      fetchEntries: async () => {
        throw new Error('HTTP 503');
      },
    });
    expect(result.status).toBe('error');
    expect(result.backoff.failures).toBe(1);
    expect(result.backoff.nextAttemptAtMs).toBeGreaterThan(Date.parse('2026-10-25T00:00:00.000Z'));
    expect(isReady(result.backoff, result.backoff.nextAttemptAtMs - 1)).toBe(false);
  });

  it('doubles the wait per failure and caps it', () => {
    const rng = () => 0.5;
    const first = nextBackoff(undefined, 0, 'transient', { baseMs: 1000, maxMs: 10_000, rng });
    const second = nextBackoff(first, 0, 'transient', { baseMs: 1000, maxMs: 10_000, rng });
    expect(first.nextAttemptAtMs).toBe(1000);
    expect(second.nextAttemptAtMs).toBe(2000);
    const gone = nextBackoff(second, 0, 'gone', { baseMs: 1000, maxMs: 10_000, rng });
    expect(gone.nextAttemptAtMs).toBe(10_000);
  });

  it('parks a channel that is inside its backoff window', async () => {
    const store = createIngestStore();
    const result = await ingestChannel(channel, deps(store), {
      failures: 1,
      nextAttemptAtMs: Date.parse('2026-10-26T00:00:00.000Z'),
    });
    expect(result.status).toBe('backoff');
    expect(store.videos()).toHaveLength(0);
  });
});
