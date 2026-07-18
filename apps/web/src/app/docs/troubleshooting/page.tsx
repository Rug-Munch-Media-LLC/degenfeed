'use client';

import Link from 'next/link';
import { useState } from 'react';

const issues = [
  {
    title: 'My feed is empty',
    summary: 'Nothing shows up in the feed — blank, loading, or "no posts" message.',
    steps: [
      'Check your protocol connections: Settings → Connected Accounts. Make sure at least one protocol is connected.',
      'Try switching to a different sort mode. Click "Hot" or "New" instead of "Scored" — some sort modes may return fewer results with limited connections.',
      'Visit /status to check if any protocols are experiencing outages or degraded performance.',
      "If you're using filters, clear them. URL params like ?category=xyz or ?protocols=nostr may narrow results too much.",
      'Try the All Protocols feed at /home/all to see if any content loads.',
      'If nothing loads at all, check your internet connection and try refreshing. DegenFeed requires WebSocket access for real-time updates.',
    ],
  },
  {
    title: "Posts aren't publishing",
    summary: 'You hit Post but nothing appears on your connected protocols.',
    steps: [
      "Verify your wallet is connected and the connection hasn't expired. Reconnect if needed.",
      'Check that each target protocol\'s authentication is current. Go to Settings → Connected Accounts and look for any "Reconnect" warnings.',
      'Protocol-specific issues: Nostr requires a relay connection, Farcaster requires Hub access, Lens requires Polygon RPC, Bluesky requires a valid session.',
      "Your post may exceed a protocol's character limit. Nostr supports ~64KB, but some relays cap at 500 chars. Bluesky has 300 char limit.",
      'Check your browser console (F12) for CORS or signing errors.',
      "If you're using a browser extension ad blocker, try disabling it for degenfeed.xyz — some block WebSocket connections.",
      'For urgent issues, email admin@rugmunch.io with the protocol and approximate time.',
    ],
  },
  {
    title: "Tips aren't going through",
    summary: "Tip transaction fails, never confirms, or the creator doesn't receive it.",
    steps: [
      'Check your wallet balance. You need enough native token (ETH, SOL) for both the tip amount AND gas fees.',
      'For Ethereum tips: ensure you have enough ETH for gas. Gas prices fluctuate — try again when gas is lower.',
      'For Solana tips: check your SOL balance for rent+gas. Minimum ~0.005 SOL should cover most tips.',
      "For USDC tips: ensure you've approved the token spend (first-time users need to approve the contract).",
      'Nostr Lightning zaps require a connected Lightning wallet. Check your wallet has inbound capacity.',
      "The creator must have a connected wallet to receive tips. If their wallet address isn't set, the tip button will show as unavailable.",
      "If the transaction succeeds but the creator hasn't received it, check the transaction on a block explorer (Etherscan, Solscan). The tip goes directly on-chain — DegenFeed never intermediates.",
    ],
  },
  {
    title: 'Protocol shows as degraded',
    summary: 'A protocol icon shows yellow/orange and posts from that network are stale.',
    steps: [
      'Visit /status for real-time protocol health. Degraded means the provider is responding but with higher latency or partial data.',
      'Most protocols recover automatically within 5-15 minutes. No action needed on your part.',
      'Degraded status can mean: high latency (>2s response), partial data (some endpoints fail), or rate limiting (too many requests).',
      'If a protocol stays degraded for more than an hour, check /status for an incident notice.',
      'You can still browse cached content from degraded protocols — only real-time updates are affected.',
      'To report persistent degradation, email admin@rugmunch.io with the protocol name and time window.',
    ],
  },
  {
    title: "I can't link my account",
    summary: "Protocol authorization fails, redirect loops, or the connection doesn't save.",
    steps: [
      'Nostr: Make sure your browser extension (Alby, nos2x) is unlocked. Try re-installing the extension. If using nsec/npub, verify the key format (nsec1... or npub1...).',
      "Farcaster: Ensure you're signing with the wallet that owns your Farcaster ID. The signer must match the registered Farcaster custody address.",
      'Lens: Verify your Lens profile exists on Polygon. New profiles may take a few minutes to index. Use the Lens API checker at api-v2.lens.dev.',
      "Bluesky: Create an app password in Bluesky Settings → App Passwords. Your main password won't work with third-party apps.",
      'Mastodon: Ensure your instance allows API access. Small or restricted instances may block OAuth apps. The app password approach works for most.',
      'If you get a redirect loop, clear your browser cookies and cache, then try again.',
      'Still stuck? Email admin@rugmunch.io with the protocol and a description of the error.',
    ],
  },
  {
    title: 'The app is slow',
    summary: 'Pages load slowly, feeds are sluggish, or interactions have noticeable delay.',
    steps: [
      'Clear your browser cache and DegenFeed data: Settings → Clear Local Data. This resets the IndexedDB cache which may have grown large.',
      'Check your internet connection. DegenFeed fetches from multiple protocols simultaneously — a slow connection amplifies perceived lag.',
      'If using a VPN, try disabling it. Some VPNs interfere with WebSocket connections to Nostr relays and Farcaster Hubs.',
      'Reduce the number of protocols in your feed: use per-protocol feeds (/home/nostr, /home/farcaster) instead of All Protocols.',
      'Switch to a lower density layout: Settings → Preferences → Feed Layout → Compact.',
      'On mobile, the PWA may run slower than desktop. Try using the browser version directly.',
      'DegenFeed caches aggressively. If the issue started recently, a clear + refresh usually resolves it.',
    ],
  },
  {
    title: "Notifications aren't working",
    summary: 'No push notifications, delayed notifications, or missing notification badges.',
    steps: [
      'Ensure you accepted the browser notification prompt when it first appeared. If you blocked it, reset in browser site settings.',
      'PWA notifications require the app to be installed (Add to Home Screen). Browser-only mode may not support all notification types.',
      'Check Settings → Notifications to verify which events trigger alerts.',
      'Notifications use the Web Push API. Some browsers (especially iOS Safari) have limited push support.',
      'If notifications worked before but stopped, your push subscription may have expired. Re-install the PWA to refresh it.',
    ],
  },
];

