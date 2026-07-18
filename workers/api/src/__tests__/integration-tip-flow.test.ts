/**
 * @degenfeed/api — Integration test: Full tip flow
 *
 * Tests the end-to-end tip flow: input validation → method ranking → response.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ResolvedTipMethod, TipPostContext } from '../routes/tip';
import { handleTipResolve, rankMethods } from '../routes/tip';

function method(name: string, available = true): ResolvedTipMethod {
  return {
    method: name,
    label: name,
    description: `Pay via ${name}`,
    icon: '',
    available,
  };
}

describe('Tip flow: validation → ranking → response', () => {
  // ─── Input validation ─────────────────────────────────────────────
  it('should return 400 for missing protocol parameter', async () => {
    const req = new Request('http://localhost/api/tip/resolve');
    const env = {} as any;
    const res = await handleTipResolve(req, env);
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing authorId parameter', async () => {
    const req = new Request('http://localhost/api/tip/resolve?protocol=nostr');
    const env = {} as any;
    const res = await handleTipResolve(req, env);
    expect(res.status).toBe(400);
  });

  it('should resolve tip methods when valid params are provided', async () => {
    const req = new Request('http://localhost/api/tip/resolve?protocol=nostr&authorId=abc123');
    const env = {} as any;
    const res = await handleTipResolve(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { methods?: unknown[]; resolved?: boolean };
    expect(body.methods).toBeDefined();
    expect(body.resolved).toBe(true);
  });

  // ─── Method ranking ───────────────────────────────────────────────
  it('should rank Lightning Zap first for Nostr with lightning address', () => {
    const methods = [
      method('ethereum'),
      method('solana'),
      method('lightning_zap', false),
    ];
    const context: TipPostContext = {
      protocol: 'nostr',
      authorId: 'abc',
      author: { lightningAddress: 'alice@getalby.com' },
    };
    const ranked = rankMethods(methods, 'nostr', context);
    expect(ranked[0]?.method).toBe('lightning_zap');
    expect(ranked[0]?.recommended).toBe(true);
    expect(ranked[0]?.available).toBe(true);
  });

  it('should rank Lens Collect first for Lens with collect module', () => {
    const methods = [
      method('ethereum'),
      method('solana'),
      method('lens_collect', false),
    ];
    const context: TipPostContext = {
      protocol: 'lens',
      authorId: '0x01',
      meta: { hasCollectModule: true },
    };
    const ranked = rankMethods(methods, 'lens', context);
    expect(ranked[0]?.method).toBe('lens_collect');
    expect(ranked[0]?.recommended).toBe(true);
  });

  it('should rank the default method for unsupported protocols', () => {
    const methods = [
      method('ethereum'),
      method('solana'),
    ];
    const context: TipPostContext = {
      protocol: 'rss',
      authorId: 'feed1',
    };
    const ranked = rankMethods(methods, 'rss', context);
    expect(ranked.length).toBe(2);
  });

  it('should move unavailable methods to the end', () => {
    const methods = [
      method('solana'),
      method('lightning_zap', false),
      method('ethereum'),
    ];
    const context: TipPostContext = {
      protocol: 'nostr',
      authorId: 'abc',
      author: { lightningAddress: 'alice@getalby.com' },
    };
    const ranked = rankMethods(methods, 'nostr', context);
    const lastIdx = ranked.length - 1;
    expect(ranked[lastIdx]?.available).toBe(false);
  });
});
