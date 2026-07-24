'use client';

/**
 * ProtocolConnectFlow — Multi-step connection wizard for protocols.
 *
 * Supports Mastodon (instance URL → OAuth) and Bluesky (handle → auth).
 * Shows connection status per protocol.
 */

import { getProtocolColor, getProtocolLabel } from '@degenfeed/ui';
import { useCallback, useState } from 'react';
import { useProtocolConnections } from '../hooks/useProtocolConnections';

/* ─── Types ─────────────────────────────────────────────────── */

export interface ProtocolConnectFlowProps {
  open: boolean;
  protocolId: string | null;
  onClose: () => void;
}

type ConnectionStep =
  | 'choose'
  | 'mastodon-instance'
  | 'bluesky-handle'
  | 'authenticating'
  | 'done'
  | 'error';

/* ─── Step indicators ───────────────────────────────────────── */

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full transition-all ${
        done ? 'bg-degen-500' : active ? 'bg-degen-400 scale-125' : 'bg-[var(--color-muted)]'
      }`}
    />
  );
}

/* ─── Protocol card (for choose step) ────────────────────────── */

function ProtocolOptionCard({
  name,
  icon,
  color,
  connected,
  handle,
  onSelect,
  onDisconnect,
}: {
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  handle?: string;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
        connected
          ? 'border-degen-500/30 bg-degen-500/5'
          : 'border-[var(--color-glass-border)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-overlay)]'
      }`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
            {name}
          </span>
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-degen-400">
              <span className="h-1.5 w-1.5 rounded-full bg-degen-500" />
              Connected
            </span>
          )}
        </div>
        {connected && handle && (
          <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {handle}
          </div>
        )}
      </div>
      {connected ? (
        <button
          type="button"
          onClick={onDisconnect}
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-degen-400 transition-colors hover:bg-degen-500/15"
        >
          Connect
        </button>
      )}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────── */

const PROTOCOL_ORDER = ['mastodon', 'bluesky', 'nostr', 'farcaster', 'lens', 'reddit', 'rss'];

