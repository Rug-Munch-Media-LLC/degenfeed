/**
 * @degenfeed/degenchat — Identity resolution
 *
 * Maps a single person across every chat protocol: npub ↔ fid ↔ did ↔ acct ↔
 * wallet. DegenChat uses this to know which protocols can reach a contact.
 *
 * Resolution sources:
 *   1. Explicit links the user registered (CrossProtocolIdentity from KV)
 *   2. The identifier itself (npub → nostr, fid → farcaster, did → bluesky, …)
 *   3. Network lookups via the realtime identity-resolver when available
 *
 * Provides:
 *   - `resolveDegenIdentity()` — async pure resolver
 *   - `useIdentityResolution()` — React hook that resolves once + on refresh
 */

'use client';

import { resolveIdentity } from '@degenfeed/realtime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DegenIdentityLink {
  protocol: string;
  id: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface DegenIdentity {
  /** Canonical wallet address if known. */
  walletAddress?: string;
  /** The original raw identifier. */
  raw: string;
  /** Protocol of the raw identifier. */
  sourceProtocol: string;
  /** All resolved protocol links. */
  links: DegenIdentityLink[];
  /** Display name if resolved. */
  displayName?: string;
  /** Avatar URL if resolved. */
  avatarUrl?: string;
  /** Protocols this identity can be reached on (ordered by preference). */
  deliveryProtocols: string[];
}

export interface ResolveDegenIdentityOptions {
  /** Whether to allow network lookups (default true). */
  allowNetworkLookup?: boolean;
  /** KV namespace for identity lookups. */
  IDENTITIES?: unknown;
}

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  lens: 'Lens',
  matrix: 'Matrix',
  xmpp: 'XMPP',
};

// ─── Resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve any identifier (npub, fid, did, acct, wallet, handle) into a
 * unified identity with cross-protocol links.
 */
export async function resolveDegenIdentity(
  identifier: string,
  options: ResolveDegenIdentityOptions = {},
): Promise<DegenIdentity> {
  const raw = identifier.trim();
  if (!raw) {
    return { raw, sourceProtocol: 'unknown', links: [], deliveryProtocols: [] };
  }

  let resolved: Awaited<ReturnType<typeof resolveIdentity>> | null = null;
  try {
    resolved = await resolveIdentity(raw, {
      IDENTITIES: options.IDENTITIES as never,
      allowNetworkLookup: options.allowNetworkLookup ?? true,
    });
  } catch {
    resolved = null;
  }

  const links: DegenIdentityLink[] = [];
  const deliveryProtocols: string[] = [];

  if (resolved) {
    if (resolved.walletAddress) {
      links.push({ protocol: 'wallet', id: resolved.walletAddress });
      deliveryProtocols.push('wallet');
    }
    for (const [protocol, proto] of Object.entries(resolved.protocols)) {
      if (!proto?.id) continue;
      links.push({
        protocol,
        id: proto.id,
        handle: proto.handle,
        displayName: proto.displayName,
        avatarUrl: proto.avatarUrl,
      });
      if (PROTOCOL_LABELS[protocol]) deliveryProtocols.push(protocol);
    }
    if (resolved.displayName) {
      // displayName on resolved identity is used when present
    }
  }

  return {
    walletAddress: resolved?.walletAddress,
    raw,
    sourceProtocol: resolved?.sourceProtocol ?? 'unknown',
    links,
    displayName: resolved?.displayName,
    avatarUrl: resolved?.avatarUrl,
    deliveryProtocols: dedupe(deliveryProtocols),
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

/**
 * Get the best delivery protocols for an identity, preferring the source
 * protocol first.
 */
export function getDeliveryProtocolsForIdentity(identity: DegenIdentity): string[] {
  const preferred: string[] = [];
  switch (identity.sourceProtocol) {
    case 'nostr':
      preferred.push('nostr');
      break;
    case 'farcaster':
      preferred.push('farcaster');
      break;
    case 'bluesky':
      preferred.push('bluesky');
      break;
    case 'mastodon':
      preferred.push('mastodon');
      break;
    case 'lens':
      preferred.push('lens');
      break;
    case 'matrix':
      preferred.push('matrix');
      break;
    case 'xmpp':
      preferred.push('xmpp');
      break;
    case 'wallet':
      preferred.push('nostr', 'farcaster', 'matrix');
      break;
    default:
      preferred.push('nostr');
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const p of [...preferred, ...identity.deliveryProtocols]) {
    if (!seen.has(p)) {
      seen.add(p);
      ordered.push(p);
    }
  }
  return ordered;
}

// ─── React hook ───────────────────────────────────────────────────────────

export interface UseIdentityResolutionResult {
  identity: DegenIdentity | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Best delivery protocols for the resolved identity. */
  deliveryProtocols: string[];
}

/**
 * Resolve a chat contact's cross-protocol identity.
 *
 *   const { identity, deliveryProtocols, loading } = useIdentityResolution('npub1…');
 *   // deliveryProtocols → ['nostr', 'farcaster', …]
 */
export function useIdentityResolution(
  identifier: string | null | undefined,
  options: ResolveDegenIdentityOptions = {},
): UseIdentityResolutionResult {
  const [identity, setIdentity] = useState<DegenIdentity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Keep a ref so the effect can read the latest options without re-running
  // on every render (options is usually an inline object literal).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken re-runs resolution
  useEffect(() => {
    let cancelled = false;
    const opts = optionsRef.current;
    if (!identifier?.trim()) {
      setIdentity(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    resolveDegenIdentity(identifier, opts)
      .then((resolved) => {
        if (!cancelled) setIdentity(resolved);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identifier, refreshToken]);

  const deliveryProtocols = useMemo(() => {
    return identity ? getDeliveryProtocolsForIdentity(identity) : [];
  }, [identity]);

  return { identity, loading, error, refresh, deliveryProtocols };
}
