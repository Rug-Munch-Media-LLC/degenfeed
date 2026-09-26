/**
 * @degenfeed/api-worker — ActivityPub / Mastodon bridge regression tests
 *
 * Locks the contract of the poll bridge extracted from unified-chat.ts:
 * the acct-derived protocol split (threads vs mastodon), HTML stripping,
 * the status-search fallback, cursor staleness, and the no-op behaviour
 * when the instance is unconfigured.
 */

import { describe, expect, it } from 'vitest';
import { pollActivityPubChat, protocolForAcct, stripHtml } from './activitypub-bridge';
import { fakeSender, makeEnv, makeKv, nowIso, STREAM, stubFetchJson } from './bridge-test-harness';
import * as bridges from './bridges';
import { chatLastKey } from './chat-keys';

const INSTANCE = 'https://social.test';
const TOKEN = 'tok';

function deps(send: ReturnType<typeof fakeSender>['send'], kv = makeKv()) {
  return { env: makeEnv(kv), send, accessToken: TOKEN, instance: INSTANCE };
}

describe('protocolForAcct', () => {
  it('tags threads accounts activitypub and everything else mastodon', () => {
    expect(protocolForAcct('someone@threads.net')).toBe('activitypub');
    expect(protocolForAcct('someone@social.test')).toBe('mastodon');
    expect(protocolForAcct(undefined)).toBe('mastodon');
  });
});

describe('stripHtml', () => {
  it('strips tags and decodes the entities mastodon returns', () => {
    expect(stripHtml('<p>hi &amp; bye &lt;3</p>')).toBe('hi & bye <3');
  });
});

describe('pollActivityPubChat', () => {
  it('ingests context descendants and splits the protocol by acct', async () => {
    const { send, sent } = fakeSender();
    stubFetchJson({
      descendants: [
        {
          id: '1',
          account: { acct: 'a@social.test', display_name: 'A' },
          content: '<p>from mastodon</p>',
          created_at: nowIso(),
        },
        {
          id: '2',
          account: { acct: 'b@threads.net', display_name: 'B' },
          content: '<p>from threads</p>',
          created_at: nowIso(),
        },
        { id: '3', account: { acct: 'c@social.test' }, content: '<p></p>', created_at: nowIso() },
      ],
    });

    const count = await pollActivityPubChat(STREAM, '1099', deps(send));

    expect(count).toBe(2);
    expect(sent[0]).toMatchObject({
      protocol: 'mastodon',
      badges: ['mastodon'],
      message: 'from mastodon',
    });
    expect(sent[1]).toMatchObject({ protocol: 'activitypub', badges: ['activitypub'] });
  });

  it('searches statuses when no post id is given', async () => {
    const urls = stubFetchJson({
      statuses: [
        {
          id: '9',
          account: { acct: 's@social.test' },
          content: '<p>search hit</p>',
          created_at: nowIso(),
        },
      ],
    });
    const { send, sent } = fakeSender();

    const count = await pollActivityPubChat(STREAM, undefined, deps(send));

    expect(count).toBe(1);
    expect(urls[0]).toContain('/api/v2/search?q=');
    expect(sent[0]?.protocol).toBe('mastodon');
  });

  it('skips statuses older than the stored cursor', async () => {
    const { send } = fakeSender();
    stubFetchJson({
      descendants: [
        {
          id: '4',
          account: { acct: 'd@social.test' },
          content: '<p>stale</p>',
          created_at: new Date(Date.now() - 3_600_000).toISOString(),
        },
      ],
    });
    const kv = makeKv({ [chatLastKey(STREAM, 'activitypub')]: String(Date.now() - 1000) });

    await expect(pollActivityPubChat(STREAM, '1099', deps(send, kv))).resolves.toBe(0);
  });

  it('returns 0 on a non-ok instance response', async () => {
    stubFetchJson({}, false);
    const { send } = fakeSender();
    await expect(pollActivityPubChat(STREAM, '1099', deps(send))).resolves.toBe(0);
  });

  it('is a no-op from the barrel when no access token is configured', async () => {
    await expect(bridges.pollActivityPubChat(makeEnv(makeKv()), STREAM)).resolves.toBe(0);
  });
});
