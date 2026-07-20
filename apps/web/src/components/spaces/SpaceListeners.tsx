'use client';

import Image from 'next/image';

// === Types ========================================================

interface HandRaise {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  raisedAt: number;
}

interface Speaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isCoHost: boolean;
}

interface SpaceListenersProps {
  speakers: Speaker[];
  listenerCount: number;
  handRaised: HandRaise[];
  isHost: boolean;
  currentUserId: string;
  onAcceptSpeaker?: (userId: string) => void;
  onDeclineSpeaker?: (userId: string) => void;
}

// === Mini Avatar ==================================================

function MiniAvatar({ src, name }: { src?: string; name: string }) {
  return (
    <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-degen-500/30 to-purple-600/30">
      {src ? (
        <Image
          src={src}
          alt={name}
          width={24}
          height={24}
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-[var(--color-fg)]">
          {name[0]?.toUpperCase() || '?'}
        </div>
      )}
    </div>
  );
}

// === Main Component ===============================================

export function SpaceListeners({
  speakers,
  listenerCount,
  handRaised,
  isHost,
  onAcceptSpeaker,
  onDeclineSpeaker,
}: SpaceListenersProps) {
  return (
    <div className="space-y-4">
      {/* Speakers as audience */}
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          In the room
        </h3>
        <div className="flex flex-wrap gap-2">
          {speakers.map((speaker) => (
            <div
              key={speaker.id}
              className="flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5 transition-all hover:border-[var(--color-border)]"
            >
              <MiniAvatar src={speaker.avatarUrl} name={speaker.displayName} />
              <span className="max-w-[80px] truncate text-xs font-medium text-[var(--color-fg)]">
                {speaker.displayName}
              </span>
              {speaker.isHost && (
                <span className="text-[8px] font-bold uppercase text-degen-500">Host</span>
              )}
              {speaker.isCoHost && !speaker.isHost && (
                <span className="text-[8px] font-bold uppercase text-cyan-400">Co</span>
              )}
            </div>
          ))}

          {/* More listeners */}
          {listenerCount > speakers.length && (
            <div className="flex items-center gap-1 rounded-full border border-dashed border-[var(--color-glass-border)] px-3 py-1.5">
              <span className="text-[10px] text-[var(--color-muted)]">
                +{listenerCount - speakers.length} more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hand raises */}
      {handRaised.length > 0 && (
        <div>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            <span aria-hidden="true">✋</span>
            Requested to speak ({handRaised.length})
          </h3>
          <div className="space-y-1.5">
            {handRaised.map((raise) => (
              <div
                key={raise.userId}
                className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
              >
                <MiniAvatar src={raise.avatarUrl} name={raise.displayName} />
                <span className="flex-1 truncate text-xs font-medium text-[var(--color-fg)]">
                  {raise.displayName}
                </span>

                {/* Host-only accept/decline buttons */}
                {isHost && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onAcceptSpeaker?.(raise.userId)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] text-degen-400 transition-all hover:bg-degen-500/30"
                      aria-label={`Accept ${raise.displayName} as speaker`}
                      title="Accept"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeclineSpeaker?.(raise.userId)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20 text-[10px] text-red-400 transition-all hover:bg-red-500/30"
                      aria-label={`Decline ${raise.displayName}`}
                      title="Decline"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Time since raised */}
                <span className="text-[9px] text-[var(--color-muted)]">
                  {Math.floor((Date.now() - raise.raisedAt) / 1000)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
