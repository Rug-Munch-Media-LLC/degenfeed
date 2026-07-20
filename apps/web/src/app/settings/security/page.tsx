'use client';

/**
 * Security Settings page
 *
 * Users manage all 2FA methods, view active sessions, review security
 * events, and control their account security from one place.
 *
 * Follows the same layout conventions as the main settings page (settings/page.tsx).
 */

import { useState } from 'react';
import { SecurityCard } from '../../../components/auth/SecurityCard';
import { SecurityLog } from '../../../components/auth/SecurityLog';
import { SessionList } from '../../../components/auth/SessionList';
import { PageHeader } from '../../../components/ui/PageHeader';

/* ─── Placeholder Setup Components ─────────────────────────── */

function PasskeySetup() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Passkeys use your device&apos;s biometric authentication (fingerprint, Face ID, Windows
        Hello) or a hardware security key (YubiKey) to sign in securely. They are phishing-resistant
        and work across devices via iCloud Keychain or password managers.
      </p>
      <button
        type="button"
        className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
      >
        Register a passkey
      </button>
    </div>
  );
}

function TOTPSetup() {
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'done'>('intro');

  return (
    <div className="space-y-3">
      {step === 'intro' && (
        <>
          <p className="text-sm text-[var(--color-muted)]">
            Set up two-factor authentication using any authenticator app that supports TOTP
            (Time-based One-Time Passwords), such as Google Authenticator, Authy, or 1Password.
          </p>
          <button
            type="button"
            onClick={() => setStep('scan')}
            className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
          >
            Set up authenticator app
          </button>
        </>
      )}
      {step === 'scan' && (
        <>
          <p className="text-sm text-[var(--color-muted)]">
            Scan this QR code with your authenticator app, or enter the setup key manually.
          </p>
          {/* QR code placeholder — real implementation uses a proper QR lib */}
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-glass-border)] bg-[var(--color-overlay)]">
            <span className="text-xs text-[var(--color-muted)]">QR Code</span>
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] px-3 py-2 font-mono text-xs text-[var(--color-muted)]">
            Setup key: XXXX XXXX XXXX XXXX
          </div>
          <button
            type="button"
            onClick={() => setStep('verify')}
            className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
          >
            I&apos;ve scanned the code
          </button>
        </>
      )}
      {step === 'verify' && (
        <>
          <p className="text-sm text-[var(--color-muted)]">
            Enter the 6-digit code from your authenticator app to verify setup.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="input flex-1 text-center font-mono text-lg tracking-widest"
              aria-label="Verification code"
            />
            <button
              type="button"
              onClick={() => setStep('done')}
              className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
            >
              Verify
            </button>
          </div>
        </>
      )}
      {step === 'done' && (
        <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4 text-center">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm font-medium text-degen-400">Authenticator app is now enabled</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            You&apos;ll be asked for a verification code on new sign-ins.
          </p>
          <button
            type="button"
            onClick={() => setStep('intro')}
            className="mt-3 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            Remove authenticator
          </button>
        </div>
      )}
    </div>
  );
}

function HardwareWalletVerify() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Connect your Ledger, Trezor, or other hardware wallet and sign a cryptographic challenge to
        verify ownership. This is the most secure 2FA method — your private key never leaves the
        device.
      </p>
      <button
        type="button"
        className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
      >
        Sign challenge with hardware wallet
      </button>
    </div>
  );
}

function RecoveryCodesManager() {
  const [codes, setCodes] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleGenerate = () => {
    // Generate 10 recovery codes (placeholder)
    const newCodes = Array.from({ length: 10 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      ).join('-');
    });
    setCodes(newCodes);
    setShowConfirm(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join('\n'));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Recovery codes allow you to regain access to your account if you lose your 2FA device. Each
        code can only be used once. Store them securely — preferably offline.
      </p>

      {codes.length > 0 && (
        <div className="rounded-xl border border-degen-500/30 bg-degen-500/5 p-4">
          <p className="mb-2 text-xs font-medium text-degen-400">
            Save these codes in a secure location. They will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {codes.map((code, i) => (
              <code
                key={code}
                className="rounded-lg bg-[var(--color-bg)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-fg)]"
              >
                {i + 1}. {code}
              </code>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)]"
            >
              Copy codes
            </button>
            <button
              type="button"
              onClick={() => setCodes([])}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              I&apos;ve saved them — clear
            </button>
          </div>
        </div>
      )}

      {codes.length === 0 && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded-xl bg-[var(--color-overlay)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)]"
        >
          Generate new recovery codes
        </button>
      )}

      {showConfirm && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-xs text-yellow-400 font-medium">
            Generating new codes will invalidate any previously generated codes. Make sure you have
            saved your current codes if you still need them.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/30"
            >
              Generate anyway
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
              {deactivating ? 'Deactivating…' : 'Yes, deactivate my account'}
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
  // State placeholders for 2FA methods — real implementations would
  // fetch these from the server and wire up the setup flows.
  const [passkeysEnabled] = useState(false);
  const [totpEnabled] = useState(false);
  const [hwWalletEnabled] = useState(true);

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
            setupComponent={<PasskeySetup />}
            hint="Most secure and convenient method"
          />

          {/* TOTP (Authenticator App) */}
          <SecurityCard
            icon="📱"
            title="Authenticator App (TOTP)"
            description="6-digit codes from Google Authenticator, Authy, or 1Password."
            status={totpEnabled ? 'active' : 'inactive'}
            setupComponent={<TOTPSetup />}
            hint="Works without internet connection"
          />

          {/* Hardware Wallet */}
          <SecurityCard
            icon="🔐"
            title="Hardware Wallet Challenge"
            description="Sign a challenge with your Ledger or Trezor. Most secure method."
            status={hwWalletEnabled ? 'active' : 'inactive'}
            setupComponent={<HardwareWalletVerify />}
            hint="Requires a hardware wallet device"
          />
        </div>
      </section>

      {/* ─── Recovery Codes Section ────────────────────────── */}
      <section className="mb-8" aria-labelledby="heading-recovery">
        <h2 id="heading-recovery" className="mb-3 text-base font-semibold text-[var(--color-fg)]">
          Recovery Codes
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-5 py-4">
          <RecoveryCodesManager />
        </div>
      </section>

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
