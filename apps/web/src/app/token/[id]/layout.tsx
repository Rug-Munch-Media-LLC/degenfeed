import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const shortId = id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;

  return {
    title: `${shortId} — DegenFeed`,
    description: `Token page on DegenFeed. View posts, charts, and community discussions about token ${shortId}.`,
    openGraph: {
      title: `${shortId} — DegenFeed Token`,
      description: `Token page on DegenFeed. Discussions, charts, and community activity.`,
      url: `https://app.degenfeed.xyz/token/${encodeURIComponent(id)}`,
      images: [
        {
          url: 'https://app.degenfeed.xyz/og-image.png',
          width: 1200,
          height: 630,
          alt: `${shortId} Token`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${shortId} — DegenFeed`,
      description: `Token page on DegenFeed.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/token/${encodeURIComponent(id)}` },
  };
}

export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
