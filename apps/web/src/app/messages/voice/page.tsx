'use client';

/**
 * Voice Rooms — Discord-style voice chat
 *
 * Features:
 * - Voice connected indicator with green pulse
 * - Participant list with speaker indicators
 * - Push-to-talk toggle
 * - Mute/deafen buttons
 * - Screen share button
 * - Leave quietly button
 * - Voice activity detection (animate border when speaking)
 * - Invite link generation
 * - Password-protected rooms
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useAnnouncer } from '../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../lib/retryFetch';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface VoiceRoom {
  id: string;
  name: string;
  type: 'voice' | 'video';
  createdBy: string;
  createdAt: number;
  lastActivity: number;
  active: boolean;
  maxParticipants: number;
  passwordHash: string;
  inviteOnly: boolean;
  participants: VoiceParticipant[];
}

interface VoiceRoomSummary {
  id: string;
  name: string;
  type: 'voice' | 'video';
  participantCount: number;
  maxParticipants: number;
  hasPassword: boolean;
  inviteOnly: boolean;
  createdBy: string;
  lastActivity: number;
}

interface VoiceParticipant {
  walletAddress: string;
  displayName: string;
  joinedAt: number;
  muted: boolean;
  videoMuted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  connected: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function _shortAddr(addr: string): string {
  if (!addr) return 'Unknown';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function getInitials(name: string): string {
  return (
    name
      .split(/[\s:@]+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/* ─── Participant Row ──────────────────────────────────────────────── */

