'use client';

import { useToast } from '../Toast';
import { Toggle } from './Toggle';

export function StreamingSection() {
  const { showToast } = useToast();
  return (
    <div className="space-y-4">
      <Toggle id="stream-auto-record" checked={true} onChange={() => showToast('info', 'Stream setting updated')} label="Auto-record streams to VOD" />
      <Toggle id="stream-chat-replay" checked={false} onChange={() => showToast('info', 'Stream setting updated')} label="Include chat replay in VOD" />
      <div className="border-t border-[var(--color-glass-border)] pt-3">
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">OBS Stream Key</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-2.5 font-mono text-xs text-[var(--color-muted)]">••••••••••••••••</code>
          <button type="button" className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors">Show</button>
          <button type="button" className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors">Reset</button>
        </div>
      </div>
      <div className="border-t border-[var(--color-glass-border)] pt-3">
        <span className="mb-2 block text-xs font-medium text-[var(--color-fg)]">Stream Destinations</span>
        <div className="flex flex-wrap gap-2">
          {['Farcaster', 'Nostr', 'Lens', 'Bluesky', 'YouTube', 'PeerTube'].map((p) => (
            <button key={p} type="button"
              className="flex items-center gap-1.5 rounded-full border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-[10px] font-medium text-degen-400">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" /></svg>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
