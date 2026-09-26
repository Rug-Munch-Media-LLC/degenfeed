/**
 * @degenfeed/api-worker — Bluesky bridge regression tests
 *
 * Locks the contract of the poll bridge extracted from unified-chat.ts:
 * the getPostThread path, the searchPosts fallback, cursor-based staleness
 * filtering, and the no-op behaviour when the bridge is unconfigured
 * (the barrel returns 0 without issuing a request).
 */

import { describe, expect, it } from 'vitest';
import { pollBlueskyChat } from './bluesky-bridge';
import { fakeSender, makeEnv, makeKv, nowIso, STREAM, stubFetchJson } from './bridge-test-harness';
import * as bridges from './bridges';
import { chatLastKey } from './chat-keys';

const TOKEN = 'bearer-token';
const DID = 'did:me';
const POST_URI = 'at://did/app.bsky.feed.post/1';

function deps(send: ReturnType<typeof fakeSender>['send'], kv = makeKv()) {
  return { env: makeEnv(kv), send, accessToken: TOKEN, senderDid: DID };
}

describe('pollBlueskyChat', () => {
  it('ingests fresh replies from the post thread', async () => {
    const { send, sent } = fakeSender();
    stubFetchJson({
      thread: {
        replies: [
          {
            post: {
              author: { did: 'did:plc:abc', displayName: 'A', avatar: 'https://a/x.png' },
              record: { text: 'hello thread', createdAt: nowIso() },
            },
          },
          { post: { record: { text: 'no author', createdAt: nowIso() } } },
        ],
      },
    });

    const count = await pollBlueskyChat(STREAM, POST_URI, deps(send));

    expect(count).toBe(1);
    expect(sent[0]).toMatchObject({
      userId: 'bluesky:did:plc:abc',
      displayName: 'A',
      message: 'hello thread',
      badges: ['bluesky'],
    });
  });

  it('falls back to a mention search when no post uri is given', async () => {
    const urls = stubFetchJson({
      posts: [
        {
          author: { did: 'did:plc:search' },
          record: { text: 'mentioned', createdAt: nowIso() },
        },
      ],
    });
    const { send, sent } = fakeSender();

    const count = await pollBlueskyChat(STREAM, undefined, deps(send));

    expect(count).toBe(1);
    expect(urls[0]).toContain('searchPosts?q=');
    expect(sent[0]?.displayName).toBe('did:plc:se');
  });

  it('skips replies older than the stored cursor', async () => {
    const { send } = fakeSender();
    stubFetchJson({
      thread: {
        replies: [
          {
            post: {
              author: { did: 'did:plc:old' },
              record: {
                text: 'stale',
                createdAt: new Date(Date.now() - 3_600_000).toISOString(),
              },
            },
          },
        ],
      },
    });
    const kv = makeKv({ [chatLastKey(STREAM, 'bluesky')]: String(Date.now() - 1000) });

    await expect(pollBlueskyChat(STREAM, POST_URI, deps(send, kv))).resolves.toBe(0);
  });

  it('returns 0 on a non-ok xrpc response', async () => {
    stubFetchJson({}, false);
    const { send } = fakeSender();
    await expect(pollBlueskyChat(STREAM, POST_URI, deps(send))).resolves.toBe(0);
  });

  it('is a no-op from the barrel when credentials are missing', async () => {
    await expect(bridges.pollBlueskyChat(makeEnv(makeKv()), STREAM)).resolves.toBe(0);
  });
});
