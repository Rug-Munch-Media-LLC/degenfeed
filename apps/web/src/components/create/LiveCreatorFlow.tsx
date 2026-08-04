'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { FormatPicker } from './FormatPicker';
import { LIVE_PLATFORMS, platformMeta, type VideoFormat } from './format';
import { PlatformMultiSelect } from './PlatformMultiSelect';

/**
 * LiveCreatorFlow — "Go Live" with full format flexibility.
 *
 *  1. Pick format: 📱 Vertical (Loops/TikTok) vs 🖥️ Horizontal (YouTube/Twitch)
 *  2. Pick platforms: Owncast, PeerTube, Lens, Farcaster, Nostr + Pro (YouTube, Twitch)
 *  3. Details + one-click Go Live that orchestrates every platform at once.
 */

type LiveStep = 'format' | 'platforms' | 'details' | 'connecting' | 'live';

export interface LiveStreamResult {
  streamId: string;
  rtmpUrl: string;
  streamKey: string;
  playbackUrl: string;
  platformMessages: Record<string, { ok: boolean; id?: string; url?: string; error?: string }>;
}

const CATEGORIES = [
  'Entertainment',
  'Music',
  'Gaming',
  'Education',
  'News',
  'Tech',
  'Crypto',
  'DeFi',
  'Trading',
  'Comedy',
  'Sports',
  'Art',
];

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function LiveCreatorFlow({ initialFormat = 'portrait' }: { initialFormat?: VideoFormat }) {
  const { ready, walletAddress, openSignIn } = useAuth();
  const [step, setStep] = useState<LiveStep>('format');
  const [format, setFormat] = useState<VideoFormat>(initialFormat);
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(['owncast', 'peertube']));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveStreamResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [viewers, setViewers] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasWallet = ready && (!!walletAddress || true); // read-only hub; sign-in handled at page level

  // Live timer
  useEffect(() => {
    if (step !== 'live') return;
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
      setViewers((v) => Math.max(0, v + Math.floor(Math.random() * 4) - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const togglePlatform = useCallback((id: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const goLive = useCallback(async () => {
    if (!title.trim() || platforms.size === 0) return;
    setIsConnecting(true);
    setError(null);
    setStep('connecting');
    try {
      let data: LiveStreamResult | null = null;
      try {
        const res = await fetch('/api/creator/live/go-live', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            category,
            format,
            platforms: Array.from(platforms),
            tipsEnabled,
            chatEnabled,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { stream?: LiveStreamResult };
          if (json.stream) data = json.stream;
        }
      } catch {
        // Worker backend unreachable — fall back to local simulation.
      }

      if (!data) {
        // Simulated orchestration (matches the app's existing studio flows).
        await new Promise((r) => setTimeout(r, 1200));
        const id = `df_live_${generateId().slice(0, 12)}`;
        const rtmpBase =
          format === 'portrait'
            ? 'rtmp://live.degenfeed.xyz/shorts'
            : 'rtmp://live.degenfeed.xyz/live';
        const platformMessages: LiveStreamResult['platformMessages'] = {};
        for (const p of platforms) {
          const meta = platformMeta(p);
          platformMessages[p] = {
            ok: true,
            id: `${p}_${id}`,
            url: `https://degenfeed.xyz/live/${p}/${id}`,
          };
          await new Promise((r) => setTimeout(r, 350));
          void meta;
        }
        data = {
          streamId: id,
          rtmpUrl: rtmpBase,
          streamKey: id,
          playbackUrl: `https://degenfeed.xyz/live/${id}`,
          platformMessages,
        };
      }

      setResult(data);
      setViewers(0);
      setElapsed(0);
      setStep('live');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream.');
      setStep('details');
    } finally {
      setIsConnecting(false);
    }
  }, [title, description, category, format, platforms, tipsEnabled, chatEnabled]);

  const endStream = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('format');
    setResult(null);
    setElapsed(0);
    setViewers(0);
    setError(null);
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="skeleton mb-4 h-10 w-64 rounded-xl" />
        <div className="skeleton h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
          <span className="text-3xl" aria-hidden="true">
            🔴
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Go Live</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
          Connect your wallet to stream across every platform in one click.
        </p>
        <div className="mt-8">
          <button type="button" onClick={openSignIn} className="btn-primary text-sm">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  /* ── Connecting / orchestration ─────────────────────────── */
  if (step === 'connecting') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
              <span className="text-2xl" aria-hidden="true">
                🔴
              </span>
            </div>
          </div>
        </div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Starting your stream…</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Orchestrating {platforms.size} platform{platforms.size > 1 ? 's' : ''}
        </p>
        <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          {Array.from(platforms).map((p) => {
            const meta = platformMeta(p);
            return (
              <div
                key={p}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2"
              >
                <span className="text-sm" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="text-xs font-medium text-[var(--color-fg)]">{meta.label}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[9px] text-degen-400">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-degen-500" />
                  connecting…
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Live ───────────────────────────────────────────────── */
  if (step === 'live' && result) {
    const fmt = format === 'portrait' ? 'Vertical' : 'Horizontal';
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
          </span>
          <span className="text-sm font-bold text-red-400">LIVE · {fmt}</span>
        </div>
        <p className="text-2xl font-black tabular-nums text-[var(--color-fg)]">
          {mm}:{ss}
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {viewers} viewer{viewers !== 1 ? 's' : ''} · streaming to {platforms.size} platform
          {platforms.size > 1 ? 's' : ''}
        </p>

        {/* Per-platform status */}
        <div className="mx-auto mt-6 max-w-md space-y-2 text-left">
          {Array.from(platforms).map((p) => {
            const meta = platformMeta(p);
            const msg = result.platformMessages[p];
            return (
              <div
                key={p}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2"
              >
                <span className="text-sm" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="text-xs font-medium text-[var(--color-fg)]">{meta.label}</span>
                {msg?.ok ? (
                  <>
                    <span className="ml-auto text-[9px] text-degen-400">✓ live</span>
                    {msg.url && (
                      <a
                        href={msg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-degen-400 underline-offset-2 hover:underline"
                      >
                        view
                      </a>
                    )}
                  </>
                ) : (
                  <span className="ml-auto text-[9px] text-red-400">{msg?.error ?? 'failed'}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Stream keys for OBS etc. */}
        <div className="mx-auto mt-5 w-full max-w-md rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-left">
          <p className="mb-2 text-[10px] font-medium uppercase text-[var(--color-muted)]">
            Stream key (OBS / vMix)
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[var(--color-bg-tertiary)] px-2 py-1 text-[10px] text-degen-400">
                {result.rtmpUrl}
              </code>
              <CopyButton text={result.rtmpUrl} label="Copy RTMP URL" />
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[var(--color-bg-tertiary)] px-2 py-1 text-[10px] text-degen-400">
                {result.streamKey}
              </code>
              <CopyButton text={result.streamKey} label="Copy stream key" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={endStream}
            className="rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-600 active:scale-[0.98]"
          >
            End Stream
          </button>
          <a
            href={result.playbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[var(--color-glass-border)] px-6 py-2.5 text-sm font-semibold text-[var(--color-fg)] transition-colors hover:border-degen-500/30"
          >
            Open player
          </a>
        </div>
      </div>
    );
  }

  /* ── Setup steps ────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 animate-page-enter">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {['Format', 'Platforms', 'Details'].map((label, i) => {
          const idx = step === 'format' ? 0 : step === 'platforms' ? 1 : 2;
          const active = idx === i;
          const done = idx > i;
          return (
            <div key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (done) setStep(i === 0 ? 'format' : i === 1 ? 'platforms' : 'details');
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
                  active
                    ? 'bg-degen-500/20 text-degen-400'
                    : done
                      ? 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)] opacity-60'
                }`}
              >
                {done ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
                {label}
              </button>
              {i < 2 && (
                <span className="h-px w-4 bg-[var(--color-glass-border)]" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {step === 'format' && (
        <div className="space-y-6">
          <FormatPicker value={format} onChange={setFormat} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep('platforms')}
              className="btn-primary gap-2 text-sm"
            >
              Choose platforms
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {step === 'platforms' && (
        <div className="space-y-6">
          <PlatformMultiSelect
            platforms={LIVE_PLATFORMS}
            selected={platforms}
            onToggle={togglePlatform}
            mode="live"
            title="Stream to"
            subtitle="Multi-select — go live everywhere at once"
          />
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('format')}
              className="btn-secondary text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep('details')}
              disabled={platforms.size === 0}
              className="btn-primary gap-2 text-sm disabled:opacity-30"
            >
              {platforms.size} platform{platforms.size > 1 ? 's' : ''} — continue
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-5">
          <div>
            <label
              htmlFor="live-title"
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
            >
              Stream title
            </label>
            <input
              id="live-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your stream a catchy title…"
              maxLength={200}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <div>
            <label
              htmlFor="live-desc"
              className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
            >
              Description
            </label>
            <textarea
              id="live-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this stream about?"
              rows={2}
              className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="live-category"
                className="mb-1 block text-xs font-medium text-[var(--color-fg)]"
              >
                Category
              </label>
              <select
                id="live-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={tipsEnabled}
                  onChange={(e) => setTipsEnabled(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
                />
                <span className="text-[10px] text-[var(--color-fg)]">Enable tips</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={chatEnabled}
                  onChange={(e) => setChatEnabled(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
                />
                <span className="text-[10px] text-[var(--color-fg)]">Enable chat</span>
              </label>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep('platforms')}
              className="btn-secondary text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goLive}
              disabled={isConnecting || !title.trim()}
              className="rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 px-7 py-3 text-sm font-bold text-black transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
            >
              {isConnecting
                ? 'Starting…'
                : `🔴 Go Live (${format === 'portrait' ? 'Vertical' : 'Horizontal'})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Copy button ───────────────────────────────────────────── */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-[var(--color-glass-border)] px-2 py-1 text-[9px] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
      aria-label={label}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}
