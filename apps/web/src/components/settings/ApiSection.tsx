'use client';

import { useToast } from '../Toast';
import { ApiKeyCard } from './ApiKeyCard';
import { Toggle } from './Toggle';

export function ApiSection() {
  const { showToast } = useToast();
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-[var(--color-fg)]">API Keys</div>
          <p className="text-xs text-[var(--color-muted)]">Generate API keys for programmatic access.</p>
        </div>
        <button type="button" onClick={async () => {
          try {
            const res = await fetch('/api/keys', { method: 'POST', credentials: 'include' });
            if (!res.ok) throw new Error('Failed');
            const data = (await res.json()) as { key: string };
            showToast('success', `API key generated: ${data.key.slice(0, 12)}...`);
          } catch { showToast('error', 'Failed to generate API key'); }
        }} className="btn-primary text-xs">Generate Key</button>
      </div>
      <ApiKeyCard name="Development" keyPreview="df_dev_...a1b2" created="2026-06-15" onRevoke={() => showToast('success', 'Key revoked')} />
      <ApiKeyCard name="Production Bot" keyPreview="df_prod_...c3d4" created="2026-07-01" onRevoke={() => showToast('success', 'Key revoked')} />
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
        <div className="text-xs font-medium text-[var(--color-fg)] mb-1">Webhook Endpoints</div>
        <p className="text-xs text-[var(--color-muted)] mb-2">Receive real-time events for new posts, tips, and stream activity.</p>
        <button type="button" className="rounded-lg border border-dashed border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors w-full">
          + Add webhook endpoint
        </button>
      </div>
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
        <div className="text-xs font-medium text-[var(--color-fg)] mb-1">Developer Mode</div>
        <Toggle id="dev-mode" checked={false} onChange={() => showToast('info', 'Developer mode toggled')} label="Enable Developer Mode" />
      </div>
    </div>
  );
}
