import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const displayName = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${displayName} — DegenFeed`,
    description: `Custom feed "${displayName}" on DegenFeed. Multi-protocol timeline with curated content.`,
    openGraph: {
      title: `${displayName} — DegenFeed Custom Feed`,
      description: `Custom feed "${displayName}" on DegenFeed.`,
      url: `https://app.degenfeed.xyz/feeds/${encodeURIComponent(id)}`,
      images: [
        {
          url: 'https://app.degenfeed.xyz/og-image.png',
          width: 1200,
          height: 630,
          alt: `${displayName} Feed`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} — DegenFeed`,
      description: `Custom feed "${displayName}" on DegenFeed.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/feeds/${encodeURIComponent(id)}` },
  };
}

export default function FeedDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
