'use client';

import { useCallback, useState } from 'react';
import { useToast } from '../../../../components/Toast';
import type { MigrationPlatform } from '../types';

export function MigrationCard({
  platform,
  walletAddress,
  onStatusChange,
}: {
  platform: MigrationPlatform;
  walletAddress: string | null;
  onStatusChange: () => void;
}) {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const handleImport = useCallback(async () => {
    if (!jsonInput.trim()) return;
    setImporting(true);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonInput);
      } catch {
        showToast('error', 'Invalid JSON format');
        setImporting(false);
        return;
      }

      const res = await fetch(`/api/account/migrate/import/${platform.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Import failed');
      }

      const result = (await res.json()) as { imported?: number; total?: number; errors?: string[] };
      showToast(
        'success',
        `✓ Imported ${result.imported || 0}/${result.total || 0} items from ${platform.label}`,
      );
      setJsonInput('');
      setShowInput(false);
      onStatusChange();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [platform, jsonInput, showToast, onStatusChange]);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{platform.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-fg)]">{platform.label}</div>
          <p className="text-xs text-[var(--color-muted)]">
            {platform.direction === 'both'
              ? 'Import & Export'
              : `${platform.direction === 'import' ? 'Import from' : 'Export to'} ${platform.label}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInput(!showInput)}
          className="rounded-lg bg-degen-500/15 px-3 py-1.5 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
        >
          {showInput ? 'Cancel' : 'Import Data'}
        </button>
      </div>

      {showInput && (
        <div className="mt-3 space-y-2">
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`Paste ${platform.label} archive JSON here...
Example: { "tweets": [...] } or { "events": [...] }`}
            className="input w-full min-h-[100px] text-xs font-mono"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !jsonInput.trim() || !walletAddress}
              className="btn-primary text-xs"
            >
              {importing ? 'Importing...' : `Import into DegenFeed`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
