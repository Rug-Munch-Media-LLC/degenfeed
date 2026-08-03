'use client';

/**
 * @app/auth — Dedicated sign-in / sign-up landing page.
 *
 * Renders the polished SignInModal (with Sign In / Create Account tabs) over
 * a branded backdrop. Used for direct links like "Sign in" from marketing
 * pages and the login button in the header.
 */

import { SignInModal } from '@degenfeed/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useWeb3 } from '../../components/Web3Provider';

export default function AuthPage() {
  const router = useRouter();
  const { signIn, walletAddress, signingIn } = useAuth();
  const { availableWallets } = useWeb3();

  // Once a wallet/identity is connected on this page, glide over to the
  // profile instead of leaving the modal open.
  useEffect(() => {
    if (!walletAddress) return;
    const timer = setTimeout(() => router.push('/profile'), 600);
    return () => clearTimeout(timer);
  }, [walletAddress, router]);

  const close = () => {
    if (walletAddress) {
      router.push('/profile');
    } else {
      router.push('/');
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-bg)]">
      {/* Branded backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-degen-500/10 via-transparent to-purple-500/10" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-degen-500/5 blur-3xl" />
      </div>

      {/* Brand block behind the modal */}
      <div
        className="pointer-events-none absolute top-8 flex w-full flex-col items-center gap-2 px-4"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-degen-500/20 text-xl font-black text-degen-400">
            D
          </span>
          <span className="text-xl font-black tracking-tight text-[var(--color-fg)]">
            DegenFeed
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          The Web3 Social Universe — one identity across every protocol
        </p>
      </div>

      <SignInModal
        open
        onClose={close}
        onSignIn={signIn}
        walletAddress={walletAddress}
        walletSigningIn={signingIn}
        busy={signingIn}
        availableWallets={availableWallets}
      />
    </main>
  );
}
