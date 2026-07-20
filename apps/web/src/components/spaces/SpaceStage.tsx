'use client';

import { useMemo } from 'react';

// === Types ========================================================

interface Speaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
  muted: boolean;
}

interface SpaceStageProps {
  speakers: Speaker[];
  currentUserId: string;
  onTip?: (speakerId: string) => void;
  tippingEnabled: boolean;
}

// === Ring colors ==================================================

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

// === Speaker Card =================================================

function SpeakerCard({
  speaker,
  index,
  isCurrentUser,
  onTip,
  tippingEnabled,
}: {
  speaker: Speaker;
  index: number;
  isCurrentUser: boolean;
  onTip?: (speakerId: string) => void;
  tippingEnabled: boolean;
}) {
  const gradient = RING_GRADIENTS[index % RING_GRADIENTS.length];
  const ringSize = speaker.isHost ? 'h-20 w-20' : 'h-16 w-16';

  return (
    <div className="flex flex-col items-center gap-2 transition-all duration-300">
      {/* Avatar with gradient ring */}
      <div className="relative">
        <div
          className={`rounded-full bg-gradient-to-br p-[3px] ${gradient} ${
            speaker.speaking ? 'shadow-[0_0_20px_rgba(0,255,65,0.3)]' : ''
          } ${speaker.muted ? 'opacity-60' : ''} transition-shadow duration-300`}
        >
          <div className={`${ringSize} overflow-hidden rounded-full bg-[var(--color-bg)]`}>
            {speaker.avatarUrl ? (
              <img
                src={speaker.avatarUrl}
                alt={speaker.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center font-bold ${
                  speaker.isHost ? 'text-xl' : 'text-base'
                } text-[var(--color-fg)]`}
              >
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

        {/* Muted indicator */}
        {speaker.muted && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow-lg shadow-red-500/30">
            🔇
          </span>
        )}

        {/* Host badge */}
        {speaker.isHost && (
          <span className="absolute -top-1.5 -left-1.5 rounded-full bg-degen-500 px-1.5 py-0.5 text-[8px] font-bold uppercase text-black shadow-lg">
            Host
          </span>
        )}

        {/* Co-host badge */}
        {speaker.isCoHost && !speaker.isHost && (
          <span className="absolute -top-1.5 -left-1.5 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-cyan-400 shadow-lg ring-1 ring-cyan-500/30">
            Co
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--color-fg)]">{speaker.displayName}</p>
      </div>

      {/* Speaking status */}
      {speaker.speaking && (
        <div className="flex items-center gap-[2px]">
          {[12, 20, 14, 22, 16].map((h, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-degen-500/70"
              style={{
                height: `${h}%`,
                animation: `waveform 0.9s ease-in-out ${i * 0.12}s infinite`,
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      )}

      {/* Tip button */}
      {!isCurrentUser && tippingEnabled && (
        <button
          type="button"
          onClick={() => onTip?.(speaker.id)}
          className="mt-0.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[9px] font-semibold text-[var(--color-muted)] transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
        >
          ⚡ Tip
        </button>
      )}
    </div>
  );
}

// === Main Component ===============================================

export function SpaceStage({ speakers, currentUserId, onTip, tippingEnabled }: SpaceStageProps) {
  // Sort: host first, then co-hosts, then speakers
  const sorted = useMemo(
    () =>
      [...speakers].sort((a, b) => {
        if (a.isHost) return -1;
        if (b.isHost) return 1;
        if (a.isCoHost) return -1;
        if (b.isCoHost) return 1;
        return 0;
      }),
    [speakers],
  );

  if (speakers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--color-muted)]">
        <span className="mb-3 text-4xl opacity-30" aria-hidden="true">
          🎙️
        </span>
        <p className="text-sm font-medium">No speakers yet</p>
        <p className="mt-1 text-xs">Request to speak or wait for an invitation</p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
        {sorted.map((speaker, index) => (
          <SpeakerCard
            key={speaker.id}
            speaker={speaker}
            index={index}
            isCurrentUser={speaker.id === currentUserId}
            onTip={onTip}
            tippingEnabled={tippingEnabled}
          />
        ))}
      </div>
    </div>
  );
}
