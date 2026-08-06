import type { Metadata } from 'next';
import { TroubleshootingClient } from './troubleshooting-client';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Troubleshooting Guide — DegenFeed',
  description:
    'Fix common DegenFeed issues: empty feeds, posts not publishing, tips failing, degraded protocols, account linking problems, slow app performance, and broken notifications.',
  keywords: [
    'degenfeed troubleshooting',
    'empty feed fix',
    'post not publishing',
    'tip failed',
    'protocol degraded',
    'link account error',
    'degenfeed slow',
    'notifications not working',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/troubleshooting' },
  openGraph: {
    title: 'Troubleshooting Guide — DegenFeed',
    description:
      'Step-by-step fixes for common DegenFeed issues: empty feeds, publishing failures, tips, degraded protocols, account linking, performance, and notifications.',
    url: 'https://app.degenfeed.xyz/docs/troubleshooting',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Troubleshooting Guide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Troubleshooting Guide — DegenFeed',
    description:
      'Step-by-step fixes for common DegenFeed issues: feeds, publishing, tips, protocols, accounts, and notifications.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

export default function TroubleshootingPage() {
  return <TroubleshootingClient />;
}
