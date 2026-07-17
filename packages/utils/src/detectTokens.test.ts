/**
 * @degenfeed/utils — detectTokens tests
 */

import { describe, expect, it } from 'vitest';

describe('detectTokens', () => {
  it('should detect $TICKER patterns', async () => {
    const { detectTokens } = await import('./detectTokens');
    const result = detectTokens('Just bought $BTC and $ETH!');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ symbol: 'BTC' });
    expect(result[1]).toEqual({ symbol: 'ETH' });
  });

  it('should detect only uppercase tickers per $[A-Z] pattern', async () => {
    const { detectTokens } = await import('./detectTokens');
    // $btc is lowercase so it won't match; $BTC does
    const result = detectTokens('$btc is not the same as $BTC');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ symbol: 'BTC' });
  });

  it('should detect EVM addresses', async () => {
    const { detectTokens } = await import('./detectTokens');
    const addr = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const result = detectTokens(`Check this token: ${addr}`);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ address: addr.toLowerCase(), chain: 'ethereum' });
  });

  it('should detect Solana addresses', async () => {
    const { detectTokens } = await import('./detectTokens');
    // Jupiter mint address on Solana
    const addr = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
    const result = detectTokens(`Solana token: ${addr}`);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ address: addr, chain: 'solana' });
  });

  it('should deduplicate identical tokens', async () => {
    const { detectTokens } = await import('./detectTokens');
    const result = detectTokens('$BTC $BTC $BTC');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ symbol: 'BTC' });
  });

  it('should return at most 3 tokens', async () => {
    const { detectTokens } = await import('./detectTokens');
    const result = detectTokens('$BTC $ETH $SOL $DOGE $PEPE');
    expect(result).toHaveLength(3);
  });

  it('should return empty array for no matches', async () => {
    const { detectTokens } = await import('./detectTokens');
    expect(detectTokens('Hello world')).toEqual([]);
    expect(detectTokens('')).toEqual([]);
  });

  it('should not match short $ patterns', async () => {
    const { detectTokens } = await import('./detectTokens');
    expect(detectTokens('$A $AB')).toHaveLength(1); // $A is too short (1 char)
    expect(detectTokens('$AB')).toHaveLength(1); // $AB is valid (2 chars)
  });

  it('should not match non-address hex strings', async () => {
    const { detectTokens } = await import('./detectTokens');
    // A short hex should not match EVM_RE (needs 40 hex chars after 0x)
    const result = detectTokens('0xdeadbeef');
    expect(result).toHaveLength(0);
  });

  it('should detect mixed tickers and addresses', async () => {
    const { detectTokens } = await import('./detectTokens');
    const evmAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const result = detectTokens(`$ETH and token at ${evmAddr}`);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ symbol: 'ETH' });
    expect(result[1]).toEqual({ address: evmAddr.toLowerCase(), chain: 'ethereum' });
  });

  it('should lowercase EVM addresses', async () => {
    const { detectTokens } = await import('./detectTokens');
    const mixed = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const result = detectTokens(mixed);
    expect(result[0]?.address).toBe(mixed.toLowerCase());
  });
});