export function ProtocolConnectFlow({ open, protocolId, onClose }: ProtocolConnectFlowProps) {
  const { connections, connect, disconnect } = useProtocolConnections();

  const [flowState, setFlowState] = useState<{
    step: ConnectionStep;
    protocolId: string | null;
  }>({ step: protocolId ? 'authenticating' : 'choose', protocolId });

  // Reset when opened
  if (open && flowState.protocolId !== protocolId) {
    setFlowState({ step: protocolId ? 'authenticating' : 'choose', protocolId });
  }

  const startConnect = useCallback(
    (pid: string) => {
      if (pid === 'mastodon') {
        setFlowState({ step: 'mastodon-instance', protocolId: pid });
      } else if (pid === 'bluesky') {
        setFlowState({ step: 'bluesky-handle', protocolId: pid });
      } else {
        // Direct connect for other protocols
        setFlowState({ step: 'authenticating', protocolId: pid });
        connect(pid, {}).then((ok) => {
          setFlowState({ step: ok ? 'done' : 'error', protocolId: pid });
        });
      }
    },
    [connect],
  );

  const handleDisconnect = useCallback(
    (pid: string) => {
      disconnect(pid);
    },
    [disconnect],
  );

  const handleMastodonAuth = useCallback(
    (instanceUrl: string) => {
      if (!flowState.protocolId) return;
      setFlowState({ step: 'authenticating', protocolId: flowState.protocolId });
      connect(flowState.protocolId, { instanceUrl }).then((ok) => {
        if (flowState.protocolId)
          setFlowState({ step: ok ? 'done' : 'error', protocolId: flowState.protocolId });
      });
    },
    [connect, flowState.protocolId],
  );

  const handleBlueskyAuth = useCallback(
    (handle: string) => {
      if (!flowState.protocolId) return;
      setFlowState({ step: 'authenticating', protocolId: flowState.protocolId });
      connect(flowState.protocolId, { handle }).then((ok) => {
        if (flowState.protocolId)
          setFlowState({ step: ok ? 'done' : 'error', protocolId: flowState.protocolId });
      });
    },
    [connect, flowState.protocolId],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="fixed inset-x-4 top-[10%] z-[90] mx-auto max-w-lg animate-scale-in"
        role="dialog"
        aria-label="Connect protocols"
      >
        <div
          className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] shadow-2xl backdrop-blur-2xl"
          style={{ backgroundColor: 'var(--color-card)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-5 py-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
                style={{
                  backgroundColor: `${flowState.protocolId ? getProtocolColor(flowState.protocolId) : '#00ff41'}1a`,
                  color: flowState.protocolId ? getProtocolColor(flowState.protocolId) : '#00ff41',
                }}
              >
                {flowState.protocolId ? (connections[flowState.protocolId]?.icon ?? '?') : '\u26A1'}
              </span>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                {flowState.step === 'choose'
                  ? 'Connect Your Protocols'
                  : flowState.protocolId
                    ? `Connect ${getProtocolLabel(flowState.protocolId)}`
                    : 'Connect'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-overlay)]"
              aria-label="Close"
              style={{ color: 'var(--color-muted)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-glass-border)]">
            <StepDot active={flowState.step === 'choose'} done={flowState.step !== 'choose'} />
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              {flowState.step === 'choose' ? 'Select Protocol' : 'Configure'}
            </span>
            <StepDot
              active={
                flowState.step === 'mastodon-instance' ||
                flowState.step === 'bluesky-handle' ||
                flowState.step === 'authenticating'
              }
              done={flowState.step === 'done'}
            />
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Authenticate
            </span>
            <StepDot active={flowState.step === 'done'} done={false} />
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Done
            </span>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {flowState.step === 'choose' && (
              <div className="space-y-2">
                <p className="mb-4 text-sm" style={{ color: 'var(--color-muted)' }}>
                  Choose a protocol to connect. Your feeds will appear in your unified timeline.
                </p>
                {PROTOCOL_ORDER.map((pid) => {
                  const conn = connections[pid];
                  if (!conn) return null;
                  return (
                    <ProtocolOptionCard
                      key={pid}
                      name={conn.name}
                      icon={conn.icon}
                      color={conn.color}
                      connected={conn.connected}
                      handle={conn.handle}
                      onSelect={() => startConnect(pid)}
                      onDisconnect={() => handleDisconnect(pid)}
                    />
                  );
                })}
              </div>
            )}

            {flowState.step === 'mastodon-instance' && (
              <MastodonInstanceForm onSubmit={handleMastodonAuth} />
            )}

            {flowState.step === 'bluesky-handle' && (
              <BlueskyHandleForm onSubmit={handleBlueskyAuth} />
            )}

            {flowState.step === 'authenticating' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
                <p className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
                  Authenticating with{' '}
                  {flowState.protocolId ? getProtocolLabel(flowState.protocolId) : 'protocol'}
                  ...
                </p>
              </div>
            )}

            {flowState.step === 'done' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/20 text-2xl text-degen-400">
                  ✓
                </span>
                <p className="text-base font-semibold" style={{ color: 'var(--color-fg)' }}>
                  Connected!
                </p>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Your {flowState.protocolId ? getProtocolLabel(flowState.protocolId) : ''} feed is
                  now live.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 rounded-xl bg-degen-500 px-6 py-2 text-sm font-semibold text-black transition-all hover:bg-degen-400"
                >
                  Done
                </button>
              </div>
            )}

            {flowState.step === 'error' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-2xl text-red-400">
                  ✗
                </span>
                <p className="text-base font-semibold" style={{ color: 'var(--color-fg)' }}>
                  Connection failed
                </p>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Please check your credentials and try again.
                </p>
                <button
                  type="button"
                  onClick={() => setFlowState({ step: 'choose', protocolId: null })}
                  className="mt-2 rounded-xl border border-[var(--color-glass-border)] px-6 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-overlay)]"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Sub-forms ─────────────────────────────────────────────── */

function MastodonInstanceForm({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) onSubmit(url.trim());
      }}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="mastodon-instance"
          className="mb-1.5 block text-sm font-medium"
          style={{ color: 'var(--color-fg)' }}
        >
          Mastodon Instance URL
        </label>
        <input
          id="mastodon-instance"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mastodon.social"
          className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-degen-500/50 focus:ring-1 focus:ring-degen-500/30"
          style={{ color: 'var(--color-fg)' }}
        />
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
          Enter the URL of your Mastodon server (e.g., mastodon.social, hachyderm.io)
        </p>
      </div>
      <button
        type="submit"
        disabled={!url.trim()}
        className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-degen-400 disabled:opacity-40"
      >
        Continue to Authorize
      </button>
    </form>
  );
}

function BlueskyHandleForm({ onSubmit }: { onSubmit: (handle: string) => void }) {
  const [handle, setHandle] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (handle.trim()) onSubmit(handle.trim());
      }}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="bluesky-handle"
          className="mb-1.5 block text-sm font-medium"
          style={{ color: 'var(--color-fg)' }}
        >
          Bluesky Handle
        </label>
        <input
          id="bluesky-handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="alice.bsky.social"
          className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-degen-500/50 focus:ring-1 focus:ring-degen-500/30"
          style={{ color: 'var(--color-fg)' }}
        />
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
          Enter your Bluesky handle (e.g., alice.bsky.social)
        </p>
      </div>
      <button
        type="submit"
        disabled={!handle.trim()}
        className="w-full rounded-xl bg-degen-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-degen-400 disabled:opacity-40"
      >
        Continue to Authorize
      </button>
    </form>
  );
}
