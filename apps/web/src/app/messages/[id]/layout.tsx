import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conversation — DegenFeed',
  description: 'Cross-protocol direct message conversation on DegenFeed.',
  openGraph: {
    title: 'Conversation — DegenFeed',
    description: 'Cross-protocol DM conversation on DegenFeed.',
    url: 'https://app.degenfeed.xyz/messages',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Messages',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Conversation — DegenFeed',
    description: 'Cross-protocol DM conversation.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/messages' },
};

export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
