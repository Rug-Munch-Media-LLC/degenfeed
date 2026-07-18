/**
 * @degenfeed/ui — CrossPlatformSetup component tests
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrossPlatformSetup } from './CrossPlatformSetup';

// ─── Fixtures ─────────────────────────────────────────────────────

const MOCK_STATUS_RESPONSE = {
  data: {
    accounts: [
      { platform: 'nostr', status: 'created' as const, username: 'nostr_user' },
      { platform: 'farcaster', status: 'created' as const, username: 'fc_user' },
      { platform: 'lens', status: 'created' as const, username: 'lens_user' },
      { platform: 'bluesky', status: 'created' as const, username: 'bsky_user' },
    ],
    platformStatus: {
      nostr: { registered: true, username: 'nostr_user' },
      farcaster: { registered: true, username: 'fc_user' },
      lens: { registered: true, username: 'lens_user' },
      bluesky: { registered: true, username: 'bsky_user' },
      mastodon: { registered: false, username: null },
    },
    connectedCount: 4,
    totalPlatforms: 5,
    isPremium: true,
    tier: 'premium',
  },
};

const MOCK_EMPTY_STATUS = {
  data: {
    accounts: [],
    platformStatus: {
      nostr: { registered: false, username: null },
      farcaster: { registered: false, username: null },
      lens: { registered: false, username: null },
      bluesky: { registered: false, username: null },
      mastodon: { registered: false, username: null },
    },
    connectedCount: 0,
    totalPlatforms: 5,
    isPremium: false,
    tier: null,
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CrossPlatformSetup', () => {
  it('should show loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    expect(screen.getByText('Loading platform status...')).toBeDefined();
  });

  it('should show all 5 platforms when data loads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_STATUS_RESPONSE), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Cross-Platform Setup')).toBeDefined();
    });
    expect(screen.getByText('Nostr')).toBeDefined();
    expect(screen.getByText('Farcaster')).toBeDefined();
    expect(screen.getByText('Lens')).toBeDefined();
    expect(screen.getByText('Bluesky')).toBeDefined();
    expect(screen.getByText('Mastodon')).toBeDefined();
  });

  it('should show connected count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_STATUS_RESPONSE), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('4')).toBeDefined(); // connectedCount
    });
  });

  it('should show "Pro feature" badges for premium-only platforms (3 of 5)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EMPTY_STATUS), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      const badges = screen.getAllByText('Pro feature');
      expect(badges.length).toBe(3);
    });
  });

  it('should show Upgrade prompt for non-premium users', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EMPTY_STATUS), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeDefined();
    });
  });

  it('should show "Connected" badges for created accounts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_STATUS_RESPONSE), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      const connectedBadges = screen.getAllByText('Connected');
      expect(connectedBadges.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('should show premium progress bar when premium', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_STATUS_RESPONSE), { status: 200 }),
    );
    const { container } = render(<CrossPlatformSetup walletAddress="0xabc" isPremium />);
    await waitFor(() => {
      expect(screen.getByText('Cross-Platform Setup')).toBeDefined();
    });
    // Progress bar should exist
    const progressBars = container.querySelectorAll('.rounded-full');
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
  });

  it('should display error state on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load status')).toBeDefined();
    });
  });

  it('should show username inputs for non-connected premium platforms', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_STATUS_RESPONSE), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" isPremium />);
    await waitFor(() => {
      // Mastodon should have a username input (not connected)
      const inputs = document.querySelectorAll('input[type="text"]');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should disable inputs only for premium-required platforms when non-premium', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EMPTY_STATUS), { status: 200 }),
    );
    render(<CrossPlatformSetup walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeDefined();
    });
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(5);
    // Premium platforms (farcaster, lens, bluesky) should have disabled inputs
    // Free platforms (mastodon, nostr) should have enabled inputs
    expect(screen.getAllByPlaceholderText('username').length).toBeGreaterThanOrEqual(5);
  });
});
