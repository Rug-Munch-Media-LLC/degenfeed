'use client';

/* MediaStream is a DOM global type (lib.dom) — no import needed. */

/* ─── Controls Bar Props ──────────────────────────────────────────── */

interface ControlsBarProps {
  audioMuted: boolean;
  videoMuted: boolean;
  isScreenSharing: boolean;
  callActive: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onScreenShare: () => void;
  onFlipCamera: () => void;
  onEndCall: () => void;
  onPiP: () => void;
}

/* ─── Controls Bar ────────────────────────────────────────────────── */

export function ControlsBar({
  audioMuted,
  videoMuted,
  isScreenSharing,
  callActive,
  onToggleAudio,
  onToggleVideo,
  onScreenShare,
  onFlipCamera,
  onEndCall,
  onPiP,
}: ControlsBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggleAudio}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          audioMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={audioMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-label={audioMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {audioMuted ? (
            <>
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
              <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          ) : (
            <>
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          )}
        </svg>
      </button>

      <button
        type="button"
        onClick={onToggleVideo}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          videoMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={videoMuted ? 'Turn on camera' : 'Turn off camera'}
        aria-label={videoMuted ? 'Turn on camera' : 'Turn off camera'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {videoMuted ? (
            <>
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2z" />
            </>
          ) : (
            <>
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </>
          )}
        </svg>
      </button>

      <button
        type="button"
        onClick={onScreenShare}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          isScreenSharing
            ? 'bg-degen-500/30 text-degen-400 hover:bg-degen-500/40'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onFlipCamera}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
        title="Flip camera"
        aria-label="Flip camera"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <path d="M1 5h8l2 3h4v8H3a2 2 0 01-2-2V5z" />
          <path d="M7 15l-3-3 3-3" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onPiP}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
        title="Picture-in-Picture"
        aria-label="Picture-in-Picture"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <rect x="11" y="9" width="8" height="6" rx="1" ry="1" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onEndCall}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
        title="End call"
        aria-label="End call"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Ringing Animation ────────────────────────────────────────────── */

export function RingingAnimation() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 150, 300].map((delay) => (
        <div
          key={delay}
          className="h-3 w-3 rounded-full bg-degen-400 animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
        />
      ))}
    </div>
  );
}

/* ─── Calling Screen ───────────────────────────────────────────────── */

interface CallingScreenProps {
  callee: string;
  type: 'audio' | 'video';
  onCancel: () => void;
}

export function CallingScreen({ callee, type, onCancel }: CallingScreenProps) {
  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-degen-500/20 text-4xl font-bold text-degen-400">
        {shortAddr(callee).charAt(0)}
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-white">{shortAddr(callee)}</p>
        <p className="mt-1 text-sm text-white/60">
          {type === 'audio' ? '\u{1F3A4}' : '\u{1F4F9}'} Calling...
        </p>
      </div>
      <RingingAnimation />
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
        aria-label="Cancel call"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ─── PiP Overlay ──────────────────────────────────────────────────── */

interface PiPOverlayProps {
  localStream: MediaStream | null;
  duration: number;
  onExpand: () => void;
  onEndCall: () => void;
}

export function PiPOverlay({ localStream, duration, onExpand, onEndCall }: PiPOverlayProps) {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-56 cursor-pointer overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-black"
      onClick={onExpand}
      role="button"
      tabIndex={0}
      aria-label="Expand call"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onExpand();
      }}
    >
      <video
        ref={(el) => {
          if (el && localStream) el.srcObject = localStream;
        }}
        autoPlay
        muted
        playsInline
        className="h-32 w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
        <span className="text-[10px] font-mono text-white">
          {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEndCall();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-600"
          aria-label="End call"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
