import { describe, it, expect, vi } from 'vitest';

const sockets: any[] = [];
vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
  const ws: any = { onopen: null, onclose: null, onerror: null, close: vi.fn(), readyState: 0 };
  sockets.push(ws);
  return ws;
}));

import { handleRelaysHealth } from '../routes/health';

describe('handleRelaysHealth (configured)', () => {
  it('should return relay status', { timeout: 5000 }, async () => {
    const env: any = { RELAY_URLS: 'wss://relay.damus.io' };
    const resPromise = handleRelaysHealth(env);
    await new Promise(r => setTimeout(r, 10));
    for (const ws of sockets) { if (typeof ws.onopen === 'function') ws.onopen(); }
    sockets.length = 0;
    const res = await resPromise;
    expect(res.status).toBe(200);
  });
});
