/**
 * Provider integration smoke tests — validates that our schema guards
 * accept the real API response shapes from each provider.
 */

import { describe, expect, it } from 'vitest';
import { isNostrEvent } from '../schemas';

const NOSTR_EVENT = {
  id: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  kind: 1,
  created_at: 1700000000,
  tags: [],
  content: 'Hello from Nostr',
  sig: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead',
};

describe('Nostr schema guard', () => {
  it('accepts a valid event', () => {
    expect(isNostrEvent(NOSTR_EVENT)).toBe(true);
  });

  it('rejects null', () => {
    expect(isNostrEvent(null)).toBe(false);
  });

  it('rejects an event missing pubkey', () => {
    expect(isNostrEvent({ id: 'abc', kind: 1, content: 'x' })).toBe(false);
  });
});
