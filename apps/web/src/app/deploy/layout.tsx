import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Launch Your Community',
  description:
    'Spin up your own self-hosted Lemmy, PeerTube, or Mastodon instance. DegenFeed handles federation and discovery.',
};

export default function DeployLayout({ children }: { children: React.ReactNode }) {
  return children;
}
