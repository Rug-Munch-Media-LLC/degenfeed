'use client';

import { useCallback, useState } from 'react';

export function WaitlistSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;
      setStatus('loading');
      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) throw new Error('Failed');
        setStatus('success');
      } catch {
        setStatus('error');
      }
    },
    [email],
  );

  if (status === 'success') {
    return (
      <section className="waitlist-section" aria-labelledby="waitlist-heading">
        <h2 id="waitlist-heading" className="section-heading">
          You&apos;re on the list!
        </h2>
        <div className="waitlist-success">
          <h3>Welcome to DegenFeed</h3>
          <p>We&apos;ll notify you when we launch. In the meantime, check out the live feed.</p>
          <div className="hero-ctas" style={{ marginTop: '1rem' }}>
            <a href="/feed" className="cta-primary">
              Browse the Feed
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="waitlist-section" id="waitlist" aria-labelledby="waitlist-heading">
      <h2 id="waitlist-heading" className="section-heading">
        Get early access
      </h2>
      <p className="section-sub">
        Be the first to know when we launch. Join 1,200+ creators already on the list.
      </p>

      <form className="waitlist-form" onSubmit={handleSubmit}>
        <div className="waitlist-input-group">
          <label htmlFor="waitlist-email" className="sr-only">
            Email address
          </label>
          <input
            id="waitlist-email"
            type="email"
            required
            placeholder="you@example.com"
            className="waitlist-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button type="submit" className="cta-primary" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending\u2026' : 'Notify Me'}
          </button>
        </div>
        <p className="waitlist-note">
          No spam, ever. We&apos;ll only email you about launch. Unsubscribe anytime.
        </p>
        {status === 'error' && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}>
            Something went wrong. Please try again.
          </p>
        )}
      </form>
    </section>
  );
}
