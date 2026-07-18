import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Muted Accounts — DegenFeed',
  description: 'Manage your muted accounts and content filters across all protocols on DegenFeed.',
  alternates: { canonical: 'https://app.degenfeed.xyz/settings/muted' },
};

export default function MutedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
