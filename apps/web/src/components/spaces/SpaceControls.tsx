'use client';

import { useCallback, useState } from 'react';

// === Types ========================================================

interface Speaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isCoHost: boolean;
  muted: boolean;
}

interface SpaceControlsProps {
  speakers: Speaker[];
  currentUserId: string;
  isHost: boolean;
  isCoHost: boolean;
  spaceId: string;
  onMuteSpeaker: (userId: string, muted: boolean) => void;
  onRemoveSpeaker: (userId: string) => void;
  onEndSpace: () => void;
  connecting: boolean;
  micEnabled: boolean;
  onToggleMic: () => void;
  onRequestSpeak: () => void;
  requestingSpeak: boolean;
  isSpeaker: boolean;
}

// === Host Controls Panel ==========================================

function HostControlsPanel({
  speakers,
  currentUserId,
  onMuteSpeaker,
  onRemoveSpeaker,
  onEndSpace,
}: {
  speakers: Speaker[];
  currentUserId: string;
  onMuteSpeaker: (userId: string, muted: boolean) => void;
  onRemoveSpeaker: (userId: string) => void;
  onEndSpace: () => void;
}) {
  const [showPanel, setShowPanel] = useState(false);

  const nonHostSpeakers = speakers.filter((s) => s.id !== currentUserId && !s.isHost);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3.5 py-2 text-xs font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/40 hover:text-degen-400"
        aria-label="Host controls"
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Controls
      </button>

      {showPanel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onPointerDown={() => setShowPanel(false)} />
          {/* Panel */}
          <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 shadow-2xl">
            <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Speaker Controls
            </h3>

            {nonHostSpeakers.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-[var(--color-muted)]">
                No other speakers
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {nonHostSpeakers.map((speaker) => (
                  <div
                    key={speaker.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--color-muted)]/5 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {speaker.avatarUrl ? (
                        <img
                          src={speaker.avatarUrl}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)]/20 text-[9px] font-bold text-[var(--color-fg)]">
                          {speaker.displayName[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="truncate text-xs font-medium text-[var(--color-fg)]">
                        {speaker.displayName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Mute toggle */}
                      <button
                        type="button"
                        onClick={() => onMuteSpeaker(speaker.id, !speaker.muted)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] transition-all ${
                          speaker.muted
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-[var(--color-muted)]/10 text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                        }`}
                        aria-label={speaker.muted ? 'Unmute speaker' : 'Mute speaker'}
                        title={speaker.muted ? 'Unmute' : 'Mute'}
                      >
                        {speaker.muted ? '🔇' : '🔊'}
                      </button>

                      {/* Remove speaker */}
                      <button
                        type="button"
                        onClick={() => onRemoveSpeaker(speaker.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] text-[var(--color-muted)] transition-all hover:bg-red-500/20 hover:text-red-400"
                        aria-label={`Remove ${speaker.displayName}`}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <hr className="my-2 border-[var(--color-glass-border)]" />

            <button
              type="button"
              onClick={() => {
                onEndSpace();
                setShowPanel(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-xs font-bold text-red-400 transition-all hover:bg-red-500/30"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="11" width="12" height="2" rx="1" />
              </svg>
              End Space for All
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// === Main Component ===============================================

export function SpaceControls({
  speakers,
  currentUserId,
  isHost,
  isCoHost,
  spaceId: _spaceId,
  onMuteSpeaker,
  onRemoveSpeaker,
  onEndSpace,
  connecting,
  micEnabled,
  onToggleMic,
  onRequestSpeak,
  requestingSpeak,
  isSpeaker,
}: SpaceControlsProps) {
  const handleRaiseHand = useCallback(async () => {
    try {
      await fetch(`/api/spaces/${_spaceId}/raise-hand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'User',
        }),
      });
    } catch {
      /* ignore */
    }
  }, [_spaceId]);

  return (
    <div className="flex items-center gap-3">
      {/* Mic toggle (for speakers) */}
      {isSpeaker && (
        <button
          type="button"
          onClick={onToggleMic}
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
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
      )}

      {/* Request to speak (non-speakers) */}
      {!isSpeaker && (
        <>
          <button
            type="button"
            onClick={handleRaiseHand}
            className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-400 transition-all hover:bg-amber-500/20"
          >
            ✋ Raise Hand
          </button>
          <button
            type="button"
            onClick={onRequestSpeak}
            disabled={requestingSpeak}
            className="flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/40 hover:text-degen-400 disabled:opacity-50"
          >
            🎤 {requestingSpeak ? 'Requesting...' : 'Request to Speak'}
          </button>
        </>
      )}

      {/* Mic status */}
      {isSpeaker && !connecting && (
        <span className="hidden text-xs text-[var(--color-muted)] sm:block">
          {micEnabled ? 'Mic on' : 'Mic muted'}
        </span>
      )}
      {connecting && isSpeaker && (
        <span className="hidden text-xs text-yellow-400 sm:block">Connecting...</span>
      )}

      {/* Host controls */}
      {(isHost || isCoHost) && (
        <HostControlsPanel
          speakers={speakers}
          currentUserId={currentUserId}
          onMuteSpeaker={onMuteSpeaker}
          onRemoveSpeaker={onRemoveSpeaker}
          onEndSpace={onEndSpace}
        />
      )}
    </div>
  );
}
