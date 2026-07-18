/**
 * @degenfeed/ui — SpaceRoom
 *
 * Premium live audio room view with colorful speaker rings,
 * floating controls, and audience grid.
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

// ─── Ring colors for speakers ────────────────────────────────────

const RING_GRADIENTS = [
  'from-pink-500 via-purple-500 to-indigo-500',
  'from-cyan-400 via-blue-500 to-purple-600',
  'from-amber-400 via-orange-500 to-pink-500',
  'from-degen-400 via-emerald-400 to-cyan-400',
  'from-rose-400 via-fuchsia-500 to-violet-600',
  'from-sky-400 via-indigo-500 to-violet-500',
  'from-lime-400 via-degen-400 to-teal-400',
  'from-yellow-400 via-amber-500 to-red-500',
];

// ─── Helper components ───────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 items-center justify-center" role="img" aria-label="Live">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

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

// ─── SpeakerAvatar with colorful ring ────────────────────────────

function SpeakerAvatar({
  speaker,
  index,
  isCurrentUser,
  onTip,
  spaceId,
  tippingEnabled,
}: {
  speaker: Speaker;
  index: number;
  isCurrentUser: boolean;
  onTip?: (spaceId: string, speakerId?: string) => void;
  spaceId: string;
  tippingEnabled: boolean;
}) {
  const gradient = RING_GRADIENTS[index % RING_GRADIENTS.length];
  const ringSize = speaker.isHost ? 'h-20 w-20' : 'h-16 w-16';
  const iconSize = speaker.isHost ? 'text-xl' : 'text-base';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Gradient ring */}
        <div
          className={`rounded-full bg-gradient-to-br p-[3px] ${gradient} ${
            speaker.speaking ? 'shadow-[0_0_16px_rgba(0,255,65,0.25)]' : ''
          } transition-shadow duration-300`}
        >
          <div className={`${ringSize} overflow-hidden rounded-full bg-[var(--color-bg)]`}>
            {speaker.avatarUrl ? (
              <img
                src={speaker.avatarUrl}
                alt={speaker.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center font-bold ${iconSize} text-[var(--color-fg)]`}>
                {speaker.displayName[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
        </div>

        {/* Speaking indicator */}
        {speaker.speaking && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-degen-500 text-[10px] text-black shadow-lg shadow-degen-500/30">
            🔊
          </span>
        )}

        {/* Host/Co-host badge */}
        {(speaker.isHost || speaker.isCoHost) && (
          <span
            className={`absolute -top-1.5 -left-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase shadow-lg ${
              speaker.isHost
                ? 'bg-degen-500 text-black'
                : 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
            }`}
          >
            {speaker.isHost ? 'Host' : 'Co'}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--color-fg)]">{speaker.displayName}</p>
        {speaker.handle && <p className="text-[10px] text-gray-500">@{speaker.handle}</p>}
      </div>

      {/* Tip button */}
      {!isCurrentUser && tippingEnabled && (
        <button
          type="button"
          onClick={() => onTip?.(spaceId, speaker.id)}
          className="mt-0.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[9px] font-semibold text-gray-400 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
        >
          ⚡ Tip
        </button>
      )}
    </div>
  );
}

// ─── Audience member row ─────────────────────────────────────────

function AudienceMember({ speaker, index }: { speaker: Speaker; index: number }) {
  const gradient = RING_GRADIENTS[index % RING_GRADIENTS.length];
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5 transition-all hover:border-[var(--color-border)]">
      {/* Mini avatar */}
      <div className={`h-6 w-6 shrink-0 rounded-full bg-gradient-to-br p-[1.5px] ${gradient}`}>
        <div className="h-full w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
          {speaker.avatarUrl ? (
            <img src={speaker.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-[var(--color-fg)]">
              {speaker.displayName[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      </div>
      <span className="max-w-[100px] truncate text-xs font-medium text-[var(--color-fg)]">
        {speaker.displayName}
      </span>
      {(speaker.isHost || speaker.isCoHost) && (
        <span className={`text-[8px] font-bold uppercase ${speaker.isHost ? 'text-degen-500' : 'text-cyan-400'}`}>
          {speaker.isHost ? 'Host' : 'Co'}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

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

  const isHost = space.hostId === currentUserId || space.coHosts.includes(currentUserId);
  const isSpeaker = useMemo(
    () => space.speakers.some((s) => s.id === currentUserId),
    [space.speakers, currentUserId],
  );

  // Poll for space updates
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/spaces/live');
        if (!res.ok) return;
        const data = (await res.json()) as { spaces: SpaceData[] };
        const updated = data.spaces.find((s) => s.id === space.id);
        if (updated) setSpace(updated);
      } catch { /* ignore */ }
    }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [space.id]);

  // Simulate audio connection
  useEffect(() => {
    const timer = setTimeout(() => setConnecting(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Send emoji reaction
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
          setReactions((prev) => [
            ...prev,
            { userId: currentUserId, emoji: emoji.trim(), createdAt: Date.now() },
          ]);
          setTimeout(() => setReactions((prev) => prev.slice(1)), 3000);
        }
      } catch { /* ignore */ }
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
    } catch { /* ignore */ }
    setRequestingSpeak(false);
  }, [space.id, currentUserId, currentUserDisplayName, currentUserAvatarUrl]);

  // Host ends the space
  const handleEndSpace = useCallback(async () => {
    try {
      await fetch(`/api/spaces/${space.id}/end`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostId: currentUserId }),
      });
    } catch { /* ignore */ }
    onLeave();
  }, [space.id, currentUserId, onLeave]);

  const quickEmojis = ['🔥', '❤️', '🚀', '💎', '🙌', '😂', '🎙️', '🤯', '👏', '💯'];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col">
      {/* ═══ Room Header ═══ */}
      <div className="sticky top-16 z-30 border-b border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onLeave}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 transition-all hover:bg-[var(--color-muted)]/10 hover:text-[var(--color-fg)]"
              aria-label="Leave space"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5m7-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Leave
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-[var(--color-fg)]">{space.title}</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <LiveDot />
                  <span className="font-bold uppercase tracking-wider text-red-400">LIVE</span>
                </span>
                <span>·</span>
                <span>{space.speakers.length} speaker{space.speakers.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{space.listeners} listening</span>
              </div>
            </div>
          </div>

          {/* Protocol badges + End btn */}
          <div className="flex items-center gap-2">
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
            {isHost && (
              <button
                type="button"
                onClick={handleEndSpace}
                className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40"
              >
                End
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Main content ═══ */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── Stage ── */}
        <div className="flex-1 border-b border-[var(--color-glass-border)] lg:border-b-0 lg:border-r lg:border-[var(--color-glass-border)]">
          <div className="p-4 sm:p-6">
            {/* Audio status */}
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/50 px-4 py-2.5">
              {connecting ? (
                <>
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-500" />
                  <span className="text-xs text-yellow-400">Connecting to audio...</span>
                </>
              ) : audioConnected ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.4)]" />
                  <span className="text-xs font-medium text-degen-400">Audio connected</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-600" />
                  <span className="text-xs text-gray-500">Audio placeholder — LiveKit integration pending</span>
                </>
              )}
            </div>

            {/* Speaker grid */}
            {space.speakers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <span className="mb-3 text-4xl opacity-30" aria-hidden="true">🎙️</span>
                <p className="text-sm font-medium">No speakers yet</p>
                <p className="mt-1 text-xs">Request to speak or wait for an invitation</p>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
                {space.speakers.map((speaker, index) => (
                  <SpeakerAvatar
                    key={speaker.id}
                    speaker={speaker}
                    index={index}
                    isCurrentUser={speaker.id === currentUserId}
                    onTip={onTip}
                    spaceId={space.id}
                    tippingEnabled={space.tippingEnabled}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="flex w-full flex-col lg:w-80">
          {/* Audience */}
          <div className="border-b border-[var(--color-glass-border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Audience</h2>
              <span className="rounded-full bg-[var(--color-muted)]/10 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                {space.listeners}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {space.speakers.map((speaker, index) => (
                <AudienceMember key={speaker.id} speaker={speaker} index={index} />
              ))}
              {space.listeners > space.speakers.length && (
                <div className="flex items-center gap-2 rounded-full border border-dashed border-[var(--color-glass-border)] px-3 py-1.5">
                  <span className="text-[10px] text-gray-500">
                    +{space.listeners - space.speakers.length} more
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reactions */}
          <div className="flex-1 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Reactions</h2>

            {/* Quick emoji grid */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] text-sm transition-all hover:border-degen-500/30 hover:bg-degen-500/5"
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
                onKeyDown={(e) => { if (e.key === 'Enter') sendReaction(reactionInput); }}
                placeholder="Custom emoji..."
                maxLength={10}
                className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder-gray-600 outline-none focus:border-degen-500/50"
              />
              <button
                type="button"
                onClick={() => sendReaction(reactionInput)}
                disabled={!reactionInput.trim()}
                className="rounded-lg bg-degen-500/15 px-3 py-2 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/25 disabled:opacity-30"
              >
                Send
              </button>
            </div>

            {/* Reaction feed */}
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
              {reactions.length === 0 && space.reactions.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-gray-500">No reactions yet — be the first!</p>
              ) : (
                <>
                  {space.reactions.slice(-10).map((r, i) => (
                    <div key={`${r.createdAt}-${i}`} className="flex items-center gap-2 rounded-lg bg-[var(--color-muted)]/10 px-3 py-1.5">
                      <span className="text-lg">{r.emoji}</span>
                      <span className="text-[10px] text-gray-500">{timeAgo(r.createdAt)}</span>
                    </div>
                  ))}
                  {reactions.map((r, i) => (
                    <div key={`live-${r.createdAt}-${i}`} className="flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-1.5 animate-slide-up">
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

      {/* ═══ Floating Controls Bar ═══ */}
      <div className="sticky bottom-0 z-30 border-t border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mic toggle (speaker only) */}
            {isSpeaker ? (
              <button
                type="button"
                onClick={() => setMicEnabled((prev) => !prev)}
                disabled={connecting}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                  connecting
                    ? 'bg-yellow-500/10 text-yellow-500/50'
                    : micEnabled
                      ? 'bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                      : 'bg-red-500/20 text-red-400'
                }`}
                aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {micEnabled || connecting ? (
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
            ) : (
              /* Request to speak button */
              <button
                type="button"
                onClick={handleRequestSpeak}
                disabled={requestingSpeak}
                className="flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/40 hover:text-degen-400 disabled:opacity-50"
              >
                🎤 {requestingSpeak ? 'Requesting...' : 'Request to speak'}
              </button>
            )}

            {/* Mic status text */}
            {isSpeaker && !connecting && (
              <span className="hidden text-xs text-gray-500 sm:block">
                {micEnabled ? 'Mic on' : 'Mic muted'}
              </span>
            )}
            {connecting && isSpeaker && (
              <span className="hidden text-xs text-yellow-400 sm:block">Connecting...</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Tip host (non-host) */}
            {!isHost && space.tippingEnabled && (
              <button
                type="button"
                onClick={() => onTip?.(space.id)}
                className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20"
              >
                ⚡ Tip
              </button>
            )}

            {/* Leave button */}
            <button
              type="button"
              onClick={onLeave}
              className="rounded-full bg-red-500/20 px-4 py-2 text-xs font-bold text-red-400 transition-all hover:bg-red-500/30 active:scale-95"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
