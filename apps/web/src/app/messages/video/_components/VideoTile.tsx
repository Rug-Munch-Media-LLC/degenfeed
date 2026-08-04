'use client';

import { getInitials } from '../helpers';
import type { FloatingEmoji, VideoParticipant } from '../types';

export function VideoTile({
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
      {(!participant.connected || participant.videoMuted) && (
        <div className="flex flex-col items-center gap-2">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${
              speaking
                ? 'bg-degen-500 text-black'
                : 'bg-[var(--color-overlay)] text-[var(--color-fg)]'
            }`}
          >
            {getInitials(participant.displayName)}
          </span>
          {participant.videoMuted && (
            <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-1">
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
                <path d="M23 7l-7 5 7 5V7z" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              Camera Off
            </span>
          )}
        </div>
      )}

      {isScreenShare && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="mx-auto mb-2 text-degen-400"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p className="text-xs text-[var(--color-muted)]">Screen Share</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
          <span className={`text-[9px] font-medium ${isMe ? 'text-degen-400' : 'text-white'}`}>
            {participant.displayName}
            {isMe ? ' (you)' : ''}
          </span>
          {participant.muted && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-red-400"
              aria-hidden="true"
            >
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
          {participant.handRaised && (
            <span className="text-[12px]" role="img" aria-label="Hand raised">
              ✋
            </span>
          )}
        </div>
      </div>

      {emojis.map((emoji) => (
        <span
          key={emoji.id}
          className="absolute pointer-events-none text-xl animate-emoji-float"
          style={{ left: `${emoji.x}%`, bottom: '20%', animationDuration: '2s' }}
          aria-hidden="true"
        >
          {emoji.emoji}
        </span>
      ))}

      {isScreenShare && (
        <div className="absolute top-2 left-2 rounded-lg bg-degen-500 px-2 py-0.5 text-[8px] font-bold text-black">
          SCREEN
        </div>
      )}
    </div>
  );
}
