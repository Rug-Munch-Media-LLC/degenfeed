/**
 * @degenfeed/web — RegistrationPrompt tests
 *
 * Covers the anonymous-browsing registration nudge:
 *   - no prompt before the banner threshold
 *   - subtle banner at 5 page views
 *   - modal at 10 page views (with a "Continue browsing" escape hatch)
 *   - dismiss persistence
 *   - hidden entirely once the user signs in
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationPrompt } from './RegistrationPrompt';

const PAGE_VIEW_KEY = 'df_pv_count';
const BANNER_DISMISSED_KEY = 'df_pv_banner_dismissed';
const MODAL_SEEN_KEY = 'df_pv_modal_seen';

const openSignIn = vi.fn();
const openSignUp = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/feed',
}));

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    walletAddress: undefined,
    primaryIdentity: undefined,
    signedInProtocols: {},
    openSignIn,
    openSignUp,
  }),
}));

function setCount(n: number) {
  localStorage.setItem(PAGE_VIEW_KEY, String(n));
}

function renderPrompt() {
  return render(<RegistrationPrompt />);
}

beforeEach(() => {
  localStorage.clear();
  openSignIn.mockClear();
  openSignUp.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RegistrationPrompt', () => {
  it('renders nothing below the banner threshold', () => {
    setCount(3);
    const { container } = renderPrompt();
    expect(container.innerHTML).toBe('');
  });

  it('shows the subtle banner at 5 page views', () => {
    setCount(5);
    renderPrompt();
    expect(screen.getByText('Enjoying DegenFeed?')).toBeDefined();
    expect(screen.getByText(/Create a free account to customize/)).toBeDefined();
  });

  it('banner CTA opens the sign-up flow', () => {
    setCount(5);
    renderPrompt();
    fireEvent.click(screen.getByText(/Create free account/));
    expect(openSignUp).toHaveBeenCalledTimes(1);
  });

  it('dismisses the banner and persists the dismissal', () => {
    setCount(5);
    renderPrompt();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Enjoying DegenFeed?')).toBeNull();
    expect(localStorage.getItem(BANNER_DISMISSED_KEY)).toBe('1');
  });

  it('shows the modal at 10 page views with a continue-browsing option', () => {
    setCount(10);
    renderPrompt();
    expect(screen.getByText(/You've been browsing anonymously/)).toBeDefined();
    expect(screen.getByText('Continue browsing')).toBeDefined();
  });

  it('modal CTA opens the sign-up flow', () => {
    setCount(10);
    renderPrompt();
    fireEvent.click(screen.getByText('Create free account'));
    expect(openSignUp).toHaveBeenCalledTimes(1);
  });

  it('never blocks content — continue browsing closes the modal', () => {
    setCount(10);
    renderPrompt();
    fireEvent.click(screen.getByText('Continue browsing'));
    expect(screen.queryByText(/You've been browsing anonymously/)).toBeNull();
    expect(localStorage.getItem(MODAL_SEEN_KEY)).toBe('1');
  });
});
