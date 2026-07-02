import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DegenFeed — The social feed of web3',
  description:
    'Sign in once. Read every network. Write everywhere. DegenFeed aggregates Nostr, Farcaster, Lens, and Bluesky into one window.',
  openGraph: {
    title: 'DegenFeed — The social feed of web3',
    description: 'One composer. Four protocols. Zero switching apps.',
    url: 'https://degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — The social feed of web3',
    description: 'One composer. Four protocols. Zero switching apps.',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black text-gray-200 antialiased">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
