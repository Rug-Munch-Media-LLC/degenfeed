'use client';

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { useCallback, useEffect, useState } from 'react';

interface UseCrossProtocolIdentityResult {
  identity: CrossProtocolIdentity | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches the cross-protocol identity profile for a wallet address.
 * Used to display linked protocol badges on PostCard and user profiles.
 *
 * @param walletAddress — EVM or Solana address to look up
 * @param enabled — Whether to actually fetch (defaults to true when address is provided)
 */
export function useCrossProtocolIdentity(
  walletAddress: string | null | undefined,
  enabled = true,
): UseCrossProtocolIdentityResult {
  const [identity, setIdentity] = useState<CrossProtocolIdentity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdentity = useCallback(async () => {
    if (!walletAddress || !enabled) {
      setIdentity(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/identity/profile?wallet=${encodeURIComponent(walletAddress)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { data: CrossProtocolIdentity | null };
      setIdentity(data.data ?? null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [walletAddress, enabled]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  return { identity, loading, error, refresh: fetchIdentity };
}

/**
 * Returns the linked protocol keys that exist on a CrossProtocolIdentity.
 */
export function getLinkedProtocols(
  identity: CrossProtocolIdentity,
): Array<{ protocol: string; handle?: string }> {
  const protocols: Array<{ protocol: string; handle?: string }> = [];

  if (identity.nostr) protocols.push({ protocol: 'nostr', handle: identity.nostr.npub });
  if (identity.farcaster) {
    protocols.push({
      protocol: 'farcaster',
      handle: identity.farcaster.username || String(identity.farcaster.fid),
    });
  }
  if (identity.lens) protocols.push({ protocol: 'lens', handle: identity.lens.handle });
  if (identity.bluesky) protocols.push({ protocol: 'bluesky', handle: identity.bluesky.handle });
  if (identity.mastodon) {
    protocols.push({
      protocol: 'mastodon',
      handle: `${identity.mastodon.handle}@${identity.mastodon.instance}`,
    });
  }
  if (identity.reddit) protocols.push({ protocol: 'reddit', handle: identity.reddit.username });
  if (identity.threads) {
    protocols.push({
      protocol: 'threads',
      handle: identity.threads.username || identity.threads.did || '',
    });
  }
  if (identity.lemmy) {
    protocols.push({
      protocol: 'lemmy',
      handle: identity.lemmy.instance
        ? `${identity.lemmy.username}@${identity.lemmy.instance}`
        : identity.lemmy.username,
    });
  }
  if (identity.rss) protocols.push({ protocol: 'rss', handle: identity.rss.url });
  if (identity.peertube) {
    protocols.push({
      protocol: 'peertube',
      handle: identity.peertube.username || identity.peertube.channelId || '',
    });
  }

  return protocols;
}
