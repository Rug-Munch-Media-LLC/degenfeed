'use client';

/**
 * WelcomeGreeting — Time-based welcome message shown on the landing page.
 *
 * "Good morning 🌅", "Good afternoon ☀️", "Good evening 🌙"
 * with a dynamic subtitle based on time of day and protocol connections.
 */

import { useMemo } from 'react';

export interface WelcomeGreetingProps {
  displayName?: string;
  connectedProtocols?: number;
  totalProtocols?: number;
}

function getTimeBasedGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: 'Good morning', emoji: '\uD83C\uDF05' }; // 🌅
  if (hour < 17) return { greeting: 'Good afternoon', emoji: '\u2600\uFE0F' }; // ☀️
  if (hour < 21) return { greeting: 'Good evening', emoji: '\uD83C\uDF19' }; // 🌙
  return { greeting: 'Good night', emoji: '\uD83C\uDF03' }; // 🌃
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
    <div className="welcome-greeting">
      <div className="flex items-center gap-3 mb-2">
        <span className="welcome-greeting-emoji" role="img" aria-label="Time of day">
          {emoji}
        </span>
        <div>
          <h1 className="welcome-greeting-text">
            {greeting}
            {displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="welcome-greeting-sub">
            {getTimeBasedSubtitle(connectedProtocols, totalProtocols)}
          </p>
        </div>
      </div>
    </div>
  );
}
