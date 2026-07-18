'use client';

import { useState, useMemo } from 'react';

const faqs = [
  {
    q: 'What is DegenFeed?',
    a: 'DegenFeed is an open-source, multi-protocol social aggregator for web3. It pulls posts from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified, ranked timeline. No account needed to browse — just open the app and see what\'s trending across every decentralized social network at once. Connect a wallet to post, tip, and engage across protocols.',
  },
  {
    q: 'How is DegenFeed different from Twitter/X?',
    a: 'DegenFeed is not a walled garden. It reads from 10+ open protocols and lets you post to multiple networks simultaneously. There are no ads, no algorithm manipulation, no data selling, and no pay-to-play visibility. The ranking algorithm is transparent — every post shows its score breakdown. DegenFeed is open source (AGPL-3.0), self-hostable, and governed by the community.',
  },
  {
    q: 'What protocols does DegenFeed support?',
    a: 'Nostr (kind 1 text notes, kind 7 reactions, NIP-05/07/46), Farcaster (casts, replies, reactions via Hub API), Lens (profiles, publications, mirrors via GraphQL v2), Bluesky (AT Protocol — posts, likes, reposts), Mastodon / ActivityPub (via GotoSocial instance + federated instances), Threads (read-only via HTML scraping), Reddit (RSS + JSON API), RSS / Atom (550+ sources including YouTube, PeerTube, Mirror.xyz, Substack, Medium, Hacker News), and Lemmy (federated communities via API v3).',
  },
  {
    q: 'How does cross-protocol posting work?',
    a: 'The DegenFeed composer lets you select which protocols to publish to. When you hit post, your content is sent to each selected protocol using its native API — Nostr via signed events, Farcaster via protobuf, Lens via typed data, Bluesky via XRPC, Mastodon via REST API. Each post gets a canonical DegenFeed ID so engagement (likes, replies) can be aggregated across protocols. Cross-posting requires connecting at least one protocol account and is available to all signed-in users. Recurring cross-posting schedules are a Creator tier feature.',
  },
  {
    q: 'How does tipping work?',
    a: 'Tap the tip button on any post to send ETH, SOL, or USDC directly to the creator\'s wallet. DegenFeed uses on-chain transactions — no platform takes a cut. For Nostr posts, Lightning Network zaps are also supported via LNURL. To receive tips, connect a wallet with your account. Tips appear on your analytics dashboard and can be withdrawn at any time. Tipping is available to all users with a connected wallet.',
  },
  {
    q: 'Is DegenFeed free?',
    a: 'Yes. Browsing the feed is completely free and requires no account. Creating an account is also free and gives you a @degenfeed.xyz Fediverse handle. Premium ($5/mo) adds advanced filtering, custom feeds, noise reduction, and priority support. Creator ($15/mo) unlocks analytics, cross-posting analytics, post scheduling, and API access. All subscriptions fund development and infrastructure.',
  },
  {
    q: 'Can I use DegenFeed without a wallet?',
    a: 'Yes. You can browse all feeds, read posts, watch videos, and read news without any wallet. You only need a wallet to sign in (for posting, tipping, and account features) or to send tips. DegenFeed supports Solana wallets (Phantom, Backpack, Solflare) and EVM wallets (MetaMask, Rainbow, WalletConnect).',
  },
  {
    q: 'How do I link my Nostr/Farcaster/Lens/Bluesky account?',
    a: 'Go to Settings → Connected Accounts and click "Connect" for each protocol. For Nostr, you can use a browser extension (Alby, nos2x) or paste your nsec/npub. For Farcaster, sign with your Farcaster wallet. For Lens, authenticate via your Lens profile. For Bluesky, enter your handle and app password. For Mastodon, enter your instance URL and authorize via OAuth. Each connection is stored locally and used only to sign your posts.',
  },
  {
    q: 'What is a df:// URI?',
    a: 'A df:// URI is a DegenFeed universal resource identifier that can reference posts, profiles, communities, or spaces across any supported protocol. For example, df://post/nostr:note1abc... links to a specific Nostr note through DegenFeed\'s resolver. These URIs work anywhere you\'d paste a link — DegenFeed, other apps, or even Twitter/X. When someone opens a df:// link, DegenFeed resolves it to the canonical content regardless of which protocol it originated on.',
  },
  {
    q: 'How do I create a community?',
    a: 'Navigate to the Communities page and click "Create Community". You\'ll need to set a name, description, icon, and moderation rules. Communities live on DegenFeed\'s infrastructure but are federated via ActivityPub — your community can be discovered by users on Mastodon, Lemmy, and other Fediverse platforms. Community creators can appoint moderators, set posting guidelines, and enable DAO governance for decentralized decision-making.',
  },
  {
    q: 'How do I schedule a post?',
    a: 'Compose your post as usual, then click the clock icon in the composer toolbar. Pick your desired publish time and timezone. You can schedule posts to individual protocols or cross-post to multiple. Scheduled posts appear in your Creator Studio dashboard where you can edit, reschedule, or cancel them. Post scheduling is available on the Creator tier ($15/mo) and is perfect for coordinating multi-protocol announcements.',
  },
  {
    q: 'How does the algorithm work?',
    a: 'Every post is scored on a transparent 7-factor model: Recency (24%, 12-hour half-life), Engagement (35%, weighted log-scale), Relevance (18%, keyword/niche/platform matching), Quality (14%, author reputation), Diversity (10%, author variety penalty), Source (8%, protocol weight), and Velocity (12%, engagement rate-of-change). Posts under 15min get a 2x freshness boost, media posts get 1.2x, and low-effort content is penalized. You can override with ?sort=new for chronological order.',
  },
  {
    q: 'How do I report spam or abuse?',
    a: 'Click the "..." menu on any post and select "Report". Choose the reason: spam, harassment, impersonation, or copyright violation. Reports are reviewed by human moderators within 24 hours. For urgent issues, email admin@rugmunch.io. DMCA takedown requests go to dmca@degenfeed.xyz. You can also mute or block users from their profile page — blocked users won\'t see your content on DegenFeed.',
  },
  {
    q: 'Can I self-host DegenFeed?',
    a: 'Yes. DegenFeed is AGPL-3.0 licensed and designed for easy self-hosting. Clone the repo, run pnpm install && pnpm dev, and you\'re running your own instance. The recommended deployment is Cloudflare Pages + Workers (free-tier eligible). You\'ll need two KV namespaces for caching and subscriptions. Full documentation is available at /docs including environment variables and deployment guides.',
  },
  {
    q: 'How do I get my content featured?',
    a: 'DegenFeed\'s ranking algorithm surfaces content based on engagement quality, not paid placement. To increase your visibility: post consistently across multiple protocols, engage with replies and build community, use rich media (images, videos), share original analysis and insights, and participate in trending topics. The algorithm favors authentic engagement and meaningful content over clickbait. There is no "promote" button — featured content is earned, not bought.',
  },
  {
    q: 'Does DegenFeed have a mobile app?',
    a: 'DegenFeed is a Progressive Web App (PWA). On Android, you\'ll be prompted to "Add to Home Screen" on your first visit — this installs it as a full-screen app with offline support, push notifications, and a dedicated icon. On iOS, use Safari\'s Share → "Add to Home Screen". The PWA supports all features including posting, tipping, and real-time notifications. No app store download needed.',
  },
];

