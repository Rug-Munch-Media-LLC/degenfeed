'use client';

/**
 * LiveShortsViewer — Full-screen immersive live short viewer.
 *
 * Layout:
 *   ┌==============================┐
 *   │ 🔴 LIVE  👁️ 1.2K  [Chat]   │ ← Top overlay (creator, viewers)
 *   │                              │
 *   │       ▼ VIDEO PLAYER ▼       │ ← HLS video
 *   │                              │
 *   │    🎉 tip flew by! 🎉        │ ← Floating tips
 *   │    🔥🔥💀🔥💎                │ ← Emoji reactions
 *   │                              │
 *   │ [Tip] [💬] [Share] ⏱️ 02:30  │ ← Bottom action bar
 *   └==============================┘
 *
 * Supports: HLS playback, fullscreen, keyboard controls.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveShortsChat } from './LiveShortsChat';
import { LiveShortsCountdown } from './LiveShortsCountdown';
import { LiveShortsEnded } from './LiveShortsEnded';
import { LiveShortsReactions } from './LiveShortsReactions';
import { LiveShortsTips } from './LiveShortsTips';
import type { LiveShortSession } from './useLiveShorts';
import { useLiveShortTips, useLiveShortViewers } from './useLiveShorts';
import { ViewerBreakdown } from './ViewerBreakdown';

interface LiveShortsViewerProps {
  session: LiveShortSession;
  onClose?: () => void;
  onShare?: () => void;
}

/* === Helpers =================================================== */

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* === Top Overlay =============================================== */

function TopOverlay({
  session,
  viewerTotal,
  onChatToggle,
  chatOpen,
}: {
  session: LiveShortSession;
  viewerTotal: number;
  onChatToggle: () => void;
  chatOpen: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
      {/* Left: creator + viewers */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* LIVE badge */}
        <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          LIVE
        </span>

        {/* Creator avatar + name */}
        <div className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 backdrop-blur-sm">
          <div
            className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[7px] font-bold text-degen-400"
            style={
              session.creator.avatarUrl
                ? {
                    backgroundImage: `url(${session.creator.avatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {session.creator.avatarUrl ? '' : session.creator.displayName[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-xs font-semibold text-white">{session.creator.displayName}</span>
          {session.creator.verified && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="#00ff41"
              aria-label="Verified"
              role="img"
            >
              <path d="M12 1L15 9H23L17 15L19 23L12 18L5 23L7 15L1 9H9L12 1Z" />
            </svg>
          )}
        </div>

        {/* Viewer count */}
        <span className="inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {formatViewers(viewerTotal)}
        </span>
      </div>

      {/* Right: chat toggle + close */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onChatToggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
          aria-label={chatOpen ? 'Close chat' : 'Open chat'}
        >
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
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* === Bottom Action Bar ========================================== */

function BottomBar({
  session,
  onTip,
  onShare,
  onCountdownEnd,
}: {
  session: LiveShortSession;
  onTip?: () => void;
  onShare?: () => void;
  onCountdownEnd?: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10">
      <div className="pointer-events-auto flex items-center justify-between">
        {/* Left: Tip button */}
        <button
          type="button"
          onClick={onTip}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-degen-500 to-emerald-500 px-3.5 py-2 text-xs font-bold text-black transition-all hover:from-degen-400 hover:to-emerald-400 active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Send Tip
        </button>

        {/* Center: countdown */}
        <LiveShortsCountdown
          startedAt={session.startedAt}
          maxDuration={session.maxDuration}
          onEnd={onCountdownEnd}
        />

        {/* Right: Share */}
        <button
          type="button"
          onClick={onShare}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Share this live short"
        >
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
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* === HLS Video Player =========================================== */

function VideoPlayer({
  playbackUrl,
  isEnded,
  onEnded,
}: {
  playbackUrl: string;
  isEnded: boolean;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // For HLS, we'd use hls.js here. For now, use native <video>.
    // In production: import Hls from 'hls.js'; and bind it.
    video.src = playbackUrl;
    video.play().catch(() => {
      // Autoplay may be blocked — user interaction required
    });
  }, [playbackUrl]);

  const handleEnded = useCallback(() => {
    onEnded();
  }, [onEnded]);

  if (isEnded) return null;

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-contain bg-black"
      autoPlay
      playsInline
      muted={false}
      controls={false}
      onEnded={handleEnded}
      aria-label="Live short video player"
    >
      <track kind="captions" label="No captions available" />
    </video>
  );
}

/* === Main Viewer ================================================ */

export function LiveShortsViewer({ session, onClose, onShare }: LiveShortsViewerProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [_showTipModal, setShowTipModal] = useState(false);

  const { tips } = useLiveShortTips(session.id);
  const { total: viewerTotal, breakdown } = useLiveShortViewers(session.id);

  const handleChatToggle = useCallback(() => setChatOpen((v) => !v), []);
  const handleCountdownEnd = useCallback(() => setEnded(true), []);

  if (ended) {
    return (
      <LiveShortsEnded session={session} onWatchAgain={() => setEnded(false)} onClose={onClose} />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black">
      {/* Main video area */}
      <div className="relative flex flex-1 flex-col">
        {/* Video */}
        <VideoPlayer
          playbackUrl={session.playbackUrl}
          isEnded={ended}
          onEnded={handleCountdownEnd}
        />

        {/* Floating tips */}
        <LiveShortsTips tips={tips} />

        {/* Emoji reactions */}
        <LiveShortsReactions sessionId={session.id} />

        {/* Top overlay */}
        <TopOverlay
          session={session}
          viewerTotal={viewerTotal}
          onChatToggle={handleChatToggle}
          chatOpen={chatOpen}
        />

        {/* Bottom bar */}
        <BottomBar
          session={session}
          onTip={() => setShowTipModal(true)}
          onShare={onShare}
          onCountdownEnd={handleCountdownEnd}
        />

        {/* Viewer breakdown pill (bottom-left, small) */}
        {breakdown.length > 0 && (
          <div className="pointer-events-none absolute bottom-14 left-3 z-20">
            <ViewerBreakdown counts={breakdown} total={viewerTotal} compact />
          </div>
        )}
      </div>

      {/* Chat sidebar (expandable) */}
      <div
        className={`hidden w-80 shrink-0 border-l border-white/10 bg-black/90 backdrop-blur-xl transition-all md:block ${
          chatOpen ? 'md:block' : 'md:hidden'
        }`}
      >
        <LiveShortsChat sessionId={session.id} />
      </div>

      {/* Mobile chat drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          {/* biome-ignore jsx-a11y/no-static-element-interactions: backdrop click */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setChatOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setChatOpen(false);
            }}
            role="presentation"
          />
          <div className="relative z-10 flex h-2/3 w-full flex-col rounded-t-2xl bg-black/95 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-white">Chat</span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="text-white/60 hover:text-white"
                aria-label="Close chat"
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
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <LiveShortsChat sessionId={session.id} />
          </div>
        </div>
      )}
    </div>
  );
}
