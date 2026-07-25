import type { Metadata } from 'next';

interface Props {
  params: { handle: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = params.handle;
  const title = handle ? `${handle} — DegenFeed Profile` : 'Profile — DegenFeed';

  return {
    title,
    description: `View the unified cross-protocol profile for ${handle} on DegenFeed.`,
    openGraph: {
      title,
      description: `Cross-protocol profile for ${handle} — Nostr, Farcaster, Bluesky, Lens, and more.`,
      url: `https://app.degenfeed.xyz/profile/${handle}`,
      images: [
        {
          url: 'https://app.degenfeed.xyz/og-image.png',
          width: 1200,
          height: 630,
          alt: 'DegenFeed Profile',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: `Cross-protocol profile for ${handle} on DegenFeed.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/profile/${handle}` },
  };
}

export default function ProfileHandleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
