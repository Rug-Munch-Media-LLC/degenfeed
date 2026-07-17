/**
 * @degenfeed/ui — SpaceRoom
 *
 * Live audio room view with host/participant controls.
 *
 * ─── REAL-TIME AUDIO ARCHITECTURE (PLACEHOLDER) ──────────────────
 *
 * This component CURRENTLY renders the full UI shell with placeholder
 * audio controls. Real audio transport (WebRTC / LiveKit) is NOT yet
 * integrated. The architecture is designed for drop-in replacement:
 *
 * ## Target Architecture (LiveKit)
 *
 * 1. **Room provisioning**: When a space is created via POST /api/spaces/create,
 *    the backend provisions a LiveKit room and stores the room name in the
 *    SpaceRecord.livekitRoom field.
 *
 * 2. **Client connection**: On mount, the host/participant:
 *    a. Fetches a LiveKit access token from a backend endpoint
 *       (e.g. POST /api/spaces/{id}/token) that returns a JWT signed
 *       with the LiveKit API key.
 *    b. Connects to the LiveKit WebSocket using @livekit/components-react
 *       or livekit-client:
 *
 *    ```tsx
 *    import { Room } from 'livekit-client';
 *    import { useTracks } from '@livekit/components-react';
 *
 *    const room = new Room();
 *    const token = await fetch(`/api/spaces/${spaceId}/token`, { ... });
 *    await room.connect(LIVEKIT_URL, token);
 *    ```
 *
 * 3. **Host mic controls**: Use room.localParticipant.setMicrophoneEnabled()
 *    to toggle the host's own mic.
 *
 * 4. **Speaker management**: The host can mute/unmute individual speakers
 *    via server-track permissions. In LiveKit, the host publishes tracks
 *    as a "speaker" role; listeners subscribe to the host's tracks.
 *    Speaker stage changes are synced via the space metadata in KV.
 *
 * 5. **Audio indicators**: LiveKit tracks expose audio level via
 *    track.audioLevel observable — use this for the speaking indicator
 *    UI (green ring animation around speaker avatars).
 *
 * 6. **Emoji reactions**: Sent via POST /api/spaces/{id}/react.
 *    Each reaction appears as a floating animation overlay.
 *
 * 7. **Tipping**: The tip button opens the existing QuickTipButton /
 *    TipModal using the space's tipTokenAddress.
 *
 * ## When WebRTC is NOT connected:
 * - Mic controls show a "Connecting..." placeholder
 * - The "You are connected" indicator is always gray
 * - Speaking indicators are static
 * - This all works once LiveKit is wired in
 *
 * ## Required packages (to add):
 *   livekit-client       — WebRTC transport + track management
 *   @livekit/components-react  — React hooks + prebuilt UI
 *
 * ## Required backend endpoints (to add):
 *   POST /api/spaces/{id}/token  — Returns a LiveKit access token
 *   POST /api/spaces/{id}/mute   — Host mutes a speaker
 * POST /api/spaces/{id}/remove-speaker — Host removes a speaker
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

// ─── Types ────────────────────────────────────────────────────────

interface Speaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
}

interface Reaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface SpaceData {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'live' | 'scheduled' | 'ended';
  listeners: number;
  speakers: Speaker[];
  reactions: Reaction[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
}

export interface SpaceRoomProps {
  space: SpaceData;
  currentUserId: string;
  currentUserDisplayName: string;
  currentUserAvatarUrl?: string;
  onLeave: () => void;
  onTip?: (spaceId: string, speakerId?: string) => void;
}

// ─── Time helpers ────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Component ────────────────────────────────────────────────────

export function SpaceRoom({
  space: initialSpace,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  onLeave,
  onTip,
}: SpaceRoomProps) {
  const [space, setSpace] = useState<SpaceData>(initialSpace);
  const [reactionInput, setReactionInput] = useState('');
  const [requestingSpeak, setRequestingSpeak] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [connecting, setConnecting] = useState(true);
  const [audioConnected, _setAudioConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);
  const reactionsEndRef = useRef<HTMLDivElement>(null);

  // Whether current user is host or co-host
  const isHost = space.hostId === currentUserId || space.coHosts.includes(currentUserId);

  // Whether current user is a speaker
  const isSpeaker = useMemo(
    () => space.speakers.some((s) => s.id === currentUserId),
    [space.speakers, currentUserId],
  );

  // Poll for space updates
  useEffect(() => {
    const _poll = async () => {
      try {
        const res = await fetch(`/api/spaces/${space.id}/join`, {
          method: 'GET',
          headers: { 'content-type': 'application/json' },
        });
        if (!res.ok) return;
        // GET /join returns space data — we use this for polling
      } catch {
        /* ignore */
      }
    };

    // For now, poll KV via the live endpoint every 10s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/spaces/live');
        if (!res.ok) return;
        const data = (await res.json()) as { spaces: SpaceData[] };
        const updated = data.spaces.find((s) => s.id === space.id);
        if (updated) {
          setSpace(updated);
        }
      } catch {
        /* ignore */
      }
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [space.id]);

  // Simulate "connecting" to audio
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnecting(false);
      // In production, this would be:
      // 1. Fetch LiveKit token
      // 2. Connect to LiveKit room
      // 3. Set audioConnected = true on successful connection
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll reactions
  useEffect(() => {
    reactionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Handle emoji reaction
  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!emoji.trim()) return;
      try {
        const res = await fetch(`/api/spaces/${space.id}/react`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, emoji: emoji.trim() }),
        });
        if (res.ok) {
          const _data = (await res.json()) as { space: SpaceData; ok: boolean };
          setReactions((prev) => [
            ...prev,
            { userId: currentUserId, emoji: emoji.trim(), createdAt: Date.now() },
          ]);
          // Auto-clear reaction after 3s
          setTimeout(() => {
            setReactions((prev) => prev.slice(1));
          }, 3000);
        }
      } catch {
        /* ignore */
      }
      setReactionInput('');
    },
    [space.id, currentUserId],
  );

  // Request to speak
  const handleRequestSpeak = useCallback(async () => {
    setRequestingSpeak(true);
    try {
      const res = await fetch(`/api/spaces/${space.id}/request-speak`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          displayName: currentUserDisplayName,
          avatarUrl: currentUserAvatarUrl,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { space: SpaceData; ok: boolean };
        setSpace(data.space);
      }
    } catch {
      /* ignore */
    } finally {
      setRequestingSpeak(false);
    }
  }, [space.id, currentUserId, currentUserDisplayName, currentUserAvatarUrl]);

  // Host ends the space
  const handleEndSpace = useCallback(async () => {
    try {
      await fetch(`/api/spaces/${space.id}/end`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostId: currentUserId }),
      });
    } catch {
      /* ignore */
    }
    onLeave();
  }, [space.id, currentUserId, onLeave]);

  // Quick emojis for reactions
  const quickEmojis = ['🔥', '❤️', '🚀', '💎', '🙌', '😂', '🎙️', '🤯', '👏', '💯'];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col">
      {/* Room header */}
      <div className="sticky top-16 z-30 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onLeave}
              className="flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Leave space"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M19 12H5m7-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[var(--color-fg)] truncate">{space.title}</h1>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-degen-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                  LIVE
                </span>
                <span>·</span>
                <span>
                  {space.speakers.length} speaker{space.speakers.length !== 1 ? 's' : ''}
                </span>
                <span>·</span>
                <span>
                  {space.listeners} listener{space.listeners !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Protocol badges */}
            <div className="flex gap-1">
              {space.protocols.map((protocol) => (
                <span
                  key={protocol}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px]"
                  style={{ backgroundColor: `${getProtocolColor(protocol)}18` }}
                  title={getProtocolLabel(protocol)}
                >
                  {getProtocolIcon(protocol)}
                </span>
              ))}
            </div>

            {/* End space button (host only) */}
            {isHost && (
              <button
                type="button"
                onClick={handleEndSpace}
                className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/50 transition-colors"
              >
                End
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Stage — speakers */}
        <div className="flex-1 border-b border-[var(--color-border)] lg:border-b-0 lg:border-r lg:border-[var(--color-border)]">
          <div className="p-4">
            <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              On Stage
            </h2>

            {/* Audio status */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
              {connecting ? (
                <>
                  <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-500" />
                  <span className="text-xs text-yellow-400">Connecting to audio...</span>
                </>
              ) : audioConnected ? (
                <>
                  <span className="h-3 w-3 rounded-full bg-degen-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                  <span className="text-xs text-degen-400">Audio connected</span>
                </>
              ) : (
                <>
                  <span className="h-3 w-3 rounded-full bg-gray-600" />
                  <span className="text-xs text-gray-500">
                    Audio disconnected — WebRTC/LiveKit not yet integrated
                  </span>
                </>
              )}
            </div>

            {/* Speaker grid */}
            {space.speakers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <span className="mb-2 text-3xl opacity-30">🎙️</span>
                <p className="text-sm">No speakers yet</p>
                <p className="text-xs">Request to speak or wait for an invitation</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {space.speakers.map((speaker) => {
                  const isCurrentUser = speaker.id === currentUserId;
                  return (
                    <div
                      key={speaker.id}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                        speaker.speaking
                          ? 'border-degen-500/50 bg-degen-500/5 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                          : 'border-[var(--color-border)] bg-[var(--color-card)]'
                      } ${isCurrentUser ? 'ring-1 ring-degen-500/30' : ''}`}
                    >
                      {/* Avatar with speaking indicator */}
                      <div className="relative">
                        {speaker.avatarUrl ? (
                          <img
                            src={speaker.avatarUrl}
                            alt={speaker.displayName}
                            className={`h-16 w-16 rounded-full object-cover ${
                              speaker.speaking
                                ? 'ring-2 ring-degen-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                                : ''
                            }`}
                          />
                        ) : (
                          <div
                            className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold bg-[var(--color-muted)] ${
                              speaker.speaking ? 'ring-2 ring-degen-500' : ''
                            }`}
                          >
                            {speaker.displayName[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        {speaker.speaking && (
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-degen-500 text-[10px] text-black shadow-lg">
                            🔊
                          </span>
                        )}
                        {(speaker.isHost || speaker.isCoHost) && (
                          <span
                            className={`absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                              speaker.isHost
                                ? 'bg-degen-500 text-black'
                                : 'bg-cyan-500/20 text-cyan-400'
                            }`}
                          >
                            {speaker.isHost ? 'Host' : 'Co-host'}
                          </span>
                        )}
                      </div>

                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--color-fg)]">
                          {speaker.displayName}
                        </p>
                        {speaker.handle && (
                          <p className="text-[10px] text-gray-500">@{speaker.handle}</p>
                        )}
                      </div>

                      {/* Tip button (not shown for current user) */}
                      {!isCurrentUser && space.tippingEnabled && (
                        <button
                          type="button"
                          onClick={() => onTip?.(space.id, speaker.id)}
                          className="mt-1 rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] font-medium text-gray-400 hover:text-[var(--color-fg)] hover:border-[var(--color-fg)] transition-colors"
                        >
                          ⚡ Tip
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mic controls (host/speaker only) */}
          {isSpeaker && (
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {connecting ? (
                    <div className="h-10 w-10 animate-pulse rounded-full bg-yellow-500/20" />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        // PLACEHOLDER: In production, call room.localParticipant.setMicrophoneEnabled(!micEnabled)
                        setMicEnabled((prev) => !prev)
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        micEnabled ? 'bg-degen-500/20 text-degen-400' : 'bg-red-500/20 text-red-400'
                      }`}
                      aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        {micEnabled ? (
                          <>
                            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </>
                        ) : (
                          <>
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </>
                        )}
                      </svg>
                    </button>
                  )}
                  <div>
                    <p className="text-xs font-medium text-[var(--color-fg)]">
                      {connecting
                        ? 'Connecting...'
                        : micEnabled
                          ? 'Microphone on'
                          : 'Microphone muted'}
                    </p>
                    {!connecting && (
                      <p className="text-[10px] text-gray-500">
                        {audioConnected ? 'Audio active' : 'Audio placeholder'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mute all / settings (host only) */}
                {isHost && (
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
                    onClick={() => {
                      // PLACEHOLDER: In production, mute all speakers via LiveKit
                    }}
                  >
                    Mute all
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Request to speak (listeners) */}
          {!isSpeaker && (
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <button
                type="button"
                onClick={handleRequestSpeak}
                disabled={requestingSpeak}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-medium text-[var(--color-fg)] hover:border-degen-500/50 hover:bg-degen-500/5 hover:text-degen-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requestingSpeak ? '\u23F3 Requesting...' : '\u{1F3A4} Request to speak'}
              </button>
            </div>
          )}

          {/* Tip host button */}
          {!isHost && space.tippingEnabled && (
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <button
                type="button"
                onClick={() => onTip?.(space.id)}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-4 py-3 text-sm font-semibold text-amber-400 hover:from-amber-500/30 hover:to-yellow-500/30 transition-all"
              >
                ⚡ Tip the host
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar — Audience + Reactions */}
        <div className="flex w-full flex-col lg:w-80">
          {/* Audience list */}
          <div className="border-b border-[var(--color-border)] p-4">
            <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Audience ({space.listeners})
            </h2>
            <div className="flex flex-wrap gap-2">
              {space.speakers.map((speaker) => (
                <div
                  key={speaker.id}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5"
                >
                  {speaker.avatarUrl ? (
                    <img src={speaker.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-muted)] text-[8px] font-bold">
                      {speaker.displayName[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="text-xs text-[var(--color-fg)]">{speaker.displayName}</span>
                  {(speaker.isHost || speaker.isCoHost) && (
                    <span
                      className={`text-[8px] font-bold uppercase ${
                        speaker.isHost ? 'text-degen-500' : 'text-cyan-400'
                      }`}
                    >
                      {speaker.isHost ? 'Host' : 'Co'}
                    </span>
                  )}
                </div>
              ))}
              {/* Placeholder for more listeners */}
              {space.listeners > space.speakers.length && (
                <div className="flex items-center gap-2 rounded-full border border-dashed border-[var(--color-border)] px-3 py-1.5">
                  <span className="text-[10px] text-gray-500">
                    +{space.listeners - space.speakers.length} more
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reactions */}
          <div className="flex-1 p-4">
            <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Reactions
            </h2>

            {/* Quick emoji grid */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm hover:bg-[var(--color-muted)] hover:border-degen-500/30 transition-all"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Custom emoji input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={reactionInput}
                onChange={(e) => setReactionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendReaction(reactionInput);
                }}
                placeholder="Custom emoji..."
                maxLength={10}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500"
              />
              <button
                type="button"
                onClick={() => sendReaction(reactionInput)}
                disabled={!reactionInput.trim()}
                className="rounded-lg bg-degen-500/20 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 disabled:opacity-30 transition-colors"
              >
                Send
              </button>
            </div>

            {/* Reaction feed */}
            <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
              {reactions.length === 0 && space.reactions.length === 0 ? (
                <p className="text-[11px] text-gray-500 text-center py-4">
                  No reactions yet — be the first to react!
                </p>
              ) : (
                <>
                  {space.reactions.slice(-10).map((r, i) => (
                    <div
                      key={`${r.createdAt}-${i}`}
                      className="flex items-center gap-2 rounded-lg bg-[var(--color-muted)] px-3 py-1.5"
                    >
                      <span className="text-lg">{r.emoji}</span>
                      <span className="text-[10px] text-gray-500">{timeAgo(r.createdAt)}</span>
                    </div>
                  ))}
                  {reactions.map((r, i) => (
                    <div
                      key={`live-${r.createdAt}-${i}`}
                      className="flex animate-in fade-in items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-1.5"
                    >
                      <span className="text-lg">{r.emoji}</span>
                      <span className="text-[10px] text-gray-500">{timeAgo(r.createdAt)}</span>
                    </div>
                  ))}
                  <div ref={reactionsEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
