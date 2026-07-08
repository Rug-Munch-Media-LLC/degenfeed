import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your DegenFeed profile, connected wallets, and social accounts.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
