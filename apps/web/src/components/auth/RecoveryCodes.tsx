'use client';

/**
 * RecoveryCodes — One-time display of TOTP recovery codes
 *
 * Shows the user their recovery codes exactly once after TOTP setup.
 * Provides options to download as text, print, or copy all.
 *
 * SECURITY: These codes are shown ONCE. After this component unmounts,
 * the codes are gone from the UI. Users must save them.
 */

import { useCallback, useRef } from 'react';

interface RecoveryCodesProps {
  codes: string[];
  onAcknowledged: () => void;
}

export default function RecoveryCodes({ codes, onAcknowledged }: RecoveryCodesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    const header = 'DegenFeed — 2FA Recovery Codes\n';
    const warning = 'Keep these codes safe. Each code can only be used once.\n';
    const footer = '\nGenerated: ' + new Date().toISOString().split('T')[0];
    const content = header + warning + '\n' + codes.join('\n') + footer;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'degenfeed-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [codes]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DegenFeed — Recovery Codes</title>
        <style>
          body { font-family: monospace; padding: 2rem; max-width: 500px; margin: 0 auto; }
          h1 { font-size: 1.2rem; margin-bottom: 0.25rem; }
          p { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
          .code { font-size: 1.1rem; padding: 0.5rem; letter-spacing: 0.1em; }
          .footer { margin-top: 2rem; font-size: 0.75rem; color: #999; border-top: 1px solid #ddd; padding-top: 1rem; }
        </style>
      </head>
      <body>
        <h1>DegenFeed — 2FA Recovery Codes</h1>
        <p>Each code can only be used once. Keep these safe.</p>
        ${codes.map((c) => `<div class="code">${c}</div>`).join('')}
        <div class="footer">Generated: ${new Date().toISOString().split('T')[0]}</div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }, [codes]);

  const handleCopyAll = useCallback(() => {
    const text = codes.join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }, [codes]);

  return (
    <div className="space-y-5" ref={containerRef}>
      {/* Warning banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-400">Save These Codes</p>
            <p className="text-xs text-amber-400/70 mt-1">
              These recovery codes will <strong>never be shown again</strong>.
              If you lose access to your authenticator app, these are the only way
              to regain access to your account.
            </p>
          </div>
        </div>
      </div>

      {/* Codes display */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {codes.map((code, i) => (
            <div
              key={code}
              className="flex items-center gap-3 rounded-lg bg-[var(--color-card)] px-3 py-2.5 border border-[var(--color-glass-border)]"
            >
              <span className="text-[10px] font-medium text-[var(--color-muted)] w-5 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <code className="flex-1 text-sm font-mono font-bold tracking-wider text-[var(--color-fg)] select-all">
                {code}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-2.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </span>
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-2.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </span>
        </button>
        <button
          type="button"
          onClick={handleCopyAll}
          className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-2.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy All
          </span>
        </button>
      </div>

      {/* I've Saved Them button */}
      <button
        type="button"
        onClick={onAcknowledged}
        className="btn-primary w-full text-sm"
      >
        I&apos;ve saved my recovery codes
      </button>
    </div>
  );
}
