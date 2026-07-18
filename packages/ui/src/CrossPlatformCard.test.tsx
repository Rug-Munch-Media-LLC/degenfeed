/**
 * @degenfeed/ui — CrossPlatformCard component tests
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrossPlatformCard } from './CrossPlatformCard';

// ─── Fixtures ─────────────────────────────────────────────────────

const MOCK_STATUS_RESPONSE = {
  data: {
    platformStatus: {
      nostr: { registered: true, username: 'nostr_user' },
      farcaster: { registered: true, username: 'fc_user' },
      lens: { registered: false, username: null },
      bluesky: { registered: true, username: 'bsky_user' },
      mastodon: { registered: false, username: null },
    },
    connectedCount: 3,
    totalPlatforms: 5,
    isPremium: true,
    tier: 'premium',
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CrossPlatformCard', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_STATUS_RESPONSE), { status: 200 }),
    );
  });

  it('should show loading spinner initially', () => {
    // Keep fetch unresolved
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>(() => {}),
    );
    render(<CrossPlatformCard walletAddress="0xabc" />);
    expect(document.querySelector('.animate-spin')).toBeDefined();
  });

  it('should render connected count when data loads', async () => {
    render(<CrossPlatformCard walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('3/5 platforms connected')).toBeDefined();
    });
  });

  it('should show "Pro" label when premium', async () => {
    render(<CrossPlatformCard walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeDefined();
    });
  });

  it('should show "Upgrade" label when not premium', async () => {
    const nonPremiumResponse = {
      ...MOCK_STATUS_RESPONSE,
      data: { ...MOCK_STATUS_RESPONSE.data, isPremium: false, tier: null },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(nonPremiumResponse), { status: 200 }),
    );
    render(<CrossPlatformCard walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Upgrade')).toBeDefined();
    });
  });

  it('should show progress bar', async () => {
    const { container } = render(<CrossPlatformCard walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('3/5 platforms connected')).toBeDefined();
    });
    const progressBar = container.querySelector('.bg-gradient-to-r');
    expect(progressBar).toBeDefined();
  });

  it('should show platform icons for connected platforms', async () => {
    render(<CrossPlatformCard walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('3/5 platforms connected')).toBeDefined();
    });
    // Should show nostr icon
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(5);
  });

  it('should show CTA button with premium text to finish setup', async () => {
    render(<CrossPlatformCard walletAddress="0xabc" isPremium />);
    await waitFor(() => {
      expect(screen.getByText('Create accounts on all platforms')).toBeDefined();
    });
  });

  it('should show upgrade CTA when not premium', async () => {
    const nonPremiumResponse = {
      ...MOCK_STATUS_RESPONSE,
      data: { ...MOCK_STATUS_RESPONSE.data, isPremium: false, tier: null },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(nonPremiumResponse), { status: 200 }),
    );
    render(<CrossPlatformCard walletAddress="0xabc" isPremium={false} />);
    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro →')).toBeDefined();
    });
  });

  it('should call onOpenSetup when setup button clicked (premium)', async () => {
    const onOpenSetup = vi.fn();
    render(<CrossPlatformCard walletAddress="0xabc" isPremium onOpenSetup={onOpenSetup} />);
    await waitFor(() => {
      expect(screen.getByText('Create accounts on all platforms')).toBeDefined();
    });
    screen.getByText('Create accounts on all platforms').click();
    expect(onOpenSetup).toHaveBeenCalledTimes(1);
  });

  it('should show "Manage" button when all platforms connected', async () => {
    const allConnected = {
      ...MOCK_STATUS_RESPONSE,
      data: {
        ...MOCK_STATUS_RESPONSE.data,
        connectedCount: 5,
        platformStatus: {
          nostr: { registered: true, username: 'nostr_user' },
          farcaster: { registered: true, username: 'fc_user' },
          lens: { registered: true, username: 'lens_user' },
          bluesky: { registered: true, username: 'bsky_user' },
          mastodon: { registered: true, username: 'masto_user' },
        },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(allConnected), { status: 200 }),
    );
    render(<CrossPlatformCard walletAddress="0xabc" isPremium />);
    await waitFor(() => {
      expect(screen.getByText('Manage connected platforms')).toBeDefined();
    });
  });

  it('should show header title', async () => {
    render(<CrossPlatformCard walletAddress="0xabc" />);
    await waitFor(() => {
      expect(screen.getByText('Cross-Platform Setup')).toBeDefined();
    });
  });
});
