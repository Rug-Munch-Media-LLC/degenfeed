'use client';

import type { LiveStream } from './useLiveStreams';

/* ─── Types ──────────────────────────────────────────────────── */

interface SpeakerBarProps {
  stream: LiveStream;
}

/* ─── Speaker avatar with mute indicator ─────────────────────── */

function SpeakerAvatar({
  name,
  avatarUrl,
  isMuted,
  isHost,
}: {
  name: string;
  avatarUrl?: string;
  isMuted: boolean;
  isHost: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="relative">
        {/* Avatar circle */}
        <div
          className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-bold transition-all ${
            isHost
              ? 'border-degen-500 bg-degen-500/20 text-degen-400 shadow-[0_0_12px_var(--color-accent-glow)]'
              : isMuted
                ? 'border-red-500/30 bg-[var(--color-overlay)] text-[var(--color-muted)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)]'
          }`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
          ) : (
            name[0]?.toUpperCase() || '?'
          )}
        </div>

        {/* Mute indicator */}
        {isMuted && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white shadow-sm">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="3" />
              <polygon
                points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          </span>
        )}

        {/* Speaking indicator */}
        {!isMuted && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-degen-500 animate-pulse" />
          </span>
        )}
      </div>

      {/* Name */}
      <span
        className={`max-w-[3rem] truncate text-[9px] font-medium ${
          isHost ? 'text-degen-400' : 'text-[var(--color-muted)]'
        }`}
        title={name}
      >
        {name}
      </span>

      {/* Host badge */}
      {isHost && (
        <span className="absolute -right-2 -top-1 rounded bg-degen-500 px-1 py-[1px] text-[7px] font-bold uppercase text-black">
          HOST
        </span>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export function SpeakerBar({ stream }: SpeakerBarProps) {
  const speakers = stream.space?.speakers ?? [];

  if (speakers.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[var(--color-muted)]"
        >
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="text-xs font-semibold text-[var(--color-fg)]">Speakers</span>
        <span className="text-[10px] text-[var(--color-muted)]">
          {stream.space?.listenerCount ?? 0} listening
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {speakers.map((speaker) => (
          <SpeakerAvatar
            key={speaker.userId}
            name={speaker.displayName}
            avatarUrl={speaker.avatarUrl}
            isMuted={speaker.isMuted}
            isHost={speaker.isHost}
          />
        ))}
      </div>
    </div>
  );
}
