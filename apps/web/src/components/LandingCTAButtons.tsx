'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';

/**
 * Client component for landing page CTAs.
 * "Sign in with wallet" opens the sign-in modal via AuthContext.
 * "Browse without signing in" links to /feed.
 */
export function LandingCTAButtons() {
  const { openSignIn } = useAuth();

  return (
    <div className="hero-ctas">
      <button type="button" onClick={openSignIn} className="cta-primary">
        Sign in with wallet
      </button>
      <Link href="/feed" className="cta-secondary">
        Browse without signing in
      </Link>
    </div>
  );
}
