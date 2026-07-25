'use client';

import { useState } from 'react';
import type { StreamConnection } from './GoLiveFlow';

export function StreamKeyDisplay({ connection }: { connection: StreamConnection }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copy = async (text: string, setter: (v: boolean) => void) => {
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    setter(true); setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Stream Connection Details</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Copy these into OBS, Streamlabs, or any RTMP-compatible software</p>
      </div>
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]">RTMP URL</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-xs text-degen-400 font-mono whitespace-nowrap">{connection.rtmpUrl}</code>
          <button type="button" onClick={() => copy(connection.rtmpUrl, setCopiedUrl)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-xs transition-colors hover:bg-white/5" title="Copy RTMP URL">
            {copiedUrl ? '✓' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>}
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-amber-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Stream Key — Keep this private!
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg bg-black/50 px-3 py-2 text-sm text-amber-300 font-mono tracking-wider">{connection.streamKey}</code>
          <button type="button" onClick={() => copy(connection.streamKey, setCopiedKey)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 text-amber-400 transition-colors hover:bg-amber-500/10" title="Copy Stream Key">
            {copiedKey ? '✓' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>}
          </button>
        </div>
      </div>
      <details className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--color-fg)]">📖 OBS / Streamlabs Setup Instructions</summary>
        <div className="border-t border-[var(--color-glass-border)] px-4 py-3 text-[11px] text-[var(--color-muted)] space-y-2">
          <p><strong>1.</strong> Open OBS Studio or Streamlabs</p>
          <p><strong>2.</strong> Go to <em>Settings → Stream</em></p>
          <p><strong>3.</strong> Set <em>Service</em> to <strong>Custom...</strong></p>
          <p><strong>4.</strong> Paste the <strong>RTMP URL</strong> above</p>
          <p><strong>5.</strong> Paste the <strong>Stream Key</strong> above</p>
          <p><strong>6.</strong> Click <em>Apply</em> and <em>OK</em></p>
          <p><strong>7.</strong> Set up your scenes and click <strong>Start Streaming</strong></p>
          <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-amber-400">⚠️ Never share your stream key. Anyone with it can stream to your channel.</p>
        </div>
      </details>
      {connection.playbackUrl && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]">Playback URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-xs text-degen-400 font-mono">{connection.playbackUrl}</code>
            <button type="button" onClick={() => copy(connection.playbackUrl, () => {})}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-xs transition-colors hover:bg-white/5" title="Copy playback URL">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
