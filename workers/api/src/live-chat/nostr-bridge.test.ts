/**
 * @degenfeed/api-worker — Nostr bridge regression tests
 *
 * Locks the contract of the poll bridge extracted from unified-chat.ts:
 * relay-list parsing, the `protocol:userId` namespace, the bridge badge,
 * the shared poll cursor, and graceful degradation.
 */

// Plain class (not vi.fn) so the shared afterEach(vi.restoreAllMocks) in
// test-setup.ts cannot strip the implementation between tests. `vi` is
// imported here (not only in the describe block below) because the module
// mock above is hoisted above the import statements.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: class {
    async list() {
      return [{ pubkey: 'c'.repeat(64), content: 'nostr reply' }];
    }
    disconnectAll() {}
  },
  npubEncode: () => 'npub1abcdefghijklmnop',
}));

import { fakeSender, makeEnv, makeKv, STREAM } from './bridge-test-harness';
import { chatLastKey } from './chat-keys';
import { pollNostrChat } from './nostr-bridge';

describe('pollNostrChat', () => {
  it('returns 0 when every configured relay is blank', async () => {
    const { send } = fakeSender();
    const env = makeEnv(makeKv(), { RELAY_URLS: ' , , ' });
    await expect(pollNostrChat(STREAM, 'evt_1', { env, send })).resolves.toBe(0);
  });

  it('parses RELAY_URLS and ingests replies with an npub display name', async () => {
    const { send, sent } = fakeSender();
    const env = makeEnv(makeKv(), { RELAY_URLS: ' wss://relay.damus.io , ,wss://nos.lol ' });
    const count = await pollNostrChat(STREAM, 'evt_1', { env, send });

    expect(count).toBe(1);
    expect(sent[0]).toMatchObject({
      userId: `nostr:${'c'.repeat(64)}`,
      displayName: 'npub1abcdefghijk',
      message: 'nostr reply',
      badges: ['nostr'],
    });
  });

  it('advances the nostr poll cursor after a poll window', async () => {
    const { send } = fakeSender();
    const kv = makeKv();
    const env = makeEnv(kv, { RELAY_URLS: 'wss://relay.damus.io' });
    await pollNostrChat(STREAM, 'evt_1', { env, send });

    expect(Number(kv.store.get(chatLastKey(STREAM, 'nostr')))).toBeGreaterThan(0);
  });
});
