'use client';

import { useMemo, useState } from 'react';

const faqs = [
  {
    q: 'What is DegenFeed?',
    a: "DegenFeed is the Web3 Social Universe — an open-source, multi-protocol aggregator that unifies 18+ decentralized and federated social networks into one app. Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube, Lemmy, Pixelfed, Reddit, RSS/Atom (248+ sources), YouTube, and more, all in a single ranked feed. No account needed to browse. Connect a wallet to post, tip, launch creator coins, and engage across every protocol at once. We don't own your content — we give you the tools to own it yourself.",
  },
  {
    q: 'How is DegenFeed different from Twitter/X, Bluesky, and Mastodon?',
    a: "Twitter/X is a walled garden — ads, algorithms you can't see, data sold to the highest bidder, and you can be deplatformed instantly. Bluesky is open protocol but single-client focused. Mastodon is federated but fragmented across instances. DegenFeed is none of these things. We aggregate all of them into one app while adding what none of them have: cross-protocol posting, creator coins, cross-chain tipping in ETH/SOL/USDC/Lightning, livestreaming to 7 protocols at once, transparent open-source ranking, and zero platform fees. Your identity lives on open protocols, not on DegenFeed. There is no lock-in, no data selling, no algorithm manipulation.",
  },
  {
    q: 'What protocols does DegenFeed support?',
    a: 'DegenFeed bridges 18+ networks. Major protocols include: Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube, Owncast, Lemmy, Pixelfed, Matrix, Reddit, Threads, RSS/Atom (248+ sources), YouTube, Odysee, Rumble, Minds, Substack, Mirror, Paragraph, and more — plus centralized platforms via DegenFeed Connect (YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn). Every major decentralized social protocol is supported.',
  },
  {
    q: 'What makes DegenFeed web3?',
    a: "DegenFeed is web3 at its core. Sign in with your crypto wallet (EVM or Solana) — no email, no password, no phone number. Your identity is your wallet address and your protocol handles. Creator coins are real ERC-20 and SPL tokens deployed on Base and Solana. Tipping happens on-chain — ETH, SOL, USDC, or Lightning — with zero platform fees. Livestreams can include live NFT minting. Communities support token gating and on-chain DAO governance. Your protocol credentials never leave your browser — posts are signed client-side. DegenFeed doesn't have a database of user content; your data lives on the protocols, secured by their respective cryptographic primitives.",
  },
  {
    q: 'How does cross-protocol posting work?',
    a: 'The DegenFeed composer lets you select which protocols to publish to. When you hit post, your content is sent to each selected protocol using its native API — Nostr via signed events, Farcaster via protobuf, Lens via typed data, Bluesky via XRPC, Mastodon via REST API. Each post gets a canonical DegenFeed ID so engagement (likes, replies) can be aggregated across protocols. Cross-posting requires connecting at least one protocol account and is available to all signed-in users. Recurring cross-posting schedules are a Creator tier feature.',
  },
  {
    q: 'How does federation work?',
    a: "DegenFeed is a reader and bridge across every major federated and decentralized social system, and each one federates differently. Mastodon, Lemmy, PeerTube, and Pixelfed speak ActivityPub — thousands of independent servers exchange posts with each other, and DegenFeed reads the public network directly. Bluesky runs on the AT Protocol, where portable identities and data feeds are hosted on PDSes. Nostr uses relays: anyone can run one, and clients (like DegenFeed) talk to many relays at once. Farcaster replicates its social graph across a network of Hubs, while Lens publishes on-chain via Polygon. DegenFeed connects to all of them — public instances, relays, Hubs, and APIs — and merges everything into one unified feed. You don't need to understand the plumbing to use it; just connect an account and the rest happens automatically.",
  },
  {
    q: 'Is my data private?',
    a: "Yes — by architecture, not by policy. Your protocol credentials (Nostr keys, Bluesky app passwords) are encrypted in your browser and never sent to our servers. Posts are signed client-side and published to open protocols where you control the keys. DegenFeed never sells, rents, or monetizes your data — there are no ads, no trackers, and no data brokers beyond privacy-friendly analytics. You can export everything at any time via /api/account/export in JSON or CSV. If you self-host, you have full database access. The ranking algorithm is open source, so there's no black-box feed manipulation either.",
  },
  {
    q: 'What is Postiz and how do I use it?',
    a: 'Postiz is the open-source social media scheduling and publishing engine that powers DegenFeed Connect — the feature that lets you post and schedule to centralized platforms like YouTube, Twitch, Kick, TikTok, Instagram, and LinkedIn from the same dashboard you use for decentralized protocols. Postiz handles OAuth for each platform, so DegenFeed never sees your platform credentials. To use it: open the Connect page (/connect), sign in, and click Connect on each platform you want to link. After authorizing, you can compose once and publish to both centralized platforms (via Postiz) and decentralized protocols (via DegenFeed) at the same time. DegenFeed Connect is included in the Enterprise tier ($20/mo) or available as a standalone add-on ($15/mo).',
  },
  {
    q: 'How does livestreaming work?',
    a: 'To start a livestream, navigate to the Live page and click "Go Live". Connect your OBS (or any RTMP-compatible encoder) using the provided stream key and URL. Your stream is broadcast via PeerTube and simultaneously announced on Nostr (kind 30311), Farcaster (frames), Bluesky (AT Protocol), Mastodon (ActivityPub), and Telegram. You can choose between solo streams, collaborative broadcasts with co-hosts, Spaces-style audio rooms, or coin launch events with live minting. Enterprise users can also go live to YouTube, Twitch, and Kick simultaneously through DegenFeed Connect. Stream types are configured before going live.',
  },
  {
    q: 'How does DegenFeed compare to Ground News?',
    a: "DegenFeed and Ground News share a mission: break out of your echo chamber. Ground News is a paywalled news product that shows media bias ratings and 'blindspot' coverage. DegenFeed gives you the same style of bias transparency for free — 248 crypto, DeFi, AI, and tech news sources ranked by credibility tier, tagged with a 5-point political bias, and flagged when coverage of a story skews to one side, with suggested sources from the other. But DegenFeed goes further: it's not just news. The same feed also aggregates social posts from 18+ open protocols (Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, YouTube, and more), lets you cross-post to all of them at once, and includes creator coins, tipping, and livestreaming. No paywall, no account required to read.",
  },
  {
    q: 'How does tipping work?',
    a: "Tap the tip button on any post to send ETH, SOL, or USDC directly to the creator's wallet. DegenFeed uses on-chain transactions — no platform takes a cut. Tipping is cross-chain and context-aware: the best route is automatically selected based on the creator's connected wallets and the content they've posted. For Nostr posts, Lightning Network zaps are supported via LNURL. Tips can be sent on Ethereum, Base, Solana, or Lightning Network. To receive tips, connect a wallet with your account. Tips appear on your analytics dashboard and can be withdrawn at any time. Tipping is available to all users with a connected wallet.",
  },
  {
    q: 'Is DegenFeed free?',
    a: 'Yes. Browsing the feed is completely free and requires no account. Creating an account is also free and gives you a @degenfeed.xyz Fediverse handle. Premium ($10/mo) adds cross-platform posting, Feddy Communities, creator coins, livestreaming, and priority support. Creator ($25/mo) unlocks advanced analytics, custom domains, post scheduling, and API access. All subscriptions fund development and infrastructure.',
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
    a: "A df:// URI is a DegenFeed universal resource identifier that can reference posts, profiles, communities, or spaces across any supported protocol. For example, df://post/nostr:note1abc... links to a specific Nostr note through DegenFeed's resolver. These URIs work anywhere you'd paste a link — DegenFeed, other apps, or even Twitter/X. When someone opens a df:// link, DegenFeed resolves it to the canonical content regardless of which protocol it originated on.",
  },
  {
    q: 'How do I create a community?',
    a: 'Navigate to the Communities page and click "Create Community". You\'ll need to set a name, description, icon, and moderation rules. Communities live on DegenFeed\'s infrastructure but are federated via ActivityPub — your community can be discovered by users on Mastodon, Lemmy, and other Fediverse platforms. Community creators can appoint moderators, set posting guidelines, and enable DAO governance for decentralized decision-making.',
  },
  {
    q: 'How do I schedule a post?',
    a: 'Compose your post as usual, then click the clock icon in the composer toolbar. Pick your desired publish time and timezone. You can schedule posts to individual protocols or cross-post to multiple. Scheduled posts appear in your Creator Studio dashboard where you can edit, reschedule, or cancel them. Post scheduling is available on the Creator tier ($25/mo) and is perfect for coordinating multi-protocol announcements.',
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
    a: "Yes. DegenFeed is AGPL-3.0 licensed and designed for easy self-hosting. Clone the repo, run pnpm install && pnpm dev, and you're running your own instance. The recommended deployment is Cloudflare Pages + Workers (free-tier eligible). You'll need two KV namespaces for caching and subscriptions. Full documentation is available at /docs including environment variables and deployment guides.",
  },
  {
    q: 'How do I get my content featured?',
    a: 'DegenFeed\'s ranking algorithm surfaces content based on engagement quality, not paid placement. To increase your visibility: post consistently across multiple protocols, engage with replies and build community, use rich media (images, videos), share original analysis and insights, and participate in trending topics. The algorithm favors authentic engagement and meaningful content over clickbait. There is no "promote" button — featured content is earned, not bought.',
  },
  {
    q: 'Does DegenFeed have a mobile app?',
    a: 'DegenFeed is a Progressive Web App (PWA). On Android, you\'ll be prompted to "Add to Home Screen" on your first visit — this installs it as a full-screen app with offline support, push notifications, and a dedicated icon. On iOS, use Safari\'s Share → "Add to Home Screen". The PWA supports all features including posting, tipping, and real-time notifications. No app store download needed. Native iOS and Android apps are on the roadmap for Q3 2026.',
  },
  {
    q: 'What are Creator Coins?',
    a: 'Creator Coins are personalized tokens (ERC-20 on Base or SPL on Solana) that creators deploy to build their own economy. Fans buy, hold, and trade creator coins to support their favorite creators. Each coin uses a sigmoid bonding curve with 5 pricing eras (Steal Deal → Early Bird → Ramp Up → Fair Launch → Moonshot) and built-in anti-exploit protection: per-wallet caps, cooldown periods, bundle detection, and anti-sniping. Creators can configure revenue splits, vesting schedules, and supply caps. Liquidity is locked via smart contract — no admin keys to drain.',
  },
  {
    q: 'How much does it cost to create a coin?',
    a: 'Creating a creator coin costs only the gas fee for deploying the smart contract — typically $5–$20 on Base or $0.01–$0.05 on Solana. There is no platform fee for coin creation. Premium subscribers ($10/mo) get priority deployment and additional features. The Creator tier ($25/mo) unlocks advanced vesting configurations and analytics.',
  },
  {
    q: 'Can I be deplatformed?',
    a: "No. DegenFeed is built on open protocols — Nostr, Farcaster, Bluesky, Lens, and Mastodon. Your identity lives on these protocols, not on DegenFeed. Even if DegenFeed's hosted instance went offline, your accounts on each protocol remain independently accessible. You can self-host the entire DegenFeed stack on your own infrastructure, ensuring no single entity can ever silence you. Content moderation on DegenFeed's hosted instance follows our Community Guidelines, but your fundamental access to the underlying protocols is never at risk.",
  },
  {
    q: 'How do I own my data?',
    a: "Your data ownership is baked into DegenFeed's architecture. Social protocol credentials (Nostr nsec, Bluesky app passwords) are encrypted in your browser and never sent to our servers. Your posts are published to open protocols where you control the keys. You can export all your data at any time via /api/account/export in JSON or CSV format. If you self-host, you have full database access. DegenFeed never sells, rents, or monetizes your data — there are no ads, no trackers, and no data brokers.",
  },
  {
    q: 'How do I go live / start livestreaming?',
    a: 'To start a livestream, navigate to the Live page and click "Go Live". Connect your OBS (or any RTMP-compatible encoder) using the provided stream key and URL. Your stream is broadcast via PeerTube and simultaneously announced on Nostr (kind 30311), Farcaster (frames), Bluesky (AT Protocol), Mastodon (ActivityPub), and Telegram. You can choose between solo streams, collaborative broadcasts with co-hosts, Spaces-style audio rooms, or coin launch events with live minting. Stream types are configured before going live.',
  },
  {
    q: 'What are Feddy Communities?',
    a: 'Feddy Communities are cross-protocol communities that span Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. A member on Nostr can interact with a member on Farcaster in the same community feed. Communities support token gating (restrict access based on token/NFT ownership across EVM and Solana), on-chain governance (proposal and voting systems with quadratic voting and timelocks), and cross-protocol moderation tools. Create your community at /feddy/create with a name, description, icon, and moderation rules.',
  },
  {
    q: 'When is DegenFeed launching?',
    a: "DegenFeed is already live at app.degenfeed.xyz! The feed is fully operational — you can browse content from 18+ protocols right now without an account. The waitlist is for premium features: cross-protocol posting, creator coins, livestreaming, and analytics. We're rolling out these features gradually through Q3–Q4 2026. Join the waitlist to get early access as each feature launches.",
  },
  {
    q: 'What chains and wallets are supported?',
    a: 'DegenFeed supports Ethereum (MetaMask, Rainbow, WalletConnect, Coinbase Wallet), Base (same EVM wallets), Optimism, Arbitrum, Solana (Phantom, Backpack, Solflare), and Lightning Network (via Nostr zaps). For creator coins, deployment is on Base (ERC-20) and Solana (SPL). Tipping works across all supported chains. Cross-chain bridging between EVM and Solana uses Wormhole.',
  },
  {
    q: 'How do I get started?',
    a: 'Open app.degenfeed.xyz and start browsing — no account required. To post, cross-post, tip, and engage, click "Sign In" and connect an EVM wallet (MetaMask, Rainbow, WalletConnect) or Solana wallet (Phantom, Backpack, Solflare). Once signed in, go to Settings → Connected Accounts to link your Nostr, Farcaster, Lens, Bluesky, or Mastodon handles. Then use the composer to write a post and select which protocols to publish to. Browse the Feed, Trending, and News tabs to discover content across all 18+ protocols. For full docs, visit app.degenfeed.xyz/docs.',
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
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Everything you need to know about DegenFeed. Can&apos;t find what you&apos;re looking for?
          Email{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
          .
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-[var(--color-muted)]">
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
            <p className="text-sm text-[var(--color-muted)]">
              No results for &ldquo;{search}&rdquo;
            </p>
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
                  className={`flex-shrink-0 text-xs text-[var(--color-muted)] transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>
              {openIndex === i && (
                <div className="px-3 pb-4 text-sm leading-relaxed text-[var(--color-muted)] animate-slide-up">
                  {faq.a}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Contact */}
      <div className="mt-12 rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">
          Still have questions? Reach out to{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>{' '}
          or join the community on{' '}
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank"
            className="text-degen-400 underline"
            rel="noopener"
          >
            Forgejo
          </a>
          .
        </p>
      </div>
    </div>
  );
}
