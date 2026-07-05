import { describe, it, expect, vi } from 'vitest';

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    disconnectAll: vi.fn(),
  })),
}));

import { handleNotifications } from '../routes/notifications';

describe('handleNotifications', () => {
  it('should return notifications array', async () => {
    const req = new Request('http://localhost/api/notifications?auth=%7B%7D');
    const res = await handleNotifications(req, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.notifications)).toBe(true);
  });

  it('should handle Nostr pubkey auth', async () => {
    const auth = encodeURIComponent(JSON.stringify({ nostr_pubkey: 'abc123' }));
    const req = new Request('http://localhost/api/notifications?auth=' + auth);
    const res = await handleNotifications(req, {} as any);
    expect(res.status).toBe(200);
  });
});
