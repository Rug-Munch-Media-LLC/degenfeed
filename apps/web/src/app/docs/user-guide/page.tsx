import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'User Guide — DegenFeed',
  description:
    'Complete user guide for DegenFeed — wallet setup, posting, tipping, communities, messages, spaces, analytics, and settings.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/user-guide' },
  openGraph: {
    title: 'DegenFeed User Guide',
    description:
      'Learn how to use DegenFeed: connect protocols, post across networks, tip creators, manage communities, and more.',
    url: 'https://app.degenfeed.xyz/docs/user-guide',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed User Guide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed User Guide',
    description: 'Learn how to use DegenFeed across all protocols.',
  },
};

function SectionNav() {
  const sections = [
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'feed-discovery', label: 'Feed & Discovery' },
    { id: 'posting-engagement', label: 'Posting & Engagement' },
    { id: 'tipping-monetization', label: 'Tipping & Monetization' },
    { id: 'communities-governance', label: 'Communities & Governance' },
    { id: 'messages-dms', label: 'Messages & DMs' },
    { id: 'spaces', label: 'Spaces' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <nav className="mb-10 flex flex-wrap gap-2" aria-label="User guide sections">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-14 mb-4 flex items-center gap-3 text-2xl font-bold text-[var(--color-fg)] scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </a>
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="group mt-8 mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--color-fg)] scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </a>
    </h3>
  );
}

function Callout({
  type,
  children,
}: {
  type: 'info' | 'warning' | 'tip';
  children: React.ReactNode;
}) {
  const styles: Record<string, { border: string; bg: string; icon: string }> = {
    info: { border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: 'ℹ' },
    warning: { border: 'border-yellow-500/20', bg: 'bg-yellow-500/5', icon: '⚠' },
    tip: { border: 'border-degen-500/20', bg: 'bg-degen-500/5', icon: '✓' },
  };
  const s = styles[type];
  if (!s) return <div className="my-4 text-sm text-[var(--color-muted)]">{children}</div>;
  return (
    <div className={`my-4 rounded-lg border ${s.border} ${s.bg} p-4`}>
      <div className="flex gap-3">
        <span className="mt-0.5 flex-shrink-0 text-sm">{s.icon}</span>
        <div className="min-w-0 text-sm text-[var(--color-muted)]">{children}</div>
      </div>
    </div>
  );
}

function Step({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
        {number}
      </span>
      <div>
        <div className="mb-1 text-sm font-semibold text-[var(--color-fg)]">{label}</div>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">{children}</p>
      </div>
    </div>
  );
}

