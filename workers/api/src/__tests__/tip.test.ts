import { describe, expect, it } from 'vitest';
import type { ResolvedTipMethod, TipPostContext } from '../routes/tip';
import { rankMethods } from '../routes/tip';

function method(name: string, available: boolean): ResolvedTipMethod {
  return {
    method: name,
    label: name,
    description: name,
    icon: '',
    available,
  };
}

describe('rankMethods', () => {
  it('ranks Lightning Zap first for Nostr when author has a lightning address', () => {
    const methods = [
      method('ethereum', true),
      method('solana', true),
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

  it('ranks Lens Collect first for Lens when post has a collect module', () => {
    const methods = [
      method('ethereum', true),
      method('solana', true),
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
    expect(ranked[0]?.available).toBe(true);
  });

  it('ranks Farcaster Frame first for Farcaster when author has custody address', () => {
    const methods = [
      method('ethereum', true),
      method('solana', true),
      method('farcaster_frame', false),
    ];
    const context: TipPostContext = {
      protocol: 'farcaster',
      authorId: '123',
      author: { farcasterCustodyAddress: '0x1234567890123456789012345678901234567890' },
    };
    const ranked = rankMethods(methods, 'farcaster', context);
    expect(ranked[0]?.method).toBe('farcaster_frame');
    expect(ranked[0]?.recommended).toBe(true);
    expect(ranked[0]?.available).toBe(true);
  });

  it('falls back to EVM then Solana when no native protocol method is available', () => {
    const methods = [
      method('ethereum', true),
      method('solana', true),
      method('lightning_zap', false),
    ];
    const context: TipPostContext = {
      protocol: 'nostr',
      authorId: 'abc',
    };
    const ranked = rankMethods(methods, 'nostr', context);
    const recommended = ranked.find((m) => m.recommended);
    expect(recommended?.method).toBe('ethereum');
    expect(recommended?.recommended).toBe(true);
  });

  it('prefers Lightning over EVM for Nostr when both are available', () => {
    const methods = [
      method('ethereum', true),
      method('solana', true),
      method('lightning_zap', true),
    ];
    const context: TipPostContext = {
      protocol: 'nostr',
      authorId: 'abc',
      author: { nostrPubkey: 'abc' },
    };
    const ranked = rankMethods(methods, 'nostr', context);
    expect(ranked[0]?.method).toBe('lightning_zap');
  });

  it('marks no method recommended when none are available', () => {
    const methods = [method('ethereum', false), method('solana', false)];
    const context: TipPostContext = {
      protocol: 'bluesky',
      authorId: 'did:plc:abc',
    };
    const ranked = rankMethods(methods, 'bluesky', context);
    expect(ranked.some((m: ResolvedTipMethod) => m.recommended)).toBe(false);
  });

  it('uses author EVM/Solana addresses to enable direct transfers', () => {
    const methods = [method('ethereum', false), method('solana', false)];
    const context: TipPostContext = {
      protocol: 'bluesky',
      authorId: 'did:plc:abc',
      author: {
        evmAddress: '0x1234567890123456789012345678901234567890',
        solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      },
    };
    const ranked = rankMethods(methods, 'bluesky', context);
    expect(ranked[0]?.method).toBe('ethereum');
    expect(ranked[0]?.available).toBe(true);
    expect(ranked[0]?.address).toBe(context.author?.evmAddress);
    expect(ranked[1]?.method).toBe('solana');
    expect(ranked[1]?.available).toBe(true);
    expect(ranked[1]?.address).toBe(context.author?.solanaAddress);
  });
});
