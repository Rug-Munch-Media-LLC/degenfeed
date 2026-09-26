/**
 * @degenfeed/api-worker — Farcaster bridge regression tests
 *
 * Locks the contract of the poll bridge extracted from unified-chat.ts:
 * the parentUrl fallback, second-vs-millisecond timestamp normalisation,
 * stale-cast filtering against the shared poll cursor, and the fact that a
 * dead or failing hub degrades to 0 rather than rejecting.
 */

import { describe, expect, it, vi } from 'vitest';
import { fakeSender, makeEnv, makeKv, STREAM, stubFetchJson } from './bridge-test-harness';
import { chatLastKey } from './chat-keys';
import { pollFarcasterChat } from './farcaster-bridge';

const HUB = 'http://hub.test';

describe('pollFarcasterChat', () => {
  it('ingests casts inside the window and skips stale or empty ones', async () => {
    const { send, sent } = fakeSender();
    const now = Math.floor(Date.now() / 1000);
    stubFetchJson({
      messages: [
        { data: { fid: 1, timestamp: now, castAddBody: { text: 'fresh' } } },
        { data: { fid: 2, timestamp: 1_000_000, castAddBody: { text: 'ancient' } } },
        { data: { fid: 3, timestamp: now } },
      ],
    });

    const count = await pollFarcasterChat(STREAM, '0xparent', {
      env: makeEnv(makeKv()),
      send,
      hubUrl: HUB,
    });

    expect(count).toBe(1);
    expect(sent[0]).toMatchObject({
      userId: 'farcaster:fid:1',
      displayName: 'fc:1',
      message: 'fresh',
      badges: ['farcaster'],
    });
  });

  it('queries by parentUrl when no parent cast hash is known', async () => {
    const urls = stubFetchJson({ messages: [] });
    const { send } = fakeSender();

    await pollFarcasterChat(STREAM, undefined, {
      env: makeEnv(makeKv()),
      send,
      hubUrl: HUB,
    });

    expect(urls[0]).toContain('parentUrl=');
    expect(urls[0]).toContain(encodeURIComponent(`https://app.degenfeed.xyz/live/${STREAM}`));
  });

  it('skips casts older than the stored cursor', async () => {
    const { send } = fakeSender();
    stubFetchJson({
      messages: [
        {
          data: {
            fid: 9,
            timestamp: Math.floor((Date.now() - 3_600_000) / 1000),
            castAddBody: { text: 'stale' },
          },
        },
      ],
    });
    const kv = makeKv({ [chatLastKey(STREAM, 'farcaster')]: String(Date.now() - 1000) });

    await expect(
      pollFarcasterChat(STREAM, '0xparent', { env: makeEnv(kv), send, hubUrl: HUB }),
    ).resolves.toBe(0);
  });

  it('returns 0 on a non-ok hub response', async () => {
    stubFetchJson({}, false);
    const { send } = fakeSender();
    await expect(
      pollFarcasterChat(STREAM, '0xparent', { env: makeEnv(makeKv()), send, hubUrl: HUB }),
    ).resolves.toBe(0);
  });

  it('returns 0 when the hub connection is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    const { send } = fakeSender();
    await expect(
      pollFarcasterChat(STREAM, '0xparent', { env: makeEnv(makeKv()), send, hubUrl: HUB }),
    ).resolves.toBe(0);
  });
});
