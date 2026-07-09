import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsletter',
  description:
    'Subscribe to the DegenFeed daily digest. Curated web3, crypto, and AI news from 8 protocols delivered to your inbox.',
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