export default function UserGuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center rounded-md border border-degen-500/20 bg-degen-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-degen-400">
          User Guide
        </span>
        <span className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-purple-400">
          v1.0
        </span>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">User Guide</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        Everything you need to know to use DegenFeed — from your first visit to advanced features
        like cross-posting, DAO governance, and analytics.
      </p>

      <SectionNav />

      {/* ═══════════════════════════════════════════════════════
          GETTING STARTED
      ═══════════════════════════════════════════════════════ */}
      <H2 id="getting-started">Getting Started</H2>

      <H3 id="wallet-setup">Wallet Setup</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        You don&apos;t need a wallet to browse DegenFeed, but connecting one unlocks posting,
        tipping, and account features. DegenFeed supports:
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-muted)]">
        <li>
          <strong className="text-[var(--color-muted)]">Solana:</strong> Phantom, Backpack, Solflare
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">EVM:</strong> MetaMask, Rainbow, WalletConnect
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
        Click <strong>Connect Wallet</strong> in the header and approve the connection in your
        wallet extension. Your wallet is used only for signing cryptographic messages — DegenFeed
        never has access to your private keys.
      </p>

      <Callout type="tip">
        You can connect both a Solana and an EVM wallet simultaneously. This lets you tip across
        chains and use protocol-specific features (e.g., Lens on Polygon, Farcaster on Optimism).
      </Callout>

      <H3 id="protocol-linking">Protocol Linking</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        After connecting a wallet, link your social accounts to post and engage across protocols:
      </p>
      <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-[var(--color-muted)]">
        <li>
          Go to <strong>Settings → Connected Accounts</strong>
        </li>
        <li>
          Click <strong>Connect</strong> for each protocol you want to link
        </li>
        <li>Follow the protocol-specific authorization flow</li>
      </ol>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Step number="1" label="Nostr">
          Use a browser extension (Alby, nos2x) or paste your nsec/npub. Your key never leaves your
          device — all signing happens client-side.
        </Step>
        <Step number="2" label="Farcaster">
          Sign with the wallet that owns your Farcaster ID. The Hub API confirms your identity.
        </Step>
        <Step number="3" label="Lens">
          Authenticate via your Lens profile on Polygon. Uses challenge-response signing.
        </Step>
        <Step number="4" label="Bluesky">
          Enter your Bluesky handle and an app password (create one in Bluesky Settings → App
          Passwords).
        </Step>
        <Step number="5" label="Mastodon">
          Enter any Mastodon-compatible instance URL and authorize via OAuth.
        </Step>
      </div>

      <H3 id="first-post">First Post</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">Ready to post? Here&apos;s how:</p>
      <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-[var(--color-muted)]">
        <li>
          Click the <strong>Compose</strong> button in the header
        </li>
        <li>Write your post. You can include images, links, and mentions</li>
        <li>Select which protocols to publish to (Nostr, Farcaster, Lens, Bluesky, Mastodon)</li>
        <li>
          Click <strong>Post</strong> — your content is sent to each selected protocol
          simultaneously
        </li>
      </ol>
      <Callout type="info">
        Posts are published to each protocol via its native API. Nostr posts appear on relays,
        Farcaster casts on Hubs, Lens publications on-chain, etc. DegenFeed does not store your
        content — it lives on the protocols you choose.
      </Callout>

      {/* ═══════════════════════════════════════════════════════
          FEED & DISCOVERY
      ═══════════════════════════════════════════════════════ */}
      <H2 id="feed-discovery">Feed & Discovery</H2>

      <H3 id="how-feed-works">How the Feed Works</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Your feed is an aggregated, ranked timeline of posts from all connected protocols. Every
        post is scored by a transparent 7-factor algorithm that considers recency, engagement,
        relevance, quality, diversity, source, and velocity. You can switch between sort modes:
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-muted)]">
        <li>
          <strong className="text-[var(--color-muted)]">Scored (default):</strong> Balanced ranking across all 7
          factors
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">Hot:</strong> Trending posts with recent engagement
          velocity
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">New:</strong> Chronological, most recent first
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">Top:</strong> Highest raw engagement
        </li>
      </ul>

      <H3 id="filtering">Filtering</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Narrow your feed with filters available in the sidebar or as URL parameters:
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Filter</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">How it works</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              ['Protocol', 'Show posts from specific protocols (Nostr, Farcaster, etc.)'],
              ['Category', 'defi, nft, ai, bitcoin, ethereum, solana, security, macro'],
              ['Content type', 'video, article, image, thread, link, or text'],
              ['Language', 'English only or all languages'],
              ['Time range', 'Trending window: 1h, 6h, or 24h'],
            ].map(([f, desc]) => (
              <tr key={f} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-medium text-[var(--color-muted)]">{f}</td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3 id="custom-feeds">Custom Feeds</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Premium subscribers can create custom feeds with saved filters. Save any combination of
        protocols, categories, and content types as a named feed that appears in your sidebar.
        Custom feeds update in real-time and can be shared with a unique URL.
      </p>

      {/* ═══════════════════════════════════════════════════════
          POSTING & ENGAGEMENT
      ═══════════════════════════════════════════════════════ */}
      <H2 id="posting-engagement">Posting & Engagement</H2>

      <H3 id="compose">Compose</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        The composer supports rich content: text up to protocol limits, images (drag-and-drop or
        paste), links with automatic OpenGraph preview, mentions (@username resolves across
        protocols), and hashtags for topic tagging.
      </p>

      <H3 id="cross-protocol-posting">Cross-Protocol Posting</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Before posting, select the destination protocols using the checkboxes in the composer. Each
        protocol adapts your content to its native format automatically — Nostr events, Farcaster
        casts, Lens publications, Bluesky records, Mastodon toots. Engagement from all protocols
        flows back to a single canonical post view.
      </p>
      <Callout type="warning">
        Some protocols have different character limits and content restrictions. DegenFeed will warn
        you if your post exceeds a protocol&apos;s limit before publishing.
      </Callout>

      <H3 id="scheduling">Scheduling</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Creator tier users can schedule posts. Click the clock icon in the composer toolbar, pick
        your publish time and timezone, and choose target protocols. Scheduled posts appear in your
        Creator Studio dashboard where you can manage, edit, or cancel them before they go live.
      </p>

      <H3 id="likes-replies-reposts">Likes, Replies & Reposts</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Engage with any post using the action bar: like (❤️), reply (💬), repost/quote (🔄), or
        bookmark (🔖). Each action is sent to the original protocol — a like on a Nostr post becomes
        a kind 7 reaction, a like on a Farcaster cast becomes a Farcaster reaction. Your engagement
        profile is unified across protocols.
      </p>

      {/* ═══════════════════════════════════════════════════════
          TIPPING & MONETIZATION
      ═══════════════════════════════════════════════════════ */}
      <H2 id="tipping-monetization">Tipping & Monetization</H2>

      <H3 id="how-to-tip">How to Tip</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Click the tip button (⚡) on any post to open the tip dialog. Select your currency (ETH,
        SOL, or USDC) and amount. Confirm the transaction in your wallet — the tip goes directly to
        the creator&apos;s wallet on-chain. For Nostr posts, you can also zap via Lightning Network.
      </p>

      <H3 id="how-to-receive">How to Receive Tips</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Connect a wallet in Settings → Wallets to receive tips. You can set different receiving
        addresses for different tokens. Tips appear in your analytics dashboard with a breakdown by
        protocol, currency, and time period. Withdraw at any time — DegenFeed never holds your
        funds.
      </p>

      <H3 id="subscriptions">Subscriptions</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Premium ($5/mo) unlocks advanced filtering, custom feeds, noise reduction, and priority
        support. Creator ($15/mo) adds analytics, cross-posting analytics, post scheduling, RSS
        feeds, and API access. All subscriptions are billed monthly and can be cancelled anytime.
      </p>

      {/* ═══════════════════════════════════════════════════════
          COMMUNITIES & GOVERNANCE
      ═══════════════════════════════════════════════════════ */}
      <H2 id="communities-governance">Communities & Governance</H2>

      <H3 id="creating-communities">Creating Communities</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Navigate to Communities → Create Community. Set a name, description, icon, and moderation
        rules. Communities are federated via ActivityPub — discoverable by Mastodon, Lemmy, and
        other Fediverse users. Appoint moderators to help manage content.
      </p>

      <H3 id="dao-voting">DAO Voting</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Communities can enable DAO governance for decentralized decision-making. Proposals can cover
        rule changes, moderator appointments, treasury spending, and community direction. Voting
        power can be based on reputation, token holdings, or a custom formula set by the community
        creator.
      </p>

      <H3 id="proposals">Proposals</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Any community member can create a proposal if the community has enabled DAO mode. Proposals
        include a title, description, voting period, and options. Members vote using their connected
        wallet. Results are recorded on-chain and automatically enforced where applicable.
      </p>

      {/* ═══════════════════════════════════════════════════════
          MESSAGES & DMs
      ═══════════════════════════════════════════════════════ */}
      <H2 id="messages-dms">Messages & DMs</H2>

      <H3 id="cross-protocol-messaging">Cross-Protocol Messaging</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        The Messages section aggregates DMs from Nostr (NIP-04 encrypted DMs) and Mastodon (private
        mentions). Each conversation shows messages from all protocols in a unified thread. Start a
        new conversation by searching for a user across protocols.
      </p>

      <H3 id="privacy">Privacy</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Nostr DMs are end-to-end encrypted using NIP-04. Mastodon private mentions are encrypted in
        transit. You can block users from messaging you in Settings → Privacy. DegenFeed never reads
        your private messages.
      </p>

      {/* ═══════════════════════════════════════════════════════
          SPACES
      ═══════════════════════════════════════════════════════ */}
      <H2 id="spaces">Spaces</H2>

      <H3 id="hosting-spaces">Hosting a Space</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Spaces are live audio rooms where you can host discussions. Click Spaces → Host a Space, set
        a title and description, choose whether it&apos;s public or invite-only, and go live. You
        can invite speakers, moderate the chat, and record sessions for later playback.
      </p>

      <H3 id="joining-spaces">Joining a Space</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Browse upcoming and live Spaces from the Spaces page. Tap Join to enter as a listener. You
        can raise your hand to speak, react with emoji, and chat alongside the audio. Spaces work on
        desktop and mobile (PWA).
      </p>

      {/* ═══════════════════════════════════════════════════════
          ANALYTICS
      ═══════════════════════════════════════════════════════ */}
      <H2 id="analytics">Analytics</H2>

      <H3 id="dashboard">Your Dashboard</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Creator Studio shows your cross-protocol analytics: total reach, engagement rate, top posts,
        follower growth, and tip revenue. Data is broken down by protocol so you can see which
        networks perform best for your content.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
          <div className="text-xs font-semibold text-[var(--color-fg)]">Reach</div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Total unique impressions across all protocols. Updated hourly.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
          <div className="text-xs font-semibold text-[var(--color-fg)]">Engagement</div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Likes, replies, reposts, and quotes aggregated and normalized.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
          <div className="text-xs font-semibold text-[var(--color-fg)]">Tips</div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Total tips received with currency breakdown and historical chart.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
          <div className="text-xs font-semibold text-[var(--color-fg)]">Top Content</div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Your highest-performing posts ranked by composite engagement score.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SETTINGS
      ═══════════════════════════════════════════════════════ */}
      <H2 id="settings">Settings</H2>

      <H3 id="preferences">Preferences</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Customize your experience in Settings → Preferences: theme (dark/light), feed density
        (compact/visual), font size (SM/MD/LG), line spacing (compact/comfortable/relaxed), language
        filter, and content type defaults.
      </p>

      <H3 id="privacy-settings">Privacy</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Control your visibility: mute words and accounts, block users, manage who can DM you, and
        request a GDPR-compliant data export at any time. DegenFeed does not sell your data — these
        controls exist for your comfort, not compliance.
      </p>

      <H3 id="notifications">Notifications</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Configure push notifications (via PWA), email digests, and in-app notification preferences.
        Choose which events trigger alerts: new followers, replies, mentions, tips, or community
        updates. Notification center at /notifications shows everything in one inbox.
      </p>

      <H3 id="muted-blocked">Muted & Blocked</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Manage muted accounts and blocked users from Settings → Privacy. Muted accounts&apos; posts
        are hidden from your feed. Blocked users cannot see your posts, message you, or interact
        with your content on DegenFeed. Blocks are local to DegenFeed and do not propagate to
        protocols.
      </p>

      {/* Footer */}
      <div className="mt-16 border-t border-[var(--color-glass-border)] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-4 text-sm">
            <Link href="/faq" className="text-degen-400 underline">
              FAQ
            </Link>
            <Link href="/docs" className="text-degen-400 underline">
              API Docs
            </Link>
            <Link href="/docs/troubleshooting" className="text-degen-400 underline">
              Troubleshooting
            </Link>
          </div>
          <p className="text-xs text-gray-600">
            Need help?{' '}
            <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
              admin@rugmunch.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
