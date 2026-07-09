import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorTracker } from '../components/ErrorTracker';
import { Shell } from '../components/Shell';
import { SolanaProvider } from '../components/SolanaProvider';
import { ToastProvider } from '../components/Toast';
import { Web3Provider } from '../components/Web3Provider';

export const metadata: Metadata = {
  manifest: '/manifest.json',
  metadataBase: new URL('https://degenfeed.xyz'),
  title: {
    default: 'DegenFeed — The social feed of web3',
    template: '%s — DegenFeed',
  },
  description:
    'See every network. Zero sign-ups. DegenFeed aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one window.',
  openGraph: {
    title: 'DegenFeed — The social feed of web3',
    description:
      'See every network. Zero sign-ups. Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS in one window.',
    url: 'https://degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — The social feed of web3',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  alternates: {
    canonical: 'https://degenfeed.xyz',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ErrorTracker />
        <Script
          defer
          data-domain="degenfeed.xyz"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        <Script
          id="sw-register"
          strategy="afterInteractive"
        >{`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}</Script>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'DegenFeed',
              url: 'https://degenfeed.xyz',
              description:
                'Open-source multi-protocol social aggregator for web3. Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS in one feed.',
              applicationCategory: 'SocialNetworkingApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              author: {
                '@type': 'Organization',
                name: 'Rug Munch Media LLC',
                url: 'https://degenfeed.xyz',
              },
            }),
          }}
        />
        <SolanaProvider>
          <Web3Provider>
            <ToastProvider>
              <AuthProvider>
                <Shell>{children}</Shell>
              </AuthProvider>
            </ToastProvider>
          </Web3Provider>
        </SolanaProvider>
      </body>
    </html>
  );
}
