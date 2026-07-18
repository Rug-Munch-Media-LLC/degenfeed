/**
 * @degenfeed/ui — EmptyState component tests
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

afterEach(() => {
  cleanup();
});

describe('EmptyState', () => {
  it('should render the title', () => {
    render(<EmptyState title="No posts found" />);
    expect(screen.getByText('No posts found')).toBeDefined();
  });

  it('should render description when provided', () => {
    render(<EmptyState title="Empty" description="There is nothing here yet." />);
    expect(screen.getByText('There is nothing here yet.')).toBeDefined();
  });

  it('should not render description when omitted', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('should render icon when provided', () => {
    const { container } = render(<EmptyState title="Empty" icon="🚀" />);
    expect(container.querySelector('.empty-state-icon')).toBeDefined();
    expect(screen.getByText('🚀')).toBeDefined();
  });

  it('should render iconElement instead of icon when both provided', () => {
    render(
      <EmptyState
        title="Empty"
        icon="🚀"
        iconElement={<div data-testid="custom-icon">Custom</div>}
      />,
    );
    expect(screen.getByTestId('custom-icon')).toBeDefined();
  });

  it('should render action button and handle click', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={<button type="button" onClick={handleClick}>Create Post</button>}
      />,
    );
    const button = screen.getByText('Create Post');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render secondary action when provided', () => {
    render(
      <EmptyState
        title="Empty"
        action={<button type="button">Primary</button>}
        secondaryAction={<button type="button">Secondary</button>}
      />,
    );
    expect(screen.getByText('Secondary')).toBeDefined();
  });

  it('should use compact mode with reduced padding', () => {
    const { container } = render(<EmptyState title="Empty" compact />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('py-8');
  });

  it('should use non-compact mode by default with larger padding', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('py-16');
  });

  it('should have role="status" for accessibility', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole('status')).toBeDefined();
  });
});

describe('EmptyRow', () => {
  it('should render default message', async () => {
    const { EmptyRow } = await import('./EmptyState');
    const { container } = render(
      <table>
        <tbody>
          <EmptyRow />
        </tbody>
      </table>,
    );
    expect(screen.getByText('No data')).toBeDefined();
  });

  it('should render custom message', async () => {
    const { EmptyRow } = await import('./EmptyState');
    render(
      <table>
        <tbody>
          <EmptyRow message="No results found" colSpan={3} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('No results found')).toBeDefined();
  });

  it('should have role="status"', async () => {
    const { EmptyRow } = await import('./EmptyState');
    render(
      <table>
        <tbody>
          <EmptyRow />
        </tbody>
      </table>,
    );
    expect(screen.getByRole('status')).toBeDefined();
  });
});
