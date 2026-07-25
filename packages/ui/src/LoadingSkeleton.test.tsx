/**
 * @degenfeed/ui — LoadingSkeleton & ErrorState component tests
 *
 * Covers loading skeleton variants and error state rendering.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState';
import { CardSkeleton } from './LoadingSkeleton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CardSkeleton (LoadingSkeleton)', () => {
  it('renders the specified number of skeleton card containers', () => {
    const { container } = render(<CardSkeleton count={3} />);
    // Each card is a div with border-b class, count * (1 avatar + lines pulse elements)
    const cardContainers = container.querySelectorAll('div.border-b');
    expect(cardContainers.length).toBe(3);
  });

  it('renders with accessible loading label', () => {
    render(<CardSkeleton count={2} />);
    expect(screen.getByLabelText('Loading content')).toBeDefined();
  });

  it('renders avatar skeletons when avatar prop is true (default)', () => {
    const { container } = render(<CardSkeleton count={1} avatar />);
    // Avatar = rounded-full pulse
    const avatars = container.querySelectorAll('.rounded-full');
    expect(avatars.length).toBeGreaterThan(0);
  });

  it('renders line skeletons when lines > 0', () => {
    const { container } = render(<CardSkeleton count={1} lines={3} />);
    const shimmerElements = container.querySelectorAll('.skeleton-shimmer');
    // 1 avatar + 3 lines = 4 pulse elements
    expect(shimmerElements.length).toBeGreaterThanOrEqual(3);
  });

  it('renders zero cards when count is 0', () => {
    const { container } = render(<CardSkeleton count={0} />);
    const cardContainers = container.querySelectorAll('div.border-b');
    expect(cardContainers.length).toBe(0);
  });
});

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState message="Something broke" />);
    expect(screen.getByText('Something broke')).toBeDefined();
  });

  it('renders default message when none provided', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders retry button and calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Oops" onRetry={onRetry} />);
    const retryButton = screen.getByText('Try again');
    expect(retryButton).toBeDefined();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
