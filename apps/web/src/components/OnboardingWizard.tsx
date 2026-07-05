"use client";

import { useState, type ReactNode } from "react";

interface Step {
  title: string;
  description: string;
  icon: string;
  action: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "See every network",
    description: "Nostr, Farcaster, Lens, Bluesky, Threads, Mastodon, Reddit, RSS \u2014 all in one feed. Zero accounts needed to read.",
    icon: "\u25C6",
    action: "Scroll the feed below \u2193",
  },
  {
    title: "Sign in to engage",
    description: "Connect any protocol you already use. Like, reply, and repost natively. Your keys stay encrypted in your browser.",
    icon: "\uD83D\uDD11",
    action: "Click Sign In in the header",
  },
  {
    title: "Get a free @degenfeed.xyz account",
    description: "No keys yet? Create a Mastodon account on our server in 30 seconds. Username + password, that is it.",
    icon: "\u2728",
    action: (
      <a href="/api/auth/gotosocial/register" className="btn-primary mt-2 inline-block text-sm">
        Create free account \u2192
      </a>
    ),
  },
];

export function OnboardingWizard({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]; if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <div className="mb-6 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div key={i} className={"h-1.5 w-8 rounded-full transition-colors " + (i <= step ? "bg-degen-500" : "bg-gray-800")} />
          ))}
        </div>

        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">{current.icon}</div>
          <h2 className="mb-2 text-xl font-bold text-white">{current.title}</h2>
          <p className="text-sm text-gray-400">{current.description}</p>
          <div className="mt-4">{current.action}</div>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" className="text-sm text-gray-600 hover:text-white transition-colors" onClick={onDismiss}>Skip</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary text-sm" onClick={() => setStep(step + 1)}>Next \u2192</button>
          ) : (
            <button type="button" className="btn-primary text-sm" onClick={onDismiss}>Start browsing \u2192</button>
          )}
        </div>
      </div>
    </div>
  );
}
