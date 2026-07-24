'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

type Step = 'welcome' | 'interests' | 'connect' | 'feed';

interface Interest {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface ProtocolOption {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  connected?: boolean;
}

/* ─── Data ────────────────────────────────────────────────────── */

const INTERESTS: Interest[] = [
  { id: 'defi', label: 'DeFi', icon: '🏦', color: '#00ff41' },
  { id: 'nfts', label: 'NFTs & Art', icon: '🎨', color: '#8b5cf6' },
  { id: 'meme-coins', label: 'Meme Coins', icon: '🐸', color: '#f59e0b' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#f4212e' },
  { id: 'infra', label: 'Infrastructure', icon: '⚙️', color: '#1185fe' },
  { id: 'social', label: 'Social', icon: '💬', color: '#f91880' },
  { id: 'bitcoin', label: 'Bitcoin', icon: '₿', color: '#f7931a' },
  { id: 'solana', label: 'Solana', icon: '◎', color: '#9945ff' },
  { id: 'ethereum', label: 'Ethereum', icon: '⟠', color: '#627eea' },
  { id: 'creator-economy', label: 'Creator Economy', icon: '👥', color: '#00ba7c' },
  { id: 'privacy', label: 'Privacy', icon: '🔐', color: '#6364ff' },
  { id: 'ai-crypto', label: 'AI × Crypto', icon: '🤖', color: '#ff4500' },
];

const PROTOCOLS: ProtocolOption[] = [
  {
    id: 'farcaster',
    name: 'Farcaster',
    icon: 'F',
    desc: 'Web3 social protocol on Optimism',
    color: '#8a63d2',
  },
  {
    id: 'nostr',
    name: 'Nostr',
    icon: 'N',
    desc: 'Decentralized relay-based network',
    color: '#8b5cf6',
  },
  {
    id: 'lens',
    name: 'Lens Protocol',
    icon: 'L',
    desc: 'Decentralized social graph',
    color: '#abfe2c',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: 'B',
    desc: 'AT Protocol social network',
    color: '#1185fe',
  },
  { id: 'mastodon', name: 'Mastodon', icon: 'M', desc: 'Fediverse activity pub', color: '#6364ff' },
];

/* ─── Progress Bar ────────────────────────────────────────────── */

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div
      className="mb-8 flex items-center gap-2"
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label="Onboarding progress"
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-degen-500' : 'bg-[var(--color-border)]'}`}
        />
      ))}
    </div>
  );
}

/* ─── Step Indicator ──────────────────────────────────────────── */

function StepBadge({ num, label }: { num: number; label: string }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-degen-500/15 text-[10px] font-bold text-degen-400">
        {num}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════ */

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [connectedProtocols, setConnectedProtocols] = useState<string[]>([]);

  const stepIndex = ['welcome', 'interests', 'connect', 'feed'].indexOf(step);
  const totalSteps = 4;

  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleProtocol = useCallback((id: string) => {
    setConnectedProtocols((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center px-4 py-10 animate-page-enter">
      {/* Logo */}
      <div className="mb-6 text-center">
        <Link href="/feed" className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500 text-sm font-bold text-black">
            D
          </span>
          <span className="text-lg font-bold text-[var(--color-fg)]">DegenFeed</span>
        </Link>
      </div>

      <ProgressBar step={stepIndex} total={totalSteps} />

      {/* ═══ WELCOME ═══ */}
      {step === 'welcome' && (
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-degen-500/20 via-emerald-500/10 to-transparent">
            <span className="text-4xl">🚀</span>
          </div>
          <h1
            className="mb-3 text-4xl font-black text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Welcome to <span className="gradient-text">DegenFeed</span>
          </h1>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
            The Web3 Social Universe. Connect your protocols, discover content across 15+ networks,
            and tip creators in crypto — all from one place.
          </p>
          <div className="mb-8 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '🔗', label: 'Connect', desc: 'Link protocols' },
              { icon: '📰', label: 'Unified Feed', desc: 'One timeline' },
              { icon: '⚡', label: 'Earn & Tip', desc: 'Zero fees' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3"
              >
                <div className="text-xl mb-1">{item.icon}</div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">{item.label}</div>
                <div className="text-[10px] text-[var(--color-muted)]">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('interests')}
              className="btn-primary text-base px-10 py-3"
            >
              Get Started
            </button>
            <Link
              href="/feed"
              className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Skip for now — I know what I&apos;m doing →
            </Link>
          </div>
        </div>
      )}

      {/* ═══ INTERESTS ═══ */}
      {step === 'interests' && (
        <div>
          <StepBadge num={2} label="Personalize Your Feed" />
          <h2
            className="mb-2 text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            What are you into?
          </h2>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            Pick your interests and we&apos;ll curate the best content for you.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {INTERESTS.map((interest) => {
              const selected = selectedInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                    selected
                      ? 'text-black shadow-sm'
                      : 'border border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-[var(--color-fg)]'
                  }`}
                  style={selected ? { background: interest.color, color: '#000' } : {}}
                  aria-pressed={selected}
                >
                  <span>{interest.icon}</span>
                  {interest.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('welcome')}
              className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep('connect')}
              className="btn-primary text-sm px-8 py-2.5"
            >
              {selectedInterests.length > 0
                ? `Continue (${selectedInterests.length} selected)`
                : 'Skip'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ CONNECT PROTOCOLS ═══ */}
      {step === 'connect' && (
        <div>
          <StepBadge num={3} label="Connect Your Protocols" />
          <h2
            className="mb-2 text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Link your first protocol
          </h2>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            Connect at least one account to see your unified feed. You can always add more later.
          </p>
          <div className="mb-6 space-y-2">
            {PROTOCOLS.map((p) => {
              const connected = connectedProtocols.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProtocol(p.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    connected
                      ? 'border-degen-500/50 bg-degen-500/[0.04]'
                      : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/20'
                  }`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: `${p.color}18`, color: p.color }}
                  >
                    {p.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-fg)]">{p.name}</span>
                      {connected && (
                        <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">{p.desc}</p>
                  </div>
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      connected ? 'border-degen-500 bg-degen-500' : 'border-[var(--color-border)]'
                    }`}
                  >
                    {connected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#000"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('interests')}
              className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              ← Back
            </button>
            <Link href="/feed" className="btn-primary text-sm px-8 py-2.5">
              {connectedProtocols.length > 0
                ? `Done — Start Exploring`
                : "Skip, I'll connect later"}
            </Link>
          </div>
        </div>
      )}

      {/* ═══ DONE ═══ */}
      {step === 'feed' && (
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-degen-500/20 via-emerald-500/10 to-transparent">
            <span className="text-4xl">🎉</span>
          </div>
          <h1
            className="mb-3 text-3xl font-black text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            You&apos;re all set!
          </h1>
          <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
            Your feed is personalized and ready. Start exploring content from across the
            decentralized social universe.
          </p>
          <Link href="/feed" className="btn-primary text-base px-10 py-3 gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Go to My Feed
          </Link>
        </div>
      )}
    </div>
  );
}
