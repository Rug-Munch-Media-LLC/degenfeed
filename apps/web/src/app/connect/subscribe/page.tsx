'use client';

/**
 * DegenFeed Connect — Standalone Subscription Page
 *
 * Purchase DegenFeed Connect as a standalone add-on ($15/mo or $150/yr).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConnectSubscribePage() {
  const router = useRouter();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = useCallback(async () => {
    setSubscribing(true);
    setError(null);

    try {
      // In production, this would first create a payment intent / invoice
      // For now, we simulate with a placeholder tx hash
      const res = await fetch('/api/external/standalone/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: `tx_${crypto.randomUUID().slice(0, 8)}`,
          period,
        }),
      });

      const data = (await res.json()) as {
        data?: { message?: string };
        error?: string;
      };

      if (res.ok && data.data) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/settings/external-platforms');
        }, 2000);
      } else {
        setError(data.error ?? 'Subscription failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  }, [period, router]);

  return (
    <div className="mx-auto flex max-w-md px-4 py-16">
      <div className="w-full rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-8">
        {success ? (
          <div className="py-8 text-center">
            <span className="mb-4 block text-4xl">🎉</span>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">
              DegenFeed Connect Activated!
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Redirecting to settings...
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <span className="mb-2 block text-3xl">🚀</span>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">
                DegenFeed Connect
              </h1>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Standalone add-on for external platform posting
              </p>
            </div>

            {/* Period toggle */}
            <div className="mb-6 flex rounded-lg border border-[var(--color-glass-border)] p-1">
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  period === 'monthly'
                    ? 'bg-white/10 text-[var(--color-fg)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriod('annual')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  period === 'annual'
                    ? 'bg-white/10 text-[var(--color-fg)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                Annual <span className="text-green-400">Save 17%</span>
              </button>
            </div>

            {/* Price */}
            <div className="mb-6 text-center">
              <span className="text-4xl font-bold text-[var(--color-fg)]">
                ${period === 'monthly' ? '15' : '150'}
              </span>
              <span className="text-sm text-[var(--color-muted)]">
                /{period === 'monthly' ? 'month' : 'year'}
              </span>
            </div>

            {/* Features */}
            <ul className="mb-6 space-y-3">
              {[
                'Post to YouTube, Twitch, Kick',
                'Post to TikTok, Instagram, LinkedIn',
                'Schedule posts for optimal times',
                'Go live on connected platforms',
                'Basic cross-platform analytics',
                'Cancel anytime',
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-[var(--color-muted)]"
                >
                  <span className="text-green-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subscribing
                ? 'Processing...'
                : `Subscribe $${period === 'monthly' ? '15' : '150'}/${period === 'monthly' ? 'mo' : 'yr'}`}
            </button>

            <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
              By subscribing, you agree to our Terms of Service.
              Cancel anytime — access remains until end of billing period.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
