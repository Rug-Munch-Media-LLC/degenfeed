/**
 * @degenfeed/api-worker — Live chat ingest seam regression tests
 *
 * The seam every protocol ingester (nostr, farcaster, bluesky,
 * activitypub, telegram) funnels through, so its contract is asserted once
 * here rather than per bridge.
 */

import { describe, expect, it } from 'vitest';
import type { Env } from '../index';
import { fakeSender, STREAM } from './bridge-test-harness';
import { ingestFromProtocol } from './ingest';

describe('ingestFromProtocol', () => {
  it('namespaces the user id and carries the bridge badge', async () => {
    const { send, sent } = fakeSender();
    await ingestFromProtocol(send, {} as Env, STREAM, 'farcaster', 'fid:7', 'fc:7', 'gm', {
      badges: ['farcaster'],
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      streamId: STREAM,
      userId: 'farcaster:fid:7',
      displayName: 'fc:7',
      message: 'gm',
      protocol: 'farcaster',
      badges: ['farcaster'],
    });
  });
});
