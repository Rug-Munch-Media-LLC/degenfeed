'use client';

import { HandlePriceIndicator } from './HandlePriceIndicator';
import type { PlanId } from './types';

export function Step2_ChooseUsernames({
  plan,
  farcasterUsername,
  lensHandle,
  ensName,
  isPremium,
  onFarcasterChange,
  onLensChange,
  onEnsChange,
}: {
  plan: PlanId;
  farcasterUsername: string;
  lensHandle: string;
  ensName: string;
  isPremium: boolean;
  onFarcasterChange: (v: string) => void;
  onLensChange: (v: string) => void;
  onEnsChange: (v: string) => void;
}) {
  const showFarcaster = plan !== 'free';
  const showLens = plan !== 'free';
  const showEns = plan === 'complete';

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Choose Your Usernames</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        Pick your preferred usernames, or leave blank for auto-generated ones (derived from your
        wallet address).
      </p>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
            GoToSocial (Fediverse)
          </span>
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Auto-generated from your wallet address. No input needed.
          </p>
          <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <code>{'{wallet-short}'}@social.degenfeed.xyz</code>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
            Bluesky PDS Handle
          </span>
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Auto-generated on our PDS. No input needed.
          </p>
          <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <code>{'{wallet-short}'}.pds.degenfeed.xyz</code>
          </div>
        </div>

        {showFarcaster && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <label
              htmlFor="fc-username"
              className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
            >
              Farcaster Username
            </label>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Leave blank for auto-generated (wallet-derived). Costs $5 gas to register on Base.
            </p>
            <input
              id="fc-username"
              type="text"
              value={farcasterUsername}
              onChange={(e) => onFarcasterChange(e.target.value)}
              placeholder="Auto-generated (or pick one)"
              maxLength={30}
              pattern="[a-zA-Z0-9_]{2,30}"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
            />
          </div>
        )}

        {showLens && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <label
              htmlFor="lens-handle"
              className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
            >
              Lens Handle @<span className="font-mono">yourname</span>.lens
            </label>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Leave blank for auto-generated. Pricing is based on handle length.
            </p>
            <input
              id="lens-handle"
              type="text"
              value={lensHandle}
              onChange={(e) => onLensChange(e.target.value)}
              placeholder="Auto-generated (or pick a custom handle)"
              maxLength={31}
              pattern="[a-zA-Z0-9_\-.]{2,31}"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
            />
            <HandlePriceIndicator length={lensHandle.length} premium={isPremium} />
          </div>
        )}

        {showEns && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <label
              htmlFor="ens-name"
              className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
            >
              ENS Domain Name
            </label>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Enter the ENS name you want. We register it for you ($10 gas included in Complete
              plan).
            </p>
            <div className="flex items-center gap-2">
              <input
                id="ens-name"
                type="text"
                value={ensName}
                onChange={(e) => onEnsChange(e.target.value)}
                placeholder="yourname"
                maxLength={64}
                className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
              />
              <span className="text-sm text-[var(--color-muted)]">.eth</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
