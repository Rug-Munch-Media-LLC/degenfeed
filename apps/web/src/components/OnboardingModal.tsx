'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnboarding } from '../hooks/useOnboarding';
import { resetTour } from './GuidedTour';
import { useToast } from './Toast';

/* == Types ================================================= */

interface Protocol {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
}

interface Suggestion {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  protocol: string;
}

/* == Constants ============================================= */

const PROTOCOLS: Protocol[] = [
  {
    id: 'nostr',
    label: 'Nostr',
    color: '#8e30eb',
    icon: '⚡',
    description: 'Decentralized relays. 5M+ events.',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    color: '#8a63d2',
    icon: '◈',
    description: 'On-chain social. 800K+ users.',
  },
  {
    id: 'lens',
    label: 'Lens',
    color: '#abfe2c',
    icon: '◎',
    description: 'Polygon native. 500K+ profiles.',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    color: '#1185fe',
    icon: '☁',
    description: 'AT Protocol. 30M+ users.',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    color: '#6364ff',
    icon: '🐘',
    description: 'ActivityPub. 15M+ accounts.',
  },
  {
    id: 'threads',
    label: 'Threads',
    color: '#101010',
    icon: '⊞',
    description: "Meta's microblog · via ActivityPub federation",
  },
  {
    id: 'reddit',
    label: 'Reddit',
    color: '#ff4500',
    icon: '🔴',
    description: 'Crypto subs. 8M+ daily posts.',
  },
  {
    id: 'rss',
    label: 'RSS / News',
    color: '#ffa500',
    icon: '📰',
    description: '353+ feeds. 11 categories.',
  },
];

const INTERESTS = [
  { id: 'crypto', label: 'Crypto', emoji: '₿' },
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'nft', label: 'NFT', emoji: '🎨' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'security', label: 'Security', emoji: '🛡' },
  { id: 'trading', label: 'Trading', emoji: '📊' },
  { id: 'memecoins', label: 'Memecoins', emoji: '🐸' },
  { id: 'daos', label: 'DAOs', emoji: '🏛' },
  { id: 'macro', label: 'Macro', emoji: '🌍' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
];

/* == Step components ======================================= */

