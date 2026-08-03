'use client';

import { useCallback, useEffect, useState } from 'react';
import PublishTargetPills from './PublishTargetPills';
import RecordingTimer from './RecordingTimer';
import type { LiveConfig, PublishTarget } from './types';
import { CATEGORIES, generateId } from './types';

export default function LiveTab({ format }: { format: 'portrait' | 'landscape' }) {
  const [step, setStep] = useState<'setup' | 'streaming'>('setup');
  const [config, setConfig] = useState<LiveConfig>({
    title: '',
    description: '',
    category: 'Entertainment',
    tags: [],
    thumbnail: null,
    format,
    platforms: ['degenfeed'],
    tipsEnabled: true,
    tokenGated: false,
    tipGoal: 0,
    chatEnabled: true,
  });
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [rtmpUrl, setRtmpUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'streaming') return;
    const interval = setInterval(() => {
      setStreamDuration((d) => d + 1);
      setViewerCount((v) => Math.max(0, v + Math.floor(Math.random() * 5) - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handleStartStream = useCallback(async () => {
    if (!config.title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setStreamKey(`df_live_${generateId().slice(0, 12)}`);
      setRtmpUrl(
        format === 'portrait'
          ? 'rtmp://live.degenfeed.xyz/shorts'
          : 'rtmp://live.degenfeed.xyz/live',
      );
      setViewerCount(0);
      setStep('streaming');
    } catch {
      setError('Failed to start stream. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [config, format]);

  const handleStopStream = useCallback(() => {
    setStep('setup');
    setStreamKey(null);
    setRtmpUrl(null);
    setStreamDuration(0);
    setViewerCount(0);
  }, []);

  const updateConfig = useCallback((patch: Partial<LiveConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const togglePlatform = useCallback((target: PublishTarget) => {
    setConfig((prev) => {
      const platforms = prev.platforms.includes(target)
        ? prev.platforms.filter((p) => p !== target)
        : [...prev.platforms, target];
      return { ...prev, platforms };
    });
  }, []);

  if (step === 'setup') {
    return (
      <div className="space-y-6">
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
            Stream Title
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Give your stream a catchy title..."
            maxLength={200}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
            Description
          </label>
          <textarea
            value={config.description}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="What's this stream about?"
            rows={2}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Category
            </label>
            <select
              value={config.category}
              onChange={(e) => updateConfig({ category: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">Stream to</label>
          <PublishTargetPills selected={new Set(config.platforms)} onToggle={togglePlatform} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.tipsEnabled}
              onChange={(e) => updateConfig({ tipsEnabled: e.target.checked })}
              className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
            />
            <span className="text-[10px] text-[var(--color-fg)]">Enable Tips</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.chatEnabled}
              onChange={(e) => updateConfig({ chatEnabled: e.target.checked })}
              className="rounded border-[var(--color-border)] text-degen-500 focus:ring-degen-500"
            />
            <span className="text-[10px] text-[var(--color-fg)]">Enable Chat</span>
          </label>
        </div>
        <button
          type="button"
          onClick={handleStartStream}
          disabled={isLoading || !config.title.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 py-3 text-sm font-bold text-black hover:opacity-90 transition-all disabled:opacity-30"
        >
          {isLoading
            ? 'Starting Stream...'
            : `Go Live (${format === 'portrait' ? 'Vertical' : 'Horizontal'})`}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
        </span>
        <span className="text-sm font-bold text-red-400">LIVE</span>
      </div>
      <RecordingTimer seconds={streamDuration} />
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
      </p>
      {streamKey && rtmpUrl && (
        <div className="mt-4 w-full max-w-md rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-left">
          <p className="text-[10px] font-medium text-[var(--color-muted)] uppercase mb-2">
            Stream Key (for OBS etc.)
          </p>
          <p className="text-xs text-degen-400 font-mono break-all mb-2">{rtmpUrl}</p>
          <p className="text-xs font-mono text-degen-400 break-all">{streamKey}</p>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleStopStream}
          className="rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-all"
        >
          End Stream
        </button>
      </div>
    </div>
  );
}
