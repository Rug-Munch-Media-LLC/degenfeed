import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ — DegenFeed',
  description:
    'Frequently asked questions about DegenFeed, the open-source web3 social aggregator.',
};

const faqs = [
  {
    q: 'What is DegenFeed?',
    a: 'DegenFeed is an open-source multi-protocol social aggregator for web3. It displays posts from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS feeds in a single unified timeline. No account is needed to browse.',
  },
  {
    q: 'How does aggregation work?',
    a: 'We pull public posts from each protocol via their open APIs, normalize them to a common format, rank them by engagement and recency, and display them in your feed. Nothing is stored or archived beyond what is needed to serve feeds.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Browsing DegenFeed is completely free and requires no sign-up. Creating an account unlocks posting, tipping, cross-posting across protocols, and a free @degenfeed.xyz handle on the Fediverse.',
  },
  {
    q: 'Is DegenFeed open source?',
    a: 'Yes. DegenFeed is licensed under AGPL-3.0. The full source code is available on git.rugmunch.io and codeberg.org. Contributions are welcome — see CONTRIBUTING.md for guidelines.',
  },
  {
    q: 'What is the premium tier?',
    a: 'Premium ($5/mo) adds advanced filtering, custom feeds, noise reduction, and priority support. Creator tier ($15/mo) unlocks analytics, cross-posting, and post scheduling.',
  },
  {
    q: 'How do I get a @degenfeed.xyz handle?',
    a: 'Visit social.degenfeed.xyz, connect your wallet, and request an account with a brief reason for joining. Approvals are usually processed within 24 hours. Your handle works across the entire Fediverse via ActivityPub.',
  },
  {
    q: 'How does federation work?',
    a: 'DegenFeed runs a GotoSocial instance at social.degenfeed.xyz that federates via ActivityPub. This means your @degenfeed.xyz account can follow and be followed by users on Mastodon, Lemmy, Pixelfed, and other Fediverse platforms.',
  },
  {
    q: "What is ActivityPub?",
    a: 'ActivityPub is a W3C standard for decentralized social networking. It powers Mastodon, Lemmy, Pixelfed, PeerTube, GotoSocial, and millions of federated accounts. It is the protocol that makes the Fediverse work without a central server.',
  },
  {
    q: 'Can I post from DegenFeed?',
    a: 'Yes. Connect your accounts (Nostr, Bluesky, Mastodon, Farcaster, Lens) and use the DegenFeed composer. Posts are sent directly to your chosen protocol. You can cross-post to multiple protocols simultaneously with a Creator subscription.',
  },
  {
    q: 'What wallets are supported?',
    a: 'Solana wallets (Phantom, Backpack, Solflare) and EVM wallets (MetaMask, Rainbow, WalletConnect). Wallets are used for sign-in and for tipping creators.',
  },
  {
    q: 'How do tips work?',
    a: 'Tip ETH, SOL, or USDC directly to any post. Tips go directly to the creator\'s wallet with no intermediary. Lightning Network support is in development.',
  },
  {
    q: 'Is my data sold?',
    a: 'No. DegenFeed does not sell data, does not run ads, and does not track users beyond what is needed to serve feeds. Premium subscriptions fund development.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Data deletion is available via /api/account/delete. For GotoSocial accounts, manage your account at social.degenfeed.xyz.',
  },
  {
    q: 'Is there an RSS feed?',
    a: 'Yes. Subscribe to /api/feed/rss.xml in your RSS reader to get DegenFeed\'s top posts. Atom format is also available at /api/feed/atom.xml.',
  },
  {
    q: 'How do I report content?',
    a: 'Use the report button on any post, or email admin@rugmunch.io. For copyright concerns, contact dmca@degenfeed.xyz.',
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-white">Frequently Asked Questions</h1>

      <div className="space-y-6">
        {faqs.map((faq, i) => (
          <div key={i}>
            <h2 className="mb-1 text-base font-semibold text-white">{faq.q}</h2>
            <p>{faq.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 border-t border-gray-800 pt-6 text-gray-500">
        Don&apos;t see your question? Reach out to{' '}
        <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
          admin@rugmunch.io
        </a>
        .
      </p>
    </div>
  );
}
