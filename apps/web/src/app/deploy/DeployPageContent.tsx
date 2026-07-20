'use client';

import Link from 'next/link';

// == Constants =============================================================

interface DeployOption {
  id: 'lemmy' | 'peertube' | 'mastodon';
  title: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  requirements: string[];
  setupTime: string;
  pricing: string;
}

const OPTIONS: DeployOption[] = [
  {
    id: 'lemmy',
    title: 'Community',
    tagline: 'Lemmy — Reddit-like discussions',
    description:
      'Launch a threaded discussion forum with voting, moderation, and sub-communities. Full ActivityPub federation means your users can interact with the entire fediverse.',
    icon: '💬',
    color: '#f97316',
    gradient: 'from-orange-500/20 to-amber-500/10',
    requirements: ['2 GB RAM (4 GB recommended)', '10 GB storage', 'Docker + Compose v2'],
    setupTime: '~15 minutes',
    pricing: 'Free (self-hosted)',
  },
  {
    id: 'peertube',
    title: 'Video',
    tagline: 'PeerTube — Decentralized video hosting',
    description:
      'Run your own video platform with transcoding, live streaming, and P2P distribution. Your videos are served via WebTorrent — the more viewers, the faster it gets.',
    icon: '🎬',
    color: '#e11d48',
    gradient: 'from-rose-500/20 to-pink-500/10',
    requirements: ['4 GB RAM (8 GB recommended)', '100 GB+ SSD storage', 'Docker + Compose v2'],
    setupTime: '~30 minutes',
    pricing: 'Free (self-hosted)',
  },
  {
    id: 'mastodon',
    title: 'Social',
    tagline: 'Mastodon — Twitter/X-style microblogging',
    description:
      'Stand up a full microblogging service with hashtags, trends, direct messaging, and real-time streaming. Your instance federates with thousands of other Mastodon servers.',
    icon: '🐘',
    color: '#6366f1',
    gradient: 'from-indigo-500/20 to-violet-500/10',
    requirements: [
      '4 GB RAM (8 GB recommended)',
      '20 GB+ storage',
      'Docker + Compose v2',
      'SMTP server',
    ],
    setupTime: '~20 minutes',
    pricing: 'Free (self-hosted)',
  },
];

// == Option Card ===========================================================

function DeployOptionCard({ option }: { option: DeployOption }) {
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)] backdrop-blur-xl transition-all duration-300 hover:border-[var(--color-border)] hover:shadow-[0_0_40px_-12px] hover:-translate-y-1"
      style={
        {
          '--tw-shadow-color': `${option.color}20`,
          boxShadow: `0 0 30px -12px ${option.color}15`,
          borderColor: `${option.color}20`,
        } as React.CSSProperties
      }
    >
      {/* Top accent bar */}
      <span
        className="absolute inset-x-0 top-0 h-1 opacity-60 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: option.color, boxShadow: `0 0 12px ${option.color}60` }}
      />

      <div className="p-6 sm:p-8">
        {/* Icon + Title */}
        <div className="mb-5 flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${option.color}18` }}
            aria-hidden="true"
          >
            {option.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[var(--color-fg)]">{option.title}</h2>
            <p className="text-sm" style={{ color: option.color }}>
              {option.tagline}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="mb-5 text-sm leading-relaxed text-[var(--color-muted)]">
          {option.description}
        </p>

        {/* Info grid */}
        <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-[var(--color-overlay)] p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Setup time
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--color-fg)]">
              {option.setupTime}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Pricing
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--color-fg)]">{option.pricing}</p>
          </div>
        </div>

        {/* Requirements */}
        <div className="mb-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Requirements
          </p>
          <ul className="space-y-1">
            {option.requirements.map((req) => (
              <li key={req} className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Link
          href={`/deploy/request?type=${option.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[var(--color-fg)] transition-all duration-200 hover:brightness-110"
          style={{
            backgroundColor: option.color,
            boxShadow: `0 4px 16px ${option.color}40`,
          }}
        >
          Get Started
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </article>
  );
}

// == Main Page =============================================================

export default function DeployPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-emerald-500/10 text-3xl shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            🚀
          </span>
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[var(--color-fg)] sm:text-4xl">
          Launch Your Own Community
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
          Spin up your own self-hosted Lemmy, PeerTube, or Mastodon instance under your domain.{' '}
          DegenFeed handles the federation and discovery — your community is instantly part of the
          web3 social graph.
        </p>
      </div>

      {/* Option grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {OPTIONS.map((option) => (
          <DeployOptionCard key={option.id} option={option} />
        ))}
      </div>

      {/* How it works */}
      <section className="mt-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-[var(--color-fg)]">How It Works</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '1',
              title: 'Choose',
              desc: 'Pick your platform — Community, Video, or Social',
            },
            {
              step: '2',
              title: 'Deploy',
              desc: 'Get a docker-compose.yml tailored to your domain',
            },
            { step: '3', title: 'Launch', desc: 'Run docker compose up -d on your server' },
            {
              step: '4',
              title: 'Federate',
              desc: 'DegenFeed discovers your instance and adds it to the feed',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-center backdrop-blur-xl"
            >
              <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/15 text-sm font-bold text-degen-400">
                {item.step}
              </span>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">{item.title}</h3>
              <p className="text-xs text-[var(--color-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="mb-6 text-center text-2xl font-bold text-[var(--color-fg)]">
          Frequently Asked Questions
        </h2>
        <div className="mx-auto max-w-3xl space-y-4">
          {[
            {
              q: 'Do I need my own server?',
              a: 'Yes — you provide the hardware. We generate the deployment config. A $10/month VPS is enough for most communities.',
            },
            {
              q: 'What about DNS?',
              a: "You need a domain pointing to your server IP. We guide you through SSL setup with Let's Encrypt.",
            },
            {
              q: 'How does federation work?',
              a: 'All three platforms use ActivityPub. Once your instance is live, it can communicate with thousands of other federated servers automatically.',
            },
            {
              q: 'Do I need technical skills?',
              a: 'Basic command-line experience helps, but our templates are one-command deploys. Docker handles the complexity.',
            },
            {
              q: 'Is it really free?',
              a: 'The software is free and open source. You only pay for your server hosting. DegenFeed federation is free.',
            },
          ].map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] backdrop-blur-xl transition-all hover:border-[var(--color-border)]"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-[var(--color-fg)]">
                {faq.q}
                <span className="text-[var(--color-muted)] transition-transform group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <p className="border-t border-[var(--color-border)] px-5 py-4 text-sm leading-relaxed text-[var(--color-muted)]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Docs link */}
      <div className="mt-12 text-center">
        <p className="text-sm text-[var(--color-muted)]">
          Want to do it yourself? Read the{' '}
          <a
            href="/docs"
            className="font-semibold text-degen-400 underline decoration-degen-500/30 transition-all hover:decoration-degen-500"
          >
            deployment docs
          </a>
          .
        </p>
      </div>
    </div>
  );
}
