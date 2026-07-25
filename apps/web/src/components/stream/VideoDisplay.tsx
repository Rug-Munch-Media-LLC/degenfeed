'use client';

import type { StreamExtended, PlaybackMode } from './types';

interface VideoDisplayProps {
  stream: StreamExtended;
  mode: PlaybackMode;
}

const GRADIENTS: Record<string, string> = {
  gaming: 'from-purple-600/30 via-violet-600/20 to-indigo-800/30',
  music: 'from-pink-600/30 via-rose-600/20 to-red-800/30',
  crypto: 'from-degen-500/20 via-emerald-600/20 to-green-800/30',
  art: 'from-orange-600/30 via-amber-600/20 to-yellow-800/30',
  irl: 'from-teal-600/30 via-cyan-600/20 to-blue-800/30',
  talk: 'from-yellow-600/30 via-amber-600/20 to-orange-800/30',
  education: 'from-blue-600/30 via-indigo-600/20 to-purple-800/30',
  sports: 'from-red-600/30 via-rose-600/20 to-pink-800/30',
  tech: 'from-cyan-600/30 via-sky-600/20 to-blue-800/30',
  trading: 'from-emerald-600/30 via-green-600/20 to-teal-800/30',
};

export function VideoDisplay({ stream, mode }: VideoDisplayProps) {
  const showVideo = mode === 'video';
  const gradient = GRADIENTS[stream.category] ?? 'from-gray-800 to-gray-900';

  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient}`}>
      {showVideo && stream.hlsUrl && (
        <video
          className="absolute inset-0 h-full w-full object-contain"
          src={stream.hlsUrl}
          autoPlay playsInline muted loop={!stream.isLive}
          poster={stream.thumbnailUrl}
        />
      )}

      {(!showVideo || !stream.hlsUrl) && (
        <>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
          />
          <div className="relative z-10 flex flex-col items-center gap-4">
            {mode === 'audio-only' ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white"
                  strokeWidth="1.5" opacity="0.6" aria-hidden="true">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white" opacity="0.6" aria-hidden="true">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-white/60">{stream.title}</p>
              <p className="mt-1 text-xs text-white/40">
                {stream.viewerCount.toLocaleString()} watching{mode === 'audio-only' && '  •  Audio Only'}
              </p>
            </div>
          </div>
        </>
      )}

      {mode === 'audio-only' && (
        <div className="absolute bottom-4 left-4 z-20 rounded-full bg-degen-500/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
          Audio Only
        </div>
      )}
    </div>
  );
}
