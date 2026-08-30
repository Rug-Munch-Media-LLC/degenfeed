import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans, Syne } from 'next/font/google';
import { headers } from 'next/headers';
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
import { NotificationProvider } from '../hooks/NotificationProvider';
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

/**
 * ⚡ Theme bootstrap — runs synchronously in <head> BEFORE the first paint,
 * before the CSS bundle, and before React hydrates. Prevents the light/blank
 * "shit version" flash on every page (including protocol switches).
 *
 * Resolves the theme from localStorage → df_theme cookie → df-theme cookie
 * (defaults to dark), then sets the `data-theme` attribute AND the
 * `dark`/`light` class on <html> so both the token system (design-tokens.css)
 * and any data-theme consumers agree from the very first frame.
 */
const THEME_BOOTSTRAP_SCRIPT = [
  '(function(){',
  'try{',
  'var t=null;',
  'try{t=localStorage.getItem("df_theme")}catch(e){}',
  'if(!t){var m=document.cookie.match("(^|; )df_theme=([^;]*)(;|$)");t=m?decodeURIComponent(m[2]):null}',
  'if(!t){var m2=document.cookie.match("(^|; )df-theme=([^;]*)(;|$)");t=m2?decodeURIComponent(m2[2]):null}',
  'if(t==="auto"){try{t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e2){t="dark"}}',
  'var theme=(t==="light")?"light":"dark";',
  'var root=document.documentElement;',
  'root.classList.remove("dark","light");',
  'root.classList.add(theme==="dark"?"dark":"light");',
  'root.setAttribute("data-theme",theme);',
  'try{var d=localStorage.getItem("df_layout");if(d)root.classList.add("layout-"+d)}catch(e3){}',
  '}catch(e){}',
  '})();',
].join('');

export const metadata: Metadata = {
  manifest: '/manifest.json',
  applicationName: 'DegenFeed',
  category: 'social',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  metadataBase: new URL('https://app.degenfeed.xyz'),
  title: {
    default: 'DegenFeed — One Protocol for All Web3 Social | Nostr, Farcaster, Lens, Bluesky',
    template: '%s — DegenFeed',
  },
  description:
    'One feed for the open social graph. Read Nostr, Farcaster, Lens, Bluesky, Mastodon and 18+ networks, then cross-post to all of them at once. Bias-rated news, creator coins, no sign-up.',
  keywords: [
    'web3 social media',
    'decentralized social network',
    'one protocol all web3 social',
    'nostr feed',
    'farcaster client',
    'lens protocol app',
    'bluesky aggregator',
    'mastodon reader',
    'multi protocol social feed',
    'crypto news aggregator',
    'fediverse reader',
    'cross protocol posting',
    'web3 social feed',
    'decentralized twitter alternative',
    'open source social media',
    'web3 news feed',
    'decentralized social media',
  ],
  openGraph: {
    title: 'DegenFeed — One Protocol for All Web3 Social',
    description:
      'One feed for the entire open social graph. Nostr, Farcaster, Bluesky, Mastodon + 18 networks and 248 news sources with bias ratings. No sign-up needed.',
    url: 'https://app.degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — One Protocol for All Web3 Social',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — One Protocol for All Web3 Social',
    description:
      'One feed for the entire open social graph. Nostr, Farcaster, Bluesky, Mastodon + 18 networks with bias-rated news.',
    images: ['/og-image.png'],
    creator: '@degenfeed',
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
    languages: {
      en: 'https://app.degenfeed.xyz',
      'x-default': 'https://app.degenfeed.xyz',
    },
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
  // Read CSP nonce from middleware-injected request header
  const headersList = await headers();
  const nonce = headersList.get('x-csp-nonce') || '';

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`dark ${plusJakarta.variable} ${syne.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* ⚡ SSR-safe theme: sync cookie/localStorage to <html> BEFORE first paint to prevent flash */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {/* == Critical CSS inlining — above-the-fold styles, in <head> so the
             dark background is guaranteed before the CSS bundle arrives == */}
        <style nonce={nonce} data-critical="1">
          {[
            'html{background:#000}',
            'body{--bg:#000;--fg:#e7e9ea;background:var(--bg);color:var(--fg);margin:0;font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
            '.skip-link{position:absolute;top:-100%;left:0;z-index:100;padding:8px 16px;background:var(--color-accent,#1d9bf0);color:#fff;font-weight:600}',
            '.skip-link:focus{top:0}',
            '.scanline{position:fixed;inset:0;pointer-events:none;z-index:9998;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)}',
            'img,video{max-width:100%;height:auto;vertical-align:middle}',
            '@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}',
          ].join('')}
        </style>
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {/* == PWA platform tags == */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DegenFeed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="DegenFeed" />
        <link rel="icon" href="/avatar.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/avatar.jpg" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link
          rel="apple-touch-startup-image"
          href="/icon-512.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link rel="mask-icon" href="/favicon-32.png" color="#00ff41" />
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
        <link rel="preload" href="/degenfeedlogo-nav.png" as="image" fetchPriority="high" />

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
                'The Web3 Social Universe. One free feed for Nostr, Farcaster, Lens, Bluesky, Mastodon, and 248 news sources with bias ratings and blindspot detection.',
              applicationCategory: 'SocialNetworkingApplication',
              operatingSystem: 'All',
              inLanguage: 'en',
              offers: {
                '@type': 'AggregateOffer',
                lowPrice: '0',
                highPrice: '24.99',
                priceCurrency: 'USD',
                offers: [
                  { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
                  { '@type': 'Offer', name: 'Pro', price: '9.99', priceCurrency: 'USD' },
                  { '@type': 'Offer', name: 'Creator+', price: '24.99', priceCurrency: 'USD' },
                ],
              },
              author: {
                '@type': 'Organization',
                name: 'Rug Munch Media LLC',
                url: 'https://app.degenfeed.xyz',
              },
              featureList: [
                'Multi-protocol feed aggregation across 30+ live protocols',
                'Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube, and more',
                '248 news sources with bias ratings and blindspot detection',
                'Cross-protocol posting to every network at once',
                'Real-time notifications and live streaming',
                'Creator coins and tipping on Base + Solana',
                'Open source (MIT), self-hostable, zero sign-up to read',
              ],
            }),
          }}
        />
        <SolanaProvider>
          <Web3Provider>
            <ToastProvider>
              <AuthProvider>
                <RealtimeClientProvider>
                  {/* NotificationProvider needs useAuth (AuthProvider) and
                      useRealtimeContext (RealtimeClientProvider → WebSocketProvider),
                      so it must sit inside both. Mounting it here revives the
                      notification bell, the /notifications page, and markAllRead. */}
                  <NotificationProvider>
                    <TelegramProvider>
                      <GlobalErrorBoundary>
                        <main id="main-content">
                          <ConditionalShell>{children}</ConditionalShell>
                        </main>
                      </GlobalErrorBoundary>
                    </TelegramProvider>
                  </NotificationProvider>
                </RealtimeClientProvider>
              </AuthProvider>
            </ToastProvider>
          </Web3Provider>
        </SolanaProvider>
      </body>
    </html>
  );
}
