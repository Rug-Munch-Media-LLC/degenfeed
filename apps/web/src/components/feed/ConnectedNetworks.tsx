'use client';

/**
 * @degenfeed/web — ConnectedNetworks
 *
 * Minimal "network ownership" display: shows which federated / social
 * networks the authenticated user has linked identities on (their
 * Mastodon/GTS identity, Bluesky, Nostr, Farcaster, Lens handles, etc).
 *
 * Reads the real linked identities from AuthProvider (IndexedDB-backed),
 * NOT feed-health booleans — this is user ownership, not source health.
 * Renders nothing when the user has no linked network identities, so it
 * never adds noise for anonymous/wallet-only users.
 */

import { getProtocolColor, getProtocolLabel } from '@degenfeed/utils';
import { useAuth } from '../AuthProvider';

/** Wallet/email protocols are not federated "network ownership" — skip them. */
const NETWORK_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'threads',
  'mastodon',
  'lemmy',
  'reddit',
  'peertube',
  'rss',
]);

export function ConnectedNetworks() {
  const { ready, linkedIdentities, primaryIdentity } = useAuth();

  if (!ready) return null;

  const networks = linkedIdentities
    .filter((i) => NETWORK_PROTOCOLS.has(i.protocol))
    // Primary identity first, then by link time.
    .sort((a, b) => {
      const aPrimary = primaryIdentity && a.id === primaryIdentity.id ? 0 : 1;
      const bPrimary = primaryIdentity && b.id === primaryIdentity.id ? 0 : 1;
      return aPrimary - bPrimary || a.linkedAt - b.linkedAt;
    });

  if (networks.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          Connected networks
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{networks.length}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {networks.map((identity) => {
          const color = getProtocolColor(identity.protocol) ?? '#a3a3a3';
          const label = getProtocolLabel(identity.protocol) ?? identity.protocol;
          return (
            <li key={identity.id} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-fg)]">
                <span className="font-medium">{label}</span>
                <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted)]">
                  {identity.handle}
                </span>
              </span>
              {identity.verified && (
                <span
                  className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400"
                  title="Verified"
                >
                  ✓
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
