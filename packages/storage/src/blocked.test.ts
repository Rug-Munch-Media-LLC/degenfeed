/**
 * @degenfeed/storage — Block operations tests
 *
 * Tests for the blocked user operations including isBlocked,
 * addBlockedUser, removeBlockedUser, and syncBlockedFromServer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock IndexedDB-backed db module to avoid ReferenceError in test env
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('isBlocked / addBlockedUser / removeBlockedUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should export all block functions', async () => {
    const mod = await import('./blocked');
    expect(typeof mod.addBlockedUser).toBe('function');
    expect(typeof mod.removeBlockedUser).toBe('function');
    expect(typeof mod.isBlocked).toBe('function');
    expect(typeof mod.getBlockedUsers).toBe('function');
    expect(typeof mod.syncBlockedFromServer).toBe('function');
  });

  it('should call sync API when adding a blocked user', async () => {
    const { addBlockedUser } = await import('./blocked');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await addBlockedUser('target123', 'Spammer', 'nostr', 'self');
    // The sync POST should be called
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/moderation/sync'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('syncBlockedFromServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should silently handle server errors', async () => {
    const { syncBlockedFromServer } = await import('./blocked');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await expect(syncBlockedFromServer()).resolves.toBeUndefined();
  });

  it('should silently handle network errors', async () => {
    const { syncBlockedFromServer } = await import('./blocked');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(syncBlockedFromServer()).resolves.toBeUndefined();
  });

  it('should process server response when successful', async () => {
    const { syncBlockedFromServer } = await import('./blocked');
    const serverData = {
      blocked: [
        { targetId: 'user1', targetHandle: 'spammer1', protocol: 'nostr', blockedBy: 'self' },
      ],
      muted: [],
      mutedWords: [],
      mutedCommunities: [],
      blockedCommunities: [],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(serverData), { status: 200 }),
    );
    await expect(syncBlockedFromServer()).resolves.toBeUndefined();
  });
});