function StepDots({ current, total }: { current: number; total: number }) {
  const percent = Math.round(((current + 1) / total) * 100);
  return (
    <div className="flex flex-col items-end gap-1">
      {/* Labeled progress */}
      <span className="font-mono text-[10px] font-medium tracking-wider text-degen-400/80">
        Step {current + 1} of {total} — {percent}%
      </span>
      {/* Progress bar */}
      <div
        className="h-1 w-24 overflow-hidden rounded-full bg-white/5"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current + 1} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* == Main component ======================================== */

export function OnboardingModal() {
  const { show, close, complete } = useOnboarding();
  const [step, setStep] = useState(0);
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [followedAccounts, setFollowedAccounts] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const totalSteps = 6;

  // Reset state when modal opens
  useEffect(() => {
    if (show) {
      setStep(0);
      setSelectedProtocols([]);
      setSelectedInterests([]);
      setFollowedAccounts(new Set());
      setSuggestions([]);
      setDirection('forward');
    }
  }, [show]);

  // Fetch suggestions when entering step 4 (follow step)
  useEffect(() => {
    if (step === 3 && suggestions.length === 0 && !loadingSuggestions) {
      const protoParam =
        selectedProtocols.length > 0 ? selectedProtocols.join(',') : 'nostr,farcaster,lens,bluesky';
      setLoadingSuggestions(true);
      fetch(`/api/onboarding/suggestions?protocols=${encodeURIComponent(protoParam)}`)
        .then((r) => r.json())
        .then((data) => {
          setSuggestions(data.suggestions ?? []);
        })
        .catch(() => {
          // Fallback: show a few hardcoded
          setSuggestions([
            {
              id: 'fallback_1',
              name: 'DegenFeed',
              handle: 'degenfeed',
              avatar: '/icon.svg',
              bio: 'The social feed of web3.',
              protocol: 'nostr',
            },
            {
              id: 'fallback_2',
              name: 'Kieran',
              handle: 'kieran',
              avatar: '/icon.svg',
              bio: 'Building DegenFeed.',
              protocol: 'farcaster',
            },
            {
              id: 'fallback_3',
              name: 'ChainLinkGod',
              handle: 'chainlinkgod',
              avatar: '/icon.svg',
              bio: 'Smart contract dev.',
              protocol: 'lens',
            },
            {
              id: 'fallback_4',
              name: 'Bankless',
              handle: 'bankless',
              avatar: '/icon.svg',
              bio: 'Go bankless with crypto.',
              protocol: 'bluesky',
            },
            {
              id: 'fallback_5',
              name: 'CryptoFM',
              handle: 'cryptofm',
              avatar: '/icon.svg',
              bio: 'Crypto news podcast.',
              protocol: 'mastodon',
            },
          ]);
        })
        .finally(() => setLoadingSuggestions(false));
    }
  }, [step, selectedProtocols, suggestions.length, loadingSuggestions]);

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > step ? 'forward' : 'backward');
      setStep(next);
      // Focus the panel for accessibility
      panelRef.current?.focus();
    },
    [step],
  );

  const toggleProtocol = useCallback((id: string) => {
    setSelectedProtocols((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const toggleFollow = useCallback((id: string) => {
    setFollowedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getSummary = useMemo(() => {
    const protocolLabels = selectedProtocols
      .map((id) => PROTOCOLS.find((p) => p.id === id)?.label)
      .filter(Boolean);
    const interestLabels = selectedInterests
      .map((i) => INTERESTS.find((t) => t.id === i)?.label)
      .filter(Boolean);
    const followedCount = followedAccounts.size;
    return { protocolLabels, interestLabels, followedCount };
  }, [selectedProtocols, selectedInterests, followedAccounts]);

  const router = useRouter();

  const handleComplete = useCallback(() => {
    // Save user's interest preferences
    if (selectedInterests.length > 0) {
      try {
        localStorage.setItem('degenfeed_interests', JSON.stringify(selectedInterests));
      } catch {
        /* ignore */
      }
    }
    if (selectedProtocols.length > 0) {
      try {
        localStorage.setItem('degenfeed_protocols', JSON.stringify(selectedProtocols));
      } catch {
        /* ignore */
      }
    }
    complete();
    // Reset guided tour so it triggers after onboarding
    resetTour();
    showToast('success', 'Welcome to DegenFeed! Your feed is ready. Look for the guided tour.');
    router.push('/feed');
  }, [selectedInterests, selectedProtocols, complete, showToast, router]);

  const handleBack = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  if (!show) return null;

  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const canProceed = true; // All steps can proceed

  const stepData = [
    {
      title: 'Welcome to DegenFeed',
      subtitle: 'The web3 social super app',
      illustration: '◆',
    },
    {
      title: 'Choose your networks',
      subtitle: 'Select the protocols you want to see in your feed',
      illustration: '◈',
    },
    {
      title: 'What are you into?',
      subtitle: 'Pick topics to personalize your feed',
      illustration: '◎',
    },
    {
      title: 'Follow popular accounts',
      subtitle: 'Get started with these suggested follows',
      illustration: '⊞',
    },
    {
      title: 'Create your accounts',
      subtitle: 'Get portable credentials for every platform',
      illustration: '🔑',
    },
    {
      title: "You're all set!",
      subtitle: "Here's what you selected",
      illustration: '✦',
    },
  ];

  const current = stepData[step];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-md p-4"
      onClick={(e) => {
        // Only close if clicking the backdrop
        if (e.target === e.currentTarget && step > 0) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && step > 0) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={current?.title ?? 'Onboarding'}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-xl outline-none"
        style={{ animation: 'onboarding-enter 0.35s ease-out' }}
      >
        {/* Glass panel */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0a0a0a]/95 shadow-2xl shadow-degen-500/5 backdrop-blur-2xl">
          {/* Subtle gradient edge */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-degen-500/[0.03] to-transparent" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-sm text-degen-400 shadow-[0_0_12px_rgba(29,155,240,0.15)]">
                ◆
              </div>
              <span className="text-sm font-semibold tracking-tight text-white/80">DegenFeed</span>
            </div>
            <div className="flex items-center gap-3">
              <StepDots current={step} total={totalSteps} />
              <button
                onClick={close}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                type="button"
                aria-label="Skip for now"
              >
                {step === 0 ? 'Browse anonymously' : 'Skip for now'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px bg-gradient-to-r from-degen-500/10 via-white/[0.04] to-transparent" />

          {/* Step content */}
          <div className="relative px-6 py-8 sm:px-8 sm:py-10">
            {/* Animated step transition wrapper */}
            <div
              style={{
                animation: `onboarding-slide-${direction === 'forward' ? 'in' : 'out'} 0.3s ease-out`,
              }}
            >
              {/* == Step 0: Welcome == */}
              {step === 0 && (
                <div className="text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 via-degen-500/10 to-transparent text-4xl shadow-[0_0_30px_rgba(29,155,240,0.15)]">
                    <span className="drop-shadow-[0_0_8px_rgba(29,155,240,0.5)]">◆</span>
                  </div>
                  <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                    Welcome to DegenFeed
                  </h2>
                  <p className="mb-2 text-sm text-degen-400/90 font-medium tracking-wide">
                    The web3 social super app
                  </p>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-white/50">
                    Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS — all in one
                    unified feed. No account needed to browse.
                  </p>
                  <div className="mx-auto mt-8 flex flex-wrap justify-center gap-2">
                    {PROTOCOLS.slice(0, 8).map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${p.color}18`, color: p.color }}
                      >
                        {p.icon} {p.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-6 text-xs text-white/30">
                    Cross-protocol bridging. One window. Zero sign-ups to read.
                  </p>
                </div>
              )}

              {/* == Step 1: Protocol picker == */}
              {step === 1 && (
                <div>
                  <div className="mb-6 text-center">
                    <h2 className="mb-1 text-xl font-bold text-white">Choose your networks</h2>
                    <p className="text-sm text-white/50">
                      Select protocols to include in your unified feed
                    </p>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {PROTOCOLS.map((p) => {
                      const selected = selectedProtocols.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                            selected
                              ? 'border-degen-500/40 bg-degen-500/[0.06] shadow-[0_0_20px_rgba(29,155,240,0.06)]'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleProtocol(p.id)}
                            className="peer sr-only"
                          />
                          {/* Selection indicator — more visual */}
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-all ${
                              selected
                                ? 'shadow-[0_0_12px_rgba(29,155,240,0.15)]'
                                : 'border border-white/[0.06]'
                            }`}
                            style={{
                              backgroundColor: selected ? `${p.color}22` : 'rgba(255,255,255,0.02)',
                              color: p.color,
                            }}
                          >
                            {p.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold transition-colors ${
                                  selected
                                    ? 'text-white'
                                    : 'text-white/70 group-hover:text-white/90'
                                }`}
                              >
                                {p.label}
                              </span>
                              {selected && (
                                <span className="rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[9px] font-medium text-degen-400">
                                  Added
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-white/40">{p.description}</p>
                            {/* Show protocol-specific hint */}
                            <p className="mt-1 text-[10px] text-white/20">
                              {p.id === 'nostr' && 'Relay-based · 5M+ events'}
                              {p.id === 'farcaster' && 'On-chain hubs · 800K+ users'}
                              {p.id === 'lens' && 'Polygon native · 500K+ profiles'}
                              {p.id === 'bluesky' && 'AT Protocol · 30M+ users'}
                              {p.id === 'mastodon' && 'ActivityPub · 15M+ accounts'}
                              {p.id === 'threads' && "Meta's microblog · Millions daily"}
                              {p.id === 'reddit' && 'Crypto subreddits · 8M+ daily'}
                              {p.id === 'rss' && '353+ feeds · 11 categories'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Live preview: what they'll see */}
                  {selectedProtocols.length > 0 && (
                    <div className="mt-4 rounded-xl border border-degen-500/15 bg-degen-500/[0.03] px-4 py-3">
                      <p className="mb-1.5 text-xs font-medium text-degen-400/80">
                        You&apos;ll see content from:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProtocols.map((id) => {
                          const p = PROTOCOLS.find((pr) => pr.id === id);
                          return p ? (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: `${p.color}18`, color: p.color }}
                            >
                              {p.icon} {p.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-center text-xs text-white/30">
                    You can change this later in Profile &gt; Settings.
                  </p>
                </div>
              )}

              {/* == Step 2: Interest picker == */}
              {step === 2 && (
                <div>
                  <div className="mb-6 text-center">
                    <h2 className="mb-1 text-xl font-bold text-white">What are you into?</h2>
                    <p className="text-sm text-white/50">
                      Pick topics to personalize your DegenFeed experience
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {INTERESTS.map((topic) => {
                      const selected = selectedInterests.includes(topic.id);
                      return (
                        <label
                          key={topic.id}
                          className={`group inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                            selected
                              ? 'bg-degen-500/15 text-degen-400 shadow-[0_0_12px_rgba(29,155,240,0.1)] ring-1 ring-degen-500/30'
                              : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70 ring-1 ring-white/[0.06]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleInterest(topic.id)}
                            className="peer sr-only"
                          />
                          <span className="text-base">{topic.emoji}</span>
                          <span>{topic.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-6 text-center text-xs text-white/30">
                    These power your For You algorithm. Pick as many as you like.
                  </p>
                </div>
              )}

              {/* == Step 3: Follow suggestions == */}
              {step === 3 && (
                <div>
                  <div className="mb-6 text-center">
                    <h2 className="mb-1 text-xl font-bold text-white">Follow popular accounts</h2>
                    <p className="text-sm text-white/50">
                      Jump-start your feed with these suggested follows
                    </p>
                  </div>
                  {loadingSuggestions ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
                      <p className="text-xs text-white/40">Finding suggestions…</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {suggestions.map((s) => {
                        const following = followedAccounts.has(s.id);
                        const pColor = PROTOCOLS.find((p) => p.id === s.protocol)?.color ?? '#666';
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all hover:border-white/[0.1]"
                          >
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                              style={{ backgroundColor: `${pColor}22`, color: pColor }}
                            >
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white truncate">
                                  {s.name}
                                </span>
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{ backgroundColor: `${pColor}18`, color: pColor }}
                                >
                                  {s.protocol}
                                </span>
                              </div>
                              <p className="truncate text-xs text-white/40">{s.bio}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleFollow(s.id)}
                              type="button"
                              className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                                following
                                  ? 'bg-white/[0.06] text-white/60 hover:bg-red-500/10 hover:text-red-400'
                                  : 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(29,155,240,0.25)]'
                              }`}
                            >
                              {following ? 'Following' : 'Follow'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-4 text-center text-xs text-white/30">
                    You can always follow more accounts from your feed.
                  </p>
                </div>
              )}

              {/* == Step 4: Connect your protocols == */}
              {step === 4 && (
                <div>
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 via-degen-500/10 to-transparent text-3xl shadow-[0_0_20px_rgba(29,155,240,0.12)]">
                      🔗
                    </div>
                    <h2 className="mb-1 text-xl font-bold text-white">Connect your protocols</h2>
                    <p className="mx-auto max-w-md text-sm text-white/50">
                      Link your accounts so you can post and engage across all networks
                    </p>
                  </div>

                  {/* Connection sub-steps with progress */}
                  <div className="space-y-4">
                    {/* Mastodon */}
                    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all">
                      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm font-medium text-white/70 hover:text-white transition-colors">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base bg-[#6364ff]/20 text-[#6364ff]">
                          🐘
                        </span>
                        <span className="flex-1">Connect Mastodon</span>
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                          optional
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className="transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </summary>
                      <div className="border-t border-white/[0.04] px-4 py-4">
                        <p className="text-xs text-white/50 mb-3">
                          Enter your Mastodon instance URL to connect your account.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="https://mastodon.social"
                            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#6364ff]/50"
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded-lg bg-[#6364ff] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[#6364ff]/80"
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    </details>

                    {/* Bluesky */}
                    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all">
                      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm font-medium text-white/70 hover:text-white transition-colors">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base bg-[#1185fe]/20 text-[#1185fe]">
                          🦋
                        </span>
                        <span className="flex-1">Connect Bluesky</span>
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                          optional
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className="transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </summary>
                      <div className="border-t border-white/[0.04] px-4 py-4 space-y-3">
                        <p className="text-xs text-white/50">
                          Enter your Bluesky handle and an App Password (Settings → App Passwords).
                        </p>
                        <input
                          type="text"
                          placeholder="yourhandle.bsky.social"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#1185fe]/50"
                        />
                        <input
                          type="password"
                          placeholder="App password (generate in Bluesky settings)"
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#1185fe]/50"
                        />
                        <button
                          type="button"
                          className="w-full rounded-lg bg-[#1185fe] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[#1185fe]/80"
                        >
                          Connect
                        </button>
                      </div>
                    </details>

                    {/* Nostr */}
                    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all">
                      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm font-medium text-white/70 hover:text-white transition-colors">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base bg-[#8e30eb]/20 text-[#8e30eb]">
                          ⚡
                        </span>
                        <span className="flex-1">Create Nostr Keys</span>
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
                          optional
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className="transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </summary>
                      <div className="border-t border-white/[0.04] px-4 py-4 space-y-3">
                        <p className="text-xs text-white/50">
                          Generate a Nostr key pair. Your keys never leave this device.
                        </p>
                        <div className="rounded-lg bg-white/[0.03] px-3 py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                                Public Key
                              </p>
                              <p className="mt-0.5 text-xs font-mono text-degen-400 break-all">
                                npub1...
                              </p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-2 text-[10px] font-medium text-white/60 hover:text-white transition-colors"
                            >
                              Generate
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-white/30">
                          ⚠️ Save your private key securely. It cannot be recovered.
                        </p>
                      </div>
                    </details>

                    {/* Visual progress indicator */}
                    <div className="mt-4 rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                          Connection Progress
                        </span>
                        <span className="text-[10px] font-mono text-white/30">0 / 3</span>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="h-1 flex-1 rounded-full bg-white/[0.06]" />
                        <div className="h-1 flex-1 rounded-full bg-white/[0.06]" />
                        <div className="h-1 flex-1 rounded-full bg-white/[0.06]" />
                      </div>
                      <p className="mt-2 text-[10px] text-white/30 text-center">
                        Connect any protocol now or do it later from Settings
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* == Step 5: Done == */}
              {step === 5 && (
                <div className="text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 via-degen-500/10 to-transparent shadow-[0_0_40px_rgba(29,155,240,0.15)]">
                    <span className="text-3xl drop-shadow-[0_0_12px_rgba(29,155,240,0.4)]">✦</span>
                  </div>
                  <h2 className="mb-2 text-2xl font-bold text-white">You&apos;re all set!</h2>
                  <p className="mb-6 text-sm text-white/50">
                    Your DegenFeed is personalized and ready to go.
                  </p>

                  <div className="mx-auto max-w-sm space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                    {getSummary.protocolLabels.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40">Networks</span>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {getSummary.protocolLabels.map((label) => {
                            const p = PROTOCOLS.find((pl) => pl.label === label);
                            return (
                              <span
                                key={label}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${p?.color ?? '#666'}18`,
                                  color: p?.color ?? '#666',
                                }}
                              >
                                {p?.icon} {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {getSummary.interestLabels.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40">Interests</span>
                        <div className="flex flex-wrap justify-end gap-1">
                          {getSummary.interestLabels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-degen-500/10 px-2 py-0.5 text-[10px] font-medium text-degen-400"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">Following</span>
                      <span className="text-xs font-medium text-white/70">
                        {getSummary.followedCount} account
                        {getSummary.followedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Security note */}
                  <div className="mx-auto mt-4 max-w-sm rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm" aria-hidden="true">
                        🔒
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white/80">
                          Your credentials are encrypted and stored securely.
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/40 leading-relaxed">
                          We never share them with third parties. You can revoke access at any time.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Guided tour hint */}
                  <div className="mx-auto mt-3 max-w-sm rounded-xl border border-degen-500/15 bg-degen-500/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-degen-400">◆</span>
                      <p className="text-xs text-degen-400/80 font-medium">
                        Look for the guided tour on the next page!
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-white/30 text-left">
                      We&apos;ll walk you through the feed, filters, posting, and tips.
                    </p>
                  </div>

                  <p className="mt-4 text-xs text-white/30">
                    You can customize everything later from Profile &gt; Settings.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="relative border-t border-white/[0.04] px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  isFirst ? 'invisible' : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                }`}
                disabled={isFirst}
              >
                ← Back
              </button>

              <div className="flex items-center gap-3">
                {isLast ? (
                  <button
                    onClick={handleComplete}
                    type="button"
                    className="btn-primary text-sm px-6 py-2.5"
                  >
                    Go to Feed →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo(step + 1)}
                    type="button"
                    disabled={!canProceed}
                    className="btn-primary text-sm px-5 py-2.5"
                  >
                    {step === 0 ? 'Get Started' : 'Continue'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animation keyframes injected once */}
      <style>{`
        @keyframes onboarding-enter {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes onboarding-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onboarding-slide-out {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
