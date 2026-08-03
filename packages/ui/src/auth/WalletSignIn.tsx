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
  /** Optional inline error message (e.g. "No wallet detected") */
  error?: string;
  availableWallets?: WalletInfo[];
}

/**
 * Map a detected wallet to the protocol sign-in handler it should trigger.
 * - EVM wallets (MetaMask, Rabby, Rainbow, Coinbase) → ethereum
 * - Solana wallets (Phantom, Solflare) → solana
 * - WalletConnect is connector-agnostic → ethereum (EIP-1193 bridge)
 */
function walletProtocol(id: string): string {
  if (id === 'phantom' || id === 'solflare') return 'solana';
  return 'ethereum';
}

/** The wallet options we always surface (in priority order). */
const PRIORITY_WALLETS = ['metamask', 'walletconnect', 'coinbase', 'phantom'];

export const WalletSignIn = memo(function WalletSignIn({
  onSignIn,
  walletAddress,
  walletSigningIn,
  error,
  availableWallets,
}: WalletSignInProps) {
  // Build a lookup of the detected wallet metadata.
  const byId = new Map<string, WalletInfo>((availableWallets ?? []).map((w) => [w.id, w]));

  // Always render the priority wallets; append any extra detected wallets after.
  const rendered: WalletInfo[] = [
    ...PRIORITY_WALLETS.map(
      (id) =>
        byId.get(id) ?? {
          id,
          label:
            id === 'metamask'
              ? 'MetaMask'
              : id === 'walletconnect'
                ? 'WalletConnect'
                : id === 'coinbase'
                  ? 'Coinbase Wallet'
                  : 'Phantom',
          icon:
            id === 'metamask'
              ? '🦊'
              : id === 'walletconnect'
                ? '🔗'
                : id === 'coinbase'
                  ? '🔷'
                  : '👻',
          color:
            id === 'metamask'
              ? '#f6851b'
              : id === 'walletconnect'
                ? '#3b99fc'
                : id === 'coinbase'
                  ? '#0052ff'
                  : '#ab9ff2',
          detected: false,
        },
    ),
    ...(availableWallets ?? []).filter((w) => !PRIORITY_WALLETS.includes(w.id)),
  ];

  const connected = !!walletAddress;

  return (
    <div className="space-y-3">
      {/* Connected wallet display */}
      {connected ? (
        <div className="rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3">
          <div className="text-xs text-[var(--color-muted)] mb-1">Connected Wallet</div>
          <div className="text-sm font-mono text-degen-400 break-all">{walletAddress}</div>
        </div>
      ) : null}

      {/* Inline error state */}
      {error ? (
        <p
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Wallet option list */}
      <div className="space-y-1.5">
        {rendered.map((w) => {
          const protocol = walletProtocol(w.id);
          const disabled = walletSigningIn || connected;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSignIn(protocol)}
              disabled={disabled}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all ${
                w.detected
                  ? 'border-[var(--color-border)] bg-[var(--color-muted)] hover:border-gray-500'
                  : 'border-[var(--color-border)]/50 bg-[var(--color-muted)] opacity-70 hover:border-gray-600'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span className="text-lg">{w.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-fg)]">{w.label}</div>
                <div className="text-[10px] text-[var(--color-muted)]">
                  {w.detected ? (
                    <span className="text-green-500">● Detected</span>
                  ) : (
                    'Not detected in this browser'
                  )}
                  {w.id === 'phantom' || w.id === 'solflare' ? ' · Solana' : ''}
                </div>
              </div>
              <span className="text-xs text-[var(--color-muted)]">
                {walletSigningIn ? 'Connecting…' : 'Connect →'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hint when nothing was detected */}
      {!walletSigningIn && !connected && !(availableWallets ?? []).some((w) => w.detected) && (
        <p className="text-[10px] text-gray-600">
          Install a wallet extension (MetaMask, Phantom) to connect instantly — or continue browsing
          anonymously.
        </p>
      )}
    </div>
  );
});