function ParticipantRow({
  participant,
  isMe,
  isSpeaking,
  onToggleMute,
  onToggleDeafen,
  onToggleHandRaise,
}: {
  participant: VoiceParticipant;
  isMe: boolean;
  isSpeaking: boolean;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onToggleHandRaise?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
        isSpeaking ? 'bg-degen-500/10 ring-1 ring-degen-500/40' : 'hover:bg-[var(--color-overlay)]'
      }`}
    >
      {/* Avatar with speaking indicator */}
      <div className="relative shrink-0">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
            isSpeaking
              ? 'bg-degen-500 text-black shadow-[0_0_12px_rgba(0,255,65,0.3)]'
              : 'bg-[var(--color-overlay)] text-[var(--color-fg)]'
          }`}
        >
          {getInitials(participant.displayName)}
        </span>
        {isSpeaking && (
          <span
            className="absolute -inset-0.5 rounded-full border-2 border-degen-500/50 animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm truncate ${isMe ? 'font-bold text-degen-400' : 'font-medium text-[var(--color-fg)]'}`}
          >
            {participant.displayName}
            {isMe && ' (you)'}
          </p>
          {participant.screenSharing && (
            <span className="text-[10px] text-degen-400 flex items-center gap-0.5">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Screen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Audio status */}
          {participant.deafened ? (
            <span className="text-[10px] text-red-400">Deafened</span>
          ) : participant.muted ? (
            <span className="text-[10px] text-amber-400">Muted</span>
          ) : isSpeaking ? (
            <span className="text-[10px] text-degen-400 flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="h-2 w-0.5 rounded-full bg-degen-400 animate-pulse" />
                <span
                  className="h-3 w-0.5 rounded-full bg-degen-400 animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-2 w-0.5 rounded-full bg-degen-400 animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
              Speaking
            </span>
          ) : (
            <span className="text-[10px] text-[var(--color-muted)]">Connected</span>
          )}
          {participant.handRaised && (
            <span className="text-[12px]" aria-label="Hand raised">
              ✋
            </span>
          )}
        </div>
      </div>

      {/* Controls (self only) */}
      {isMe && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={`rounded-lg p-1.5 transition-colors ${
              participant.muted
                ? 'bg-red-500/20 text-red-400'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
            }`}
            aria-label={participant.muted ? 'Unmute' : 'Mute'}
            title={participant.muted ? 'Unmute' : 'Mute'}
          >
            {participant.muted ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleDeafen}
            className={`rounded-lg p-1.5 transition-colors ${
              participant.deafened
                ? 'bg-red-500/20 text-red-400'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
            }`}
            aria-label={participant.deafened ? 'Undeafen' : 'Deafen'}
            title={participant.deafened ? 'Undeafen' : 'Deafen'}
          >
            {participant.deafened ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M17.5 17.5A10 10 0 015 12" />
                <path d="M3.5 3.5l17 17" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M7 12a5 5 0 015-5" />
                <path d="M12 7a5 5 0 012.5 1.5" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M7 12a5 5 0 015-5" />
                <path d="M12 7a5 5 0 012.5 1.5" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleHandRaise}
            className={`rounded-lg p-1.5 transition-colors ${
              participant.handRaised
                ? 'bg-degen-500/20 text-degen-400'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
            }`}
            aria-label={participant.handRaised ? 'Lower hand' : 'Raise hand'}
            title={participant.handRaised ? 'Lower hand' : 'Raise hand'}
          >
            ✋
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Create Room Modal ────────────────────────────────────────────── */

function CreateRoomModal({
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
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
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
            className={`relative h-5 w-9 rounded-full transition-colors ${
              inviteOnly ? 'bg-degen-500' : 'bg-[var(--color-muted)]/30'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                inviteOnly ? 'translate-x-4' : ''
              }`}
            />
          </button>
          <label
            className="text-sm text-[var(--color-fg)] cursor-pointer select-none"
            onClick={() => setInviteOnly(!inviteOnly)}
          >
            Invite-only room
          </label>
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
            className="flex-1 rounded-xl bg-degen-500 py-2.5 text-sm font-bold text-black hover:bg-degen-400 disabled:opacity-30 transition-all disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Join Room Modal ──────────────────────────────────────────────── */

function JoinRoomModal({
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
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
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

/* ─── Voice Room View (connected) ──────────────────────────────────── */

function VoiceRoomView({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const { tokens } = useAuth();
  const userId = tokens.evmAddress?.toLowerCase() ?? '';
  const { announce } = useAnnouncer();

  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const pushToTalkRef = useRef(false);

  // Fetch room state
  const fetchRoom = useCallback(async () => {
    try {
      const data = await retryFetchJson<{ participants: VoiceParticipant[]; roomName: string }>(
        `/api/voice/${roomId}/participants`,
        { maxRetries: 1 },
      );
      setRoom((prev) => {
        if (!prev) {
          return {
            id: roomId,
            name: data.roomName,
            type: 'voice',
            createdBy: '',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            active: true,
            maxParticipants: 0,
            passwordHash: '',
            inviteOnly: false,
            participants: data.participants,
          } as VoiceRoom;
        }
        return { ...prev, participants: data.participants, name: data.roomName };
      });
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    pollingRef.current = setInterval(fetchRoom, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchRoom]);

  // Leave room
  const handleLeave = useCallback(async () => {
    try {
      await retryFetchJson(`/api/voice/${roomId}/leave`, {
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
        },
      });
      announce('Left voice room', 'polite');
    } catch {
      // Handle silently
    }
    onLeave();
  }, [roomId, onLeave, announce]);

  // Participant update
  const updateState = useCallback(
    async (updates: Partial<VoiceParticipant>) => {
      try {
        const data = await retryFetchJson<{ ok: boolean; room: VoiceRoom }>(
          `/api/voice/${roomId}/update`,
          {
            maxRetries: 0,
            fetchOptions: {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(updates),
            },
          },
        );
        if (data.ok && data.room) {
          setRoom(data.room);
        }
      } catch {
        // Handle silently
      }
    },
    [roomId],
  );

  const me = useMemo(
    () => room?.participants.find((p) => p.walletAddress === userId),
    [room, userId],
  );

  const _isSpeaking = me && !me.muted && !me.deafened;

  // Generate invite
  const handleGenerateInvite = useCallback(async () => {
    try {
      const data = await retryFetchJson<{ ok: boolean; code: string; inviteUrl: string }>(
        `/api/voice/${roomId}/invite`,
        { maxRetries: 1 },
      );
      if (data.ok && data.code) {
        const url = `${window.location.origin}/messages/voice?invite=${data.code}`;
        await navigator.clipboard.writeText(url);
        setCopiedInvite(true);
        announce('Invite link copied', 'polite');
        setTimeout(() => setCopiedInvite(false), 2000);
      }
    } catch {
      // Handle error
    }
  }, [roomId, announce]);

  // Push-to-talk key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !pushToTalkRef.current) {
        pushToTalkRef.current = true;
        setPushToTalk(true);
        updateState({ muted: false });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        pushToTalkRef.current = false;
        setPushToTalk(false);
        updateState({ muted: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [updateState]);

  // Simulated VAD (would use Web Audio API in production)
  const [speakingUsers] = useState(new Set<string>());

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="text-xs text-[var(--color-muted)]">Connecting to voice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Voice connected banner */}
      <div className="flex items-center gap-2 bg-degen-500/8 border-b border-degen-500/20 px-4 py-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-degen-500" />
        </span>
        <span className="text-xs font-medium text-degen-400">Voice Connected</span>
        <span className="text-[10px] text-[var(--color-muted)]">
          &middot; {room?.name ?? 'Voice Room'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateInvite}
            className="rounded-lg px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-degen-400 transition-colors flex items-center gap-1"
            title="Copy invite link"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            {copiedInvite ? 'Copied!' : 'Invite'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Participants ({room?.participants.length ?? 0})
        </p>

        {room?.participants.map((p) => (
          <ParticipantRow
            key={p.walletAddress}
            participant={p}
            isMe={p.walletAddress === userId}
            isSpeaking={
              speakingUsers.has(p.walletAddress) || (pushToTalk && p.walletAddress === userId)
            }
            onToggleMute={() => updateState({ muted: !p.muted })}
            onToggleDeafen={() => updateState({ deafened: !p.deafened })}
            onToggleHandRaise={() => updateState({ handRaised: !p.handRaised })}
          />
        ))}
      </div>

      {/* Bottom controls */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 shrink-0">
        <div className="flex items-center justify-center gap-3">
          {/* Mute */}
          <button
            type="button"
            onClick={() => updateState({ muted: !me?.muted })}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
              me?.muted
                ? 'bg-red-500/20 text-red-400'
                : 'hover:bg-[var(--color-overlay)] text-[var(--color-fg)]'
            }`}
            aria-label={me?.muted ? 'Unmute' : 'Mute'}
          >
            {me?.muted ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </svg>
            )}
            <span className="text-[9px]">{me?.muted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Deafen */}
          <button
            type="button"
            onClick={() => updateState({ deafened: !me?.deafened })}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
              me?.deafened
                ? 'bg-red-500/20 text-red-400'
                : 'hover:bg-[var(--color-overlay)] text-[var(--color-fg)]'
            }`}
            aria-label={me?.deafened ? 'Undeafen' : 'Deafen'}
          >
            {me?.deafened ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M17.5 17.5A10 10 0 015 12" />
                <path d="M3.5 3.5l17 17" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M7 12a5 5 0 015-5" />
                <path d="M12 7a5 5 0 012.5 1.5" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M7 12a5 5 0 015-5" />
                <path d="M12 7a5 5 0 012.5 1.5" />
              </svg>
            )}
            <span className="text-[9px]">{me?.deafened ? 'Undeafen' : 'Deafen'}</span>
          </button>

          {/* Screen share */}
          <button
            type="button"
            onClick={() => updateState({ screenSharing: !me?.screenSharing })}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
              me?.screenSharing
                ? 'bg-degen-500/20 text-degen-400'
                : 'hover:bg-[var(--color-overlay)] text-[var(--color-fg)]'
            }`}
            aria-label={me?.screenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="text-[9px]">Screen</span>
          </button>

          {/* Push to talk indicator */}
          <button
            type="button"
            onClick={() => updateState({ muted: !me?.muted })}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
              pushToTalk
                ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500'
                : 'hover:bg-[var(--color-overlay)] text-[var(--color-fg)]'
            }`}
            aria-label="Push to talk"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span className="text-[9px]">{pushToTalk ? 'Talking' : 'PTT'}</span>
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={handleLeave}
            className="flex flex-col items-center gap-1 rounded-xl bg-red-500/20 px-4 py-2 text-red-400 hover:bg-red-500/30 transition-all"
            aria-label="Leave voice room"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="text-[9px]">Leave</span>
          </button>
        </div>

        {/* Push to talk hint */}
        <p className="text-center text-[9px] text-[var(--color-muted)] mt-2">
          Hold{' '}
          <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[8px] font-mono">
            Space
          </kbd>{' '}
          for push-to-talk
        </p>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────── */

export default function VoicePage() {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [rooms, setRooms] = useState<VoiceRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<VoiceRoomSummary | null>(null);
  const { announce } = useAnnouncer();

  // Fetch active rooms
  const fetchRooms = useCallback(async () => {
    if (!hasSignedIn) return;
    setLoading(true);
    try {
      const data = await retryFetchJson<{ rooms: VoiceRoomSummary[] }>(
        '/api/voice/active?type=voice',
        { maxRetries: 2 },
      );
      setRooms(data.rooms ?? []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Poll rooms list
  useEffect(() => {
    if (!selectedRoomId) {
      const interval = setInterval(fetchRooms, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchRooms, selectedRoomId]);

  // Check for invite code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite');
    if (inviteCode) {
      retryFetchJson<{ ok: boolean; room: VoiceRoomSummary }>(`/api/voice/invite/${inviteCode}`, {
        maxRetries: 1,
      })
        .then((data) => {
          if (data.ok && data.room) {
            // Join directly or prompt to join
            retryFetchJson(`/api/voice/${data.room.id}/join`, {
              fetchOptions: {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
              },
            })
              .then(() => {
                setSelectedRoomId(data.room.id);
                announce('Joined room from invite', 'polite');
              })
              .catch(() => {
                setJoinTarget(data.room);
              });
          }
        })
        .catch(() => {
          // Invalid invite
        });
    }
  }, [announce]);

  if (!hasSignedIn) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col items-center justify-center p-6 lg:h-[calc(100dvh-4rem)]">
        <span
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl bg-[var(--color-overlay)] text-[var(--color-muted)]"
          aria-hidden="true"
        >
          🎤
        </span>
        <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use Voice Rooms</p>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Real-time voice chat with your community.
        </p>
      </div>
    );
  }

  // Connected voice room view
  if (selectedRoomId) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
        <VoiceRoomView roomId={selectedRoomId} onLeave={() => setSelectedRoomId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">
            🎤
          </span>
          <div>
            <h1 className="text-base font-bold text-[var(--color-fg)] leading-tight">
              Voice Rooms
            </h1>
            <p className="text-[10px] text-[var(--color-muted)]">
              {rooms.length} active room{rooms.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-degen-500 px-3 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Room
        </button>
      </header>

      {/* Rooms list */}
      <div className="flex-1 overflow-y-auto">
        {loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <span className="mb-4 text-4xl opacity-30" aria-hidden="true">
              🎤
            </span>
            <p className="text-sm font-medium text-[var(--color-fg)]">No active voice rooms</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Create a room and invite others to join.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-degen-500 px-4 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
            >
              Create Your First Room
            </button>
          </div>
        )}

        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => {
              if (room.hasPassword || room.inviteOnly) {
                setJoinTarget(room);
              } else {
                // Join directly
                retryFetchJson(`/api/voice/${room.id}/join`, {
                  fetchOptions: {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    credentials: 'include',
                  },
                })
                  .then(() => setSelectedRoomId(room.id))
                  .catch(() => {
                    setJoinTarget(room);
                  });
              }
            }}
            className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-overlay)] transition-colors"
          >
            {/* Room icon — animated if has people */}
            <div className="relative shrink-0">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                  room.participantCount > 0 ? 'bg-degen-500/15' : 'bg-[var(--color-overlay)]'
                }`}
              >
                {room.hasPassword ? '🔒' : '🎤'}
              </span>
              {room.participantCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-degen-500" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-fg)] truncate">{room.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-[var(--color-muted)]">
                  {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--color-muted)]">·</span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  {timeAgo(room.lastActivity)}
                </span>
                {room.inviteOnly && (
                  <>
                    <span className="text-[var(--color-muted)]">·</span>
                    <span className="text-[10px] text-amber-400">Invite only</span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <span className="rounded-lg bg-degen-500/10 px-2 py-1 text-[10px] font-medium text-degen-400">
                {room.participantCount > 0 ? 'Join' : 'Enter'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Create room modal */}
      <CreateRoomModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(room) => {
          setRooms((prev) => [room, ...prev]);
          setSelectedRoomId(room.id);
        }}
      />

      {/* Join room modal (for password-protected) */}
      <JoinRoomModal
        room={joinTarget}
        open={!!joinTarget}
        onClose={() => setJoinTarget(null)}
        onJoined={() => {
          if (joinTarget) setSelectedRoomId(joinTarget.id);
        }}
      />
    </div>
  );
}
