import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorTracker } from '../components/ErrorTracker';
import { SolanaProvider } from '../components/SolanaProvider';
import { Web3Provider } from '../components/Web3Provider';

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: 'DegenFeed — The social feed of web3',
  description:
    'See every network. Zero sign-ups. DegenFeed aggregates Nostr, Farcaster, Lens, Bluesky, Threads, Reddit, and RSS into one window.',
  openGraph: {
    title: 'DegenFeed — The social feed of web3',
    description:
      'See every network. Zero sign-ups. Nostr, Farcaster, Lens, Bluesky, Threads, Reddit, RSS in one window.',
    url: 'https://degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — The social feed of web3',
    description:
      'See every network. Zero sign-ups. Nostr, Farcaster, Lens, Bluesky, Threads, Reddit, RSS in one window.',
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
        <ErrorTracker />
        <SolanaProvider>
          <Web3Provider>
            <AuthProvider>{children}</AuthProvider>
          </Web3Provider>
        </SolanaProvider>
      </body>
    </html>
  );
}
