/**
 * @degenfeed/utils — Protocol currency mapping tests
 */

import { describe, expect, it } from 'vitest';
import { CURRENCY_META, getDefaultCurrency, PROTOCOL_DEFAULT_CURRENCY } from './protocolCurrency';

describe('PROTOCOL_DEFAULT_CURRENCY', () => {
  it('should map farcaster to base', () => {
    expect(PROTOCOL_DEFAULT_CURRENCY.farcaster).toBe('base');
  });

  it('should map lens to matic', () => {
    expect(PROTOCOL_DEFAULT_CURRENCY.lens).toBe('matic');
  });

  it('should map nostr to btc', () => {
    expect(PROTOCOL_DEFAULT_CURRENCY.nostr).toBe('btc');
  });

  it('should map solana to sol', () => {
    expect(PROTOCOL_DEFAULT_CURRENCY.solana).toBe('sol');
  });

  it('should map ethereum to eth', () => {
    expect(PROTOCOL_DEFAULT_CURRENCY.ethereum).toBe('eth');
  });
});

describe('getDefaultCurrency', () => {
  it('should prefer post protocol currency', () => {
    const result = getDefaultCurrency(['ethereum'], 'farcaster');
    expect(result).toBe('base');
  });

  it('should fall back to first connected protocol', () => {
    const result = getDefaultCurrency(['solana', 'ethereum']);
    expect(result).toBe('sol');
  });

  it('should return eth when no protocols match', () => {
    const result = getDefaultCurrency(['unknown_protocol']);
    expect(result).toBe('eth');
  });

  it('should return eth when connected protocols is empty', () => {
    const result = getDefaultCurrency([]);
    expect(result).toBe('eth');
  });

  it('should return eth when post protocol has no mapping', () => {
    const result = getDefaultCurrency(['ethereum'], 'unknown_protocol');
    expect(result).toBe('eth');
  });

  it('should handle undefined postProtocol', () => {
    const result = getDefaultCurrency(['farcaster']);
    expect(result).toBe('base');
  });

  it('should iterate through connected protocols in order', () => {
    // First protocol with a mapping should win
    const result = getDefaultCurrency(['unknown_a', 'unknown_b', 'solana']);
    expect(result).toBe('sol');
  });
});

describe('CURRENCY_META', () => {
  it('should have metadata for all supported currencies', () => {
    const currencies = ['eth', 'base', 'matic', 'sol', 'btc', 'usdc'];
    for (const c of currencies) {
      expect(CURRENCY_META[c]).toBeDefined();
      expect(CURRENCY_META[c]!.label).toBeTruthy();
      expect(CURRENCY_META[c]!.symbol).toBeTruthy();
      expect(CURRENCY_META[c]!.icon).toBeTruthy();
      expect(CURRENCY_META[c]!.color).toMatch(/^#/);
    }
  });

  it('should have ETH symbol for base currency', () => {
    expect(CURRENCY_META.base!.symbol).toBe('ETH');
  });

  it('should have correct BTC color', () => {
    expect(CURRENCY_META.btc!.color).toBe('#f7931a');
  });

  it('should have correct SOL color', () => {
    expect(CURRENCY_META.sol!.color).toBe('#9945ff');
  });
});
