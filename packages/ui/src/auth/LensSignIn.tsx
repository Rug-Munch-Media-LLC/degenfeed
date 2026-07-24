'use client';

import { memo, useState } from 'react';

export interface LensSignInProps {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}

export const LensSignIn = memo(function LensSignIn({ onSignIn, onBack }: LensSignInProps) {
  const [hasWallet, setHasWallet] = useState(false);

  if (typeof window !== 'undefined') {
    setTimeout(() => setHasWallet(!!(window as unknown as { ethereum?: unknown }).ethereum), 0);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Lens uses your Ethereum wallet to sign in. Make sure MetaMask, Rainbow, or another EVM
        wallet is installed.
      </p>
      <button
        type="button"
        onClick={() => onSignIn({ method: 'wallet' })}
        className="btn-primary w-full"
      >
        {hasWallet ? 'Sign in with wallet' : 'Connect wallet'}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)]"
      >
        ← Back
      </button>
    </div>
  );
});
