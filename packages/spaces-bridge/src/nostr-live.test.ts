/**
 * @degenfeed/spaces-bridge — NIP-53 live event publisher tests.
 *
 * Verifies the kind:30311 live event (audio space / live video) is built
 * with the correct tags (HLS streaming URL, status, participant count)
 * and is ALWAYS signed before being published to relays — the fix for
 * the earlier audit finding that live events could be dropped unsigned.
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the nostr SDK before importing the module under test
const publishMock = vi.fn();
const disconnectMock = vi.fn();
let connectedRelays: string[] = ['wss://relay.test'];

vi.mock('@degenfeed/nostr-sdk', () => ({
  getPublicKey: vi.fn(() => 'pubkey-abc'),
  signEvent: vi.fn((e: Record<string, unknown>) => ({
    ...e,
    id: 'signed-event-id',
    sig: 'sig-abc',
  })),
  RelayPool: vi.fn(() => ({
    publish: publishMock,
    disconnectAll: disconnectMock,
    getConnectedRelays: vi.fn(() => connectedRelays),
  })),
}));

import { endNip53LiveEvent, publishNip53LiveEvent, publishSignedEvent } from './nostr';

describe('publishSignedEvent (reliable relay publish)', () => {
  const event = {
    id: 'evt-1',
    pubkey: 'pubkey-abc',
    created_at: 1_700_000_000,
    kind: 30311,
    tags: [['d', 'live-1']],
    content: 'live',
    sig: 'sig-abc',
  };

  beforeEach(() => {
    publishMock.mockReset();
    disconnectMock.mockReset();
    connectedRelays = ['wss://relay.test'];
    process.env.NOSTR_PRIVATE_KEY = 'deadbeef';
  });

  afterEach(() => {
    delete process.env.NOSTR_PRIVATE_KEY;
  });

  it('waits for a relay connection before publishing', async () => {
    // Simulate a relay that connects 250ms after pool creation
    connectedRelays = [];
    const originalPool = connectedRelays;
    const timer = setTimeout(() => {
      originalPool.push('wss://relay.test');
    }, 250);
    publishMock.mockImplementation(() => {});

    const result = await publishSignedEvent(event, ['wss://relay.test'], {
      connectTimeoutMs: 2000,
      ackTimeoutMs: 50,
    });
    clearTimeout(timer);

    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(result.relaysAttempted).toContain('wss://relay.test');
  });

  it('does not publish when no relay ever connects', async () => {
    connectedRelays = [];
    const result = await publishSignedEvent(event, ['wss://relay.test'], {
      connectTimeoutMs: 100,
      ackTimeoutMs: 10,
    });

    expect(publishMock).not.toHaveBeenCalled();
    expect(result.published).toBe(false);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});

describe('publishNip53LiveEvent', () => {
  beforeEach(() => {
    process.env.NOSTR_PRIVATE_KEY = 'deadbeef';
    publishMock.mockReset();
    disconnectMock.mockReset();
    connectedRelays = ['wss://relay.test'];
  });

  afterEach(() => {
    delete process.env.NOSTR_PRIVATE_KEY;
  });

  it('builds a signed kind:30311 event with HLS stream URL, status, and participant count', async () => {
    const result = await publishNip53LiveEvent({
      dTag: 'degenfeed-live-abc123',
      title: 'Crypto Trading Live',
      status: 'live',
      streamUrl: 'https://owncast.degenfeed.xyz/hls/stream.m3u8',
      summary: 'Charts and alpha',
      currentParticipants: 42,
      tags: ['crypto', 'live'],
      hostName: 'trader_joe',
    });

    expect(result.ok).toBe(true);
    expect(result.eventId).toBe('signed-event-id');

    // The signed event was handed to RelayPool.publish
    const signedEvent = publishMock.mock.calls[0]?.[0] as {
      kind: number;
      sig: string;
      tags: string[][];
    };
    expect(signedEvent.kind).toBe(30311);
    expect(signedEvent.sig).toBe('sig-abc'); // always signed
    const tagMap = new Map(signedEvent.tags.map((t) => [t[0], t[1]]));
    expect(tagMap.get('d')).toBe('degenfeed-live-abc123');
    expect(tagMap.get('title')).toBe('Crypto Trading Live');
    expect(tagMap.get('status')).toBe('live');
    expect(tagMap.get('streaming')).toBe('https://owncast.degenfeed.xyz/hls/stream.m3u8');
    expect(tagMap.get('current_participants')).toBe('42');
    expect(tagMap.get('host')).toBe('trader_joe');
    expect(signedEvent.tags.some((t) => t[0] === 't' && t[1] === 'crypto')).toBe(true);
  });

  it('returns a helpful error when NOSTR_PRIVATE_KEY is missing', async () => {
    delete process.env.NOSTR_PRIVATE_KEY;
    const result = await publishNip53LiveEvent({
      dTag: 'live-1',
      title: 'No Key Stream',
      status: 'live',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('NOSTR_PRIVATE_KEY');
  });
});

describe('endNip53LiveEvent', () => {
  beforeEach(() => {
    process.env.NOSTR_PRIVATE_KEY = 'deadbeef';
    publishMock.mockReset();
    disconnectMock.mockReset();
    connectedRelays = ['wss://relay.test'];
  });

  afterEach(() => {
    delete process.env.NOSTR_PRIVATE_KEY;
  });

  it('publishes an ended status with the same d tag', async () => {
    const result = await endNip53LiveEvent({
      dTag: 'degenfeed-live-abc123',
      title: 'Crypto Trading Live',
      recordingUrl: 'https://owncast.degenfeed.xyz/vod/1.m3u8',
    });

    expect(result.ok).toBe(true);
    const signedEvent = publishMock.mock.calls[0]?.[0] as {
      kind: number;
      tags: string[][];
    };
    expect(signedEvent.kind).toBe(30311);
    const tagMap = new Map(signedEvent.tags.map((t) => [t[0], t[1]]));
    expect(tagMap.get('d')).toBe('degenfeed-live-abc123');
    expect(tagMap.get('status')).toBe('ended');
    expect(tagMap.get('recording')).toBe('https://owncast.degenfeed.xyz/vod/1.m3u8');
  });
});

// Silence unused type import in this test file (kept for clarity of mocks)
export type { Mock };
