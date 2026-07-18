import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your DegenFeed account settings, preferences, and privacy.',
  openGraph: {
    title: 'Settings — DegenFeed',
    description: 'Manage your DegenFeed account settings and preferences.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/settings' },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
