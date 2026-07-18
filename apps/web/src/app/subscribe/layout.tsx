import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscribe — DegenFeed',
  description: 'Support your favorite creators and unlock exclusive content on DegenFeed.',
  alternates: { canonical: 'https://app.degenfeed.xyz/subscribe' },
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
