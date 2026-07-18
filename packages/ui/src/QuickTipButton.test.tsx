/**
 * @degenfeed/ui — QuickTipButton component tests
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickTipButton } from './QuickTipButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('QuickTipButton', () => {
  it('should render tip button with default label', () => {
    render(<QuickTipButton postId="test-1" />);
    expect(screen.getByText('Tip')).toBeDefined();
  });

  it('should show tip amounts on click', () => {
    render(<QuickTipButton postId="test-1" tipAmounts={[1, 5, 10]} />);
    const button = screen.getByText('Tip');
    fireEvent.click(button);
    expect(screen.getByText('$1')).toBeDefined();
    expect(screen.getByText('$5')).toBeDefined();
    expect(screen.getByText('$10')).toBeDefined();
  });

  it('should show tipping spinner on amount click', async () => {
    // Keep the fetch pending so we see the spinning state
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>(() => {}), // never resolves
    );

    render(<QuickTipButton postId="test-1" />);
    fireEvent.click(screen.getByText('Tip'));
    fireEvent.click(screen.getByText('$1'));
    // Should show the spinner
    expect(screen.getByText('⚡')).toBeDefined();
  });

  it('should show "Tipped" state on successful tip', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    render(<QuickTipButton postId="test-1" />);
    fireEvent.click(screen.getByText('Tip'));
    fireEvent.click(screen.getByText('$1'));

    await waitFor(() => {
      expect(screen.getByText('Tipped')).toBeDefined();
    });
  });

  it('should call onOpenModal when "More methods" is clicked', () => {
    const onOpenModal = vi.fn();
    render(<QuickTipButton postId="test-1" onOpenModal={onOpenModal} />);
    fireEvent.click(screen.getByText('Tip'));
    fireEvent.click(screen.getByText('More methods'));
    expect(onOpenModal).toHaveBeenCalledTimes(1);
  });

  it('should show tip count when tipCount > 0', () => {
    render(<QuickTipButton postId="test-1" tipCount={42} />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('should not show tip count when tipCount is 0', () => {
    render(<QuickTipButton postId="test-1" tipCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('should show currency label based on defaultCurrency prop', () => {
    render(<QuickTipButton postId="test-1" defaultCurrency="sol" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Solana (SOL)')).toBeDefined();
  });

  it('should show Ethereum label for eth currency', () => {
    render(<QuickTipButton postId="test-1" defaultCurrency="eth" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Ethereum (ETH)')).toBeDefined();
  });

  it('should derive currency from connectedProtocol', () => {
    render(<QuickTipButton postId="test-1" connectedProtocol="solana" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Solana (SOL)')).toBeDefined();
  });

  it('should default to ETH when no currency info is available', () => {
    render(<QuickTipButton postId="test-1" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Ethereum (ETH)')).toBeDefined();
  });

  it('should have accessible aria-label', () => {
    render(<QuickTipButton postId="test-1" authorAddress="0x1234" />);
    expect(screen.getByLabelText('Tip author')).toBeDefined();
  });

  // ─── Multi-currency tipping tests ─────────────────────────────

  it('should show Base (ETH) label for base currency', () => {
    render(<QuickTipButton postId="test-1" defaultCurrency="base" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Base (ETH)')).toBeDefined();
  });

  it('should show Polygon (MATIC) label for matic currency', () => {
    render(<QuickTipButton postId="test-1" defaultCurrency="matic" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Polygon (MATIC)')).toBeDefined();
  });

  it('should show Bitcoin (BTC) label for btc currency', () => {
    render(<QuickTipButton postId="test-1" defaultCurrency="btc" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Bitcoin (Lightning) (BTC)')).toBeDefined();
  });

  it('should show USD Coin (USDC) label for usdc currency', () => {
    render(<QuickTipButton postId="test-1" defaultCurrency="usdc" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('USD Coin (USDC)')).toBeDefined();
  });

  it('should derive correct currency from farcaster protocol', () => {
    render(<QuickTipButton postId="test-1" connectedProtocol="farcaster" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Base (ETH)')).toBeDefined();
  });

  it('should derive correct currency from lens protocol', () => {
    render(<QuickTipButton postId="test-1" connectedProtocol="lens" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Polygon (MATIC)')).toBeDefined();
  });

  it('should derive correct currency from nostr protocol', () => {
    render(<QuickTipButton postId="test-1" connectedProtocol="nostr" />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('Bitcoin (Lightning) (BTC)')).toBeDefined();
  });

  // ─── Tip button cycle (full state machine) ────────────────────

  it('should cycle through states: Tip → amounts → spinner → Tipped → back to Tip', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    render(<QuickTipButton postId="test-1" />);
    // 1. Initial: Tip label visible, no Tipped
    expect(screen.getByText('Tip')).toBeDefined();
    expect(screen.queryByText('Tipped')).toBeNull();

    // 2. Click Tip → show amounts
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('$1')).toBeDefined();
    expect(screen.getByText('$5')).toBeDefined();
    expect(screen.getByText('$10')).toBeDefined();

    // 3. Click amount → show Tipped
    fireEvent.click(screen.getByText('$1'));
    await waitFor(() => {
      expect(screen.getByText('Tipped')).toBeDefined();
    });

    // 4. After 2s, returns to Tip (via setTimeout)
    await waitFor(
      () => {
        expect(screen.queryByText('Tipped')).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  // ─── TipModal integration ──────────────────────────────────────

  it('should hide amounts dropdown when "More methods" is clicked (TipModal)', () => {
    const onOpenModal = vi.fn();
    render(<QuickTipButton postId="test-1" onOpenModal={onOpenModal} />);
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('$1')).toBeDefined();
    // Click "More methods"
    fireEvent.click(screen.getByText('More methods'));
    // Dropdown should be hidden
    expect(screen.queryByText('$1')).toBeNull();
    expect(onOpenModal).toHaveBeenCalledTimes(1);
  });

  it('should send correct POST body on tip', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    render(<QuickTipButton postId="test-1" defaultCurrency="sol" />);
    fireEvent.click(screen.getByText('Tip'));
    fireEvent.click(screen.getByText('$5'));

    await waitFor(() => {
      expect(screen.getByText('Tipped')).toBeDefined();
    });

    // Check fetch was called with correct tip payload
    expect(mockFetch).toHaveBeenCalledWith('/api/tip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: 'test-1', amount: 5, currency: 'usd', method: 'sol' }),
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it('should handle empty tipAmounts gracefully', () => {
    render(<QuickTipButton postId="test-1" tipAmounts={[]} />);
    fireEvent.click(screen.getByText('Tip'));
    // No amount buttons should render
    expect(screen.queryByText('$1')).toBeNull();
    expect(screen.queryByText('$5')).toBeNull();
  });

  it('should toggle amounts dropdown on re-click', () => {
    render(<QuickTipButton postId="test-1" />);
    // Open
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.getByText('$1')).toBeDefined();
    // Close
    fireEvent.click(screen.getByText('Tip'));
    expect(screen.queryByText('$1')).toBeNull();
  });
});
