import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Premium',
  description:
    'Unlock advanced filtering, custom feeds, noise reduction, analytics, and cross-posting. $5/mo Pro, $15/mo Creator.',
};

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
