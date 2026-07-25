'use client';

import { useHardwareWallet2FA } from '../../hooks/useHardwareWallet2FA';
import { useAuth } from '../AuthProvider';
import { HardwareWalletVerify } from '../auth/HardwareWalletVerify';
import { useToast } from '../Toast';
import { PROTOCOLS } from './types';

interface AccountSectionProps {
  email: string;
  onEmailChange: (v: string) => void;
  onSaveEmail: () => void;
  emailSaved: boolean;
}

export function AccountSection({
  email,
  onEmailChange,
  onSaveEmail,
  emailSaved,
}: AccountSectionProps) {
  const { primaryIdentity, walletAddress, openSignIn, linkedIdentities } = useAuth();
  const { showToast } = useToast();
  const { status: hw2FA, fetchStatus: fetchHw2FA, toggle2FA } = useHardwareWallet2FA();

  const connectedProtocols = PROTOCOLS.filter(
    (p) => linkedIdentities.some((i) => i.protocol === p) || primaryIdentity?.protocol === p,
  );

  const handleHw2FAToggle = async () => {
    const newState = !hw2FA?.enabled;
    const ok = await toggle2FA(newState);
    showToast('success', ok ? (newState ? '2FA enabled' : '2FA disabled') : 'Failed to toggle 2FA');
  };

  return (
    <div>
      {/* Wallet */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">
          Wallet Address
        </span>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-degen-400">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M18 12h.01" />
            </svg>
          </div>
          <code className="flex-1 text-sm font-mono text-[var(--color-fg)]">
            {walletAddress
              ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
              : 'No wallet connected'}
          </code>
          {!walletAddress && (
            <button type="button" onClick={openSignIn} className="btn-primary text-xs py-1.5 px-3">
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="settings-email"
          className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
        >
          Email
        </label>
        <div className="flex gap-2">
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            className="input flex-1 text-sm"
          />
          <button
            type="button"
            onClick={onSaveEmail}
            disabled={!email.trim()}
            className="btn-primary text-xs shrink-0"
          >
            {emailSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* 2FA */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-[var(--color-fg)]">Hardware Wallet 2FA</div>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Your private key never leaves your hardware device.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hw2FA?.enabled ?? false}
            data-checked={hw2FA?.enabled ?? false}
            onClick={handleHw2FAToggle}
            className="toggle-track shrink-0"
          >
            <span className="toggle-thumb" />
          </button>
        </div>
        {hw2FA?.enabled && (
          <div className="flex items-start gap-2.5 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-2.5">
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <p className="text-xs font-medium text-degen-400">Active</p>
          </div>
        )}
        {!hw2FA?.enabled && walletAddress && (
          <HardwareWalletVerify
            mode="inline"
            walletType={walletAddress.startsWith('0x') ? 'ethereum' : 'solana'}
            onVerified={() => {
              showToast('success', 'Hardware wallet verified');
              toggle2FA(true);
              fetchHw2FA();
            }}
          />
        )}
        {!walletAddress && (
          <p className="text-xs text-amber-400">Connect a wallet to enable hardware wallet 2FA.</p>
        )}
      </div>

      <hr className="border-[var(--color-glass-border)]" />

      {/* Protocols */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">
          Connected Protocols
        </span>
        <div className="flex flex-wrap gap-2">
          {PROTOCOLS.map((p) => {
            const linked = connectedProtocols.includes(p);
            return (
              <span
                key={p}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${linked ? 'bg-degen-500/15 text-degen-400 border border-degen-500/30' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-[var(--color-glass-border)]'}`}
              >
                {linked && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-degen-400"
                  >
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                  </svg>
                )}
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={openSignIn}
          className="mt-2 rounded-lg bg-degen-500/15 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/25 transition-colors"
        >
          + Link another protocol
        </button>
      </div>
    </div>
  );
}
