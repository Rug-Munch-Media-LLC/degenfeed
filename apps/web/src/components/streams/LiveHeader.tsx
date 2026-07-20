'use client';

import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';

function LiveDotIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="6" fill="currentColor" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

function PulseRing() {
  return (
    <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <span className="h-3 w-3 animate-ping rounded-full bg-red-500 opacity-40" />
    </span>
  );
}

function GoLiveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

interface LiveHeaderProps {
  liveCount?: number;
  onGoLive?: () => void;
}

export function LiveHeader({ liveCount = 0, onGoLive }: LiveHeaderProps) {
  const { ready, signedInProtocols } = useAuth();
  const { showToast } = useToast();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const handleGoLive = () => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to start streaming');
      return;
    }
    onGoLive?.();
  };

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: title + live indicator */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/10">
          <LiveDotIcon />
          <PulseRing />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">Live</h1>
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-0.5 text-xs font-semibold text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                {liveCount} live
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Live streams, spaces, and token launches across DegenFeed
          </p>
        </div>
      </div>

      {/* Right: CTA */}
      <button
        type="button"
        onClick={handleGoLive}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-degen-500/20 transition-all hover:from-degen-400 hover:to-emerald-400 hover:shadow-degen-500/30 active:scale-[0.97]"
      >
        <GoLiveIcon />
        Go Live
      </button>
    </header>
  );
}
