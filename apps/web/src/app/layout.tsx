import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorTracker } from '../components/ErrorTracker';
import { RealtimeClientProvider } from '../components/RealtimeClientProvider';
import { Shell } from '../components/Shell';
import { SolanaProvider } from '../components/SolanaProvider';
import { ToastProvider } from '../components/Toast';
import { Web3Provider } from '../components/Web3Provider';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  manifest: '/manifest.json',
  metadataBase: new URL('https://app.degenfeed.xyz'),
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
    url: 'https://app.degenfeed.xyz',
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
    canonical: 'https://app.degenfeed.xyz',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'light dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('df_theme')?.value || 'dark';

  return (
    <html lang="en" className={`${theme} ${inter.className}`} suppressHydrationWarning>
      <body className="page-transition-enter">
        {/* ⚡ SSR-safe theme: sync localStorage before paint to prevent flash */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline script reads localStorage to prevent theme + density flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: [
              '(function(){',
              'try{',
              'var t=localStorage.getItem("df_theme");',
              'if(t==="light")document.documentElement.classList.remove("dark");',
              'if(t==="dark")document.documentElement.classList.add("dark");',
              'var d=localStorage.getItem("df_layout");',
              'if(d)document.documentElement.classList.add("layout-"+d);',
              '}catch(e){}',
              '})();',
            ].join(''),
          }}
        />
        {/* ── PWA platform tags ── */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DegenFeed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="DegenFeed" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Windows PWA */}
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        <ErrorTracker />
        <Script
          defer
          data-domain="degenfeed.xyz"
          src="https://plausible.rugmunch.io/js/script.js"
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
              url: 'https://app.degenfeed.xyz',
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
                url: 'https://app.degenfeed.xyz',
              },
            }),
          }}
        />
        <SolanaProvider>
          <Web3Provider>
            <ToastProvider>
              <AuthProvider>
                <RealtimeClientProvider>
                  <Shell>{children}</Shell>
                </RealtimeClientProvider>
              </AuthProvider>
            </ToastProvider>
          </Web3Provider>
        </SolanaProvider>
      </body>
    </html>
  );
}
