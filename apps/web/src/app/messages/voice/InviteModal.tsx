'use client';

import { useCallback, useState } from 'react';
import { useAnnouncer } from '../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../lib/retryFetch';
import type { VoiceRoom, VoiceRoomSummary } from './types';

/* ─── Create Room Modal ────────────────────────────────────────────── */

export function CreateRoomModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (room: VoiceRoomSummary) => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteOnly, setInviteOnly] = useState(false);
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
      const data = await retryFetchJson<{ ok: boolean; room: VoiceRoom }>('/api/voice/create', {
        maxRetries: 1,
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: name.trim(),
            type: 'voice',
            password: password || undefined,
            inviteOnly,
          }),
        },
      });
      if (data.ok && data.room) {
        announce(`Room "${name}" created`, 'polite');
        onCreated({
          id: data.room.id,
          name: data.room.name,
          type: 'voice',
          participantCount: 1,
          maxParticipants: data.room.maxParticipants,
          hasPassword: !!data.room.passwordHash,
          inviteOnly: data.room.inviteOnly,
          createdBy: data.room.createdBy,
          lastActivity: data.room.lastActivity,
        });
        onClose();
        setName('');
        setPassword('');
        setInviteOnly(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  }, [name, password, inviteOnly, announce, onCreated, onClose]);

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
        aria-labelledby="create-room-title"
      >
        <h2 id="create-room-title" className="text-lg font-bold text-[var(--color-fg)] mb-5">
          Create Voice Room
        </h2>
        <div className="mb-4">
          <label
            htmlFor="room-name"
            className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
          >
            Room Name
          </label>
          <input
            id="room-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Trading Lounge"
            maxLength={100}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="room-password"
            className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
          >
            Password (optional)
          </label>
          <input
            id="room-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty for public room"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
          />
        </div>
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={inviteOnly}
            onClick={() => setInviteOnly(!inviteOnly)}
            className={`relative h-5 w-9 rounded-full transition-colors ${inviteOnly ? 'bg-degen-500' : 'bg-[var(--color-muted)]/30'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${inviteOnly ? 'translate-x-4' : ''}`}
            />
          </button>
          <button
            type="button"
            className="text-sm text-[var(--color-fg)] cursor-pointer select-none"
            onClick={() => setInviteOnly(!inviteOnly)}
          >
            Invite-only room
          </button>
        </div>
        {error && (
          <p className="mb-4 text-xs text-red-400 flex items-center gap-1.5" role="alert">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M5.5 5.5l5 5M10.5 5.5l-5 5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
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
            {creating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Join Room Modal ──────────────────────────────────────────────── */

export function JoinRoomModal({
  room,
  open,
  onClose,
  onJoined,
}: {
  room: VoiceRoomSummary | null;
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [password, setPassword] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    if (!room) return;
    setJoining(true);
    setError(null);
    try {
      const data = await retryFetchJson<{ ok: boolean }>(`/api/voice/${room.id}/join`, {
        maxRetries: 1,
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password: password || undefined }),
        },
      });
      if (data.ok) {
        onJoined();
        onClose();
        setPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  }, [room, password, onJoined, onClose]);

  if (!open || !room) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-room-title"
      >
        <h2 id="join-room-title" className="text-lg font-bold text-[var(--color-fg)] mb-2">
          Join &ldquo;{room.name}&rdquo;
        </h2>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''} in this room
        </p>
        {room.hasPassword && (
          <div className="mb-4">
            <label
              htmlFor="join-password"
              className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5"
            >
              Password Required
            </label>
            <input
              id="join-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter room password"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
            />
          </div>
        )}
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
            onClick={handleJoin}
            disabled={joining || (room.hasPassword && !password.trim())}
            className="flex-1 rounded-xl bg-degen-500 py-2.5 text-sm font-bold text-black hover:bg-degen-400 disabled:opacity-30 transition-all"
          >
            {joining ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