function AccordionItem({
  item,
  index,
  openIndex,
  toggle,
}: {
  item: (typeof issues)[0];
  index: number;
  openIndex: number | null;
  toggle: (i: number) => void;
}) {
  const isOpen = openIndex === index;
  return (
    <div className="border-b border-[var(--color-glass-border)]">
      <button
        type="button"
        onClick={() => toggle(index)}
        className="group flex w-full items-start justify-between gap-4 py-4 text-left transition-colors hover:bg-white/[0.01] px-3 -mx-3 rounded-lg"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <span className="text-sm font-medium text-[var(--color-fg)]">{item.title}</span>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{item.summary}</p>
        </div>
        <span
          className={`mt-1 flex-shrink-0 text-xs text-[var(--color-muted)] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-5 animate-slide-up">
          <ol className="space-y-3">
            {item.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-[10px] font-bold text-degen-400">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <span className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-2 py-0.5 text-[11px] text-yellow-400">
              Troubleshooting
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TroubleshootingPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center rounded-md border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-yellow-400">
          Troubleshooting
        </span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-fg)]">
        Troubleshooting Guide
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
        Common issues and how to fix them. If you don&apos;t find your problem here, check the{' '}
        <Link href="/faq" className="text-degen-400 underline">
          FAQ
        </Link>{' '}
        or email{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>
        .
      </p>

      {/* Quick links */}
      <div className="mt-6 mb-8 flex flex-wrap gap-2">
        {issues.map((issue) => (
          <button
            key={issue.title}
            type="button"
            onClick={() => {
              const idx = issues.indexOf(issue);
              setOpenIndex(openIndex === idx ? null : idx);
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              openIndex === issues.indexOf(issue)
                ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20 hover:text-degen-400'
            }`}
          >
            {issue.title}
          </button>
        ))}
      </div>

      {/* Issues */}
      <div className="divide-y divide-[var(--color-glass-border)]">
        {issues.map((issue, i) => (
          <AccordionItem
            key={issue.title}
            item={issue}
            index={i}
            openIndex={openIndex}
            toggle={toggle}
          />
        ))}
      </div>

      {/* Still stuck */}
      <div className="mt-12 rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6 text-center">
        <h2 className="mb-2 text-base font-semibold text-[var(--color-fg)]">Still stuck?</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          We&apos;re here to help. Reach out and we&apos;ll get back to you within 24 hours.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="mailto:admin@rugmunch.io" className="btn-secondary text-xs">
            Email Support
          </a>
          <Link href="/faq" className="btn-secondary text-xs">
            Browse FAQ
          </Link>
          <Link href="/status" className="btn-secondary text-xs">
            System Status
          </Link>
        </div>
      </div>
    </div>
  );
}
