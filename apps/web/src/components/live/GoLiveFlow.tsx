'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StepIndicator, type Step } from './StepIndicator';
import { PlatformSelection, type LivePlatform } from './PlatformSelection';
import { StreamConfiguration } from './StreamConfiguration';
import { StreamKeyDisplay } from './StreamKeyDisplay';
import { GoLiveActions } from './GoLiveActions';

export interface StreamConfig {
  title: string; description: string; category: string; tags: string[];
  privacy: 'public' | 'unlisted' | 'private'; chatEnabled: boolean; recordingEnabled: boolean;
  thumbnail: File | null; thumbnailPreview: string;
}

export interface StreamConnection {
  streamKey: string; rtmpUrl: string; playbackUrl: string; embedUrl: string;
  streamId: string; platformMessages: Record<string, { ok: boolean; id?: string; url?: string; error?: string }>;
}

interface GoLiveFlowProps { isOpen: boolean; onClose: () => void; onLiveStarted?: (streamId: string) => void; }

export function GoLiveFlow({ isOpen, onClose, onLiveStarted }: GoLiveFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [platform, setPlatform] = useState<LivePlatform>('owncast');
  const [config, setConfig] = useState<StreamConfig>({ title: '', description: '', category: 'gaming', tags: ['live', 'stream'], privacy: 'public', chatEnabled: true, recordingEnabled: true, thumbnail: null, thumbnailPreview: '' });
  const [connection, setConnection] = useState<StreamConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) { setStep(1); setPlatform('owncast'); setConfig({ title: '', description: '', category: 'gaming', tags: ['live', 'stream'], privacy: 'public', chatEnabled: true, recordingEnabled: true, thumbnail: null, thumbnailPreview: '' }); setConnection(null); setError(null); setIsLoading(false); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (step === 1) onClose(); else setStep((step - 1) as Step); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, step, onClose]);

  const handleConfigured = useCallback(async () => {
    if (!config.title.trim()) return;
    setIsLoading(true); setError(null);
    try {
      const response = await fetch('/api/live/go-live', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: config.title, description: config.description, category: config.category, tags: config.tags, privacy: config.privacy, recordingEnabled: config.recordingEnabled, chatEnabled: config.chatEnabled, platform }) });
      if (!response.ok) { const err = (await response.json()) as { error?: string }; throw new Error(err.error || 'Failed to start stream'); }
      const data = (await response.json()) as StreamConnection;
      setConnection(data); setStep(3);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to configure stream'); }
    finally { setIsLoading(false); }
  }, [config, platform]);

  const handleGoLive = useCallback(() => { if (connection) onLiveStarted?.(connection.streamId); }, [connection, onLiveStarted]);
  const handleOverlayClick = useCallback((e: React.MouseEvent) => { if (e.target === overlayRef.current && step === 1) onClose(); }, [step, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={overlayRef} onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center animate-backdrop-in"
      role="dialog" aria-modal="true" aria-label="Go Live Wizard">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] shadow-2xl sm:rounded-2xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500/20 to-purple-500/10 text-sm">{step === 4 ? '🔴' : '📡'}</span>
            <h2 className="text-base font-bold text-[var(--color-fg)]">
              {step === 1 && 'Go Live'}{step === 2 && 'Stream Settings'}{step === 3 && 'Stream Key'}{step === 4 && "You're Live!"}
            </h2>
          </div>
          <button type="button" onClick={() => { if (step === 1) onClose(); else setStep((step - 1) as Step); }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label={step === 1 ? 'Close' : 'Back'}>
            {step === 1 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            )}
          </button>
        </div>
        <div className="px-5 pt-4"><StepIndicator currentStep={step} /></div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</div>}
          {step === 1 && <PlatformSelection selected={platform} onChange={setPlatform} />}
          {step === 2 && <StreamConfiguration config={config} onChange={setConfig} />}
          {step === 3 && connection && <StreamKeyDisplay connection={connection} />}
          {step === 4 && connection && <GoLiveActions connection={connection} config={config} platform={platform} onGoLive={handleGoLive} />}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4">
          <button type="button" onClick={() => { if (step === 1) onClose(); else setStep((step - 1) as Step); }}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">{step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 3 && (
            <button type="button" onClick={() => { if (step === 1) setStep(2); if (step === 2) handleConfigured(); }}
              disabled={(step === 2 && !config.title.trim()) || isLoading} className="btn-primary gap-2">
              {isLoading ? (<><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />Setting up...</>) : step === 1 ? 'Continue' : 'Get Stream Key'}
            </button>
          )}
          {step === 3 && <button type="button" onClick={() => setStep(4)} className="btn-primary gap-2">Continue → Go Live</button>}
          {step === 4 && <button type="button" onClick={onClose} className="btn-secondary text-xs">Close</button>}
        </div>
      </div>
    </div>
  );
}
