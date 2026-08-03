import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans, Syne } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import Script from 'next/script';

import '../styles/design-tokens.css';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ConditionalShell } from '../components/ConditionalShell';
import { ErrorTracker } from '../components/ErrorTracker';
import { GlobalErrorBoundary } from '../components/GlobalErrorBoundary';
import { RealtimeClientProvider } from '../components/RealtimeClientProvider';
import { SolanaProvider } from '../components/SolanaProvider';
import { ToastProvider } from '../components/Toast';
import { Web3Provider } from '../components/Web3Provider';
import { TelegramProvider } from '../lib/telegram-provider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
});

const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.ico',
    apple: '/icon-192.png',
  },
  metadataBase: new URL('https://app.degenfeed.xyz'),
  title: {
    default: 'DegenFeed — The Web3 Social Universe | Nostr, Farcaster, Lens, Bluesky',
    template: '%s — DegenFeed',
  },
  description:
    'The Web3 Social Universe. Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, and more into one unified feed. Cross-post, tip creators in crypto, and follow web3 communities without switching apps.',
  keywords: [
    'nostr feed',
    'farcaster client',
    'lens protocol app',
    'bluesky aggregator',
    'mastodon reader',
    '101+ protocols',
    'fediverse cross-post',
    'web3 social feed',
    'crypto tipping app',
    'multi protocol social',
    'decentralized social media',
  ],
  openGraph: {
    title: 'DegenFeed — The Web3 Social Universe',
    description:
      'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, and more into one unified feed. Cross-post and tip creators in crypto.',
    url: 'https://app.degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — The Web3 Social Universe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — The Web3 Social Universe',
    description:
      'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, and more in one unified feed. Cross-post and tip creators in crypto.',
    images: ['/og-image.png'],
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
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const _theme = cookieStore.get('df_theme')?.value || 'dark';

  // Read CSP nonce from middleware-injected request header
  const headersList = await headers();
  const nonce = headersList.get('x-csp-nonce') || '';

  return (
    <html
      lang="en"
      className={`dark ${plusJakarta.variable} ${syne.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {/* ⚡ SSR-safe theme: sync localStorage before paint to prevent flash */}
        <script
          nonce={nonce}
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
        {/* == PWA platform tags == */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DegenFeed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="DegenFeed" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link
          rel="apple-touch-startup-image"
          href="/icon-512.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link rel="mask-icon" href="/icon.svg" color="#1d9bf0" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="msapplication-TileImage" content="/icon-512.png" />

        {/* == RSS / Atom feed autodiscovery links == */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="DegenFeed — Unified Protocol Feed"
          href="https://app.degenfeed.xyz/api/feed/rss"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title="DegenFeed — Unified Protocol Feed (Atom)"
          href="https://app.degenfeed.xyz/api/feed/atom"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="DegenFeed — News Feed"
          href="https://app.degenfeed.xyz/api/feed/news?format=rss"
        />

        {/* == LCP: Preconnect to critical origins == */}
        <link rel="preconnect" href="https://app.degenfeed.xyz" />
        <link rel="preconnect" href="https://degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://app.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://pbs.twimg.com" />
        <link rel="dns-prefetch" href="https://cdn.bsky.app" />

        {/* == LCP: Preload critical assets == */}
        <link rel="preload" href="/icon.svg" as="image" fetchPriority="high" />

        {/* == Critical CSS inlining — above-the-fold styles == */}
        <style nonce={nonce} data-critical="1">
          {[
            'body{--bg:#000;--fg:#e7e9ea;background:var(--bg);color:var(--fg);margin:0;font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
            '.skip-link{position:absolute;top:-100%;left:0;z-index:100;padding:8px 16px;background:var(--color-accent,#1d9bf0);color:#fff;font-weight:600}',
            '.skip-link:focus{top:0}',
            '.scanline{position:fixed;inset:0;pointer-events:none;z-index:9998;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)}',
            'img,video{max-width:100%;height:auto;vertical-align:middle}',
            '@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}',
          ].join('')}
        </style>

        <ErrorTracker />
        <Script
          defer
          data-domain="degenfeed.xyz"
          src="https://plausible.rugmunch.io/js/script.js"
          strategy="afterInteractive"
          nonce={nonce}
        />
        <Script
          id="sw-register"
          strategy="afterInteractive"
          nonce={nonce}
        >{`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}</Script>
        {/* Scanline overlay for cyberpunk texture */}
        <div className="scanline" aria-hidden="true" />
        {/* JSON-LD structured data — BreadcrumbList */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              name: 'DegenFeed Breadcrumb',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: 'https://app.degenfeed.xyz',
                },
              ],
            }),
          }}
        />
        {/* JSON-LD structured data — Organization */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Rug Munch Media LLC',
              url: 'https://app.degenfeed.xyz',
              logo: 'https://app.degenfeed.xyz/icon-512.png',
              sameAs: ['https://github.com/degenfeed', 'https://git.rugmunch.io/RugMunchMedia'],
              description: 'Creator of DegenFeed — The Web3 Social Universe',
              foundingDate: '2024',
              legalName: 'Rug Munch Media LLC',
              address: {
                '@type': 'PostalAddress',
                addressCountry: 'US',
                addressRegion: 'WY',
              },
            }),
          }}
        />
        {/* JSON-LD structured data — WebApplication */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'DegenFeed',
              url: 'https://app.degenfeed.xyz',
              description:
                'The Web3 Social Universe. Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
              applicationCategory: 'SocialNetworkingApplication',
              operatingSystem: 'All',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: {
                '@type': 'Organization',
                name: 'Rug Munch Media LLC',
                url: 'https://app.degenfeed.xyz',
              },
              featureList: [
                'Multi-protocol feed aggregation across 101+ protocols',
                'Nostr, Farcaster, Lens, Bluesky, Mastodon, PeerTube, and more',
                'Cross-protocol search',
                'Real-time notifications',
                'Creator coins and tipping on Base + Solana',
                'Live streaming across protocols',
              ],
            }),
          }}
        />
        <SolanaProvider>
          <Web3Provider>
            <ToastProvider>
              <AuthProvider>
                <RealtimeClientProvider>
                  <TelegramProvider>
                    <GlobalErrorBoundary>
                      <main id="main-content">
                        <ConditionalShell>{children}</ConditionalShell>
                      </main>
                    </GlobalErrorBoundary>
                  </TelegramProvider>
                </RealtimeClientProvider>
              </AuthProvider>
            </ToastProvider>
          </Web3Provider>
        </SolanaProvider>
      </body>
    </html>
  );
}
