/**
 * @degenfeed/web — AuthProvider tests
 *
 * Covers: context provision, identity loading, protocol mapping,
 * sign-out flow, pending Mastodon identity processing,
 * error rendering (useAuth outside provider), and wallet-only detection.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';

// ─── Mock external dependencies ──────────────────────────────────────

import type { StoredIdentity } from '@degenfeed/storage';

vi.mock('@degenfeed/storage', () => ({
  getAllIdentities: vi.fn(),
  getPrimaryIdentity: vi.fn(),
  clearAllSessions: vi.fn().mockResolvedValue(undefined),
  deleteIdentity: vi.fn().mockResolvedValue(undefined),
  saveIdentity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@degenfeed/auth', () => ({
  buildIdentityRecord: vi.fn().mockResolvedValue({
    id: 'mastodon:42',
    protocol: 'mastodon',
    publicId: '42',
    handle: '@test@social.degenfeed.xyz',
    displayName: 'Test User',
    avatarUrl: '',
    linkedAt: Date.now(),
  }),
}));

// Mock UI modals — render nothing but don't crash
vi.mock('@degenfeed/ui', () => ({
  ComposeModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="compose-modal" /> : null,
  SignInModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="signin-modal" /> : null,
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../hooks/useWalletSignIn', () => ({
  useWalletSignIn: () => ({
    address: undefined,
    isConnected: false,
    signingIn: false,
    error: null,
    signInWithEthereum: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('../hooks/useSolanaSignIn', () => ({
  useSolanaSignIn: () => ({
    available: false,
    signingIn: false,
    error: null,
    signInWithSolana: vi.fn().mockRejectedValue(new Error('No Solana wallet')),
  }),
}));

vi.mock('../components/Web3Provider', () => ({
  useWeb3: () => ({
    account: undefined,
    isConnected: false,
    connect: vi.fn().mockRejectedValue(new Error('No wallet')),
    signMessage: vi.fn(),
    chainId: undefined,
  }),
}));

vi.mock('../lib/nostr', () => ({
  engageNostr: vi.fn().mockResolvedValue({ ok: true }),
  publishNoteToNostr: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
  Toast: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// ─── Storage mock helpers ────────────────────────────────────────────

import * as storage from '@degenfeed/storage';

interface StubIdentity {
  id: string;
  protocol: string;
  publicId: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
  linkedAt?: number;
  verified?: boolean;
  keys?: Record<string, string>;
}

function makeIdentity(overrides: Partial<StubIdentity> & { id: string; protocol: string }): StubIdentity {
  return {
    publicId: overrides.id,
    handle: `@${overrides.id}`,
    displayName: `User ${overrides.id}`,
    avatarUrl: '',
    linkedAt: Date.now(),
    verified: false,
    keys: {},
    ...overrides,
  };
}

function mockStorageIdentities(identities: StoredIdentity[]) {
  vi.mocked(storage.getAllIdentities).mockResolvedValue(identities);
  vi.mocked(storage.getPrimaryIdentity).mockResolvedValue(identities[0] ?? undefined);
}

// ─── Consumer helper ─────────────────────────────────────────────────

function TestConsumer({ onReady }: { onReady?: (val: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  // Signal that the context was read
  if (onReady && auth.ready) onReady(auth);
  return (
    <div>
      <span data-testid="ready">{String(auth.ready)}</span>
      <span data-testid="wallet">{auth.walletAddress ?? 'none'}</span>
      <span data-testid="protocols">{JSON.stringify(auth.signedInProtocols)}</span>
      <span data-testid="primary">{auth.primaryIdentity?.handle ?? 'none'}</span>
      <span data-testid="linked-count">{auth.linkedIdentities.length}</span>
      <span data-testid="is-wallet-only">{String(auth.isWalletOnly)}</span>
      <span data-testid="nostr-pubid">{auth.nostrPublicId ?? 'none'}</span>
      {auth.ready && (
        <button data-testid="sign-out-btn" onClick={() => auth.signOut()} type="button">
          Sign Out
        </button>
      )}
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AuthProvider', () => {
  it('should render children', () => {
    render(
      <AuthProvider>
        <div data-testid="child">hello</div>
      </AuthProvider>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen.getByText('hello')).toBeDefined();
  });

  it('should provide a context with default values before initialisation', async () => {
    mockStorageIdentities([]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Before the async init completes, ready should be false
    expect(screen.getByTestId('ready').textContent).toBe('false');
  });

  it('should load identities and mark ready after mount', async () => {
    const nostrIdent = makeIdentity({ id: 'npub1abc', protocol: 'nostr', keys: { accessToken: 'tok1' } });
    mockStorageIdentities([nostrIdent]);

    let captured: ReturnType<typeof useAuth> | undefined;
    render(
      <AuthProvider>
        <TestConsumer onReady={(v) => { captured = v; }} />
      </AuthProvider>,
    );

    // Wait for the init effect to fire and state to settle
    const readyEl = await screen.findByTestId('ready');
    expect(readyEl.textContent).toBe('true');

    expect(captured).toBeDefined();
    expect(captured!.walletAddress).toBe('npub1abc');
    expect(captured!.signedInProtocols).toEqual({ nostr: true });
    expect(captured!.primaryIdentity?.handle).toBe('@npub1abc');
  });

  it('should map multiple identities to signedInProtocols', async () => {
    const identities = [
      makeIdentity({ id: 'npub1abc', protocol: 'nostr', keys: { accessToken: 'tok_n' } }),
      makeIdentity({ id: '0xdef', protocol: 'ethereum', keys: { accessToken: 'tok_e' } }),
    ];
    mockStorageIdentities(identities);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const protocolsEl = await screen.findByTestId('protocols');
    const protocols = JSON.parse(protocolsEl.textContent ?? '{}');
    expect(protocols).toEqual({ nostr: true, ethereum: true });
  });

  it('should set walletAddress from ethereum/solana identity', async () => {
    const ethIdent = makeIdentity({ id: '0xabc123', protocol: 'ethereum' });
    mockStorageIdentities([ethIdent]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const walletEl = await screen.findByTestId('wallet');
    expect(walletEl.textContent).toBe('0xabc123');
  });

  it('should detect wallet-only state (ETH primary, no linked identities)', async () => {
    const ethIdent = makeIdentity({ id: '0xabc', protocol: 'ethereum' });
    mockStorageIdentities([ethIdent]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const walletOnlyEl = await screen.findByTestId('is-wallet-only');
    expect(walletOnlyEl.textContent).toBe('true');
  });

  it('should detect non-wallet-only state when linked identities exist', async () => {
    const identities = [
      makeIdentity({ id: '0xabc', protocol: 'ethereum' }),
      makeIdentity({ id: 'npub1def', protocol: 'nostr' }),
    ];
    mockStorageIdentities(identities);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const walletOnlyEl = await screen.findByTestId('is-wallet-only');
    expect(walletOnlyEl.textContent).toBe('false');
  });

  it('should set nostrPublicId from nostr identity', async () => {
    const nostrIdent = makeIdentity({ id: 'npub1xyz', protocol: 'nostr' });
    mockStorageIdentities([nostrIdent]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const nostrEl = await screen.findByTestId('nostr-pubid');
    expect(nostrEl.textContent).toBe('npub1xyz');
  });

  it('should clear all state on sign-out', async () => {
    const identities = [
      makeIdentity({ id: 'npub1abc', protocol: 'nostr' }),
      makeIdentity({ id: '0xdef', protocol: 'ethereum' }),
    ];
    mockStorageIdentities(identities);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Wait for ready
    await screen.findByTestId('ready');

    // Click sign out
    const signOutBtn = screen.getByTestId('sign-out-btn');
    signOutBtn.click();

    // After sign-out: wallet should be undefined, protocols empty
    const walletEl = screen.getByTestId('wallet');
    const protocolsEl = screen.getByTestId('protocols');

    // Wait for state to propagate
    await waitFor(() => {
      expect(walletEl.textContent).toBe('none');
      expect(JSON.parse(protocolsEl.textContent ?? '{}')).toEqual({});
    });

    // Storage deleteIdentity should have been called for each identity
    expect(storage.deleteIdentity).toHaveBeenCalledTimes(2);
    expect(storage.clearAllSessions).toHaveBeenCalledTimes(1);
  });

  it('should process pending Mastodon identity from localStorage', async () => {
    mockStorageIdentities([]);

    // Set up a pending Mastodon identity in localStorage
    const pending = {
      protocol: 'mastodon',
      accessToken: 'masto_token_123',
      profile: {
        id: '42',
        acct: 'testuser@social.degenfeed.xyz',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.png',
      },
    };
    localStorage.setItem('degenfeed_pending_identity', JSON.stringify(pending));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // After init, the pending identity should be processed
    await screen.findByTestId('ready');

    // saveIdentity should have been called (from buildIdentityRecord mock)
    expect(storage.saveIdentity).toHaveBeenCalledTimes(1);

    // The pending key should be removed
    expect(localStorage.getItem('degenfeed_pending_identity')).toBeNull();
  });

  it('should ignore non-Mastodon pending identities', async () => {
    mockStorageIdentities([]);

    const pending = {
      protocol: 'nostr',
      accessToken: 'tok',
      profile: { id: '1', acct: 'user' },
    };
    localStorage.setItem('degenfeed_pending_identity', JSON.stringify(pending));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await screen.findByTestId('ready');

    // saveIdentity should NOT have been called for non-Mastodon protocol
    expect(storage.saveIdentity).not.toHaveBeenCalled();
  });

  it('should show primary and linked identity counts correctly', async () => {
    const identities = [
      makeIdentity({ id: 'primary1', protocol: 'nostr' }),
      makeIdentity({ id: 'linked1', protocol: 'farcaster' }),
      makeIdentity({ id: 'linked2', protocol: 'bluesky' }),
    ];
    mockStorageIdentities(identities);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const primaryEl = await screen.findByTestId('primary');
    const linkedCountEl = screen.getByTestId('linked-count');

    expect(primaryEl.textContent).toBe('@primary1');
    expect(linkedCountEl.textContent).toBe('2');
  });
});

// ─── useAuth standalone (no provider) ─────────────────────────────────

describe('useAuth without AuthProvider', () => {
  it('should throw a descriptive error when used outside AuthProvider', () => {
    // Suppress console.error from React error boundary
    const original = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    console.error = original;
  });
});
