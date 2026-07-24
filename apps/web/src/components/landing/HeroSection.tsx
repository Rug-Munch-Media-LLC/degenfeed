'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * HeroSection — Bold web3 social aggregator hero with animated aurora background,
 * gradient headline, CTA buttons, and live stat counters.
 */

const STATS = [
  { label: 'Protocols', value: '18', suffix: '' },
  { label: 'Self-Hosted Nodes', value: '38', suffix: '' },
  { label: 'Open Source', value: '100', suffix: '%' },
] as const;

export function HeroSection() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <section className="relative flex flex-col items-center overflow-hidden pt-12 md:pt-20 pb-10 text-center">
      {/* Aurora background layers */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div
          className="aurora aurora--1"
          style={{
            transform: `translateY(${scrollY * 0.08}px)`,
          }}
        />
        <div
          className="aurora aurora--2"
          style={{
            transform: `translateY(${scrollY * 0.12}px)`,
          }}
        />
        <div
          className="aurora aurora--3"
          style={{
            transform: `translateY(${scrollY * 0.04}px)`,
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,255,65,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: `translateY(${scrollY * -0.05}px)`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4">
        {/* Badge */}
        <div
          className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
          style={{
            borderColor: 'var(--color-accent)',
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
            animationDelay: '0.1s',
            animationFillMode: 'both',
          }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          Live — 18 Protocols · 38 Self-Hosted Nodes
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-in-up text-[clamp(2.5rem,8vw,5.5rem)] font-black leading-[0.95] tracking-[-0.05em]"
          style={{
            fontFamily: 'var(--font-heading)',
            animationDelay: '0.2s',
            animationFillMode: 'both',
          }}
        >
          <span className="gradient-text">One Feed.</span>
          <br />
          <span className="text-[var(--color-fg)]">Every Protocol.</span>
          <br />
          <span className="gradient-text">Your Rules.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mx-auto mt-5 max-w-2xl animate-fade-in text-lg leading-relaxed md:text-xl"
          style={{
            color: 'var(--color-fg-secondary)',
            animationDelay: '0.35s',
            animationFillMode: 'both',
          }}
        >
          DegenFeed unifies 18 decentralized networks into a single, beautiful timeline. Own your
          identity. Control your feed. Bridge every protocol.
        </p>

        {/* CTA Buttons */}
        <div
          className="mt-8 flex animate-fade-in flex-wrap items-center justify-center gap-4"
          style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
        >
          <Link
            href="https://app.degenfeed.xyz"
            className="btn-glow inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M9 9l6 3-6 3V9z" />
            </svg>
            Connect Wallet
          </Link>
          <Link
            href="https://app.degenfeed.xyz"
            className="btn-outline inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Browse Anonymously
          </Link>
        </div>

        {/* Live Stat Counters */}
        <div
          className="mt-10 flex animate-fade-in flex-wrap items-center justify-center gap-6 md:gap-10"
          style={{ animationDelay: '0.65s', animationFillMode: 'both' }}
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="text-2xl font-black tabular-nums md:text-3xl"
                style={{ color: 'var(--color-accent)' }}
              >
                {stat.value}
                {stat.suffix}
              </div>
              <div
                className="text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--color-muted)' }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
