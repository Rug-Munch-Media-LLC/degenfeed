'use client';

/**
 * Video Rooms — Zoom/Discord-style video chat
 *
 * Features:
 * - Grid of participant videos
 * - Speaker view (large video of active speaker)
 * - Controls: mute, camera off, screen share, chat overlay, leave
 * - Hand raise button
 * - Emoji reactions (floating emojis)
 * - Room chat sidebar
 * - Invite link generation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useAnnouncer } from '../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../lib/retryFetch';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface VideoRoom {
  id: string;
  name: string;
  participants: VideoParticipant[];
  createdBy: string;
}

interface VideoParticipant {
  walletAddress: string;
  displayName: string;
  muted: boolean;
  videoMuted: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  connected: boolean;
}

interface VideoRoomSummary {
  id: string;
  name: string;
  participantCount: number;
  hasPassword: boolean;
  createdBy: string;
  lastActivity: number;
}

/* ─── Emoji Reaction Constants ─────────────────────────────────────── */

const REACTIONS = ['❤️', '😂', '🔥', '👍', '🎉', '😮', '👏', '🚀', '💯', '🫡'] as const;

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  y: number;
  createdAt: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function shortAddr(addr: string): string {
  if (!addr) return 'Unknown';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function getInitials(name: string): string {
  return name.split(/[\s:@]+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

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

/* ─── Video Tile ────────────────────────────────────────────────────── */

function VideoTile({
  participant,
  isMe,
  isSpeaker,
  isScreenShare,
  emojis,
  speaking,
}: {
  participant: VideoParticipant;
  isMe: boolean;
  isSpeaker: boolean;
  isScreenShare?: boolean;
  emojis: FloatingEmoji[];
  speaking: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-black/60 min-h-[160px] flex items-center justify-center transition-all ${
        isSpeaker ? 'ring-2 ring-degen-500 shadow-[0_0_20px_rgba(0,255,65,0.15)]' : ''
      } ${speaking ? 'ring-1 ring-degen-500/60' : ''}`}
    >
      {/* Placeholder avatar when video is off */}
      {(participant.videoMuted || !participant.connected) && (
        <div className="flex flex-col items-center gap-2">
          <span className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${
            speaking ? 'bg-degen-500 text-black' : 'bg-[var(--color-overlay)] text-[var(--color-fg)]'
          }`}>
            {getInitials(participant.displayName)}
          </span>
          {participant.videoMuted && (
            <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M23 7l-7 5 7 5V7z" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              Camera Off
            </span>
          )}
        </div>
      )}

      {/* Screen share indicator */}
      {isScreenShare && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto mb-2 text-degen-400" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p className="text-xs text-[var(--color-muted)]">Screen Share</p>
          </div>
        </div>
      )}

      {/* Participant label */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
          <span className={`text-[9px] font-medium ${isMe ? 'text-degen-400' : 'text-white'}`}>
            {participant.displayName}{isMe ? ' (you)' : ''}
          </span>
          {participant.muted && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-400" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
          {participant.handRaised && <span className="text-[12px]" aria-label="Hand raised">✋</span>}
        </div>
      </div>

      {/* Floating emoji reactions */}
      {emojis.map((emoji) => (
        <span
          key={emoji.id}
          className="absolute pointer-events-none text-xl animate-emoji-float"
          style={{
            left: `${emoji.x}%`,
            bottom: '20%',
            animationDuration: '2s',
          }}
          aria-hidden="true"
        >
          {emoji.emoji}
        </span>
      ))}

      {/* Screen share badge */}
      {isScreenShare && (
        <div className="absolute top-2 left-2 rounded-lg bg-degen-500 px-2 py-0.5 text-[8px] font-bold text-black">
          SCREEN
        </div>
      )}
    </div>
  );
}

/* ─── Create Video Room Modal ──────────────────────────────────────── */

function CreateVideoRoomModal({
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
    if (!name.trim()) { setError('Room name is required'); return; }
    setCreating(true);
    setError(null);
    try {
      const data = await retryFetchJson<{ ok: boolean; room: VideoRoom }>(
        '/api/voice/create',
        {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: name.trim(), type: 'video' }),
          },
        },
      );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-video-title"
      >
        <h2 id="create-video-title" className="text-lg font-bold text-[var(--color-fg)] mb-5">Start Video Room</h2>

        <div className="mb-4">
          <label htmlFor="video-room-name" className="block text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
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
            autoFocus
          />
        </div>

        {error && <p className="mb-4 text-xs text-red-400" role="alert">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors">
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

/* ─── Video Room View ──────────────────────────────────────────────── */

function VideoRoomView({
  roomId,
  onLeave,
}: {
  roomId: string;
  onLeave: () => void;
}) {
  const { tokens } = useAuth();
  const userId = tokens.evmAddress?.toLowerCase() ?? '';
  const { announce } = useAnnouncer();

  const [room, setRoom] = useState<VideoRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ from: string; text: string; ts: number }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [speakerView, setSpeakerView] = useState(false);
  const [copied, setCopied] = useState(false);
  const emojiIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [speakingUser, setSpeakingUser] = useState<string | null>(null);

  // Fetch room
  const fetchRoom = useCallback(async () => {
    try {
      const data = await retryFetchJson<{ participants: VideoParticipant[]; roomName: string }>(
        `/api/voice/${roomId}/participants`,
        { maxRetries: 1 },
      );
      setRoom((prev) => {
        if (!prev) {
          return {
            id: roomId,
            name: data.roomName,
            participants: data.participants,
            createdBy: '',
          };
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
    const interval = setInterval(fetchRoom, 3000);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const me = useMemo(
    () => room?.participants.find((p) => p.walletAddress === userId),
    [room, userId],
  );

  // Update state
  const updateState = useCallback(async (updates: Partial<VideoParticipant>) => {
    try {
      await retryFetchJson(`/api/voice/${roomId}/update`, {
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates),
        },
      });
      fetchRoom();
    } catch {
      // Handle silently
    }
  }, [roomId, fetchRoom]);

  // Leave
  const handleLeave = useCallback(async () => {
    try {
      await retryFetchJson(`/api/voice/${roomId}/leave`, {
        fetchOptions: { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include' },
      });
      announce('Left video room', 'polite');
    } catch {
      // Handle
    }
    onLeave();
  }, [roomId, onLeave, announce]);

  // Send emoji reaction
  const sendReaction = useCallback((emoji: string) => {
    const id = ++emojiIdRef.current;
    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      x: 20 + Math.random() * 60,
      y: 30 + Math.random() * 40,
      createdAt: Date.now(),
    };
    setFloatingEmojis((prev) => [...prev, newEmoji]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
    // Broadcast via WebSocket in production
  }, []);

  // Send chat message
  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    const msg = { from: me?.displayName ?? 'You', text, ts: Date.now() };
    setChatMessages((prev) => [...prev, msg]);
    setChatInput('');
  }, [chatInput, me]);

  // Generate invite
  const handleInvite = useCallback(async () => {
    try {
      const data = await retryFetchJson<{ ok: boolean; code: string }>(
        `/api/voice/${roomId}/invite`,
        { maxRetries: 1 },
      );
      if (data.ok && data.code) {
        const url = `${window.location.origin}/messages/video?invite=${data.code}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        announce('Invite link copied', 'polite');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Handle
    }
  }, [roomId, announce]);

  // Speaker view: show the active speaker large
  const mainSpeaker = speakerView && speakingUser
    ? room?.participants.find((p) => p.walletAddress === speakingUser)
    : null;

  const otherParticipants = useMemo(() => {
    if (!room) return [];
    if (mainSpeaker) {
      return room.participants.filter((p) => p.walletAddress !== mainSpeaker.walletAddress && p.walletAddress !== userId);
    }
    return room.participants;
  }, [room, mainSpeaker, userId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="text-xs text-[var(--color-muted)]">Connecting to video room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-[var(--color-glass-bg)] border-b border-[var(--color-border)] px-4 py-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-degen-500" />
        </span>
        <span className="text-xs font-medium text-degen-400">Video Room</span>
        <span className="text-[10px] text-[var(--color-muted)]">&middot; {room?.name ?? 'Video Room'}</span>
        <span className="text-[10px] text-[var(--color-muted)]">&middot; {room?.participants.length ?? 0} participant{(room?.participants.length ?? 0) !== 1 ? 's' : ''}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSpeakerView(!speakerView)}
            className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${
              speakerView ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
            }`}
          >
            {speakerView ? 'Grid View' : 'Speaker View'}
          </button>
          <button
            type="button"
            onClick={handleInvite}
            className="rounded-lg px-2 py-1 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-degen-400 transition-colors"
          >
            {copied ? 'Copied!' : 'Invite'}
          </button>
          <button
            type="button"
            onClick={() => setShowChat(!showChat)}
            className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${
              showChat ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'
            }`}
          >
            Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className={`flex-1 overflow-y-auto p-3 ${showChat ? 'hidden md:block' : ''}`}>
          {/* Speaker view: large main + small thumbnails */}
          {mainSpeaker ? (
            <div className="h-full flex flex-col gap-3">
              <div className="flex-1">
                <VideoTile
                  participant={mainSpeaker}
                  isMe={false}
                  isSpeaker={true}
                  emojis={floatingEmojis}
                  speaking={speakingUser === mainSpeaker.walletAddress}
                />
              </div>
              {otherParticipants.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {otherParticipants.map((p) => (
                    <div key={p.walletAddress} className="h-28">
                      <VideoTile
                        participant={p}
                        isMe={p.walletAddress === userId}
                        isSpeaker={false}
                        emojis={[]}
                        speaking={speakingUser === p.walletAddress}
                      />
                    </div>
                  ))}
                  {/* Self tile */}
                  {me && me.walletAddress !== mainSpeaker.walletAddress && (
                    <div className="h-28">
                      <VideoTile
                        participant={me}
                        isMe={true}
                        isSpeaker={false}
                        emojis={[]}
                        speaking={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Grid view */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr min-h-[200px]">
              {room?.participants.map((p) => (
                <VideoTile
                  key={p.walletAddress}
                  participant={p}
                  isMe={p.walletAddress === userId}
                  isSpeaker={false}
                  emojis={floatingEmojis}
                  speaking={speakingUser === p.walletAddress}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <aside className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col">
            <div className="border-b border-[var(--color-border)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--color-fg)]">Room Chat</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-[10px] text-[var(--color-muted)] text-center py-8">No messages yet</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className="text-xs">
                  <span className="font-medium text-degen-400">{msg.from}: </span>
                  <span className="text-[var(--color-fg)]">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-[var(--color-border)] p-2 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder="Chat..."
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
              />
              <button
                type="button"
                onClick={sendChat}
                disabled={!chatInput.trim()}
                className="rounded-lg bg-degen-500 px-2.5 py-1.5 text-xs font-bold text-black disabled:opacity-30 transition-all"
              >
                Send
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Emoji reaction bar */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Reactions */}
            <div className="flex items-center gap-0.5">
              {REACTIONS.slice(0, 6).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="rounded-lg px-1.5 py-1 text-sm hover:bg-[var(--color-overlay)] hover:scale-125 transition-all"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <span className="text-[var(--color-border)]">|</span>

            {/* Controls */}
            <button
              type="button"
              onClick={() => updateState({ muted: !me?.muted })}
              className={`rounded-lg p-1.5 transition-colors ${me?.muted ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label={me?.muted ? 'Unmute' : 'Mute'}
              title={me?.muted ? 'Unmute' : 'Mute'}
            >
              {me?.muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => updateState({ videoMuted: !me?.videoMuted })}
              className={`rounded-lg p-1.5 transition-colors ${me?.videoMuted ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label={me?.videoMuted ? 'Turn on camera' : 'Turn off camera'}
              title={me?.videoMuted ? 'Turn on camera' : 'Turn off camera'}
            >
              {me?.videoMuted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => updateState({ screenSharing: !me?.screenSharing })}
              className={`rounded-lg p-1.5 transition-colors ${me?.screenSharing ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label="Share screen"
              title="Share screen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => updateState({ handRaised: !me?.handRaised })}
              className={`rounded-lg p-1.5 transition-colors ${me?.handRaised ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label={me?.handRaised ? 'Lower hand' : 'Raise hand'}
              title={me?.handRaised ? 'Lower hand' : 'Raise hand'}
            >
              ✋
            </button>
          </div>

          <button
            type="button"
            onClick={handleLeave}
            className="flex items-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────── */

export default function VideoPage() {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [rooms, setRooms] = useState<VideoRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!hasSignedIn) return;
    setLoading(true);
    try {
      const data = await retryFetchJson<{ rooms: VideoRoomSummary[] }>(
        '/api/voice/active?type=video',
        { maxRetries: 2 },
      );
      setRooms(data.rooms ?? []);
    } catch {
      // Handle
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    if (!selectedRoomId) {
      const interval = setInterval(fetchRooms, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchRooms, selectedRoomId]);

  if (!hasSignedIn) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col items-center justify-center p-6 lg:h-[calc(100dvh-4rem)]">
        <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl bg-[var(--color-overlay)] text-[var(--color-muted)]" aria-hidden="true">📹</span>
        <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use Video Rooms</p>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">Real-time video chat with your community.</p>
      </div>
    );
  }

  if (selectedRoomId) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
        <VideoRoomView roomId={selectedRoomId} onLeave={() => setSelectedRoomId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">📹</span>
          <div>
            <h1 className="text-base font-bold text-[var(--color-fg)] leading-tight">Video Rooms</h1>
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Start Video
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <span className="mb-4 text-4xl opacity-30" aria-hidden="true">📹</span>
            <p className="text-sm font-medium text-[var(--color-fg)]">No active video rooms</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Start a video room and invite others to join.</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-degen-500 px-4 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
            >
              Start Your First Video
            </button>
          </div>
        )}

        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => {
              retryFetchJson(`/api/voice/${room.id}/join`, {
                fetchOptions: { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include' },
              }).then(() => setSelectedRoomId(room.id)).catch(() => {});
            }}
            className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-overlay)] transition-colors"
          >
            <div className="relative shrink-0">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                room.participantCount > 0 ? 'bg-degen-500/15' : 'bg-[var(--color-overlay)]'
              }`}>
                📹
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
                <span className="text-[10px] text-[var(--color-muted)]">{timeAgo(room.lastActivity)}</span>
              </div>
            </div>
            <div className="shrink-0">
              <span className="rounded-lg bg-degen-500/10 px-2 py-1 text-[10px] font-medium text-degen-400">Join</span>
            </div>
          </button>
        ))}
      </div>

      <CreateVideoRoomModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => setSelectedRoomId(id)}
      />
    </div>
  );
}
