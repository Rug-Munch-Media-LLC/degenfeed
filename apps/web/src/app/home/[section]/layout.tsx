export const runtime = 'edge';

import type { Metadata } from 'next';
import { SECTIONS } from '../sections';

interface Props {
  params: Promise<{ section: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const label = SECTIONS.find((s) => s.id === section)?.label ?? section;
  return {
    title: label,
    description: `Browse ${label} posts on DegenFeed. ${SECTIONS.find((s) => s.id === section)?.description ?? ''}`,
    openGraph: {
      title: `Browse ${label} — DegenFeed`,
      description: `Browse ${label} posts across the open social web on DegenFeed.`,
      url: `https://app.degenfeed.xyz/home/${section}`,
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
      title: `Browse ${label} — DegenFeed`,
      description: `Browse ${label} posts across the open social web.`,
    },
    alternates: { canonical: `https://app.degenfeed.xyz/home/${section}` },
  };
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
