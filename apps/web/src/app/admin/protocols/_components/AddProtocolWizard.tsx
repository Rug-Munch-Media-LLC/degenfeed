'use client';

import type { AddProtocolWizard } from '../types';

export function AddProtocolWizardModal({
  wizard,
  wizardOpen,
  onClose,
  onUpdate,
  onSubmit,
}: {
  wizard: AddProtocolWizard;
  wizardOpen: boolean;
  onClose: () => void;
  onUpdate: (update: Partial<AddProtocolWizard>) => void;
  onSubmit: () => void;
}) {
  if (!wizardOpen) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Add new protocol"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="none"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Add Protocol</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${wizard.step >= s ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-muted)] text-[var(--color-muted)]'}`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-0.5 ${wizard.step > s ? 'bg-degen-500/40' : 'bg-[var(--color-muted)]'}`}
                />
              )}
            </div>
          ))}
        </div>

        {wizard.step === 1 && (
          <div className="space-y-4">
            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
                htmlFor="field-0e63f51a"
              >
                Protocol Name
              </label>
              <input
                id="field-0e63f51a"
                type="text"
                value={wizard.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g., Bluesky"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
                htmlFor="field-d5bb0287"
              >
                Protocol Type
              </label>
              <select
                id="field-d5bb0287"
                value={wizard.type}
                onChange={(e) => onUpdate({ type: e.target.value })}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
              >
                <option value="nostr">Nostr</option>
                <option value="farcaster">Farcaster</option>
                <option value="lens">Lens</option>
                <option value="bluesky">Bluesky</option>
                <option value="mastodon">Mastodon</option>
                <option value="rss">RSS</option>
                <option value="reddit">Reddit</option>
                <option value="custom">Custom / Other</option>
              </select>
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
                htmlFor="field-fc9d26e9"
              >
                Icon (emoji)
              </label>
              <input
                id="field-fc9d26e9"
                type="text"
                value={wizard.icon}
                onChange={(e) => onUpdate({ icon: e.target.value })}
                placeholder="e.g., 🦋"
                maxLength={2}
                className="w-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] text-center focus:border-degen-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {wizard.step === 2 && (
          <div className="space-y-4">
            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
                htmlFor="field-3399268e"
              >
                API Endpoint / URL
              </label>
              <input
                id="field-3399268e"
                type="text"
                value={wizard.endpoint}
                onChange={(e) => onUpdate({ endpoint: e.target.value })}
                placeholder="https://api.example.com"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
                htmlFor="field-8fc82fb2"
              >
                API Key (optional)
              </label>
              <input
                id="field-8fc82fb2"
                type="password"
                value={wizard.apiKey}
                onChange={(e) => onUpdate({ apiKey: e.target.value })}
                placeholder="Leave blank if not required"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {wizard.step === 3 && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl">{wizard.icon || '🔌'}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--color-fg)]">
                    {wizard.name || '(unnamed)'}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">{wizard.type}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-[var(--color-muted)]">
                <p>Endpoint: {wizard.endpoint || '(not set)'}</p>
                <p>API Key: {wizard.apiKey ? '••••••••' : '(not set)'}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              The protocol will be added in disabled mode. You can enable it from the dashboard
              after confirming configuration.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => onUpdate({ step: Math.max(1, wizard.step - 1) })}
            disabled={wizard.step === 1}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            ← Back
          </button>
          {wizard.step < 3 ? (
            <button
              type="button"
              onClick={() => onUpdate({ step: wizard.step + 1 })}
              className="rounded-xl bg-degen-500/20 px-4 py-2.5 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              className="rounded-xl bg-degen-500/20 px-4 py-2.5 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
            >
              ✓ Add Protocol
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
