'use client';

import Link from 'next/link';

/* ─── EmptyFeed ──────────────────────────────────────────── */

export interface EmptyFeedProps {
  onFollow?: () => void;
  onFilter?: () => void;
  className?: string;
}

export function EmptyFeed({ onFollow, onFilter, className = '' }: EmptyFeedProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="status"
    >
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-overlay)' }}
      >
        <span className="text-2xl" aria-hidden="true">
          🪐
        </span>
      </div>
      <h3 className="mb-1.5 text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
        Nothing here yet
      </h3>
      <p className="mb-6 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        This feed is as empty as a memecoin&apos;s roadmap. Try following some creators or expanding
        your filters to discover content from across the decentralized web.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onFollow && (
          <button
            type="button"
            onClick={onFollow}
            className="btn-primary text-sm"
            aria-label="Follow creators"
          >
            ✦ Follow Creators
          </button>
        )}
        {onFilter && (
          <button
            type="button"
            onClick={onFilter}
            className="btn-secondary text-sm"
            aria-label="Change filters"
          >
            ⚙️ Change Filters
          </button>
        )}
        {!onFollow && !onFilter && (
          <Link href="/search" className="btn-primary text-sm">
            🔍 Discover Content
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── NetworkError ───────────────────────────────────────── */

export interface ProtocolStatus {
  name: string;
  status: 'connected' | 'connecting' | 'error';
}

export interface NetworkErrorProps {
  onRetry?: () => void;
  protocols?: ProtocolStatus[];
  className?: string;
}

const DEFAULT_PROTOCOLS: ProtocolStatus[] = [
  { name: 'Nostr', status: 'connecting' },
  { name: 'Farcaster', status: 'error' },
  { name: 'Lens', status: 'connected' },
  { name: 'Bluesky', status: 'connecting' },
];

function StatusDot({ status }: { status: ProtocolStatus['status'] }) {
  const color =
    status === 'connected'
      ? 'var(--color-success)'
      : status === 'connecting'
        ? 'var(--color-warning)'
        : 'var(--color-danger)';
  const label =
    status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Error';
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

export function NetworkError({ onRetry, protocols, className = '' }: NetworkErrorProps) {
  const items = protocols ?? DEFAULT_PROTOCOLS;
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="alert"
    >
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          border: '1px solid var(--color-danger)',
          backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
        }}
      >
        <span className="text-2xl" aria-hidden="true">
          📡
        </span>
      </div>
      <h3 className="mb-1.5 text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
        Connection lost
      </h3>
      <p className="mb-1 text-sm" style={{ color: 'var(--color-muted)' }}>
        Your decentralized feed is reconnecting...
      </p>
      <p className="mb-6 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        The web3 social graph is peer-to-peer, but sometimes relays need a nudge. Hang tight while
        we re-establish your connections.
      </p>

      {/* Protocol status indicators */}
      <div
        className="mb-6 w-full max-w-xs rounded-xl border p-3"
        style={{ borderColor: 'var(--color-glass-border)', backgroundColor: 'var(--color-card)' }}
      >
        <p
          className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Protocol Status
        </p>
        <div className="space-y-1.5">
          {items.map((p) => (
            <div key={p.name} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-fg)' }}>
                {p.name}
              </span>
              <StatusDot status={p.status} />
            </div>
          ))}
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary text-sm"
          aria-label="Retry connection"
        >
          ⟳ Reconnect
        </button>
      )}
    </div>
  );
}

/* ─── NotFound ────────────────────────────────────────────── */

export interface NotFoundProps {
  onGoHome?: () => void;
  className?: string;
}

export function NotFound({ onGoHome, className = '' }: NotFoundProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="alert"
    >
      <div
        className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-secondary-glow), transparent)',
        }}
      >
        <span className="text-4xl" aria-hidden="true">
          ✦
        </span>
      </div>
      <h1
        className="mb-2 text-6xl font-black"
        style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)' }}
      >
        404
      </h1>
      <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
        This page doesn&apos;t exist... yet.
      </h2>
      <p className="mb-6 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        Maybe it&apos;s being decentralized on-chain right now? <span aria-hidden="true">⛓️✨</span>
        <br />
        Try checking the IPFS hash or coming back after the next block.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onGoHome ? (
          <button type="button" onClick={onGoHome} className="btn-primary text-sm">
            ← Go Home
          </button>
        ) : (
          <Link href="/feed" className="btn-primary text-sm">
            ← Back to Feed
          </Link>
        )}
        <Link href="/search" className="btn-secondary text-sm">
          🔍 Search
        </Link>
      </div>
      <p className="mt-6 text-[10px]" style={{ color: 'var(--color-muted)' }}>
        Error code: 0x{Math.random().toString(16).slice(2, 10)}
      </p>
    </div>
  );
}

/* ─── Unauthorized ────────────────────────────────────────── */

export interface UnauthorizedProps {
  onConnect?: () => void;
  userName?: string;
  className?: string;
}

export function Unauthorized({ onConnect, userName, className = '' }: UnauthorizedProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="alert"
    >
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          border: '1px solid var(--color-accent)',
          backgroundColor: 'var(--color-accent-soft)',
        }}
      >
        <span className="text-2xl" aria-hidden="true">
          🔑
        </span>
      </div>
      {userName ? (
        <>
          <h3 className="mb-1 text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
            Hey {userName}, sign in to continue
          </h3>
          <p className="mb-6 max-w-xs text-sm" style={{ color: 'var(--color-muted)' }}>
            Connect a protocol to access this feature. We support Nostr, Farcaster, Lens, Bluesky,
            and more.
          </p>
        </>
      ) : (
        <>
          <h3 className="mb-1 text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
            Connect your wallet
          </h3>
          <p
            className="mb-2 max-w-xs text-sm leading-relaxed"
            style={{ color: 'var(--color-muted)' }}
          >
            No email. No password. Just crypto.
          </p>
          <p
            className="mb-6 max-w-xs text-xs leading-relaxed"
            style={{ color: 'var(--color-muted)' }}
          >
            Your wallet is your identity here. Sign with one click — no personal info required, no
            data harvested, no tracking.
          </p>
        </>
      )}
      {onConnect ? (
        <button
          type="button"
          onClick={onConnect}
          className="btn-primary text-sm gap-2"
          aria-label="Connect wallet or protocol"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Connect Wallet
        </button>
      ) : (
        <Link href="/auth" className="btn-primary text-sm gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Connect Wallet
        </Link>
      )}
      <p className="mt-4 text-[10px]" style={{ color: 'var(--color-muted)' }}>
        We&apos;ll never ask for your seed phrase or private keys.
      </p>
    </div>
  );
}

/* ─── Default export ─────────────────────────────────────── */

const StateMessages = {
  EmptyFeed,
  NetworkError,
  NotFound,
  Unauthorized,
};

export default StateMessages;
