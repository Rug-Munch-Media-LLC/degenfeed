'use client';

import { useState } from 'react';
import { SettingsSection } from './SettingsSection';

export function DangerZone({
  showDangerConfirm,
  setShowDangerConfirm,
}: {
  showDangerConfirm: string | null;
  setShowDangerConfirm: (v: string | null) => void;
}) {
  return (
    <>
      <SettingsSection
        title="Danger Zone"
        description="Irreversible actions that affect the entire DAO."
        danger
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-red-500/10 p-3">
            <div>
              <div className="text-xs font-semibold text-[var(--color-fg)]">Pause DAO</div>
              <p className="text-[9px] text-[var(--color-muted)]">
                Temporarily pause all proposals and voting
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDangerConfirm('pause')}
              className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              Pause
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-red-500/10 p-3">
            <div>
              <div className="text-xs font-semibold text-[var(--color-fg)]">Transfer Ownership</div>
              <p className="text-[9px] text-[var(--color-muted)]">
                Transfer DAO ownership to another address
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDangerConfirm('transfer')}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Transfer
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <div>
              <div className="text-xs font-semibold text-red-400">Emergency Shutdown</div>
              <p className="text-[9px] text-[var(--color-muted)]">
                Irreversibly shutdown the DAO and return all treasury funds
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDangerConfirm('shutdown')}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-600 transition-colors"
            >
              Shutdown
            </button>
          </div>
        </div>
      </SettingsSection>

      {showDangerConfirm && (
        <DangerConfirmModal action={showDangerConfirm} onClose={() => setShowDangerConfirm(null)} />
      )}
    </>
  );
}

function DangerConfirmModal({ action, onClose }: { action: string; onClose: () => void }) {
  const DANGER_ACTIONS: Record<
    string,
    { title: string; description: string; confirmText: string; isSevere: boolean }
  > = {
    pause: {
      title: 'Pause DAO',
      description:
        'This will pause all proposals and voting. Active proposals will be frozen. You can resume later.',
      confirmText: 'Type "PAUSE" to confirm',
      isSevere: false,
    },
    transfer: {
      title: 'Transfer Ownership',
      description:
        'This will transfer DAO ownership to another address. This action cannot be undone.',
      confirmText: 'Type the new owner address to confirm',
      isSevere: true,
    },
    shutdown: {
      title: 'Emergency Shutdown',
      description:
        'This will irreversibly shutdown the DAO. All treasury funds will be returned to members proportionally. THIS CANNOT BE UNDONE.',
      confirmText: 'Type "SHUTDOWN" to confirm',
      isSevere: true,
    },
  };

  const d = DANGER_ACTIONS[action];
  const [confirmInput, setConfirmInput] = useState('');
  if (!d) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={d.title}
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl">
        <div className={`mb-2 text-2xl ${d.isSevere ? 'text-red-400' : 'text-amber-400'}`}>
          {d.isSevere ? '☠️' : '⚠️'}
        </div>
        <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">{d.title}</h3>
        <p className="mb-4 text-xs text-[var(--color-muted)]">{d.description}</p>
        <div className="mb-4">
          <label
            className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]"
            htmlFor="field-b7d6d328"
          >
            {d.confirmText}
          </label>
          <input
            id="field-b7d6d328"
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            className="w-full rounded-xl border border-red-500/30 bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-red-500 transition-colors"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmInput}
            className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-30 ${
              d.isSevere ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            Confirm {d.title}
          </button>
        </div>
      </div>
    </div>
  );
}
