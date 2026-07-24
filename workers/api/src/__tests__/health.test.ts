import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../index';
import { handleRelaysHealth } from '../routes/health';

const sockets: Array<{
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
  close: () => void;
  readyState: number;
}> = [];

vi.stubGlobal(
  'WebSocket',
  vi.fn().mockImplementation(() => {
    const ws = {
      onopen: null,
      onclose: null,
      onerror: null,
      close: vi.fn(),
      readyState: 0,
    };
    sockets.push(ws);
    return ws;
  }),
);

describe('handleRelaysHealth', () => {
  it('should return relay status object', { timeout: 5000 }, async () => {
    const env = { RELAY_URLS: 'wss://relay.damus.io' } as Env;
    const resPromise = handleRelaysHealth(env);
    await new Promise((r) => setTimeout(r, 10));
    for (const ws of sockets) {
      if (typeof ws.onopen === 'function') ws.onopen();
    }
    sockets.length = 0;
    const res = await resPromise;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { relays: unknown; healthy: unknown };
    expect(body.relays).toBeDefined();
    expect(typeof body.healthy).toBe('number');
  });

  it('should fall back to default relays when none configured', {
    timeout: 20000,
  }, async () => {
    const env = {} as Env;
    const resPromise = handleRelaysHealth(env);
    await new Promise((r) => setTimeout(r, 100));
    for (const ws of sockets) {
      if (typeof ws.onopen === 'function') ws.onopen();
    }
    sockets.length = 0;
    const res = await resPromise;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { relays: unknown; healthy: unknown };
    expect(body.relays).toBeDefined();
  });
});
