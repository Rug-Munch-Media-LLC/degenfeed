'use client';

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import { useCallback, useMemo, useState } from 'react';

// === Constants ====================================================

const BROADCAST_PROTOCOLS = [
  // Audio
  { id: 'nostr', label: 'Nostr', group: 'audio' },
  { id: 'peertube', label: 'PeerTube', group: 'audio' },
  { id: 'owncast', label: 'Owncast', group: 'audio' },
  { id: 'livepeer', label: 'LivePeer', group: 'audio' },
  // Social Announce
  { id: 'farcaster', label: 'Farcaster', group: 'social' },
  { id: 'lens', label: 'Lens', group: 'social' },
  { id: 'bluesky', label: 'Bluesky', group: 'social' },
  { id: 'mastodon', label: 'Mastodon', group: 'social' },
  { id: 'discord', label: 'Discord', group: 'social' },
  { id: 'telegram', label: 'Telegram', group: 'social' },
  { id: 'twitter', label: 'X / Twitter', group: 'social' },
  // Video
  { id: 'youtube', label: 'YouTube Live', group: 'video' },
  { id: 'twitch', label: 'Twitch', group: 'video' },
  { id: 'kick', label: 'Kick', group: 'video' },
  // Photos
  { id: 'nostr-pictures', label: 'Nostr Photos', group: 'photos' },
  { id: 'bluesky-photos', label: 'Bsky Photos', group: 'photos' },
  { id: 'pixelfed', label: 'Pixelfed', group: 'photos' },
] as const;

const MAX_TITLE_LENGTH = 100;
const MAX_DESC_LENGTH = 500;

// === Types ========================================================

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
  signedInProtocols: Record<string, boolean>;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  onSpaceCreated: (space: {
    id: string;
    title: string;
    protocols: string[];
    status: 'live' | 'scheduled';
    scheduledAt?: string;
  }) => void;
  onBroadcast?: (text: string, protocols: string[]) => Promise<void>;
}

// === Component ====================================================

export function CreateSpaceModal({
  open,
  onClose,
  signedInProtocols,
  hostId,
  hostName,
  hostAvatarUrl,
  onSpaceCreated,
  onBroadcast,
}: CreateSpaceModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [enabledProtocols, setEnabledProtocols] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of BROADCAST_PROTOCOLS) initial[p.id] = !!signedInProtocols[p.id];
    return initial;
  });
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isRecorded, setIsRecorded] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useMemo(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setTags('');
    const initial: Record<string, boolean> = {};
    for (const p of BROADCAST_PROTOCOLS) initial[p.id] = !!signedInProtocols[p.id];
    setEnabledProtocols(initial);
    setMode('now');
    setScheduledAt('');
    setIsRecorded(true);
    setCreating(false);
    setError(null);
  }, [open, signedInProtocols]);

  const toggleProtocol = useCallback((id: string) => {
    setEnabledProtocols((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectedCount = useMemo(
    () => Object.values(enabledProtocols).filter(Boolean).length,
    [enabledProtocols],
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
        protocols: selectedProtocols,
        tippingEnabled: true,
        isRecorded,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
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

      // Broadcast announcement to protocols
      if (selectedProtocols.length > 0 && onBroadcast) {
        const announcement =
          data.space.status === 'live'
            ? `🔊 LIVE now: ${title.trim()} — Join the Space on DegenFeed`
            : `📅 Upcoming Space: ${title.trim()} — ${new Date(scheduledAt).toLocaleDateString()} on DegenFeed`;
        try {
          await onBroadcast(announcement, selectedProtocols);
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
    tags,
    hostId,
    hostName,
    hostAvatarUrl,
    enabledProtocols,
    mode,
    scheduledAt,
    isRecorded,
    onBroadcast,
    onSpaceCreated,
    onClose,
  ]);

  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a Space"
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        style={{ maxHeight: '90vh' }}
      >
        {/* == Header == */}
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
            <h2 className="text-sm font-bold text-[var(--color-fg)]">Create a Space</h2>
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

        {/* == Content == */}
        <div className="flex-1 overflow-y-auto space-y-5 px-5 py-4">
          {/* Title */}
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
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[10px] text-[var(--color-muted)]">What&apos;s this space about?</p>
              <span
                className={`text-[10px] font-mono transition-colors ${titleRemaining < 10 ? 'text-red-400' : 'text-[var(--color-muted)]'}`}
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
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="space-tags"
              className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider"
            >
              Tags <span className="font-normal text-gray-600">(comma-separated)</span>
            </label>
            <input
              id="space-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="defi, solana, alpha"
              className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/10 px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-gray-600 outline-none transition-all focus:border-degen-500/50"
            />
          </div>

          {/* Recording toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/5 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-[var(--color-fg)]">Auto-record space</p>
              <p className="text-[10px] text-[var(--color-muted)]">
                Recording will be saved as a podcast
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsRecorded(!isRecorded)}
              className={`relative h-6 w-11 rounded-full transition-all ${
                isRecorded ? 'bg-degen-500' : 'bg-[var(--color-muted)]/30'
              }`}
              aria-label={isRecorded ? 'Disable recording' : 'Enable recording'}
              role="switch"
              aria-checked={isRecorded}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  isRecorded ? 'translate-x-5' : ''
                }`}
              />
            </button>
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
          </div>

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
              <div className="mt-3">
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

        {/* == Create button == */}
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
        </div>
      </div>
    </section>
  );
}
