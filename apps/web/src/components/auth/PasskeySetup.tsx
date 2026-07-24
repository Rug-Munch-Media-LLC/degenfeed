'use client';

/**
 * Passkey Setup & Management Component
 *
 * Allows users to:
 *   - Register a new passkey (fingerprint, Face ID, YubiKey, platform)
 *   - List registered passkeys with names and last-used timestamps
 *   - Rename passkeys
 *   - Remove passkeys (with confirmation)
 *
 * Uses @simplewebauthn/browser for client-side WebAuthn registration.
 */

import { startRegistration } from '@simplewebauthn/browser';
import { useCallback, useEffect, useState } from 'react';

/* === Types =================================================== */

interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: number;
  lastUsed: number;
}

/* === Helpers ================================================ */

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

/* === Component ============================================== */

interface PasskeySetupProps {
  /** Called after successful registration */
  onRegistered?: () => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
}

export function PasskeySetup({ onRegistered, onError }: PasskeySetupProps) {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // == Load passkeys ========================================

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/webauthn/credentials', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as PasskeyInfo[];
        setPasskeys(data);
      }
    } catch {
      // Silently fail — component shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  // == Register new passkey ==================================

  const handleRegister = useCallback(async () => {
    setRegistering(true);
    setRegisterError(null);

    try {
      // Step 1: Get registration options from server
      const beginRes = await fetch('/api/auth/webauthn/register/begin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });

      if (!beginRes.ok) {
        const errData = (await beginRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || 'Failed to start registration');
      }

      const options = await beginRes.json();

      // Step 2: Prompt the browser to create a passkey
      const regResponse = await startRegistration({ optionsJSON: options });

      // Step 3: Verify the registration with the server
      const completeRes = await fetch('/api/auth/webauthn/register/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          response: regResponse,
          name: `Passkey (${new Date().toLocaleDateString()})`,
        }),
      });

      if (!completeRes.ok) {
        const errData = (await completeRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || 'Registration failed');
      }

      // Refresh the passkey list
      await loadPasskeys();
      onRegistered?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message === 'Error: The operation either timed out or was not allowed.'
            ? 'Registration cancelled. Your browser may have declined the request. Try again or use a different authenticator.'
            : err.message
          : 'Failed to register passkey';

      setRegisterError(message);
      onError?.(message);
    } finally {
      setRegistering(false);
    }
  }, [loadPasskeys, onRegistered, onError]);

  // == Delete passkey =========================================

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const res = await fetch(`/api/auth/webauthn/credentials/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error || 'Failed to delete passkey');
        }

        setPasskeys((prev) => prev.filter((p) => p.id !== id));
        setConfirmDeleteId(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete passkey';
        onError?.(message);
      } finally {
        setDeleting(false);
      }
    },
    [onError],
  );

  // == Rename passkey =========================================

  const handleRename = useCallback(
    async (id: string) => {
      if (!renameValue.trim()) return;
      setRenaming(true);
      try {
        const res = await fetch(`/api/auth/webauthn/credentials/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: renameValue.trim() }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error || 'Failed to rename passkey');
        }

        setPasskeys((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: renameValue.trim() } : p)),
        );
        setRenamingId(null);
        setRenameValue('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rename passkey';
        onError?.(message);
      } finally {
        setRenaming(false);
      }
    },
    [renameValue, onError],
  );

  // == Render ================================================

  return (
    <div className="space-y-4">
      {/* Header & Register Button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-fg)]">Passkeys</h4>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Sign in with fingerprint, Face ID, or security key — phishing-resistant 2FA
          </p>
        </div>
        <button
          type="button"
          onClick={handleRegister}
          disabled={registering}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-degen-500/15 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add a new passkey"
        >
          {registering ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
              Registering...
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Passkey
            </>
          )}
        </button>
      </div>

      {/* Registration Error */}
      {registerError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2" role="alert">
          <p className="text-xs text-red-400">{registerError}</p>
        </div>
      )}

      {/* Passkey List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--color-overlay)]" />
          ))}
        </div>
      ) : passkeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-degen-400"
              aria-hidden="true"
            >
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
              <path d="M2 12a10 10 0 0 1 18-6" />
              <path d="M21.8 16c.2-2 .13-2.94 0-4.07" />
            </svg>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            No passkeys registered yet. Add one to enable passwordless, phishing-resistant sign-in.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 transition-colors hover:border-degen-500/20"
            >
              {renamingId === pk.id ? (
                /* Rename form */
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(pk.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    placeholder="Passkey name"
                    maxLength={64}
                    className="input flex-1 text-sm py-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRename(pk.id)}
                    disabled={renaming || !renameValue.trim()}
                    className="rounded-lg bg-degen-500/15 px-2.5 py-1 text-xs font-medium text-degen-400 hover:bg-degen-500/25 transition-colors disabled:opacity-50"
                  >
                    {renaming ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(null);
                      setRenameValue('');
                    }}
                    className="rounded-lg bg-[var(--color-overlay)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Passkey icon */}
                    <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-degen-400">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                        {pk.name}
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        Added {formatDate(pk.createdAt)} &middot; Used {timeAgo(pk.lastUsed)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(pk.id);
                        setRenameValue(pk.name);
                      }}
                      className="rounded-lg p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
                      aria-label={`Rename ${pk.name}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    {confirmDeleteId === pk.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(pk.id)}
                          disabled={deleting}
                          className="rounded-lg bg-red-500/20 px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                          {deleting ? '...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg bg-[var(--color-overlay)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(pk.id)}
                        className="rounded-lg p-1.5 text-[var(--color-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        aria-label={`Remove ${pk.name}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
        <div className="flex items-start gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 shrink-0 text-degen-400"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <p className="text-xs text-[var(--color-muted)]">
              <strong className="text-[var(--color-fg)]">Phishing-resistant.</strong> Passkeys are
              bound to this site (degenfeed.xyz). A fake website cannot trick your browser into
              using them. Your biometric data never leaves your device.
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Compatible with: fingerprint sensors, Face ID, Windows Hello, YubiKeys, and
              cross-device passkeys synced via iCloud Keychain or Google Password Manager.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
