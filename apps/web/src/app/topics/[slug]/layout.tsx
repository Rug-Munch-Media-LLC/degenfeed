import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const label = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${label} — DegenFeed`,
    description: `Browse posts about ${label} on DegenFeed. Discussions across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.`,
    openGraph: {
      title: `${label} — DegenFeed`,
      description: `Browse posts about ${label} across the open social web.`,
      url: `https://app.degenfeed.xyz/topics/${encodeURIComponent(slug)}`,
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
      description: `Browse posts about ${label} across the open social web.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/topics/${encodeURIComponent(slug)}` },
  };
}

export default function TopicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
