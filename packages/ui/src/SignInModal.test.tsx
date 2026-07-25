/**
 * @degenfeed/ui — SignInModal component tests
 *
 * Covers rendering, wallet connection, protocol selection,
 * modal open/close behavior, and accessibility.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignInModal, type SignInModalProps } from './SignInModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSignInModal(props: Partial<SignInModalProps> = {}) {
  const defaults: SignInModalProps = {
    open: true,
    onClose: vi.fn(),
    onSignIn: vi.fn(),
  };
  return render(<SignInModal {...defaults} {...props} />);
}

describe('SignInModal', () => {
  // ─── Modal visibility ──────────────────────────────────────────────

  it('renders when open is true', () => {
    renderSignInModal({ open: true });
    expect(screen.getByText('Sign in to DegenFeed')).toBeDefined();
  });

  it('returns null when open is false', () => {
    const { container } = renderSignInModal({ open: false });
    expect(container.innerHTML).toBe('');
  });

  it('has accessible dialog role and aria-label', () => {
    renderSignInModal({ open: true });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-label')).toBe('Sign in to DegenFeed');
  });

  // ─── Protocol rendering ────────────────────────────────────────────

  it('renders OAuth provider buttons (Google, Twitter, GitHub, Discord, Farcaster, Telegram)', () => {
    renderSignInModal({ open: true });
    expect(screen.getByText('Google')).toBeDefined();
    expect(screen.getByText('Twitter / X')).toBeDefined();
    expect(screen.getByText('GitHub')).toBeDefined();
    expect(screen.getByText('Discord')).toBeDefined();
    expect(screen.getByText('Farcaster')).toBeDefined();
    expect(screen.getByText('Telegram')).toBeDefined();
  });

  it('renders protocol options (Mastodon, Bluesky, Nostr, Lens, Reddit, Threads)', () => {
    renderSignInModal({ open: true });
    expect(screen.getByText('Mastodon / GoToSocial')).toBeDefined();
    expect(screen.getByText('Bluesky')).toBeDefined();
    expect(screen.getByText('Nostr')).toBeDefined();
    expect(screen.getByText('Lens')).toBeDefined();
    expect(screen.getByText('Reddit')).toBeDefined();
    expect(screen.getByText('Threads')).toBeDefined();
  });

  // ─── Wallet section ─────────────────────────────────────────────────

  it('renders wallet sign-in section', () => {
    renderSignInModal({ open: true });
    expect(screen.getByText('Connect a wallet')).toBeDefined();
  });

  it('renders wallet button for connecting Ethereum / Solana', () => {
    renderSignInModal({
      open: true,
      availableWallets: [
        { id: 'metamask', label: 'MetaMask', icon: '🦊', color: '#f6851b', detected: true },
        { id: 'phantom', label: 'Phantom', icon: '👻', color: '#ab9ff2', detected: true },
      ],
    });
    expect(screen.getByText('MetaMask')).toBeDefined();
    expect(screen.getByText('Phantom')).toBeDefined();
  });

  it('shows wallet address when already connected', () => {
    renderSignInModal({
      open: true,
      walletAddress: '0x1234...5678',
    });
    // The wallet component should show the truncated address
    expect(screen.getByText(/0x1234.*5678/)).toBeDefined();
  });

  // ─── Browse anonymously ─────────────────────────────────────────────

  it('renders browse anonymously button', () => {
    renderSignInModal({ open: true });
    expect(screen.getByText(/Browse Anonymously/)).toBeDefined();
  });

  it('calls onClose when Browse Anonymously is clicked', () => {
    const onClose = vi.fn();
    renderSignInModal({ open: true, onClose });
    fireEvent.click(screen.getByText(/Browse Anonymously/));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── Protocol selection flow ────────────────────────────────────────

  it('shows protocol-specific form after selecting a protocol', () => {
    renderSignInModal({ open: true });
    fireEvent.click(screen.getByText('Nostr'));
    expect(screen.getByText('Sign in with Nostr')).toBeDefined();
  });

  it('shows back button to return to protocol list', () => {
    renderSignInModal({ open: true });
    fireEvent.click(screen.getByText('Nostr'));
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('returns to protocol list when back is clicked', () => {
    renderSignInModal({ open: true });
    fireEvent.click(screen.getByText('Nostr'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Sign in to DegenFeed')).toBeDefined();
  });

  // ─── Close button behavior ──────────────────────────────────────────

  it('calls onClose when X close button is clicked', () => {
    const onClose = vi.fn();
    renderSignInModal({ open: true, onClose });
    const closeButtons = screen.getAllByLabelText('Close');
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking backdrop overlay', () => {
    const onClose = vi.fn();
    renderSignInModal({ open: true, onClose });
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderSignInModal({ open: true, onClose });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // ─── Footer links ──────────────────────────────────────────────────

  it('renders Terms and Privacy links', () => {
    renderSignInModal({ open: true });
    expect(screen.getByText('Terms')).toBeDefined();
    expect(screen.getByText('Privacy')).toBeDefined();
  });
});
