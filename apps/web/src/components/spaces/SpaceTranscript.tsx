'use client';

import { useCallback, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────

interface SpaceTranscriptProps {
  spaceId: string;
  transcript?: string;
  summary?: string;
  isEnded: boolean;
  hasRecording: boolean;
}

// ─── Main Component ───────────────────────────────────────────────

export function SpaceTranscript({
  spaceId,
  transcript,
  summary,
  isEnded,
  hasRecording,
}: SpaceTranscriptProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localTranscript, setLocalTranscript] = useState(transcript);
  const [localSummary, setLocalSummary] = useState(summary);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!isEnded || !hasRecording) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/transcript`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Failed to generate transcript');
      }

      // Poll for result (in production, use webhook)
      const pollResult = await new Promise<{ transcript: string; summary: string }>(
        (resolve, reject) => {
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            try {
              const pollRes = await fetch(`/api/spaces/${spaceId}/transcript`, {
                method: 'GET',
              });
              if (pollRes.ok) {
                const data = (await pollRes.json()) as {
                  transcript: string;
                  summary: string;
                };
                clearInterval(interval);
                resolve(data);
              }
            } catch {
              // Continue polling
            }
            if (attempts >= 30) {
              clearInterval(interval);
              reject(new Error('Timeout waiting for transcript'));
            }
          }, 2000);
        },
      );

      setLocalTranscript(pollResult.transcript);
      setLocalSummary(pollResult.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate transcript');
    } finally {
      setGenerating(false);
    }
  }, [spaceId, isEnded, hasRecording]);

  if (!isEnded) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/30 p-4 text-center">
        <p className="text-[11px] text-[var(--color-muted)]">
          Transcript will be available after the space ends
        </p>
      </div>
    );
  }

  if (!hasRecording) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/30 p-4 text-center">
        <p className="text-[11px] text-[var(--color-muted)]">
          Recording required for transcript generation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      {localSummary && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="text-degen-500"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              AI Summary
            </h3>
          </div>
          <p className="text-sm text-[var(--color-fg)] leading-relaxed">{localSummary}</p>
        </div>
      )}

      {/* Full transcript (collapsible) */}
      {localTranscript && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="text-[var(--color-muted)]"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Full Transcript
              </h3>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className={`text-[var(--color-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-3 max-h-80 overflow-y-auto">
              <p className="whitespace-pre-wrap text-xs text-[var(--color-fg)] leading-relaxed">
                {localTranscript}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Generate button */}
      {!localTranscript && !localSummary && !generating && (
        <button
          type="button"
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polygon points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Generate AI Transcript & Summary
        </button>
      )}

      {/* Generating */}
      {generating && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-4">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <span className="text-xs text-[var(--color-muted)]">Generating transcript...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-2.5">
          <span className="text-xs text-red-400">⚠</span>
          <p className="flex-1 text-xs text-red-400">{error}</p>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-xs font-medium text-red-400 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
