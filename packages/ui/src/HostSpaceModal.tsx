/**
 * @degenfeed/ui — HostSpaceModal
 *
 * Premium modal for creating and hosting an Audio Space.
 * Topic input with character count, protocol broadcast selector,
 * Start Now / Schedule mode, and co-host selection.
 */

'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

// ─── Constants ────────────────────────────────────────────────────

const BROADCAST_PROTOCOLS = [
  { id: 'nostr', label: 'Nostr', platforms: ['nostr'] },
  { id: 'farcaster', label: 'Farcaster', platforms: [] },
  { id: 'lens', label: 'Lens', platforms: [] },
  { id: 'mastodon', label: 'Mastodon', platforms: [] },
  { id: 'peertube', label: 'PeerTube', platforms: ['peertube'] },
  { id: 'owncast', label: 'Owncast', platforms: ['owncast'] },
  { id: 'livepeer', label: 'LivePeer', platforms: ['livepeer'] },
] as const;

const MAX_TITLE_LENGTH = 100;
const MAX_DESC_LENGTH = 500;

// ─── Types ────────────────────────────────────────────────────────

export interface CoHostOption {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
}

export interface HostSpaceModalProps {
  open: boolean;
  onClose: () => void;
  signedInProtocols: Record<string, boolean>;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHostOptions?: CoHostOption[];
  onSpaceCreated: (space: {
    id: string;
    title: string;
    protocols: string[];
    status: 'live' | 'scheduled';
    scheduledAt?: string;
  }) => void;
  onBroadcast?: (text: string, protocols: string[]) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────

export function HostSpaceModal({
  open,
  onClose,
  signedInProtocols,
  hostId,
  hostName,
  hostAvatarUrl,
  coHostOptions = [],
  onSpaceCreated,
  onBroadcast,
}: HostSpaceModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [enabledProtocols, setEnabledProtocols] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of BROADCAST_PROTOCOLS) initial[p.id] = !!signedInProtocols[p.id];
    return initial;
  });
  const [selectedCoHosts, setSelectedCoHosts] = useState<string[]>([]);
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    const initial: Record<string, boolean> = {};
    for (const p of BROADCAST_PROTOCOLS) initial[p.id] = !!signedInProtocols[p.id];
    setEnabledProtocols(initial);
    setSelectedCoHosts([]);
    setMode('now');
    setScheduledAt('');
    setCreating(false);
    setError(null);
  }, [open, signedInProtocols]);

  const toggleProtocol = useCallback((id: string) => {
    setEnabledProtocols((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleCoHost = useCallback((id: string) => {
    setSelectedCoHosts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }, []);

  const selectedCount = useMemo(
    () => Object.values(enabledProtocols).filter(Boolean).length,
    [enabledProtocols],
  );

  const hasSignedIn = useMemo(
    () => Object.values(signedInProtocols).some(Boolean),
    [signedInProtocols],
  );

  const minPickerDate = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);

  const titleRemaining = MAX_TITLE_LENGTH - title.length;

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter a space title.');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const selectedProtocols = BROADCAST_PROTOCOLS.filter((p) => enabledProtocols[p.id]).map(
        (p) => p.id,
      );

      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        hostId,
        hostName,
        hostAvatarUrl,
        coHosts: selectedCoHosts,
        protocols: selectedProtocols,
        tippingEnabled: true,
      };

      if (mode === 'schedule' && scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }

      const res = await fetch('/api/spaces/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Failed to create space');
      }

      const data = (await res.json()) as {
        space: {
          id: string;
          title: string;
          protocols: string[];
          status: 'live' | 'scheduled';
          scheduledAt?: string;
        };
        ok: boolean;
      };

      if (selectedProtocols.length > 0 && onBroadcast) {
        const broadcastText = `🔊 LIVE: ${title.trim()} — Join the Space on DegenFeed`;
        try {
          await onBroadcast(broadcastText, selectedProtocols);
        } catch {
          /* non-fatal */
        }
      }

      onSpaceCreated(data.space);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }, [
    title,
    description,
    hostId,
    hostName,
    hostAvatarUrl,
    selectedCoHosts,
    enabledProtocols,
    mode,
    scheduledAt,
    onBroadcast,
    onSpaceCreated,
    onClose,
  ]);

  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      aria-modal="true"
      aria-label="Host a Space"
      role="dialog"
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-degen-500"
              >
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-[var(--color-fg)]">Host a Space</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]/10 hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto space-y-5 px-5 py-4">
          {/* Title / topic */}
          <div>
            <label
              htmlFor="space-title"
              className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider"
            >
              Space topic
            </label>
            <input
              id="space-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DeFi Alpha Discussion"
              maxLength={MAX_TITLE_LENGTH}
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none transition-all focus:border-degen-500/50 focus:bg-[var(--color-card)]"
              autoComplete="off"
            />
            {/* Character count */}
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[10px] text-[var(--color-muted)]">What&apos;s this space about?</p>
              <span
                className={`text-[10px] font-mono transition-colors ${
                  titleRemaining < 10 ? 'text-red-400' : 'text-[var(--color-muted)]'
                }`}
              >
                {titleRemaining}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="space-desc"
              className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider"
            >
              Description <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this space about?"
              rows={2}
              maxLength={MAX_DESC_LENGTH}
              className="w-full resize-none rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none transition-all focus:border-degen-500/50 focus:bg-[var(--color-card)]"
            />
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">
              {description.length}/{MAX_DESC_LENGTH}
            </p>
          </div>

          {/* Broadcast protocols */}
          <div>
            <p className="mb-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              Broadcast to protocols{' '}
              <span className="font-normal text-gray-600">(requires sign-in)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {BROADCAST_PROTOCOLS.map((protocol) => {
                const isConnected = !!signedInProtocols[protocol.id];
                const isEnabled = enabledProtocols[protocol.id];
                return (
                  <button
                    key={protocol.id}
                    type="button"
                    onClick={() => {
                      if (isConnected) toggleProtocol(protocol.id);
                    }}
                    disabled={!isConnected}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                      isEnabled
                        ? 'border-current opacity-100'
                        : 'border-[var(--color-glass-border)] opacity-40 hover:opacity-70'
                    } ${!isConnected ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'}`}
                    style={{
                      color: isEnabled ? getProtocolColor(protocol.id) : 'var(--color-muted)',
                      backgroundColor: isEnabled
                        ? `${getProtocolColor(protocol.id)}15`
                        : 'transparent',
                    }}
                    title={
                      !isConnected
                        ? `Not signed into ${getProtocolLabel(protocol.id)}`
                        : `${getProtocolLabel(protocol.id)} — ${isEnabled ? 'will broadcast' : 'no broadcast'}`
                    }
                  >
                    <span className="text-[0.7em]">{getProtocolIcon(protocol.id)}</span>
                    {getProtocolLabel(protocol.id)}
                  </button>
                );
              })}
            </div>
            {selectedCount > 0 && (
              <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                Broadcast post will be sent to {selectedCount} protocol
                {selectedCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Co-hosts */}
          {coHostOptions.length > 0 && (
            <div>
              <p className="mb-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                Co-hosts <span className="font-normal text-gray-600">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {coHostOptions.map((cohost) => {
                  const isSelected = selectedCoHosts.includes(cohost.id);
                  return (
                    <button
                      key={cohost.id}
                      type="button"
                      onClick={() => toggleCoHost(cohost.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                        isSelected
                          ? 'border-degen-500/40 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                      }`}
                    >
                      {cohost.avatarUrl ? (
                        <Image
                          src={cohost.avatarUrl}
                          alt=""
                          width={16}
                          height={16}
                          className="h-4 w-4 rounded-full"
                          unoptimized
                        />
                      ) : (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-muted)]/20 text-[8px]">
                          {cohost.displayName[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                      {cohost.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* When */}
          <div>
            <p className="mb-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              When
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('now')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  mode === 'now'
                    ? 'border-degen-500/40 bg-degen-500/10 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.08)]'
                    : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Now
              </button>
              <button
                type="button"
                onClick={() => setMode('schedule')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  mode === 'schedule'
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.08)]'
                    : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Schedule
              </button>
            </div>
            {mode === 'schedule' && (
              <div className="mt-3 animate-slide-up">
                <label
                  htmlFor="space-schedule"
                  className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]"
                >
                  Pick date & time
                </label>
                <input
                  id="space-schedule"
                  type="datetime-local"
                  min={minPickerDate}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none transition-all focus:border-cyan-500/50"
                />
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Must be at least 5 minutes from now
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2.5">
              <span className="text-xs text-red-400">⚠</span>
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* ── Create button ── */}
        <div className="border-t border-[var(--color-glass-border)] px-5 py-3.5">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !title.trim() || (mode === 'schedule' && !scheduledAt)}
            className="w-full rounded-xl bg-degen-500 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.2)] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            {creating ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Creating Space...
              </span>
            ) : mode === 'schedule' ? (
              `Schedule Space${selectedCount > 0 ? ` → ${selectedCount} protocol${selectedCount > 1 ? 's' : ''}` : ''}`
            ) : (
              `Start Space${selectedCount > 0 ? ` → ${selectedCount} protocol${selectedCount > 1 ? 's' : ''}` : ''}`
            )}
          </button>
          {!hasSignedIn && (
            <p className="mt-2 text-center text-[10px] text-gray-600">
              Not signed in — space will start without broadcast
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
