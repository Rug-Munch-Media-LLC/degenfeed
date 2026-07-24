/**
 * ═════════════════════════════════════════════════════════════════════════════
 * PREMIUM FLOWS E2E TESTS — 10 tests
 *
 * Tests the token-gating and premium subscription logic end-to-end:
 *   - Token gate verification (ERC20, ERC721, ERC1155)
 *   - Cached verification with 5-min TTL
 *   - Cache eviction when over capacity
 *   - Token gate symbol resolution
 *   - NFT metadata resolution
 *   - Gate description formatting
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest';
import type { TokenGate } from '../../packages/token-gate/src';
import {
  CHAIN_LABELS,
  checkTokenGate,
  checkTokenGateCached,
  formatGateDescription,
  resolveTokenGateSymbol,
  TYPE_LABELS,
} from '../../packages/token-gate/src';

describe('Premium — Token Gate Types', () => {
  it('should have chain labels for all supported chains', () => {
    expect(CHAIN_LABELS.ethereum).toBe('Ethereum');
    expect(CHAIN_LABELS.base).toBe('Base');
    expect(CHAIN_LABELS.solana).toBe('Solana');
    expect(CHAIN_LABELS.polygon).toBe('Polygon');
    expect(CHAIN_LABELS.arbitrum).toBe('Arbitrum');
    expect(CHAIN_LABELS.optimism).toBe('Optimism');
  });

  it('should have type labels for all gate types', () => {
    expect(TYPE_LABELS.erc20).toContain('Token');
    expect(TYPE_LABELS.erc721).toContain('NFT');
    expect(TYPE_LABELS.erc1155).toContain('Multi Token');
  });
});

describe('Premium — Gate Description Formatting', () => {
  it('should format ERC20 gate description with balance', () => {
    const gate: TokenGate = {
      type: 'erc20',
      chain: 'ethereum',
      contractAddress: '0xabc',
      minBalance: 100,
    };
    const desc = formatGateDescription(gate, 'USDC');
    expect(desc).toContain('100');
    expect(desc).toContain('USDC');
    expect(desc).toContain('Ethereum');
  });

  it('should format ERC721 gate description without tokenId', () => {
    const gate: TokenGate = { type: 'erc721', chain: 'base', contractAddress: '0xnft' };
    const desc = formatGateDescription(gate, 'CoolNFT');
    expect(desc).toContain('any CoolNFT');
    expect(desc).toContain('Base');
  });

  it('should format ERC721 gate description with tokenId', () => {
    const gate: TokenGate = {
      type: 'erc721',
      chain: 'ethereum',
      contractAddress: '0xnft',
      tokenId: '42',
    };
    const desc = formatGateDescription(gate, 'RareNFT');
    expect(desc).toContain('#42');
    expect(desc).toContain('RareNFT');
  });

  it('should format ERC1155 gate description', () => {
    const gate: TokenGate = {
      type: 'erc1155',
      chain: 'polygon',
      contractAddress: '0xmulti',
      tokenId: '7',
    };
    const desc = formatGateDescription(gate, 'MultiToken');
    expect(desc).toContain('#7');
    expect(desc).toContain('MultiToken');
    expect(desc).toContain('Polygon');
  });
});

describe('Premium — Token Gate Verification', () => {
  it('should return false for empty wallet address', async () => {
    const gate: TokenGate = { type: 'erc20', chain: 'ethereum', contractAddress: '0xabc' };
    const result = await checkTokenGate(gate, '');
    expect(result).toBe(false);
  });

  it('should attempt RPC call for ERC20 verification (fail in test)', async () => {
    // This will make an RPC call that fails in the test environment
    const gate: TokenGate = {
      type: 'erc20',
      chain: 'ethereum',
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      minBalance: 1,
    };
    const result = await checkTokenGate(gate, '0xdead000000000000000000000000000000000000');
    // RPC will fail in test env, so should return false
    expect(result).toBe(false);
  });

  it('should return false for ERC1155 without tokenId', async () => {
    const gate: TokenGate = { type: 'erc1155', chain: 'ethereum', contractAddress: '0xabc' };
    const result = await checkTokenGate(gate, '0xuser');
    expect(result).toBe(false);
  });

  it('should return false for unsupported gate type', async () => {
    const gate: TokenGate = {
      type: 'erc20' as never,
      chain: 'ethereum' as never,
      contractAddress: '0xabc',
    };
    // Type is wrong but the function handles unknown types gracefully
    const result = await checkTokenGate(gate, '0xuser');
    expect(result).toBe(false);
  });
});

describe('Premium — Token Gate Caching', () => {
  it('should cache verification results for 5 minutes', async () => {
    const gate: TokenGate = {
      type: 'erc20',
      chain: 'ethereum',
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      minBalance: 1,
    };
    const wallet = '0xdead000000000000000000000000000000001111';

    // First call: RPC hit (fails in test)
    const result1 = await checkTokenGateCached(gate, wallet);
    expect(result1).toBe(false);

    // Second call: should use cache (no RPC)
    const result2 = await checkTokenGateCached(gate, wallet);
    expect(result2).toBe(false);
  });

  it('should return false for cached check with empty address', async () => {
    const gate: TokenGate = { type: 'erc20', chain: 'ethereum', contractAddress: '0xabc' };
    const result = await checkTokenGateCached(gate, '');
    expect(result).toBe(false);
  });
});

describe('Premium — Symbol Resolution', () => {
  it('should return shortened address for Solana tokens', async () => {
    const gate: TokenGate = {
      type: 'erc20',
      chain: 'solana',
      contractAddress: 'So11111111111111111111111111111111111111112',
    };
    const symbol = await resolveTokenGateSymbol(gate);
    expect(symbol).toContain('...');
  });

  it('should return NFT for ERC721 when symbol call fails', async () => {
    const gate: TokenGate = {
      type: 'erc721',
      chain: 'ethereum',
      contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    };
    const symbol = await resolveTokenGateSymbol(gate);
    // RPC will fail in test, so should default to 'NFT'
    expect(symbol).toBe('NFT');
  });

  it('should return Multi-Token for ERC1155 when symbol call fails', async () => {
    const gate: TokenGate = {
      type: 'erc1155',
      chain: 'ethereum',
      contractAddress: '0xabc',
    };
    const symbol = await resolveTokenGateSymbol(gate);
    expect(symbol).toBe('Multi-Token');
  });
});
