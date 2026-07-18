import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tips — DegenFeed',
  description:
    'View your cross-protocol tip history. Tips sent and received across Nostr zaps, Farcaster, Lens, and Solana.',
  alternates: { canonical: 'https://app.degenfeed.xyz/activity/tips' },
};

export default function TipsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
