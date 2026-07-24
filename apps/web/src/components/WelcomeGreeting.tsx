'use client';

/**
 * WelcomeGreeting — Neon greeting shown on the landing page.
 * Uses the new cyberpunk design language with gradient text and glow effects.
 */

import { useMemo } from 'react';

export interface WelcomeGreetingProps {
  displayName?: string;
  connectedProtocols?: number;
  totalProtocols?: number;
}

function getTimeBasedGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: 'gm', emoji: '🌅' };
  if (hour < 17) return { greeting: 'gm', emoji: '☀️' };
  if (hour < 21) return { greeting: 'gm', emoji: '🌙' };
  return { greeting: 'gm', emoji: '🌃' };
}

function getTimeBasedSubtitle(connectedCount: number, totalCount: number): string {
  if (connectedCount === 0)
    return 'Your decentralized social home. Connect a protocol to get started.';
  if (connectedCount === totalCount) return 'All protocols connected! Your unified feed is live.';
  if (connectedCount > 2)
    return `You're connected to ${connectedCount} protocols. Your world is growing.`;
  return `You're connected to ${connectedCount} protocol${connectedCount !== 1 ? 's' : ''}. Add more to see everything in one place.`;
}

export function WelcomeGreeting({
  displayName,
  connectedProtocols = 0,
  totalProtocols = 7,
}: WelcomeGreetingProps) {
  const { greeting, emoji } = useMemo(getTimeBasedGreeting, []);

  return (
    <div className="flex items-center gap-3 mb-2">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
        style={{
          background: 'var(--color-accent-soft)',
          boxShadow: '0 0 20px var(--color-accent-glow)',
        }}
        role="img"
        aria-label="Time of day"
      >
        {emoji}
      </span>
      <div>
        <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)' }}>
          {greeting}
          {displayName ? `, ${displayName}` : ''}
          <span className="gradient-text">.</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
          {getTimeBasedSubtitle(connectedProtocols, totalProtocols)}
        </p>
      </div>
    </div>
  );
}
