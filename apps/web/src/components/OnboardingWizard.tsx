'use client';

import { type ReactNode, useState } from 'react';

interface Step {
  title: string;
  description: string;
  icon: string;
  action: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'See every network',
    description:
      'Nostr, Farcaster, Lens, Bluesky, Threads, Mastodon, Reddit, RSS — all in one feed. Zero accounts needed to read.',
    icon: '◆',
    action: 'Scroll the feed below ↓',
  },
  {
    title: 'Sign in to engage',
    description:
      'Connect any protocol you already use. Like, reply, and repost natively. Your keys stay encrypted in your browser.',
    icon: '🔑',
    action: 'Click Sign In in the header',
  },
  {
    title: 'Get a free @degenfeed.xyz account',
    description:
      'No keys yet? Create a Mastodon account on our server in 30 seconds. Username + password, that is it.',
    icon: '✨',
    action: (
      <a href="/api/auth/gotosocial/register" className="btn-primary mt-2 inline-block text-sm">
        Create free account →
      </a>
    ),
  },
];

export function OnboardingWizard({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <div className="mb-6 flex justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? 'bg-degen-500' : 'bg-gray-800'}`}
            />
          ))}
        </div>

        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">{current.icon}</div>
          <h2 className="mb-2 text-xl font-bold text-white">{current.title}</h2>
          <p className="text-sm text-gray-400">{current.description}</p>
          <div className="mt-4">{current.action}</div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-white transition-colors disabled:opacity-0"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button type="button" className="btn-primary text-sm" onClick={onDismiss}>
              Get started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
