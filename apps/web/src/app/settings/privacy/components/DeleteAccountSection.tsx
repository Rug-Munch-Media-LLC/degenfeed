'use client';

import { useState } from 'react';
import type { DeleteStatus } from '../types';
import { CollapsibleSection } from './CollapsibleSection';

export function DeleteAccountSection({
  deleteStatus,
  onInitiateDeletion,
  onCancelDeletion,
  onReactivate,
  onSignatureConfirm,
  onGetSignatureMessage,
  deleting,
}: {
  deleteStatus: DeleteStatus | null;
  onInitiateDeletion: () => void;
  onCancelDeletion: () => void;
  onReactivate: () => void;
  onSignatureConfirm: (signature: string) => void;
  onGetSignatureMessage: () => string;
  deleting: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureInput, setSignatureInput] = useState('');
  const [signatureMessage, setSignatureMessage] = useState('');

  const handleRequestDeletion = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeletion = () => {
    onInitiateDeletion();
    setShowDeleteConfirm(false);
  };

  const handleSignatureRequest = () => {
    const msg = onGetSignatureMessage();
    setSignatureMessage(msg);
    setShowSignatureModal(true);
  };

  const handleSignatureSubmit = () => {
    onSignatureConfirm(signatureInput);
    setShowSignatureModal(false);
    setSignatureInput('');
  };

  return (
    <section aria-labelledby="heading-requests">
      <CollapsibleSection
        title="Delete Account & Data"
        description={
          deleteStatus?.pending
            ? '⏳ Deletion pending — grace period active'
            : 'Permanently delete your account and all data'
        }
        icon="🗑️"
        defaultOpen={!!deleteStatus?.pending}
      >
        {deleteStatus?.pending ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-400">
                <span>⏳</span>
                <span className="text-sm font-medium">Deletion in Progress</span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Your account deletion is scheduled. You can cancel or reactivate anytime.
              </p>
              {deleteStatus.recoverableUntil && (
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Recoverable until:{' '}
                  <strong className="text-amber-400">
                    {new Date(deleteStatus.recoverableUntil).toLocaleDateString()}
                  </strong>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onReactivate}
                className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
              >
                🔄 Reactivate Account
              </button>
              <button
                type="button"
                onClick={onCancelDeletion}
                className="rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-overlay)]"
              >
                Cancel Deletion
              </button>
              <button
                type="button"
                onClick={handleSignatureRequest}
                className="rounded-xl border border-amber-500/30 px-4 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
              >
                ✍️ Confirm with Wallet Signature
              </button>
            </div>

            <p className="text-[10px] text-[var(--color-muted)]">
              Wallet signature confirmation is required before deletion can be finalized. This
              prevents unauthorized deletion if your session is compromised.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-xs text-red-400 font-medium">What happens when you delete:</p>
              <ul className="mt-2 space-y-1">
                <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                  <span className="text-red-400 mt-1">•</span>
                  30-day grace period — you can cancel anytime
                </li>
                <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                  <span className="text-red-400 mt-1">•</span>
                  All stored data is permanently deleted from our servers
                </li>
                <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                  <span className="text-red-400 mt-1">•</span>
                  External protocols (Farcaster, Nostr, Lens) retain your data on their networks
                </li>
                <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                  <span className="text-red-400 mt-1">•</span>A deletion certificate is issued for
                  your records
                </li>
                <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                  <span className="text-red-400 mt-1">•</span>
                  Security audit logs retained for 90 days (GDPR compliance)
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
              <p className="text-xs text-degen-400">
                💡 Before deleting, we recommend exporting your data first. Use the export section
                above to download your data in any format.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={handleRequestDeletion}
                className="w-full rounded-xl bg-red-500/15 px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25"
              >
                Request Account Deletion
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs text-red-400 font-medium">
                  Are you absolutely sure? This will schedule deletion with a 30-day grace period.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmDeletion}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {deleting ? 'Processing...' : 'Yes, schedule deletion'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signature confirmation modal */}
        {showSignatureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 shadow-2xl">
              <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                Sign Deletion Confirmation
              </h3>
              <p className="text-xs text-[var(--color-muted)] mb-3">
                Sign this message with your wallet to authorize the deletion.
              </p>

              <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3 mb-3">
                <p className="text-xs font-mono text-[var(--color-fg)] break-all">
                  {signatureMessage}
                </p>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                  Signature
                </label>
                <textarea
                  value={signatureInput}
                  onChange={(e) => setSignatureInput(e.target.value)}
                  placeholder="Paste your wallet signature here..."
                  className="input w-full min-h-[80px] text-xs font-mono"
                  spellCheck={false}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSignatureSubmit}
                  disabled={deleting || !signatureInput.trim()}
                  className="flex-1 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  {deleting ? 'Verifying...' : 'Confirm Signature'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSignatureModal(false);
                    setSignatureInput('');
                  }}
                  className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3 mt-3">
          <p className="text-xs text-degen-400">
            🔒 Deletion requires wallet signature confirmation — your session alone is not enough.
            This prevents anyone with stolen session cookies from deleting your account.
          </p>
        </div>
      </CollapsibleSection>
    </section>
  );
}
