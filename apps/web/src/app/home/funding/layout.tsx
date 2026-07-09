import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Funding',
  description:
    'Track crypto funding rounds, VC raises, and investment news across the web3 ecosystem.',
};

export default function FundingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
