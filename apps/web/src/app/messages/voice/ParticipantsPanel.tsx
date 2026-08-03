'use client';

import { useCallback, useEffect, useRef, useState} from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useAnnouncer } from '../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../lib/retryFetch';
import type { VoiceParticipant, VoiceRoom } from './types';
import { getInitials } from './types';

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
      {isMe && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={`rounded-lg p-1.5 transition-colors ${participant.muted ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
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
            className={`rounded-lg p-1.5 transition-colors ${participant.deafened ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
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
            className={`rounded-lg p-1.5 transition-colors ${participant.handRaised ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
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

/* ─── Voice Room View (connected) ──────────────────────────────────── */

export function VoiceRoomView({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const { tokens } = useAuth();
  const userId = tokens.evmAddress?.toLowerCase() ?? '';
  const { announce } = useAnnouncer();

  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const pushToTalkRef = useRef(false);

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
      /* Handle error */
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
      /* Handle silently */
    }
    onLeave();
  }, [roomId, onLeave, announce]);

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
        if (data.ok && data.room) setRoom(data.room);
      } catch {
        /* Handle silently */
      }
    },
    [roomId],
  );

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
      /* Handle error */
    }
  }, [roomId, announce]);

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
            isSpeaking={speakingUsers.has(p.walletAddress)}
            onToggleMute={
              p.walletAddress === userId ? () => updateState({ muted: !p.muted }) : undefined
            }
            onToggleDeafen={
              p.walletAddress === userId ? () => updateState({ deafened: !p.deafened }) : undefined
            }
            onToggleHandRaise={
              p.walletAddress === userId
                ? () => updateState({ handRaised: !p.handRaised })
                : undefined
            }
          />
        ))}
      </div>
      <div className="p-3 border-t border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {pushToTalk && (
              <span className="text-[10px] text-degen-400 font-medium">Push to talk active</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 rounded-xl bg-red-500/20 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors"
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
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Leave Quietly
          </button>
        </div>
      </div>
    </div>
  );
}
