'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function OnboardingModal() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('degenfeed_onboarded')) return;
    setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('degenfeed_onboarded', '1');
    setOpen(false);
  };

  if (!open) return null;

  const steps = [
    {
      icon: '◆',
      title: '8 networks, one window',
      body: 'Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS — all in one unified feed. No account needed to browse.',
    },
    {
      icon: '🔑',
      title: 'Post across all networks',
      body: 'Sign in with your wallet once. Post to Nostr and Bluesky from one composer. Like, reply, and repost everywhere.',
    },
    {
      icon: '🐘',
      title: 'Get @you@degenfeed.xyz',
      body: 'Create your own Mastodon handle on our instance. Email required, admin-approved. Then cross-post to every network.',
      cta: { label: 'Create free account →', href: '/api/auth/gotosocial/register' },
    },
  ];

  const s = steps[step]; if (!s) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-degen-500/20 bg-gray-950 p-6 shadow-2xl shadow-degen-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/icon.svg"
              alt="DegenFeed"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg shadow-[0_0_12px_rgba(0,255,65,0.3)]"
            />
            <span className="text-sm font-semibold text-white">DegenFeed</span>
          </div>
          <button
            onClick={dismiss}
            className="rounded-lg p-1 text-gray-500 hover:text-white transition-colors text-sm"
          >
            Skip
          </button>
        </div>

        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/10 text-3xl">
          {s.icon}
        </div>
        <h2 className="mb-2 text-lg font-bold text-white">{s.title}</h2>
        <p className="mb-5 text-sm leading-relaxed text-gray-400">{s.body}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === step ? 'bg-degen-400' : 'bg-gray-700'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            {s.cta ? (
              <a href={s.cta.href} className="btn-primary text-sm" onClick={dismiss}>
                {s.cta.label}
              </a>
            ) : step < steps.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary text-sm">
                Next
              </button>
            ) : (
              <button onClick={dismiss} className="btn-primary text-sm">
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
