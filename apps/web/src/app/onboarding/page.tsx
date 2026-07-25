'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IdentityDiscoveryWizard } from '../../components/IdentityDiscoveryWizard';
import { useWalletConnect } from '../../hooks/useWalletConnect';

/* ─── Types ───────────────────────────────────────────────────── */

type Step = 'welcome' | 'interests' | 'connect' | 'discover' | 'feed';

interface Interest {
  id: string;
  label: string;
  icon: string;
  emoji: string;
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

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/* ─── Data ────────────────────────────────────────────────────── */

const INTERESTS: Interest[] = [
  { id: 'defi', label: 'DeFi', icon: '🏦', emoji: '🏦', color: '#00ff41' },
  { id: 'nfts', label: 'NFTs & Art', icon: '🎨', emoji: '🎨', color: '#8b5cf6' },
  { id: 'meme-coins', label: 'Meme Coins', icon: '🐸', emoji: '🐸', color: '#f59e0b' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', emoji: '🎮', color: '#f4212e' },
  { id: 'infra', label: 'Infrastructure', icon: '⚙️', emoji: '⚙️', color: '#1185fe' },
  { id: 'social', label: 'Social', icon: '💬', emoji: '💬', color: '#f91880' },
  { id: 'bitcoin', label: 'Bitcoin', icon: '₿', emoji: '₿', color: '#f7931a' },
  { id: 'solana', label: 'Solana', icon: '◎', emoji: '◎', color: '#9945ff' },
  { id: 'ethereum', label: 'Ethereum', icon: '⟠', emoji: '⟠', color: '#627eea' },
  { id: 'creator-economy', label: 'Creator Economy', icon: '👥', emoji: '👥', color: '#00ba7c' },
  { id: 'privacy', label: 'Privacy', icon: '🔐', emoji: '🔐', color: '#6364ff' },
  { id: 'ai-crypto', label: 'AI × Crypto', icon: '🤖', emoji: '🤖', color: '#ff4500' },
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

const WALLETS: WalletOption[] = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', color: '#f6851b' },
  { id: 'rainbow', name: 'Rainbow', icon: '🌈', color: '#0045ff' },
  { id: 'phantom', name: 'Phantom', icon: '👻', color: '#ab9ff2' },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', color: '#3b99fc' },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', color: '#0052ff' },
  { id: 'trust', name: 'Trust Wallet', icon: '🛡️', color: '#3375bb' },
];

/* ─── Confetti component ─────────────────────────────────────── */

function ConfettiBurst() {
  const colors = useMemo(() => ['#00ff41', '#8b5cf6', '#f91880', '#f59e0b', '#1185fe', '#00ba7c', '#ff4500'], []);
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 0.8 + Math.random() * 1.2,
      color: colors[i % colors.length],
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));
  }, [colors, colors.length]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti-fall 1.5s ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-confetti { animation: none !important; display: none; }
        }
      `}</style>
    </div>
  );
}

/* ─── Scanning animation ─────────────────────────────────────── */

function ScanningAnimation() {
  const protocols = [
    { name: 'ENS', icon: '🔍', color: '#627eea' },
    { name: 'Farcaster', icon: '◈', color: '#8a63d2' },
    { name: 'Lens', icon: '◎', color: '#abfe2c' },
    { name: 'Nostr', icon: '⚡', color: '#8b5cf6' },
    { name: 'Bluesky', icon: '☁', color: '#1185fe' },
  ];

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
      <div className="relative p-5">
        {/* Scanning line */}
        <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-degen-500 to-transparent" />
        <style>{`
          .scan-line {
            animation: scan-move 2s ease-in-out infinite;
          }
          @keyframes scan-move {
            0%, 100% { top: 0; opacity: 0.3; }
            50% { top: 100%; opacity: 1; }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 4px rgba(0,255,65,0.2); }
            50% { box-shadow: 0 0 20px rgba(0,255,65,0.5); }
          }
          @media (prefers-reduced-motion: reduce) {
            .scan-line { animation: none !important; display: none; }
          }
        `}</style>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {protocols.map((p, i) => (
            <div
              key={p.name}
              className="flex animate-pulse-scan items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: `${p.color}15`,
                color: p.color,
                animationDelay: `${i * 0.4}s`,
              }}
            >
              <span className="text-sm">{p.icon}</span>
              {p.name}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes pulse-scan {
            0%, 100% { opacity: 0.4; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          .animate-pulse-scan {
            animation: pulse-scan 1.5s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-pulse-scan { animation: none !important; opacity: 1 !important; transform: none !important; }
          }
        `}</style>

        <p className="mt-4 text-center text-[10px] text-[var(--color-muted)]">
          Scanning ENS, Farcaster, Lens, Nostr, Bluesky, and more...
        </p>
      </div>
    </div>
  );
}

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
          className={`h-1.5 flex-1 rounded-full transition-all duration-500 ease-out ${
            i <= step ? 'bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.3)]' : 'bg-[var(--color-border)]'
          }`}
          style={{
            transform: i === step ? 'scaleY(1.4)' : 'scaleY(1)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Step Badge ──────────────────────────────────────────────── */

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

/* ─── AnimatedStep — wraps step content with slide transition ── */

function AnimatedStep({
  direction,
  children,
}: {
  direction: 'forward' | 'backward';
  children: React.ReactNode;
}) {
  const slideClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left';
  return (
    <div key={direction} className={slideClass}>
      {children}
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
  const [discoveryLinked, setDiscoveryLinked] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [showConfetti, setShowConfetti] = useState(false);
  const [scanningComplete, setScanningComplete] = useState(false);
  const { address: walletAddress, connect } = useWalletConnect();

  const stepOrder = useMemo<Step[]>(
    () => ['welcome', 'interests', 'connect', 'discover', 'feed'],
    [],
  );
  const stepIndex = stepOrder.indexOf(step);
  const totalSteps = 5;

  // Trigger confetti when reaching the final step
  useEffect(() => {
    if (step === 'feed') {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Auto-complete scanning animation on discover step
  useEffect(() => {
    if (step === 'discover' && walletAddress) {
      const timer = setTimeout(() => setScanningComplete(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [step, walletAddress]);

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

  const handleDiscoveryComplete = useCallback((count: number) => {
    setDiscoveryLinked(count);
    setStep('feed');
  }, []);

  const goForward = useCallback((next: Step) => {
    setDirection('forward');
    setStep(next);
  }, []);

  const goBack = useCallback(() => {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) {
      setDirection('backward');
      setStep(stepOrder[idx - 1]);
    }
  }, [step, stepOrder]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center px-4 py-10">
      {showConfetti && <ConfettiBurst />}

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

      {/* Skip option always visible */}
      {step !== 'feed' && (
        <div className="mb-4 text-right">
          <Link
            href="/feed"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            I&apos;ll do this later →
          </Link>
        </div>
      )}

      {/* Step content with slide animation */}
      <div className="relative min-h-[300px]">
        {/* ═══ WELCOME ═══ */}
        {step === 'welcome' && (
          <AnimatedStep direction={direction}>
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-degen-500/20 via-emerald-500/10 to-transparent animate-pulse-glow">
                <span className="text-4xl">🚀</span>
              </div>
              <h1
                className="mb-3 text-4xl font-black text-[var(--color-fg)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Welcome to <span className="gradient-text">DegenFeed</span>
              </h1>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
                The Web3 Social Universe. Connect your protocols, discover content across 15+
                networks, and tip creators in crypto — all from one place.
              </p>
              <div className="mb-8 grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: '🔗', label: 'Connect', desc: 'Link protocols' },
                  { icon: '📰', label: 'Unified Feed', desc: 'One timeline' },
                  { icon: '⚡', label: 'Earn & Tip', desc: 'Zero fees' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/30 hover:shadow-[0_0_16px_rgba(0,255,65,0.08)]"
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
                  onClick={() => goForward('interests')}
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
          </AnimatedStep>
        )}

        {/* ═══ INTERESTS ═══ */}
        {step === 'interests' && (
          <AnimatedStep direction={direction}>
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
              <div className="mb-6 flex flex-wrap gap-2.5">
                {INTERESTS.map((interest) => {
                  const selected = selectedInterests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        selected
                          ? 'text-black shadow-lg scale-105'
                          : 'border border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-[var(--color-fg)] hover:scale-102'
                      }`}
                      style={
                        selected
                          ? { background: interest.color, color: '#000', boxShadow: `0 0 20px ${interest.color}40` }
                          : {}
                      }
                      aria-pressed={selected}
                    >
                      <span className="text-lg">{interest.icon}</span>
                      <span>{interest.label}</span>
                      {selected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedInterests.length > 0 && (
                <div
                  className="mb-4 rounded-xl border p-3 text-xs"
                  style={{
                    borderColor: 'var(--color-accent-soft)',
                    backgroundColor: 'var(--color-accent-soft)',
                  }}
                >
                  <span className="font-semibold text-degen-400">
                    {selectedInterests.length} selected
                  </span>
                  <span className="text-[var(--color-muted)]">
                    {' '}— We&apos;ll prioritize {selectedInterests.join(', ')} content in your feed
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => goForward('connect')}
                  className="btn-primary text-sm px-8 py-2.5"
                >
                  {selectedInterests.length > 0
                    ? `Continue (${selectedInterests.length})`
                    : 'Skip →'}
                </button>
              </div>
            </div>
          </AnimatedStep>
        )}

        {/* ═══ CONNECT PROTOCOLS + WALLET ═══ */}
        {step === 'connect' && (
          <AnimatedStep direction={direction}>
            <div>
              <StepBadge num={3} label="Connect & Wallet" />
              <h2
                className="mb-2 text-2xl font-bold text-[var(--color-fg)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Link your protocols
              </h2>
              <p className="mb-6 text-sm text-[var(--color-muted)]">
                Connect your wallet and choose which networks to follow.
              </p>

              {/* Wallet connect section */}
              <div
                className="mb-4 rounded-xl border p-4"
                style={{
                  borderColor: walletAddress ? 'var(--color-accent-soft)' : 'var(--color-glass-border)',
                  backgroundColor: walletAddress ? 'var(--color-accent-soft)' : 'var(--color-card)',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    {walletAddress ? '✓ Wallet Connected' : 'Connect a Wallet'}
                  </span>
                  {walletAddress && (
                    <span className="font-mono text-[11px] text-degen-400">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                  )}
                </div>
                {!walletAddress && (
                  <div className="flex flex-wrap gap-2">
                    {WALLETS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={connect}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-bg-secondary)] px-3.5 py-2 text-xs font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:bg-[var(--color-card-hover)]"
                        aria-label={`Connect with ${w.name}`}
                      >
                        <span className="text-base">{w.icon}</span>
                        <span className="hidden sm:inline">{w.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!walletAddress && (
                  <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                    Your wallet is your identity. No sign-up, no email required.
                  </p>
                )}
              </div>

              {/* Protocol selection */}
              <div className="mb-6 space-y-2">
                {PROTOCOLS.map((p) => {
                  const connected = connectedProtocols.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProtocol(p.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                        connected
                          ? 'border-degen-500/50 bg-degen-500/[0.04] shadow-[0_0_12px_rgba(0,255,65,0.06)]'
                          : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/20 hover:bg-[var(--color-card-hover)]'
                      }`}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all"
                        style={{
                          background: `${p.color}18`,
                          color: p.color,
                          boxShadow: connected ? `0 0 12px ${p.color}30` : 'none',
                        }}
                      >
                        {p.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--color-fg)]">
                            {p.name}
                          </span>
                          {connected && (
                            <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
                              Connected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-muted)]">{p.desc}</p>
                      </div>
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                          connected
                            ? 'border-degen-500 bg-degen-500 scale-110'
                            : 'border-[var(--color-border)]'
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
                            aria-hidden="true"
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
                  onClick={goBack}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => (walletAddress ? goForward('discover') : goForward('feed'))}
                  className="btn-primary text-sm px-8 py-2.5"
                >
                  {walletAddress ? 'Continue to Discovery →' : 'Continue →'}
                </button>
              </div>
            </div>
          </AnimatedStep>
        )}

        {/* ═══ IDENTITY DISCOVERY ═══ */}
        {step === 'discover' && (
          <AnimatedStep direction={direction}>
            <div>
              <StepBadge num={4} label="Auto-Discover Identities" />
              <h2
                className="mb-2 text-2xl font-bold text-[var(--color-fg)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Find your accounts across the web
              </h2>
              <p className="mb-6 text-sm text-[var(--color-muted)]">
                We&apos;ll scan ENS, Farcaster, Lens, Nostr, Bluesky, and more to find all your
                linked identities.
              </p>

              {/* Live scanning animation */}
              {!scanningComplete && walletAddress && <ScanningAnimation />}

              {walletAddress ? (
                <div className={`transition-all duration-500 ${scanningComplete ? 'opacity-100' : 'opacity-60'}`}>
                  <IdentityDiscoveryWizard
                    walletAddress={walletAddress}
                    variant="onboarding"
                    onComplete={handleDiscoveryComplete}
                    onDismiss={() => goForward('feed')}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-6 text-center">
                  <p className="mb-2 text-sm text-amber-400">
                    Connect your wallet first to enable identity discovery
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    You can also do this later from your profile settings.
                  </p>
                  <button
                    type="button"
                    onClick={() => goForward('feed')}
                    className="btn-primary mt-4 inline-block px-6 py-2 text-sm"
                  >
                    Skip for now →
                  </button>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                {scanningComplete && (
                  <button
                    type="button"
                    onClick={() => goForward('feed')}
                    className="btn-primary text-sm px-6 py-2"
                  >
                    Continue →
                  </button>
                )}
              </div>
            </div>
          </AnimatedStep>
        )}

        {/* ═══ DONE ═══ */}
        {step === 'feed' && (
          <AnimatedStep direction={direction}>
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-degen-500/20 via-emerald-500/10 to-transparent shadow-[0_0_40px_rgba(0,255,65,0.2)] animate-celebration-pulse">
                <span className="text-4xl drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]">🎉</span>
              </div>
              <h1
                className="mb-3 text-3xl font-black text-[var(--color-fg)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                You&apos;re all set!
              </h1>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
                {discoveryLinked > 0
                  ? `We found and linked ${discoveryLinked} identities across the decentralized web. Your feed is unified with content from all your networks.`
                  : 'Your feed is personalized and ready. Start exploring content from across the decentralized social universe.'}
              </p>

              {/* Summary cards */}
              <div className="mx-auto mb-8 flex max-w-sm flex-wrap justify-center gap-3">
                {selectedInterests.length > 0 && (
                  <div className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5">
                    <span className="text-xs text-[var(--color-muted)]">
                      {selectedInterests.length} interests
                    </span>
                  </div>
                )}
                {connectedProtocols.length > 0 && (
                  <div className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5">
                    <span className="text-xs text-[var(--color-muted)]">
                      {connectedProtocols.length} protocols
                    </span>
                  </div>
                )}
                {walletAddress && (
                  <div className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5">
                    <span className="text-xs font-mono text-degen-400">
                      Wallet connected
                    </span>
                  </div>
                )}
              </div>

              <Link
                href="/feed"
                className="btn-primary text-base px-10 py-3 gap-2 inline-flex items-center"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Go to My Feed
              </Link>
            </div>
          </AnimatedStep>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,65,0.1); }
          50% { box-shadow: 0 0 40px rgba(0,255,65,0.2); }
        }
        @keyframes celebration-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(0,255,65,0.2); }
          50% { transform: scale(1.05); box-shadow: 0 0 60px rgba(0,255,65,0.3); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .animate-celebration-pulse {
          animation: celebration-pulse 1.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-in-right,
          .animate-slide-in-left,
          .animate-pulse-glow,
          .animate-celebration-pulse {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
