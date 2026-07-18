import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline — DegenFeed',
  description:
    'You are offline. DegenFeed needs a network connection to display your unified social feed.',
};

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
