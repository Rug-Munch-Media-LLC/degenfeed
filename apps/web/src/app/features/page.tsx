import type { Metadata } from 'next';
import Link from 'next/link';
import './page.css';

export const metadata: Metadata = {
  title: 'Features — Creator Coins, Cross-Protocol Posting, Tipping & Livestreaming',
  description:
    'Explore everything DegenFeed can do: universal cross-posting to 15+ protocols, one-click creator coin deployment on Base & Solana, cross-chain tipping (ETH/SOL/USDC/Lightning), multi-protocol livestreaming, audio spaces, shorts, federated communities, self-hosted infrastructure, and more.',
  keywords: [
    'creator coin platform',
    'web3 content publishing',
    'cross-platform posting tool',
    'decentralized video platform',
    'cross-chain tipping app',
    'self-hosted social media',
    'fediverse community platform',
    'decentralized livestreaming',
    'web3 creator monetization',
    'multi protocol social features',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz/features' },
  openGraph: {
    title: 'DegenFeed Features — Cross-Protocol Social, Creator Coins & Livestreaming',
    description:
      'Post once to 15+ protocols. Launch your own creator coin on Base & Solana. Stream to 7 platforms simultaneously. Tip in ETH, SOL, USDC, or Lightning. Zero platform fees.',
    url: 'https://app.degenfeed.xyz/features',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Features — cross-protocol social media platform with creator coins and livestreaming',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed Features — Cross-Protocol Social & Creator Monetization',
    description:
      'Cross-post to 15+ protocols. Launch creator coins. Stream everywhere. Tip in any currency. Own your social network.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

/* ─── Feature Detail Sections ─────────────────────────────── */

interface DetailItem {
  title: string;
  desc: string;
}

interface FeatureDetail {
  id: string;
  title: string;
  lead: string;
  details: DetailItem[];
}

const features: FeatureDetail[] = [
  {
    id: 'cross-posting',
    title: 'Universal Cross-Posting',
    lead: 'Write once. Reach 15+ protocols. Replies from any network appear in one unified thread. No more copy-pasting across apps.',
    details: [
      {
        title: 'One Composer, Many Networks',
        desc: 'Type your post once, select which protocols to publish to, and hit send. Supports text, images, video, and polls.',
      },
      {
        title: 'Unified Replies',
        desc: 'Replies from Nostr, Farcaster, Bluesky, Lens, and Mastodon all appear in the same thread. Reply from DegenFeed and your response goes to the right network.',
      },
      {
        title: 'Protocol-Native Rendering',
        desc: 'Each protocol receives content in its native format. No broken embeds, no truncated posts, no compatibility issues.',
      },
      {
        title: 'Scheduled & Drafted',
        desc: 'Compose ahead of time. Schedule posts for optimal times across different timezones and network peaks.',
      },
    ],
  },
  {
    id: 'creator-coins',
    title: 'Creator Coins',
    lead: 'Your own token on Base and Solana. Deployed in one click with built-in anti-exploit protection. Your community, your economy.',
    details: [
      {
        title: 'One-Click Deployment',
        desc: 'Deploy an ERC-20 on Base or SPL token on Solana from your wallet. No coding, no audit fees, no waiting.',
      },
      {
        title: 'Anti-Bot & Anti-Whale',
        desc: 'Built-in safeguards: per-wallet caps, cooldown periods, and anti-sniping on launch. Your community buys fairly.',
      },
      {
        title: 'Revenue Splits',
        desc: 'Configure automatic revenue sharing — percentage to you, percentage to your community treasury, percentage to liquidity.',
      },
      {
        title: 'No Rug, No Exploit',
        desc: 'Liquidity is locked via smart contract. No admin keys to drain. Verified on Etherscan and Solscan.',
      },
    ],
  },
  {
    id: 'connect',
    title: 'DegenFeed Connect — Post Everywhere',
    lead: 'Post, schedule, and go live on YouTube, Twitch, Kick, TikTok, Instagram, and LinkedIn — all from one dashboard. Powered by Postiz. Enterprise-grade OAuth.',
    details: [
      {
        title: 'YouTube Integration',
        desc: 'Post videos, schedule uploads, go live, and pull subscriber analytics. OAuth handled by Postiz — no API keys needed.',
      },
      {
        title: 'Twitch & Kick',
        desc: 'Go live notifications, clip sharing, channel management. Set your stream title and category from DegenFeed.',
      },
      {
        title: 'TikTok & Instagram',
        desc: 'Post short-form videos and images, schedule content for peak times, and track engagement across both platforms.',
      },
      {
        title: 'LinkedIn Publishing',
        desc: 'Post articles and professional updates to LinkedIn. Reach your business audience alongside your decentralized followers.',
      },
      {
        title: 'Cross-Platform + Cross-Protocol',
        desc: 'Combine external platforms with decentralized protocols in one post. Write once, publish to YouTube, Nostr, Lens, Twitter, and LinkedIn simultaneously.',
      },
      {
        title: 'Unified Analytics',
        desc: 'Track engagement, views, and follower growth across all external platforms and decentralized protocols in one dashboard.',
      },
    ],
  },
  {
    id: 'live-streaming',
    title: 'Live Streaming',
    lead: 'Stream to 7 protocols simultaneously. Solo streams, Spaces-style audio, collaborative broadcasts, and coin-launch events with live minting.',
    details: [
      {
        title: 'Multi-Protocol Broadcast',
        desc: 'Stream once, broadcast to Twitch, YouTube, PeerTube, Livepeer, Lens, Farcaster, and Nostr simultaneously.',
      },
      {
        title: 'Spaces-Style Audio',
        desc: 'Host audio rooms with on-chain identity. Speaker requests, stage management, and recording to IPFS.',
      },
      {
        title: 'Collaborative Streams',
        desc: 'Invite co-hosts from any protocol. Split revenue, share moderation, and reach combined audiences.',
      },
      {
        title: 'Coin Launch Events',
        desc: 'Launch your creator coin during a live stream. Viewers mint in real-time. Price discovery happens live.',
      },
    ],
  },
  {
    id: 'tipping',
    title: 'Cross-Platform Tipping',
    lead: 'Tip any creator on any protocol in ETH, SOL, USDC, or Lightning. Zero platform fees. We never touch the money.',
    details: [
      {
        title: 'Multi-Chain Payments',
        desc: 'Send tips on Ethereum, Base, Solana, or Lightning. The recipient gets the full amount — no platform cut.',
      },
      {
        title: 'Unified Leaderboard',
        desc: 'See top-tipped creators across all protocols. Rankings update in real-time as tips come in.',
      },
      {
        title: 'Streaming Payments',
        desc: 'Set up recurring tips or pay-per-minute during live streams. Cancel anytime. Fully on-chain.',
      },
      {
        title: 'No Middleman',
        desc: "Tips go directly from your wallet to the creator's wallet. DegenFeed never holds or routes funds.",
      },
    ],
  },
  {
    id: 'aggregation',
    title: 'Content Aggregation',
    lead: '44+ sources fill your unified feed. Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube, PeerTube, and more — all in one timeline.',
    details: [
      {
        title: 'Multi-Source Timeline',
        desc: 'Follow accounts from any protocol and see their posts in one chronological or algorithmic feed.',
      },
      {
        title: 'Smart Filtering',
        desc: 'Filter by protocol, content type, language, or topic. Mute keywords, accounts, or entire protocols.',
      },
      {
        title: 'Real-Time Updates',
        desc: 'New posts appear instantly via WebSocket. No pull-to-refresh needed — the feed stays current.',
      },
      {
        title: 'Cross-Protocol Search',
        desc: 'Search across all indexed protocols simultaneously. Find content regardless of where it was posted.',
      },
    ],
  },
  {
    id: 'publishing',
    title: 'Publishing',
    lead: 'Publish long-form content to Ghost, Mirror, Paragraph, and Forem — all from DegenFeed. Blog posts, newsletters, and web3 publishing in one place.',
    details: [
      {
        title: 'Multi-Platform Publishing',
        desc: 'Write once, publish to your Ghost blog, Mirror entry, Paragraph newsletter, and Forem community simultaneously.',
      },
      {
        title: 'Rich Media Support',
        desc: 'Embed images, video, audio, and interactive web3 components. Mint posts as NFTs on Zora.',
      },
      {
        title: 'Newsletter Integration',
        desc: 'Your DegenFeed posts can double as newsletter issues. Subscribers get email delivery; web3 readers get on-chain versions.',
      },
      {
        title: 'Version History',
        desc: 'Every edit is saved on IPFS. Readers can verify the original timestamp and content integrity.',
      },
    ],
  },
  {
    id: 'video',
    title: 'Video Hub',
    lead: 'Upload once, distribute everywhere. YouTube, PeerTube, Odysee, Rumble, Twitch — one video, all platforms.',
    details: [
      {
        title: 'Cross-Platform Upload',
        desc: 'Upload your video once and distribute to YouTube, PeerTube, Odysee, Rumble, and Twitch simultaneously.',
      },
      {
        title: 'Unified Comments',
        desc: 'Comments from all platforms appear in one thread. Reply anywhere, seen everywhere.',
      },
      {
        title: 'Analytics Cross-Reference',
        desc: 'Compare view counts, engagement rates, and audience retention across all platforms in one dashboard.',
      },
      {
        title: 'Transcoding & Thumbnails',
        desc: 'Automatic transcoding to optimal formats. AI-generated thumbnails that work across platforms.',
      },
    ],
  },
  {
    id: 'shorts',
    title: 'Shorts',
    lead: 'TikTok-style short-form video, multi-protocol. Create once, share everywhere with vertical video optimized for each network.',
    details: [
      {
        title: 'Vertical Video First',
        desc: 'Record or upload vertical video optimized for mobile-first consumption on every protocol.',
      },
      {
        title: 'Cross-Protocol Shorts Feed',
        desc: 'A dedicated feed of short-form content aggregated from all protocols. Swipe up for more.',
      },
      {
        title: 'Remix & Duet',
        desc: 'Remix any short from any protocol. Add your own take, and the original creator gets attribution and a revenue share.',
      },
      {
        title: 'Monetization Ready',
        desc: 'Enable tips on your shorts. Fans can tip in ETH, SOL, or Lightning directly from the player.',
      },
    ],
  },
  {
    id: 'communities',
    title: 'Communities',
    lead: 'Cross-protocol communities with token-gating, moderation tools, and on-chain governance. Your community, your rules.',
    details: [
      {
        title: 'Federated by Design',
        desc: 'Communities span across protocols. A member on Nostr can interact with a member on Farcaster in the same community.',
      },
      {
        title: 'Token Gating',
        desc: 'Restrict access based on token ownership, NFT holdings, or minimum balance. Works across EVM and Solana.',
      },
      {
        title: 'On-Chain Governance',
        desc: 'Proposal and voting systems using your community token. Quadratic voting, delegate systems, and timelocks.',
      },
      {
        title: 'Moderation Tools',
        desc: 'Cross-protocol moderation — mute, ban, or timeout members regardless of which protocol they use.',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    lead: 'Unified metrics across every protocol you use. Track reach, engagement, tips, fan growth, and more in one place.',
    details: [
      {
        title: 'Cross-Protocol Metrics',
        desc: 'See your total reach, engagement rate, and audience growth across all protocols combined.',
      },
      {
        title: 'Per-Protocol Breakdown',
        desc: 'Dive into performance on each protocol individually. Compare what works where.',
      },
      {
        title: 'Revenue Dashboard',
        desc: 'Track tips, coin revenue, subscription income, and ad revenue in one unified view.',
      },
      {
        title: 'Export & Share',
        desc: 'Export your analytics as CSV or PDF. Share public dashboard links with sponsors and partners.',
      },
    ],
  },
  {
    id: 'self-hosted',
    title: 'Self-Hosted Infrastructure',
    lead: 'Your accounts, your data, your rules. Self-host the entire DegenFeed stack with a single command.',
    details: [
      {
        title: 'One-Command Deploy',
        desc: 'Deploy the full DegenFeed stack — relays, indexers, frontend, and storage — with a single Docker Compose command.',
      },
      {
        title: 'Your Own Relays',
        desc: 'Run your own Nostr relays, Farcaster hubs, and AT Protocol PDS. No dependency on third-party infrastructure.',
      },
      {
        title: 'Data Portability',
        desc: 'Export all your data at any time. JSON, CSV, or direct database access. Your content is never locked in.',
      },
      {
        title: 'Custom Frontend',
        desc: 'Fork and customize the DegenFeed frontend. White-label it for your brand or community.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Simple, Transparent Pricing',
    lead: 'Free to use. Premium when you need more. No hidden fees, no surprise charges.',
    details: [],
  },
];

/* ══════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════ */

export default function FeaturesPage() {
  return (
    <div className="landing-page">
      <div className="mx-auto max-w-[1200px]">
        {/* ══════════════ HERO ══════════════ */}
        <section className="features-hero" aria-label="Features overview">
          <h1>
            Everything you need to <span className="gradient-text">own your audience</span>
          </h1>
          <p>
            DegenFeed is the complete toolkit for decentralized creators. Cross-post, earn, stream,
            and build — without giving up control.
          </p>
        </section>

        {/* ══════════════ JUMP NAV ══════════════ */}
        <nav className="features-nav" aria-label="Feature sections">
          {features.map((f) => (
            <a key={f.id} href={`#${f.id}`}>
              {f.title}
            </a>
          ))}
        </nav>

        {/* ══════════════ DETAIL SECTIONS ══════════════ */}
        {features.map((feature) => (
          <FeatureDetailSection key={feature.id} feature={feature} />
        ))}

        {/* ══════════════ PRICING ══════════════ */}
        <section className="feature-detail-section" id="pricing" aria-labelledby="pricing-heading">
          <h2 id="pricing-heading">Simple, Transparent Pricing</h2>
          <p className="lead">
            Start free. Upgrade when you outgrow it. No hidden fees, no surprise charges.
          </p>

          <div className="pricing-grid">
            <PricingCard
              name="Starter"
              price="$0"
              period="forever"
              desc="For casual users exploring decentralized social."
              features={[
                'Browse all protocols',
                'Unified feed',
                'Cross-protocol search',
                'Community access',
              ]}
            />
            <PricingCard
              name="Creator"
              price="$9"
              period="/month"
              desc="For active creators building an audience."
              features={[
                'Cross-post to 15+ protocols',
                'Tipping (0% fee)',
                'Analytics dashboard',
                'Priority support',
              ]}
              featured
            />
            <PricingCard
              name="Pro"
              price="$29"
              period="/month"
              desc="For professional creators and teams."
              features={[
                'Creator Coin deployment',
                'Live streaming',
                'Scheduling & drafts',
                'API access',
                'Team accounts',
              ]}
            />
            <PricingCard
              name="Self-Hosted"
              price="Free"
              period=""
              desc="Run your own infrastructure."
              features={[
                'Full stack deploy',
                'Your own relays',
                'White-label frontend',
                'Unlimited everything',
                'MIT license',
              ]}
            />
          </div>
        </section>

        {/* ══════════════ CTA ══════════════ */}
        <section className="cta-section" aria-labelledby="features-cta">
          <div className="cta-inner">
            <h2 id="features-cta" className="cta-heading">
              Ready to take control?
            </h2>
            <p className="cta-sub">Join 1,200+ creators already building on DegenFeed.</p>
            <div className="hero-ctas">
              <a href="/waitlist" className="cta-primary cta-primary-lg">
                Join the Waitlist
              </a>
              <a href="/feed" className="cta-secondary">
                Browse the Feed
              </a>
            </div>

            <nav className="cta-footer-nav" aria-label="Footer">
              <Link href="/about" className="footer-link">
                About
              </Link>
              <Link href="/docs" className="footer-link">
                Docs
              </Link>
              <Link href="/api-docs" className="footer-link">
                API
              </Link>
              <Link href="/faq" className="footer-link">
                FAQ
              </Link>
              <Link href="/privacy" className="footer-link">
                Privacy
              </Link>
              <Link href="/terms" className="footer-link">
                Terms
              </Link>
              <a
                href="https://github.com/rugmunchmedia/degenfeed"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                GitHub
              </a>
            </nav>

            <p className="cta-copyright">
              &copy; {new Date().getFullYear()} DegenFeed &mdash; open source. Free forever.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Feature Detail Sub-Component ─────────────────────────── */

function FeatureDetailSection({ feature }: { feature: FeatureDetail }) {
  if (feature.id === 'pricing') return null; // handled separately

  return (
    <section
      className="feature-detail-section"
      id={feature.id}
      aria-labelledby={`${feature.id}-heading`}
    >
      <h2 id={`${feature.id}-heading`}>{feature.title}</h2>
      <p className="lead">{feature.lead}</p>

      {feature.details.length > 0 && (
        <div className="feature-detail-grid">
          {feature.details.map((d) => (
            <article key={d.title} className="feature-detail-card">
              <h4>{d.title}</h4>
              <p>{d.desc}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Pricing Card ─────────────────────────────────────────── */

function PricingCard({
  name,
  price,
  period,
  desc,
  features: featureList,
  featured = false,
}: {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <article className={`pricing-card${featured ? ' featured' : ''}`}>
      <h3>{name}</h3>
      <div className="price">
        {price}
        {period && <span>{period}</span>}
      </div>
      <p className="desc">{desc}</p>
      <ul>
        {featureList.map((f) => (
          <li key={f}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <div className="hero-ctas" style={{ marginTop: '1.25rem' }}>
        <a href="/waitlist" className="cta-primary" style={{ width: '100%' }}>
          Get Started
        </a>
      </div>
    </article>
  );
}
