'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────

interface RecordingInfo {
  url?: string;
  startedAt?: number;
  endedAt?: number;
  duration?: number;
  transcriptUrl?: string;
  publishedToPeertube?: boolean;
  peertubeVideoId?: string;
}

interface SpaceRecordingProps {
  spaceId: string;
  isRecorded: boolean;
  recording?: RecordingInfo;
  isLive: boolean;
  onRequestTranscript?: () => void;
  transcript?: string;
}

// ─── Duration formatter ───────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Main Component ───────────────────────────────────────────────

export function SpaceRecording({
  spaceId: _spaceId,
  isRecorded,
  recording,
  isLive,
  onRequestTranscript,
  transcript,
}: SpaceRecordingProps) {
  const [liveDuration, setLiveDuration] = useState(0);

  // Live duration counter
  useEffect(() => {
    if (!isLive || !recording?.startedAt) return;
    const interval = setInterval(() => {
      setLiveDuration(Math.floor((Date.now() - (recording.startedAt ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, recording?.startedAt]);

  if (!isRecorded) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/30 p-4 text-center">
        <p className="text-[11px] text-[var(--color-muted)]">
          Recording is disabled for this space
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Recording status */}
      {isLive && (
        <div className="flex items-center gap-3 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-400">Recording</p>
            <p className="text-[10px] text-red-400/70">
              {formatDuration(liveDuration)}
            </p>
          </div>
        </div>
      )}

      {/* Recording available */}
      {!isLive && recording?.url && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-degen-500/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="text-degen-500"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-fg)]">Recording available</p>
              {recording.duration && (
                <p className="text-[10px] text-[var(--color-muted)]">
                  Duration: {formatDuration(recording.duration)}
                </p>
              )}
            </div>
            <a
              href={recording.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-degen-500/15 px-4 py-2 text-xs font-bold text-degen-400 transition-all hover:bg-degen-500/25"
            >
              Play
            </a>
          </div>
        </div>
      )}

      {/* No recording */}
      {!isLive && !recording?.url && (
        <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/30 p-4 text-center">
          <p className="text-[11px] text-[var(--color-muted)]">
            Recording will be available when the space ends
          </p>
        </div>
      )}

      {/* PeerTube publish status */}
      {recording?.publishedToPeertube && recording.peertubeVideoId && (
        <a
          href={`https://video.degenfeed.xyz/w/${recording.peertubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-xs text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Watch on PeerTube
        </a>
      )}

      {/* Transcript button (post-space) */}
      {!isLive && recording?.url && !transcript && (
        <button
          type="button"
          onClick={onRequestTranscript}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Generate Transcript
        </button>
      )}

      {/* Transcript available */}
      {transcript && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Transcript
          </p>
          <p className="text-xs text-[var(--color-fg)] leading-relaxed">{transcript}</p>
        </div>
      )}
    </div>
  );
}