export function FAQClient() {
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(search.toLowerCase()) ||
          f.a.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-fg)]">
          Frequently Asked Questions
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Everything you need to know about DegenFeed. Can&apos;t find what you&apos;re looking
          for? Email{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
          .
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-gray-500">
          ⌕
        </span>
        <input
          type="text"
          placeholder="Search FAQs…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpenIndex(null);
          }}
          className="input pl-10"
          aria-label="Search frequently asked questions"
        />
      </div>

      {/* FAQ list */}
      <div className="divide-y divide-[var(--color-glass-border)]">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No results for &ldquo;{search}&rdquo;</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setOpenIndex(null);
              }}
              className="mt-2 text-xs text-degen-400 underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          filtered.map((faq, i) => (
            <div key={faq.q}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="group flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-white/[0.01] px-3 -mx-3 rounded-lg"
                aria-expanded={openIndex === i}
              >
                <span className="text-sm font-medium text-[var(--color-fg)]">{faq.q}</span>
                <span
                  className={`flex-shrink-0 text-xs text-gray-500 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>
              {openIndex === i && (
                <div className="px-3 pb-4 text-sm leading-relaxed text-gray-400 animate-slide-up">
                  {faq.a}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Contact */}
      <div className="mt-12 rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-gray-400">
          Still have questions? Reach out to{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>{' '}
          or join the community on{' '}
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank" rel="noopener noreferrer"
            rel="noopener noreferrer"
            className="text-degen-400 underline"
          >
            Forgejo
          </a>
          .
        </p>
      </div>
    </div>
  );
}
