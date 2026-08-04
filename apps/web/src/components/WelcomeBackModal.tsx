'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const LAST_VISIT_KEY = 'df_last_visit';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const DISMISS_SESSION_KEY = 'df_welcome_dismissed';

interface DigestPreview {
  totalPosts: number;
  sections: number;
  followedPosts: number;
  trendingCount: number;
  date: string;
}

export function WelcomeBackModal() {
  const [show, setShow] = useState(false);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAndFetch = useCallback(async () => {
    try {
      // Check last visit
      const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
      const dismissed = sessionStorage.getItem(DISMISS_SESSION_KEY);
      if (dismissed) {
        setLoading(false);
        return;
      }

      const now = Date.now();
      // Update last visit timestamp immediately
      localStorage.setItem(LAST_VISIT_KEY, String(now));

      // Only show if >12 hours since last visit
      if (lastVisit && now - Number(lastVisit) < TWELVE_HOURS_MS) {
        setLoading(false);
        return;
      }

      // Fetch digest preview for stats
      const res = await fetch('/api/digest/today', { credentials: 'include' });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        date: string;
        wallet: string | null;
        sections: Array<{ type: string; items: unknown[] }>;
        meta: { totalPosts: number; totalSections: number };
      };

      // Count followed/catch-up posts
      const catchUpSection = data.sections.find((s) => s.type === 'catch-up');
      const followedPosts = catchUpSection?.items.length ?? 0;

      const trendingSection = data.sections.find((s) => s.type === 'trending');
      const trendingCount = trendingSection?.items.length ?? 0;

      setPreview({
        totalPosts: data.meta.totalPosts,
        sections: data.meta.totalSections,
        followedPosts,
        trendingCount,
        date: data.date,
      });

      // Show modal if user has a wallet (personalized digest)
      if (data.wallet) {
        setShow(true);
      }
    } catch {
      // Silently fail — non-critical UX enhancement
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Small delay to not interfere with initial render
    const timer = setTimeout(checkAndFetch, 1500);
    return () => clearTimeout(timer);
  }, [checkAndFetch]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    sessionStorage.setItem(DISMISS_SESSION_KEY, 'true');
  }, []);

  if (loading || !show || !preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M15 5L5 15M5 5l10 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">👋</div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Welcome back!</h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">Here&apos;s what you missed</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-[var(--color-muted-bg)] p-3 text-center">
            <div className="text-xl font-bold text-degen-400">
              {preview.totalPosts > 999 ? '999+' : preview.totalPosts}
            </div>
            <div className="text-[10px] text-[var(--color-muted)] mt-0.5">New posts</div>
          </div>
          <div className="rounded-xl bg-[var(--color-muted-bg)] p-3 text-center">
            <div className="text-xl font-bold text-[var(--color-fg)]">{preview.followedPosts}</div>
            <div className="text-[10px] text-[var(--color-muted)] mt-0.5">From creators</div>
          </div>
          <div className="rounded-xl bg-[var(--color-muted-bg)] p-3 text-center">
            <div className="text-xl font-bold text-[var(--color-fg)]">{preview.trendingCount}</div>
            <div className="text-[10px] text-[var(--color-muted)] mt-0.5">Trending topics</div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="space-y-2">
          <Link
            href="/digest"
            onClick={handleDismiss}
            className="block w-full py-2.5 rounded-xl bg-degen-500 text-black text-sm font-semibold text-center hover:bg-degen-400 transition-colors"
          >
            📋 View Digest
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="block w-full py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-400/40 transition-colors"
          >
            Continue browsing
          </button>
        </div>

        <p className="text-[10px] text-[var(--color-muted)] text-center mt-4">
          Digest generated for {preview.date}
        </p>
      </div>
    </div>
  );
}
