'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { detectTokens } from '@degenfeed/utils';
import { memo, useState } from 'react';
import { TokenChart } from '../TokenChart';

export interface PostBodyProps {
  post: UnifiedPost;
  expanded?: boolean;
  showFullText: boolean;
  needsTruncation: boolean;
  displayText: string;
  onShowFullText: () => void;
  onPaywall?: (post: UnifiedPost) => void;
}

/** Estimate reading time in minutes from text length */
function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

/** Random Web3 quote for "while you wait" easter egg (TASK 6) */
function _Web3Quote() {
  const quotes = [
    { text: "Don't trust, verify.", cite: 'Bitcoin Maximalist' },
    { text: 'Code is law.', cite: 'Lawrence Lessig' },
    { text: 'Be your own bank.', cite: 'Bitcoin Meme' },
    { text: 'We need to fundamentally change the way the internet works.', cite: 'Juan Benet' },
    {
      text: "The internet of money shouldn't be slower than the internet of information.",
      cite: 'Vitalik Buterin',
    },
    { text: 'In cyberspace, everyone is a pseudonym.', cite: 'Wei Dai' },
    { text: 'Privacy is not secrecy.', cite: 'Zooko Wilcox' },
    { text: "Satoshi's vision was peer-to-peer electronic cash.", cite: 'Hal Finney' },
    { text: 'The cypherpunks are writing code.', cite: 'Eric Hughes' },
    {
      text: "Decentralization is not an end state, it's a continuous process.",
      cite: 'Balaji Srinivasan',
    },
    { text: 'Web3 is the internet owned by the builders and users.', cite: 'Packy McCormick' },
    { text: "Nostr doesn't require any infrastructure — it just needs relays.", cite: 'fiatjaf' },
    { text: 'Farcaster is a sufficiently decentralized social network.', cite: 'Dan Romero' },
    { text: 'The AT Protocol is a protocol for decentralized social media.', cite: 'Bluesky Team' },
    { text: 'Lens Protocol is a user-owned, open social graph.', cite: 'Stani Kulechov' },
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)] ?? {
    text: 'The future is decentralized.',
    cite: 'Unknown',
  };
  return (
    <div className="web3-quote mt-4">
      <blockquote>&ldquo;{quote.text}&rdquo;</blockquote>
      <cite>&mdash; {quote.cite}</cite>
    </div>
  );
}

export const PostBody = memo(function PostBody({
  post,
  showFullText,
  needsTruncation,
  displayText,
  onShowFullText,
  onPaywall,
}: PostBodyProps) {
  // TASK 2: Mastodon CW/spoiler text reveal
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const cwText = post.protocol === 'mastodon' ? (post.raw as { cw?: string })?.cw : undefined;

  // Protocol-aware body class
  const protocolBodyClass =
    post.protocol === 'nostr'
      ? 'bg-[var(--color-bg-protocol-nostr)] rounded-lg px-3 py-2 -mx-1'
      : post.protocol === 'farcaster'
        ? 'border-l-2 border-[#8a63d2] pl-3'
        : post.protocol === 'bluesky'
          ? 'text-[var(--color-fg)]'
          : post.protocol === 'lens'
            ? 'border-l-2 border-[#abfe2c] border-opacity-30 pl-3'
            : '';

  return (
    <>
      {/* Paywall */}
      {post.paywall && (
        <div className="mb-3 rounded-xl border border-purple-900/30 bg-purple-900/10 p-4 text-center">
          <div className="mb-2 text-2xl">🔒</div>
          <p className="mb-3 text-sm text-[var(--color-muted)]">This post is locked.</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPaywall?.(post);
            }}
            className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-[var(--color-fg)] hover:bg-purple-500 transition-colors"
          >
            Unlock for {post.paywall.amount} SOL
          </button>
        </div>
      )}

      {/* TASK 2: Mastodon CW/spoiler text handling */}
      {cwText && !spoilerRevealed && (
        <div className="spoiler-warning mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <p className="mb-2 text-xs font-medium text-yellow-400">⚠️ Content warning: {cwText}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSpoilerRevealed(true);
            }}
            className="rounded-md border border-yellow-500/30 px-3 py-1 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 transition-colors"
          >
            Click to reveal
          </button>
        </div>
      )}
      {(cwText && spoilerRevealed) || !cwText ? (
        <div
          className={`content-text mb-3 text-[15px] leading-[1.5] text-[var(--color-fg)] whitespace-pre-wrap break-words ${protocolBodyClass}`}
        >
          {displayText}
          {needsTruncation && !showFullText && (
            <button
              type="button"
              className="ml-1 text-degen-500 hover:text-degen-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onShowFullText();
              }}
              aria-label="Show more"
            >
              Show more
            </button>
          )}
        </div>
      ) : null}

      {/* TASK 2: RSS reading time */}
      {post.protocol === 'rss' && post.text && (
        <div className="mb-3 flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 4.5V8l2.5 1.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span>{estimateReadingTime(post.text)} min read</span>
        </div>
      )}

      {/* Inline token charts */}
      {post.text &&
        detectTokens(post.text).map((token, i) => (
          <TokenChart key={token.address ?? token.symbol ?? `token-${i}`} {...token} compact />
        ))}
    </>
  );
});
