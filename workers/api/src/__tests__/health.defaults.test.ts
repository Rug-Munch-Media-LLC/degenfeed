import { describe, it, expect, vi } from 'vitest';

const sockets: any[] = [];
vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
  const ws: any = { onopen: null, onclose: null, onerror: null, close: vi.fn(), readyState: 0 };
  sockets.push(ws);
  return ws;
}));

import { handleRelaysHealth } from '../routes/health';

describe('handleRelaysHealth (defaults)', () => {
  it('should use DEFAULT_RELAYS when empty', { timeout: 15000 }, async () => {
    const env: any = {};
    const resPromise = handleRelaysHealth(env);
    await new Promise(r => setTimeout(r, 200));
    for (const ws of sockets) { if (typeof ws.onopen === 'function') ws.onopen(); }
    sockets.length = 0;
    const res = await resPromise;
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.relays).toBeDefined();
  });
});
