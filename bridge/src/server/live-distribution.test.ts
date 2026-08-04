/**
 * Tests for the Live Distribution Engine
 *
 * Validates per-protocol fan-out on stream start and cleanup on stream end:
 *   - Nostr NIP-53 events are published and ended with the same d tag
 *   - Farcaster casts are submitted to Hubble with the HLS frame embed
 *   - Lens Momoka publications are submitted with Livepeer playback URL
 *   - Bluesky skeets are created with an external embed and deleted on end
 *   - Mastodon statuses are created and deleted on end
 *   - Unconfigured platforms return honest ok:false results
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveSession } from './live-routes';

// ─── SDK mocks ───────────────────────────────────────────────────────────

const {
  publishNip53Mock,
  endNip53Mock,
  livepeerCreateMock,
  momokaSubmitMock,
  buildFarcasterCastMessageMock,
} = vi.hoisted(() => ({
  publishNip53Mock: vi.fn(),
  endNip53Mock: vi.fn(),
  livepeerCreateMock: vi.fn(),
  momokaSubmitMock: vi.fn(),
  buildFarcasterCastMessageMock: vi.fn(),
}));

vi.mock('@degenfeed/spaces-bridge', () => ({
  publishNip53LiveEvent: publishNip53Mock,
  endNip53LiveEvent: endNip53Mock,
  livepeerBridge: { create: livepeerCreateMock },
}));

vi.mock('@degenfeed/lens-sdk/momoka', () => ({
  MomokaClient: vi.fn().mockImplementation(() => ({ submit: momokaSubmitMock })),
}));

// Farcaster SDK is imported dynamically inside the distributor.
vi.mock('@degenfeed/farcaster-sdk', () => ({
  buildFarcasterCastMessage: buildFarcasterCastMessageMock,
}));

import { distributeLiveEnd, distributeLiveStart, initLiveDistribution } from './live-distribution';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeSession(platforms: string[]): LiveSession {
  return {
    streamId: 'live-test123-abcd',
    style: 'horizontal',
    platforms: platforms as LiveSession['platforms'],
    title: 'Test Stream',
    description: 'A test stream',
    category: 'talk',
    tags: ['crypto'],
    creatorId: 'creator-1',
    creatorName: 'Test Creator',
    status: 'pending',
    createdAt: Date.now(),
    distribution: {},
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('live-distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOSTR_PRIVATE_KEY_HEX = 'deadbeef';
    process.env.FARCASTER_BOT_FID = '123';
    process.env.FARCASTER_BOT_SIGNER_KEY = 'signer-hex';
    process.env.FARCASTER_BOT_HUB_URL = 'http://127.0.0.1:2281';
    process.env.LENS_PROFILE_ID = '0x01';
    process.env.LENS_ACCESS_TOKEN = 'lens-token';
    process.env.LIVEPEER_API_KEY = 'lp-key';
    process.env.BLUESKY_CROSSPOST_DID = 'did:plc:test';
    process.env.BLUESKY_CROSSPOST_JWT = 'bsky-jwt';
    process.env.MASTODON_ACCESS_TOKEN = 'masto-token';
    process.env.MASTODON_INSTANCE = 'https://social.degenfeed.xyz';

    publishNip53Mock.mockResolvedValue({ ok: true, eventId: 'evt-nostr', dTag: 'd-1' });
    endNip53Mock.mockResolvedValue({ ok: true, eventId: 'evt-end', dTag: 'd-1' });
    livepeerCreateMock.mockResolvedValue({
      platform: 'livepeer',
      nativeId: 'lp-stream-1',
      streamUrl: 'https://livepeer.live/playback/index.m3u8',
    });
    momokaSubmitMock.mockResolvedValue({
      accepted: true,
      daHash: 'da-1',
      publicationId: 'pub-1',
    });
    buildFarcasterCastMessageMock.mockReturnValue({
      ok: true,
      messageHex: '0a1234',
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hash: 'cast-hash-1' }),
      text: async () => '',
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NOSTR_PRIVATE_KEY_HEX;
    delete process.env.NOSTR_PRIVATE_KEY;
    delete process.env.FARCASTER_BOT_FID;
    delete process.env.FARCASTER_BOT_SIGNER_KEY;
    delete process.env.LENS_PROFILE_ID;
    delete process.env.LENS_ACCESS_TOKEN;
    delete process.env.LIVEPEER_API_KEY;
    delete process.env.BLUESKY_CROSSPOST_DID;
    delete process.env.BLUESKY_CROSSPOST_JWT;
    delete process.env.MASTODON_ACCESS_TOKEN;
    vi.unstubAllGlobals();
  });

  it('fans out to Nostr with a signed NIP-53 live event', async () => {
    const session = makeSession(['nostr']);
    const results = await distributeLiveStart(session);

    expect(publishNip53Mock).toHaveBeenCalledTimes(1);
    const opts = publishNip53Mock.mock.calls[0]?.[0];
    expect(opts).toMatchObject({
      dTag: `degenfeed-live-${session.streamId}`,
      title: 'Test Stream',
      status: 'live',
      streamUrl: 'https://owncast.degenfeed.xyz/hls/stream.m3u8',
    });
    expect(results.nostr?.ok).toBe(true);
    expect(results.nostr?.eventId).toBe('evt-nostr');
    expect(session.status).toBe('live');
    expect(session.startedAt).toBeTypeOf('number');
  });

  it('submits a Farcaster cast with the HLS URL frame embed', async () => {
    const session = makeSession(['farcaster']);
    const results = await distributeLiveStart(session);

    expect(buildFarcasterCastMessageMock).toHaveBeenCalledTimes(1);
    const castOpts = buildFarcasterCastMessageMock.mock.calls[0]?.[0];
    expect(castOpts.fid).toBe(123);
    expect(castOpts.embeds).toEqual([{ url: 'https://owncast.degenfeed.xyz/hls/stream.m3u8' }]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/submitMessage'),
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(results.farcaster?.ok).toBe(true);
    expect(results.farcaster?.castHash).toBe('cast-hash-1');
  });

  it('creates a Livepeer stream and submits a Lens Momoka publication', async () => {
    const session = makeSession(['lens']);
    const results = await distributeLiveStart(session);

    expect(livepeerCreateMock).toHaveBeenCalledTimes(1);
    expect(momokaSubmitMock).toHaveBeenCalledTimes(1);
    const momokaOpts = momokaSubmitMock.mock.calls[0]?.[0];
    expect(momokaOpts.profileId).toBe('0x01');
    expect(momokaOpts.content).toContain('https://livepeer.live/playback/index.m3u8');
    expect(results.lens?.ok).toBe(true);
    expect(results.lens?.livepeerStreamId).toBe('lp-stream-1');
    expect(results.lens?.daHash).toBe('da-1');
  });

  it('creates a Bluesky skeet with an external embed card', async () => {
    const session = makeSession(['bluesky']);
    const results = await distributeLiveStart(session);

    const createCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('com.atproto.repo.createRecord'),
    );
    expect(createCall).toBeDefined();
    const body = JSON.parse(String(createCall?.[1]?.body)) as {
      collection: string;
      record: { embed: { $type: string; external: { uri: string } } };
    };
    expect(body.collection).toBe('app.bsky.feed.post');
    expect(body.record.embed.$type).toBe('app.bsky.embed.external');
    expect(body.record.embed.external.uri).toBe('https://owncast.degenfeed.xyz/hls/stream.m3u8');
    expect(results.bluesky?.ok).toBe(true);
  });

  it('posts a Mastodon status with the HLS link', async () => {
    const session = makeSession(['mastodon']);
    const results = await distributeLiveStart(session);

    const createCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/api/v1/statuses'),
    );
    expect(createCall).toBeDefined();
    const body = JSON.parse(String(createCall?.[1]?.body)) as { status: string };
    expect(body.status).toContain('https://owncast.degenfeed.xyz/hls/stream.m3u8');
    expect(results.mastodon?.ok).toBe(true);
  });

  it('returns honest failures for unconfigured platforms', async () => {
    delete process.env.MASTODON_ACCESS_TOKEN;
    delete process.env.FARCASTER_BOT_FID;
    delete process.env.FARCASTER_BOT_SIGNER_KEY;

    const session = makeSession(['mastodon', 'farcaster']);
    const results = await distributeLiveStart(session);

    expect(results.mastodon?.ok).toBe(false);
    expect(results.mastodon?.error).toContain('MASTODON_ACCESS_TOKEN');
    expect(results.farcaster?.ok).toBe(false);
    expect(results.farcaster?.error).toContain('FARCASTER');
  });

  it('cleans up on stream end — Nostr ended event, Bluesky + Mastodon deletes', async () => {
    const session = makeSession(['nostr', 'bluesky', 'mastodon']);
    session.distribution.nostr = {
      ok: true,
      dTag: 'degenfeed-live-live-test123-abcd',
      eventId: 'evt-nostr',
    };
    session.distribution.bluesky = {
      ok: true,
      url: 'at://did:plc:test/app.bsky.feed.post/rkey123',
    };
    session.distribution.mastodon = {
      ok: true,
      url: 'https://social.degenfeed.xyz/@DegenFeed/987654321',
    };

    await distributeLiveEnd(session);

    expect(endNip53Mock).toHaveBeenCalledTimes(1);
    const endOpts = endNip53Mock.mock.calls[0]?.[0];
    expect(endOpts.dTag).toBe('degenfeed-live-live-test123-abcd');
    expect(endOpts.title).toBe('Test Stream');

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    // Bluesky: com.atproto.repo.deleteRecord POST; Mastodon: DELETE status.
    const deleteCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        (typeof call[0] === 'string' && call[0].includes('com.atproto.repo.deleteRecord')) ||
        (call[1] as { method?: string } | undefined)?.method === 'DELETE',
    );
    expect(
      deleteCalls.some(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('com.atproto.repo.deleteRecord'),
      ),
    ).toBe(true);
    expect(
      deleteCalls.some(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('/api/v1/statuses/987654321'),
      ),
    ).toBe(true);

    expect(session.status).toBe('ended');
    expect(session.endedAt).toBeTypeOf('number');
  });

  it('deletes the Livepeer stream on end when one was created', async () => {
    const session = makeSession(['lens']);
    session.distribution.lens = { ok: true, livepeerStreamId: 'lp-stream-1' };

    const results = await distributeLiveEnd(session);

    const deleteCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && (call[0] as string).includes('/api/stream/lp-stream-1'),
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.[1]?.method).toBe('DELETE');
    expect(results.lens?.ok).toBe(true);
  });

  it('initLiveDistribution lists configured platforms', () => {
    expect(() => initLiveDistribution()).not.toThrow();
  });
});
