import type { Metadata } from 'next';

interface Props {
  params: Promise<{ protocol: string }>;
  children: React.ReactNode;
}

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens Protocol',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  reddit: 'Reddit',
  rss: 'RSS/News',
  threads: 'Threads',
  lemmy: 'Lemmy',
  pixelfed: 'Pixelfed',
  peertube: 'PeerTube',
  zora: 'Zora',
  telegram: 'Telegram',
  discord: 'Discord',
  github: 'GitHub',
  youtube: 'YouTube',
  audius: 'Audius',
  rarible: 'Rarible',
  hive: 'Hive',
  misskey: 'Misskey',
  pleroma: 'Pleroma',
  mirror: 'Mirror.xyz',
  paragraph: 'Paragraph',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { protocol } = await params;
  const label = PROTOCOL_LABELS[protocol] ?? protocol.charAt(0).toUpperCase() + protocol.slice(1);

  return {
    title: `${label} Feed — DegenFeed`,
    description: `Browse ${label} posts on DegenFeed. Aggregated from the ${label} network alongside the broader web3 social ecosystem.`,
    openGraph: {
      title: `${label} — DegenFeed`,
      description: `Browse ${label} posts across the open social web on DegenFeed.`,
      url: `https://app.degenfeed.xyz/feed/${protocol}`,
      images: [
        {
          url: 'https://app.degenfeed.xyz/og-image.png',
          width: 1200,
          height: 630,
          alt: `${label} on DegenFeed`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${label} — DegenFeed`,
      description: `Browse ${label} posts across the open social web.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/feed/${protocol}` },
  };
}

export default function ProtocolFeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
