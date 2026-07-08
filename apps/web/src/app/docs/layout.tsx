import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'DegenFeed documentation — API reference, protocol integration, self-hosting, and architecture. Open-source web3 social aggregator.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
