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
    expect(screen.getByLabelText('Tip 0x1234')).toBeDefined();
  });
});
