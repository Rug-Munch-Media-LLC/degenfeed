/**
 * @degenfeed/ui — HostSpaceModal
 *
 * Modal for creating and hosting an Audio Space.
 * Handles title/topic input, protocol broadcast selection,
 * co-host selection, scheduling, and space creation.
 *
 * ─── CROSS-PROTOCOL BROADCAST ─────────────────────────────────────
 * When a space is created, a broadcast post is published to all
 * selected protocols: "🔊 LIVE: {title} — Join the Space on DegenFeed"
 * This drives traffic from external protocols into the app.
 *
 * The host must be signed into each protocol they want to broadcast
 * to. Broadcast posts are sent via the same publish pipeline used
 * for compose (POST /api/publish).
 */

'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

// ─── Types ────────────────────────────────────────────────────────

const BROADCAST_PROTOCOLS = [
  { id: 'nostr', label: 'Nostr' },
  { id: 'farcaster', label: 'Farcaster' },
  { id: 'lens', label: 'Lens' },
  { id: 'mastodon', label: 'Mastodon' },
] as const;

export interface CoHostOption {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
}

export interface HostSpaceModalProps {
  open: boolean;
  onClose: () => void;
  /** Map of protocol IDs the user is signed into */
  signedInProtocols: Record<string, boolean>;
  /** Current user's identity */
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  /** Available co-host options (followers, friends, etc.) */
  coHostOptions?: CoHostOption[];
  /** Called when the space is created. Returns the space record. */
  onSpaceCreated: (space: {
    id: string;
    title: string;
    protocols: string[];
    status: 'live' | 'scheduled';
    scheduledAt?: string;
  }) => void;
  /** Called to broadcast the space creation to selected protocols */
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
    for (const p of BROADCAST_PROTOCOLS) {
      initial[p.id] = !!signedInProtocols[p.id];
    }
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
    for (const p of BROADCAST_PROTOCOLS) {
      initial[p.id] = !!signedInProtocols[p.id];
    }
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

  // Min datetime for the picker: now + 5 minutes
  const minPickerDate = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);

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

      // Broadcast to selected protocols
      if (selectedProtocols.length > 0 && onBroadcast) {
        const broadcastText = `🔊 LIVE: ${title.trim()} — Join the Space on DegenFeed`;
        try {
          await onBroadcast(broadcastText, selectedProtocols);
        } catch {
          // Broadcast failure is non-fatal — space is already created
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">
            <span className="mr-2">🔊</span>
            Host a Space
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="space-title" className="mb-1 block text-xs font-medium text-gray-400">
              Space title / topic
            </label>
            <input
              id="space-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DeFi Alpha Discussion"
              maxLength={100}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500"
            />
            <p className="mt-1 text-[10px] text-gray-500">{title.length}/100</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="space-desc" className="mb-1 block text-xs font-medium text-gray-400">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this space about?"
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500"
            />
          </div>

          {/* Broadcast protocols */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-400">
              Broadcast to protocols <span className="text-gray-600">(requires sign-in)</span>
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
                      if (!isConnected) return;
                      toggleProtocol(protocol.id);
                    }}
                    disabled={!isConnected}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                      isEnabled
                        ? 'border-current opacity-100'
                        : 'border-[var(--color-border)] opacity-40 hover:opacity-70'
                    } ${!isConnected ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'}`}
                    style={{
                      color: isEnabled ? getProtocolColor(protocol.id) : '#666',
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
              <p className="mt-1 text-[10px] text-gray-500">
                When the space starts, a broadcast post will be sent to {selectedCount} protocol
                {selectedCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Co-hosts */}
          {coHostOptions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-400">
                Co-hosts <span className="text-gray-600">(optional)</span>
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
                          ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-border)] text-gray-400 hover:text-[var(--color-fg)]'
                      }`}
                    >
                      {cohost.avatarUrl ? (
                        <Image src={cohost.avatarUrl} alt="" width={16} height={16} className="h-4 w-4 rounded-full" unoptimized />
                      ) : (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-muted)] text-[8px]">
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

          {/* Schedule or start now */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-400">When</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('now')}
                className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'now'
                    ? 'border-degen-500/50 bg-degen-500/10 text-degen-400'
                    : 'border-[var(--color-border)] text-gray-400 hover:text-[var(--color-fg)]'
                }`}
              >
                Start now
              </button>
              <button
                type="button"
                onClick={() => setMode('schedule')}
                className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'schedule'
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                    : 'border-[var(--color-border)] text-gray-400 hover:text-[var(--color-fg)]'
                }`}
              >
                Schedule
              </button>
            </div>
            {mode === 'schedule' && (
              <div className="mt-2">
                <input
                  type="datetime-local"
                  min={minPickerDate}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-cyan-500"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Must be at least 5 minutes from now
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Create button */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          {hasSignedIn ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !title.trim() || (mode === 'schedule' && !scheduledAt)}
              className="w-full rounded-xl bg-degen-500 px-4 py-3 text-sm font-semibold text-black hover:bg-degen-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating
                ? '\u23F3 Creating Space...'
                : mode === 'schedule'
                  ? `Schedule Space${selectedCount > 0 ? ` \u2192 ${selectedCount} protocol${selectedCount > 1 ? 's' : ''}` : ''}`
                  : `Start Space${selectedCount > 0 ? ` \u2192 ${selectedCount} protocol${selectedCount > 1 ? 's' : ''}` : ''}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-[var(--color-fg)] transition-colors"
            >
              Start Space (no broadcast)
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
