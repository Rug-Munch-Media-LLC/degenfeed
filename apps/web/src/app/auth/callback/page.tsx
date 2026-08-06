'use client';

/**
 * DegenFeed — Unified Auth Callback
 *
 * Better Auth handles the OAuth callback server-side (the api-server's
 * `/api/auth/better/callback/:provider` route exchanges the authorization
 * code, sets the session cookie, and redirects back to `callbackURL`).
 *
 * This page only exists for the legacy protocol flow and as a landing spot
 * for any leftover `/auth/callback` links. It shows a loading state while
 * Better Auth completes, then sends the user home.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Give Better Auth a beat to finish processing (cookie set / redirect).
    const timer = setTimeout(() => {
      router.replace('/home');
    }, 800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-6xl">🔐</div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Finishing sign-in…</h1>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        Better Auth is verifying your session. You'll be redirected automatically.
      </p>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div className="h-full w-full animate-pulse rounded-full bg-degen-500" />
      </div>
    </main>
  );
}
