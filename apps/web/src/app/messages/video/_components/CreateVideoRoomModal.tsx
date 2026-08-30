'use client';

import { useCallback, useState } from 'react';
import { useAnnouncer } from '../../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../../lib/retryFetch';
import type { VideoRoom } from '../types';

export function CreateVideoRoomModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { announce } = useAnnouncer();

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Room name is required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const data = await retryFetchJson<{ ok: boolean; room: VideoRoom }>('/api/voice/create', {
        maxRetries: 1,
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: name.trim(), type: 'video' }),
        },
      });
      if (data.ok && data.room) {
        announce(`Video room "${name}" created`, 'polite');
        onCreated(data.room.id);
        onClose();
        setName('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  }, [name, announce, onCreated, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-video-title"
      >
        <h2 id="create-video-title" className="text-lg font-bold text-[var(--color-fg)] mb-5">
          Start Video Room
        </h2>
        <div className="mb-4">
          <label
            htmlFor="video-room-name"
            className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
          >
            Room Name
          </label>
          <input
            id="video-room-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standup Meeting"
            maxLength={100}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
          />
        </div>
        {error && (
          <p className="mb-4 text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 rounded-xl bg-degen-500 py-2.5 text-sm font-bold text-black hover:bg-degen-400 disabled:opacity-30 transition-all"
          >
            {creating ? 'Creating...' : 'Start Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
