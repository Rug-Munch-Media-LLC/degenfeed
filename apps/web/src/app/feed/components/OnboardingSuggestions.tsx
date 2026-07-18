'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { EmptyState } from '../../../components/EmptyState';

interface SuggestedFollow {
  id: string;
  displayName: string;
  handle: string;
  protocol: string;
  avatarUrl?: string;
  reason: string;
}

const SUGGESTED_FOLLOWS: SuggestedFollow[] = [
  {
    id: 'npub1xrwgxk5',
    displayName: 'PabloF7z',
    handle: 'npub1x...rwgk',
    protocol: 'nostr',
    reason: 'Top crypto influencer on Nostr',
  },
  {
    id: '0x6b0b3d0e',
    displayName: 'dwr.eth',
    handle: '@dwr',
    protocol: 'farcaster',
    reason: 'Farcaster co-founder',
  },
  {
    id: 'did:plc:oc6g',
    displayName: 'jack.bsky.social',
    handle: '@jack.bsky',
    protocol: 'bluesky',
    reason: 'AT Protocol contributor',
  },
  {
    id: '0x01a5b8',
    displayName: 'Stani.lens',
    handle: '@stani',
    protocol: 'lens',
    reason: 'Lens Protocol founder',
  },
  {
    id: 'npub1ydr8q0w',
    displayName: 'PrezJeff',
    handle: 'npub1y...8q0w',
    protocol: 'nostr',
    reason: 'Bitcoin & Nostr OG',
  },
  {
    id: '0x182b8a',
    displayName: 'balajis',
    handle: '@balajis',
    protocol: 'farcaster',
    reason: 'Tech investor & visionary',
  },
];

/**
 * Onboarding suggestion card shown to new users with no followers / empty feed.
 * Displays a curated list of suggested accounts to follow, organized by protocol.
 */
export function OnboardingSuggestions() {
  const { openSignIn, ready } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [animatingFollow, setAnimatingFollow] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissedVal = localStorage.getItem('degenfeed_onboarding_dismissed');
    if (dismissedVal === 'true') setDismissed(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem('degenfeed_onboarding_dismissed', 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const handleFollow = useCallback(
    async (suggestion: SuggestedFollow) => {
      if (!ready) {
        openSignIn();
        return;
      }

      if (following.has(suggestion.id)) return;

      setAnimatingFollow(suggestion.id);

      try {
        const { saveFollow } = await import('@degenfeed/storage');
        await saveFollow({
          identityId: 'self',
          targetId: suggestion.id,
          targetProtocol: suggestion.protocol,
          targetHandle: suggestion.handle,
          followedAt: Date.now(),
        });
        setFollowing((prev) => new Set([...prev, suggestion.id]));
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'success', message: `Following ${suggestion.displayName}` },
          }),
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'error', message: 'Failed to follow. Try again.' },
          }),
        );
      } finally {
        setTimeout(() => setAnimatingFollow(null), 500);
      }
    },
    [following, ready, openSignIn],
  );

  if (dismissed) return null;

  return (
    <div className="feed-item-enter border-b border-[var(--color-glass-border)]">
      <EmptyState
        icon="🌟"
        title="Welcome to DegenFeed!"
        description="Your unified feed for Nostr, Farcaster, Lens, Bluesky & more. Follow some accounts to get started."
        action={
          <div className="w-full max-w-md space-y-3">
            {/* Suggested follows */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_FOLLOWS.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="group flex items-center gap-2.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2.5 transition-all hover:border-degen-500/30 hover:shadow-sm"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background:
                        suggestion.protocol === 'nostr'
                          ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                          : suggestion.protocol === 'farcaster'
                            ? 'linear-gradient(135deg, #8a63d2, #6b46c1)'
                            : suggestion.protocol === 'bluesky'
                              ? 'linear-gradient(135deg, #1185fe, #0a5cbc)'
                              : 'linear-gradient(135deg, #abfe2c, #7ccf1a)',
                    }}
                    aria-hidden="true"
                  >
                    {suggestion.displayName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--color-fg)] truncate">
                      {suggestion.displayName}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)] truncate">
                      {suggestion.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFollow(suggestion)}
                    disabled={following.has(suggestion.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all ${
                      following.has(suggestion.id)
                        ? 'bg-degen-500/20 text-degen-400'
                        : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 active:scale-95'
                    } ${animatingFollow === suggestion.id ? 'animate-pop' : ''}`}
                    aria-label={
                      following.has(suggestion.id)
                        ? `Following ${suggestion.displayName}`
                        : `Follow ${suggestion.displayName}`
                    }
                  >
                    {following.has(suggestion.id) ? '✓' : '+'}
                  </button>
                </div>
              ))}
            </div>

            {/* Explore link */}
            <a
              href="/discover"
              className="block text-center text-xs text-degen-500 hover:text-degen-400 transition-colors"
            >
              Discover more creators →
            </a>
          </div>
        }
        secondaryAction={
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            I&apos;ll explore on my own
          </button>
        }
      />
    </div>
  );
}
