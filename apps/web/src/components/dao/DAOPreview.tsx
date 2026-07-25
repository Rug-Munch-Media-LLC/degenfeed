'use client';

/**
 * DegenFeed DAO Preview — Live preview of what the DAO page will look like.
 *
 * Updates in real-time as the user fills in the wizard, showing
 * DAO name/description, governance stats, treasury with signer avatars,
 * and mock interactive buttons.
 */

import { useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PreviewState {
  name: string;
  description: string;
  avatarUrl: string;
  tags: string[];
  category: string;
  // Governance
  votingModel: 'token' | 'quadratic';
  proposalThreshold: number;
  quorumPercent: number;
  votingPeriodDays: number;
  timelockDelayHours: number;
  // Treasury
  signerCount: number;
  threshold: number;
  // Social links
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
}

interface DAOPreviewProps {
  state: PreviewState;
  /** Whether to show as sidebar panel (narrow) */
  sidebar?: boolean;
  /** Attach to a coin creation flow */
  coinSymbol?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateFakeAddresses(count: number): string[] {
  const chars = '0123456789abcdef';
  const addr = (prefix: string) =>
    `0x${prefix}${Array.from({ length: 38 }, () => chars[Math.floor(Math.random() * 16)]).join('')}`;
  return Array.from({ length: count }, (_, i) =>
    addr(['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'a7', 'b8', 'c9', 'd0'][i] || 'ff'),
  );
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    defi: '#f59e0b',
    nft: '#8b5cf6',
    social: '#ec4899',
    gaming: '#10b981',
    grant: '#06b6d4',
    investment: '#f97316',
    protocol: '#3b82f6',
    creator: '#8b5cf6',
    meme: '#ef4444',
    music: '#a855f7',
    art: '#d946ef',
    sports: '#14b8a6',
  };
  return colors[tag.toLowerCase()] || '#8b8f93';
}

// ─── Signer Avatar ──────────────────────────────────────────────────────────

function SignerAvatar({ address, index }: { address: string; index: number }) {
  const colors = [
    '#8b5cf6',
    '#f59e0b',
    '#10b981',
    '#06b6d4',
    '#ec4899',
    '#f97316',
    '#3b82f6',
    '#ef4444',
    '#a855f7',
    '#14b8a6',
  ];
  const bg = colors[index % colors.length];

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-black"
      style={{ backgroundColor: bg }}
      title={address}
    >
      {getInitials(shortenAddress(address))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DAOPreview({ state, sidebar = false, coinSymbol }: DAOPreviewProps) {
  const signerAddresses = useMemo(
    () => generateFakeAddresses(Math.max(state.signerCount, 1)),
    [state.signerCount],
  );

  const displayName = state.name || 'Your DAO Name';
  const displayDesc =
    state.description || 'Describe your DAO mission and what your community will govern.';

  const content = (
    <>
      {/* ═══ DAO Header ═══ */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-br from-[var(--color-accent)]/20 to-purple-600/20">
          {state.avatarUrl ? (
            <img
              src={state.avatarUrl}
              alt={`${displayName} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🏛️</div>
          )}
          {coinSymbol && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[8px] font-bold text-black shadow-lg">
              $
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-base font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {displayName}
          </h3>
          {coinSymbol && (
            <div className="text-[10px] font-medium text-[var(--color-accent)]">
              ${coinSymbol} DAO
            </div>
          )}
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
            {displayDesc}
          </p>

          {/* Tags */}
          {state.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full px-2 py-0.5 text-[8px] font-medium"
                  style={{
                    backgroundColor: `${getTagColor(tag)}15`,
                    color: getTagColor(tag),
                  }}
                >
                  {tag}
                </span>
              ))}
              {state.tags.length > 4 && (
                <span className="text-[8px] text-[var(--color-muted)]">
                  +{state.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Governance Stats ═══ */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-2.5">
          <div className="text-[8px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Voting
          </div>
          <div className="mt-0.5 text-xs font-bold text-[var(--color-fg)]">
            {state.votingModel === 'quadratic' ? 'Quadratic' : '1 Token = 1 Vote'}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">{state.quorumPercent}% quorum</div>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-2.5">
          <div className="text-[8px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Period
          </div>
          <div className="mt-0.5 text-xs font-bold text-[var(--color-fg)]">
            {state.votingPeriodDays} day{state.votingPeriodDays > 1 ? 's' : ''}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">
            {state.timelockDelayHours > 0 ? `${state.timelockDelayHours}h timelock` : 'No timelock'}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-2.5">
          <div className="text-[8px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Propose
          </div>
          <div className="mt-0.5 text-xs font-bold text-[var(--color-fg)]">
            {state.proposalThreshold}% threshold
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Min tokens to propose</div>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-2.5">
          <div className="text-[8px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Treasury
          </div>
          <div className="mt-0.5 text-xs font-bold text-[var(--color-fg)]">
            {state.threshold}/{state.signerCount} multi-sig
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Signers required</div>
        </div>
      </div>

      {/* ═══ Signers ═══ */}
      {state.signerCount > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Treasury Signers
            </span>
            <span className="text-[9px] text-[var(--color-muted)]">
              {state.threshold} of {state.signerCount} required
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {signerAddresses.slice(0, 10).map((addr, i) => (
              <div key={addr} className="group relative">
                <SignerAvatar address={addr} index={i} />
                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] px-2 py-1 text-[9px] text-[var(--color-fg)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {shortenAddress(addr)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Social Links ═══ */}
      {(state.twitter || state.discord || state.telegram || state.website) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {state.twitter && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-glass-border)] px-2 py-1 text-[9px] text-[var(--color-muted)]">
              𝕏 {state.twitter.replace('https://twitter.com/', '@')}
            </span>
          )}
          {state.discord && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-glass-border)] px-2 py-1 text-[9px] text-[var(--color-muted)]">
              💬 Discord
            </span>
          )}
          {state.telegram && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-glass-border)] px-2 py-1 text-[9px] text-[var(--color-muted)]">
              ✈️ Telegram
            </span>
          )}
          {state.website && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-glass-border)] px-2 py-1 text-[9px] text-[var(--color-muted)]">
              🌐 Website
            </span>
          )}
        </div>
      )}

      {/* ═══ Mock Actions ═══ */}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled
          className="flex-1 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-bold text-[var(--color-accent)] opacity-60"
        >
          + Join DAO
        </button>
        <button
          type="button"
          disabled
          className="flex-1 rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-[10px] font-bold text-[var(--color-muted)] opacity-60"
        >
          + Create Proposal
        </button>
      </div>
    </>
  );

  if (sidebar) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-muted)]">👁️</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Preview
          </span>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--color-glass-border)] text-[11px]">
          👁️
        </span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            DAO Page Preview
          </span>
          <p className="text-[9px] text-[var(--color-muted)]">Updates live as you configure</p>
        </div>
      </div>
      {content}
    </div>
  );
}
