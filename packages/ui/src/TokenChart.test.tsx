/**
 * @degenfeed/ui — TokenChart component tests
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DexScreenerPair } from './TokenChart';
import { TokenChart } from './TokenChart';

const mockPair: DexScreenerPair = {
  chainId: 'ethereum',
  dexId: 'uniswap',
  url: 'https://dexscreener.com/ethereum/0xabc',
  pairAddress: '0xabc',
  baseToken: { address: '0x123', name: 'Wrapped Bitcoin', symbol: 'WBTC' },
  quoteToken: { address: '0x456', name: 'USDC', symbol: 'USDC' },
  priceUsd: '65000.50',
  priceChange: { h24: 2.5 },
  liquidity: { usd: 50_000_000 },
  fdv: 1_200_000_000,
  txns: { h24: { buys: 150, sells: 120 } },
  volume: { h24: 25_000_000 },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TokenChart', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ pairs: [mockPair] }), { status: 200 }),
    );
  });

  it('should show loading state initially', () => {
    // Keep fetch unresolved to show loading
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>(() => {}),
    );
    const { container } = render(<TokenChart symbol="BTC" />);
    expect(container.querySelector('.animate-pulse')).toBeDefined();
  });

  it('should render price and symbol when data loads', async () => {
    render(<TokenChart symbol="WBTC" />);
    await waitFor(() => {
      expect(screen.getByText('WBTC')).toBeDefined();
    });
    await waitFor(() => {
      expect(screen.getByText('$65000.50')).toBeDefined();
    });
  });

  it('should show 24h change with positive sign', async () => {
    render(<TokenChart symbol="WBTC" />);
    await waitFor(() => {
      expect(screen.getByText('+2.50%')).toBeDefined();
    });
  });

  it('should show negative change with minus sign', async () => {
    const negativePair = {
      ...mockPair,
      priceChange: { h24: -3.2 },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ pairs: [negativePair] }), { status: 200 }),
    );
    render(<TokenChart symbol="WBTC" />);
    await waitFor(() => {
      expect(screen.getByText('-3.20%')).toBeDefined();
    });
  });

  it('should handle API error gracefully (return null)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const { container } = render(<TokenChart symbol="BTC" />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('should handle empty pairs response gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ pairs: [] }), { status: 200 }),
    );
    const { container } = render(<TokenChart symbol="UNKNOWN" />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('should render compact variant without chart iframe', async () => {
    const { container } = render(<TokenChart symbol="WBTC" compact />);
    await waitFor(() => {
      expect(screen.getByText('WBTC')).toBeDefined();
    });
    const iframes = container.querySelectorAll('iframe');
    expect(iframes.length).toBe(0);
  });

  it('should render full variant with chart iframe', async () => {
    const { container } = render(<TokenChart symbol="WBTC" />);
    await waitFor(() => {
      expect(screen.getByText('WBTC')).toBeDefined();
    });
    const iframes = container.querySelectorAll('iframe');
    expect(iframes.length).toBe(1);
  });

  it('should show liquidity in compact format', async () => {
    render(<TokenChart symbol="WBTC" />);
    await waitFor(() => {
      expect(screen.getByText(/Liq:/)).toBeDefined();
    });
  });
});
