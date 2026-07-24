'use client';

import { memo } from 'react';

interface WalletInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  detected: boolean;
}

export interface WalletSignInProps {
  onSignIn: (p: string) => void;
  walletAddress?: string;
  walletSigningIn?: boolean;
  availableWallets?: WalletInfo[];
}

export const WalletSignIn = memo(function WalletSignIn({
  onSignIn,
  walletAddress,
  walletSigningIn,
  availableWallets,
}: WalletSignInProps) {
  const hasDetection = availableWallets && availableWallets.length > 0;
  const detectedWallets = hasDetection
    ? availableWallets.filter((w) => w.detected && w.id !== 'walletconnect')
    : [];

  return (
    <div className="space-y-3">
      {/* Connected wallet display */}
      {walletAddress ? (
        <div className="rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3">
          <div className="text-xs text-[var(--color-muted)] mb-1">Connected Wallet</div>
          <div className="text-sm font-mono text-degen-400 break-all">{walletAddress}</div>
        </div>
      ) : null}

      {/* Detected wallet list */}
      {hasDetection && detectedWallets.length > 0 ? (
        <div className="space-y-1.5">
          {availableWallets.map((w) => {
            if (w.id === 'walletconnect') return null; // rendered separately
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onSignIn('ethereum')}
                disabled={walletSigningIn}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all ${
                  w.detected
                    ? 'border-[var(--color-border)] bg-[var(--color-muted)] hover:border-gray-500'
                    : 'border-[var(--color-border)]/50 bg-[var(--color-muted)] opacity-50'
                }`}
              >
                <span className="text-lg">{w.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-fg)]">{w.label}</div>
                  {w.detected ? (
                    <div className="text-[10px] text-green-500">● Detected</div>
                  ) : (
                    <div className="text-[10px] text-gray-600">Not detected</div>
                  )}
                </div>
                {w.detected && (
                  <span className="text-xs text-[var(--color-muted)] group-hover:text-[var(--color-muted)]">
                    Connect →
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Fallback: simple Ethereum / Solana buttons */
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSignIn('ethereum')}
            disabled={walletSigningIn}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#627eea]/30 bg-[#627eea]/10 px-4 py-3 text-sm font-semibold text-[#627eea] transition-all hover:bg-[#627eea]/20 disabled:opacity-50"
            type="button"
          >
            <span className="text-lg">◆</span>
            {walletSigningIn ? 'Signing...' : 'Ethereum'}
          </button>
          <button
            onClick={() => onSignIn('solana')}
            disabled={walletSigningIn}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#9945ff]/30 bg-[#9945ff]/10 px-4 py-3 text-sm font-semibold text-[#9945ff] transition-all hover:bg-[#9945ff]/20 disabled:opacity-50"
            type="button"
          >
            <span className="text-lg">◎</span>
            {walletSigningIn ? 'Signing...' : 'Solana'}
          </button>
        </div>
      )}

      {/* WalletConnect — functional, no "Coming soon" badge */}
      <button
        type="button"
        onClick={() => onSignIn('ethereum')}
        disabled={walletSigningIn}
        className="flex w-full items-center gap-3 rounded-xl border border-[#3b99fc]/40 bg-[#3b99fc]/5 px-4 py-2.5 text-left transition-all hover:border-[#3b99fc]/60 hover:bg-[#3b99fc]/10"
      >
        <span className="text-lg">🔗</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-[#3b99fc]">WalletConnect</div>
          <div className="text-xs text-[var(--color-muted)]">
            Connect using WalletConnect-compatible wallet
          </div>
        </div>
        <span className="text-xs text-[#3b99fc]">Connect →</span>
      </button>
    </div>
  );
});
