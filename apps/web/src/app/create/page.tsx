import type { Metadata } from 'next';
import { CreateHubContent } from '../../components/create/CreateHubContent';

export const metadata: Metadata = {
  title: 'Create — Shorts, Long Video, Live, Posts, Podcasts',
  description:
    'One hub for every format: vertical Loops-style shorts, horizontal long-form, live streams, posts, and podcasts — published everywhere at once.',
  openGraph: {
    title: 'Create — DegenFeed Creator Hub',
    description:
      'Create short or long video, go live, write posts, and record podcasts — publish to every platform in one place.',
    url: 'https://app.degenfeed.xyz/create',
    images: [{ url: 'https://app.degenfeed.xyz/og-image.png', width: 1200, height: 630 }],
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/create' },
};

export default function CreatePage() {
  return <CreateHubContent />;
}
