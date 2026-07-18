import type { Metadata } from 'next';

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeURIComponent((await params).name);

  return {
    title: `${name} — DegenFeed`,
    description: `Browse the ${name} community on DegenFeed. Posts, members, and activity across Nostr, Farcaster, and more.`,
    openGraph: {
      title: `${name} — DegenFeed Community`,
      description: `Browse the ${name} community on DegenFeed. Cross-protocol community feed.`,
      url: `https://app.degenfeed.xyz/c/${encodeURIComponent(name)}`,
      images: [
        {
          url: 'https://app.degenfeed.xyz/og-image.png',
          width: 1200,
          height: 630,
          alt: `${name} Community`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} — DegenFeed`,
      description: `Browse the ${name} community on DegenFeed.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/c/${encodeURIComponent(name)}` },
  };
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
