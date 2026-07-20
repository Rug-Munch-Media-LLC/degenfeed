'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

const creatorTypes = [
  { value: 'artist', label: 'Artist / Musician' },
  { value: 'developer', label: 'Developer / Engineer' },
  { value: 'writer', label: 'Writer / Journalist' },
  { value: 'streamer', label: 'Streamer / Podcaster' },
  { value: 'trader', label: 'Trader / Investor' },
  { value: 'builder', label: 'Builder / Founder' },
  { value: 'community', label: 'Community Manager' },
  { value: 'other', label: 'Other' },
];

const platforms = [
  'Nostr',
  'Farcaster',
  'Lens',
  'Bluesky',
  'Mastodon',
  'Twitter / X',
  'Reddit',
  'YouTube',
  'Twitch',
  'Threads',
  'Mirror',
  'Paragraph',
  'Ghost',
  'Medium',
  'Substack',
];

const featureOptions = [
  { value: 'cross-posting', label: 'Universal Cross-Posting' },
  { value: 'coins', label: 'Creator Coins' },
  { value: 'live', label: 'Live Streaming' },
  { value: 'tipping', label: 'Cross-Platform Tipping' },
  { value: 'aggregation', label: 'Content Aggregation' },
  { value: 'self-host', label: 'Self-Hosted Infrastructure' },
  { value: 'analytics', label: 'Analytics Dashboard' },
  { value: 'video', label: 'Video Hub' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'communities', label: 'Federated Communities' },
];

export function WaitlistForm() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [email, setEmail] = useState('');
  const [creatorType, setCreatorType] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [excitedFeatures, setExcitedFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const togglePlatform = useCallback((platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }, []);

  const toggleFeature = useCallback((feature: string) => {
    setExcitedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature],
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !creatorType) return;
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            creatorType,
            platforms: selectedPlatforms,
            features: excitedFeatures,
          }),
        });
        if (!res.ok) throw new Error('Failed');
        setStep('success');
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [email, creatorType, selectedPlatforms, excitedFeatures],
  );

  if (step === 'success') {
    return (
      <div className="waitlist-page">
        <div className="waitlist-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1>You&apos;re on the list!</h1>
          <p className="sub" style={{ marginBottom: '1.5rem' }}>
            Thanks, {email}. We&apos;ll notify you when DegenFeed launches. In the meantime, check
            out the live feed.
          </p>
          <div className="hero-ctas" style={{ justifyContent: 'center' }}>
            <Link href="/feed" className="cta-primary">
              Browse the Feed
            </Link>
            <Link href="/" className="cta-secondary">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist-page">
      <div className="waitlist-card">
        <h1>Join the Waitlist</h1>
        <p className="sub">Be the first to experience the future of decentralized social.</p>

        <form className="waitlist-page-form" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="waitlist-field">
            <label htmlFor="wl-email">Email address *</label>
            <input
              id="wl-email"
              type="email"
              required
              placeholder="you@example.com"
              className="waitlist-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Creator Type */}
          <div className="waitlist-field">
            <label htmlFor="wl-type">What kind of creator are you? *</label>
            <select
              id="wl-type"
              required
              className="waitlist-select"
              value={creatorType}
              onChange={(e) => setCreatorType(e.target.value)}
            >
              <option value="">Select one…</option>
              {creatorTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Platforms */}
          <fieldset className="waitlist-field">
            <legend
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '0.375rem',
                color: 'var(--color-fg)',
              }}
            >
              Which platforms do you use?
            </legend>
            <div className="waitlist-checkbox-grid">
              {platforms.map((platform) => (
                <label key={platform} className="waitlist-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                  />
                  {platform}
                </label>
              ))}
            </div>
            <span className="hint">Select all that apply</span>
          </fieldset>

          {/* Features */}
          <fieldset className="waitlist-field">
            <legend
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '0.375rem',
                color: 'var(--color-fg)',
              }}
            >
              What features excite you most?
            </legend>
            <div className="waitlist-checkbox-grid">
              {featureOptions.map((f) => (
                <label key={f.value} className="waitlist-checkbox-label">
                  <input
                    type="checkbox"
                    checked={excitedFeatures.includes(f.value)}
                    onChange={() => toggleFeature(f.value)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <span className="hint">Select all that apply</span>
          </fieldset>

          {/* Submit */}
          {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}>{error}</p>}
          <button
            type="submit"
            className="cta-primary"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Joining\u2026' : 'Join the Waitlist'}
          </button>
        </form>

        <p className="waitlist-note" style={{ marginTop: '1rem', textAlign: 'center' }}>
          No spam, ever. We&apos;ll only email you about launch. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
