import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discover',
  description:
    'Discover trending accounts and communities across the Fediverse. Browse popular Mastodon, Lemmy, and ActivityPub profiles.',
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
