'use client';

/**
 * Security Settings page
 *
 * Users manage all 2FA methods, view active sessions, review security
 * events, and control their account security from one place.
 *
 * Follows the same layout conventions as the main settings page (settings/page.tsx).
 */

import { useCallback, useState } from 'react';
import { HardwareWalletVerify } from '../../../components/auth/HardwareWalletVerify';
import { PasskeySetup } from '../../../components/auth/PasskeySetup';
import RecoveryCodes from '../../../components/auth/RecoveryCodes';
import { SecurityCard } from '../../../components/auth/SecurityCard';
import { SecurityLog } from '../../../components/auth/SecurityLog';
import { SessionList } from '../../../components/auth/SessionList';
import TOTPSetup from '../../../components/auth/TOTPSetup';
import PageHeader from '../../../components/ui/PageHeader';

/* ─── Danger Zone ──────────────────────────────────────────── */

function DangerZone() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to deactivate');
      // Redirect handled by the backend
      window.location.href = '/';
    } catch {
      setDeactivating(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
      <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Permanently deactivate your account and all associated data. This action cannot be undone.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="mt-3 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25"
        >
          Deactivate account
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 space-y-2">
          <p className="text-xs text-red-400 font-medium">
            Are you absolutely sure? This will immediately deactivate your account and schedule
            deletion of all your data. This cannot be reversed.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivating}
              className="flex-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
            >
              {deactivating ? 'Deactivating\u2026' : 'Yes, deactivate my account'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page Component ───────────────────────────────────────── */

export default function SecuritySettingsPage() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [passkeysEnabled, setPasskeysEnabled] = useState(false);
  const [hwWalletEnabled, setHwWalletEnabled] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Called after TOTP setup completes — show recovery codes
  const handleTOTPVerified = useCallback((codes: string[]) => {
    setTotpEnabled(true);
    setRecoveryCodes(codes);
  }, []);

  // Called when user acknowledges recovery codes
  const handleRecoveryAcknowledged = useCallback(() => {
    setRecoveryCodes(null);
  }, []);

  // Called after passkey registration
  const handlePasskeyRegistered = useCallback(() => {
    setPasskeysEnabled(true);
  }, []);

  // Called after hardware wallet verification
  const handleHwWalletVerified = useCallback(() => {
    setHwWalletEnabled(true);
  }, []);

  const shieldIcon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-24 sm:pb-6">
      <PageHeader
        title="Security"
        description="Manage your account security, 2FA methods, and active sessions"
        icon={shieldIcon}
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Security' }]}
      />

      {/* ─── 2FA Methods Section ───────────────────────────── */}
      <section className="mb-8" aria-labelledby="heading-2fa">
        <h2 id="heading-2fa" className="mb-3 text-base font-semibold text-[var(--color-fg)]">
          Two-Factor Authentication (2FA)
        </h2>
        <div className="space-y-3">
          {/* Passkeys (WebAuthn) */}
          <SecurityCard
            icon="🔑"
            title="Passkeys (Recommended)"
            description="Biometric authentication. Phishing-resistant. Works with fingerprint, Face ID, or security keys."
            status={passkeysEnabled ? 'active' : 'inactive'}
            setupComponent={
              <PasskeySetup onRegistered={handlePasskeyRegistered} onError={() => {}} />
            }
            hint="Most secure and convenient method"
          />

          {/* TOTP (Authenticator App) */}
          <SecurityCard
            icon="📱"
            title="Authenticator App (TOTP)"
            description="6-digit codes from Google Authenticator, Authy, or 1Password."
            status={totpEnabled ? 'active' : 'inactive'}
            setupComponent={<TOTPSetup onVerified={handleTOTPVerified} onCancel={() => {}} />}
            hint="Works without internet connection"
          />

          {/* Hardware Wallet */}
          <SecurityCard
            icon="🔐"
            title="Hardware Wallet Challenge"
            description="Sign a challenge with your Ledger or Trezor. Most secure method."
            status={hwWalletEnabled ? 'active' : 'inactive'}
            setupComponent={
              <HardwareWalletVerify mode="setup" onVerified={handleHwWalletVerified} />
            }
            hint="Requires a hardware wallet device"
          />
        </div>
      </section>

      {/* ─── Recovery Codes Section ────────────────────────── */}
      {recoveryCodes && (
        <section className="mb-8" aria-labelledby="heading-recovery">
          <h2 id="heading-recovery" className="mb-3 text-base font-semibold text-[var(--color-fg)]">
            Recovery Codes
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-5 py-4">
            <RecoveryCodes codes={recoveryCodes} onAcknowledged={handleRecoveryAcknowledged} />
          </div>
        </section>
      )}

      {/* ─── Active Sessions Section ───────────────────────── */}
      <section className="mb-8" aria-labelledby="heading-sessions">
        <h2 id="heading-sessions" className="mb-3 text-base font-semibold text-[var(--color-fg)]">
          Active Sessions
        </h2>
        <SessionList />
      </section>

      {/* ─── Security Log Section ──────────────────────────── */}
      <section className="mb-8" aria-labelledby="heading-log">
        <h2 id="heading-log" className="mb-3 text-base font-semibold text-[var(--color-fg)]">
          Security Log
        </h2>
        <SecurityLog />
      </section>

      {/* ─── Danger Zone ──────────────────────────────────── */}
      <section aria-labelledby="heading-danger">
        <DangerZone />
      </section>
    </div>
  );
}
