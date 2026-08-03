'use client';

import { useCallback, useState } from 'react';
import { useToast } from '../../../../components/Toast';
import type { ExportFormat } from '../types';

export function ExportButton({
  format,
  walletAddress,
}: {
  format: ExportFormat;
  walletAddress: string | null;
}) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [lastExported, setLastExported] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!walletAddress) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/account/export/${format.id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `degenfeed-${format.id}-${new Date().toISOString().slice(0, 10)}.${format.id === 'html' ? 'html' : format.id === 'csv' ? 'csv' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExported(new Date().toLocaleString());
      showToast('success', `✓ ${format.label} export downloaded`);
    } catch {
      showToast('error', `Failed to export ${format.label}`);
    } finally {
      setExporting(false);
    }
  }, [format, walletAddress, showToast]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting || !walletAddress}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3 transition-colors hover:bg-[var(--color-card-hover)] disabled:opacity-40 text-left w-full group"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-sm font-bold text-degen-400">
        {format.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)]">{format.label}</div>
        <p className="text-xs text-[var(--color-muted)]">{format.description}</p>
        {lastExported && (
          <p className="text-[10px] text-degen-400 mt-0.5">Last exported: {lastExported}</p>
        )}
      </div>
      <span className="text-xs text-[var(--color-muted)] group-hover:text-degen-400 transition-colors">
        {exporting ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </span>
    </button>
  );
}
