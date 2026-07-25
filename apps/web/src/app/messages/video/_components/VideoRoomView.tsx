'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../components/AuthProvider';
import { useAnnouncer } from '../../../../components/ScreenReaderAnnouncer';
import { retryFetchJson } from '../../../../lib/retryFetch';
import type { FloatingEmoji, VideoParticipant, VideoRoom } from '../types';
import { VideoTile } from './VideoTile';

const REACTIONS = ['❤️', '😂', '🔥', '👍', '🎉', '😮', '👏', '🚀', '💯', '🫡'] as const;

export function VideoRoomView({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const { tokens } = useAuth();
  const userId = tokens.evmAddress?.toLowerCase() ?? '';
  const { announce } = useAnnouncer();

  const [room, setRoom] = useState<VideoRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [chatMessages, setChatMessages] = useState<
    Array<{ from: string; text: string; ts: number }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [speakerView, setSpeakerView] = useState(false);
  const [copied, setCopied] = useState(false);
  const emojiIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [speakingUser, _setSpeakingUser] = useState<string | null>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const data = await retryFetchJson<{ participants: VideoParticipant[]; roomName: string }>(
        `/api/voice/${roomId}/participants`,
        { maxRetries: 1 },
      );
      setRoom((prev) => {
        if (!prev)
          return {
            id: roomId,
            name: data.roomName,
            participants: data.participants,
            createdBy: '',
          };
        return { ...prev, participants: data.participants, name: data.roomName };
      });
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    const i = setInterval(fetchRoom, 3000);
    return () => clearInterval(i);
  }, [fetchRoom]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const me = useMemo(
    () => room?.participants.find((p) => p.walletAddress === userId),
    [room, userId],
  );

  const updateState = useCallback(
    async (updates: Partial<VideoParticipant>) => {
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
        /* silent */
      }
    },
    [roomId, fetchRoom],
  );

  const handleLeave = useCallback(async () => {
    try {
      await retryFetchJson(`/api/voice/${roomId}/leave`, {
        fetchOptions: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
        },
      });
      announce('Left video room', 'polite');
    } catch {
      /* silent */
    }
    onLeave();
  }, [roomId, onLeave, announce]);

  const sendReaction = useCallback((emoji: string) => {
    const id = ++emojiIdRef.current;
    setFloatingEmojis((prev) => [
      ...prev,
      { id, emoji, x: 20 + Math.random() * 60, y: 30 + Math.random() * 40, createdAt: Date.now() },
    ]);
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2500);
  }, []);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((prev) => [...prev, { from: me?.displayName ?? 'You', text, ts: Date.now() }]);
    setChatInput('');
  }, [chatInput, me]);

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
      /* silent */
    }
  }, [roomId, announce]);

  const mainSpeaker =
    speakerView && speakingUser
      ? room?.participants.find((p) => p.walletAddress === speakingUser)
      : null;

  const otherParticipants = useMemo(() => {
    if (!room) return [];
    if (mainSpeaker)
      return room.participants.filter(
        (p) => p.walletAddress !== mainSpeaker.walletAddress && p.walletAddress !== userId,
      );
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
        <span className="text-[10px] text-[var(--color-muted)]">
          &middot; {room?.name ?? 'Video Room'}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">
          &middot; {room?.participants.length ?? 0} participant
          {(room?.participants.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSpeakerView(!speakerView)}
            className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${speakerView ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
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
            className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${showChat ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
          >
            Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-3 ${showChat ? 'hidden md:block' : ''}`}>
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

        {showChat && (
          <aside className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col">
            <div className="border-b border-[var(--color-border)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--color-fg)]">Room Chat</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-[10px] text-[var(--color-muted)] text-center py-8">
                  No messages yet
                </p>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat();
                }}
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

      {/* Controls bar */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => updateState({ muted: !me?.muted })}
              className={`rounded-lg p-1.5 transition-colors ${me?.muted ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label={me?.muted ? 'Unmute' : 'Mute'}
              title={me?.muted ? 'Unmute' : 'Mute'}
            >
              {me?.muted ? <MicOffIcon /> : <MicOnIcon />}
            </button>
            <button
              type="button"
              onClick={() => updateState({ videoMuted: !me?.videoMuted })}
              className={`rounded-lg p-1.5 transition-colors ${me?.videoMuted ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label={me?.videoMuted ? 'Turn on camera' : 'Turn off camera'}
              title={me?.videoMuted ? 'Turn on camera' : 'Turn off camera'}
            >
              {me?.videoMuted ? <CamOffIcon /> : <CamOnIcon />}
            </button>
            <button
              type="button"
              onClick={() => updateState({ screenSharing: !me?.screenSharing })}
              className={`rounded-lg p-1.5 transition-colors ${me?.screenSharing ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)]'}`}
              aria-label="Share screen"
              title="Share screen"
            >
              <ScreenShareIcon />
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
            <LeaveIcon /> Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/* Inline SVG icon components */
function MicOffIcon() {
  return (
    <svg
      width="16"
      height="16"
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
  );
}
function MicOnIcon() {
  return (
    <svg
      width="16"
      height="16"
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
  );
}
function CamOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function CamOnIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}
function ScreenShareIcon() {
  return (
    <svg
      width="16"
      height="16"
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
  );
}
function LeaveIcon() {
  return (
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
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
