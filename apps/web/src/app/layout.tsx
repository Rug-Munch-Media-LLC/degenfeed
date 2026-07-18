import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ErrorTracker } from '../components/ErrorTracker';
import { GlobalErrorBoundary } from '../components/GlobalErrorBoundary';
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
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — The social feed of web3',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — The social feed of web3',
    description:
      'See every network. Zero sign-ups. Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS in one window.',
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
  other: {
    'google-site-verification': 'degenfeed-google-site-verification',
    'theme-color': '#000000',
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

        {/* ── LCP: Preconnect to critical origins ── */}
        <link rel="preconnect" href="https://cdn.degenfeed.xyz" />
        <link rel="preconnect" href="https://community.degenfeed.xyz" />
        <link rel="preconnect" href="https://video.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://cdn.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://community.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://video.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://pbs.twimg.com" />
        <link rel="dns-prefetch" href="https://cdn.bsky.app" />

        {/* ── LCP: Defer non-critical third-party scripts ── */}
        <link rel="preload" href="/icon.svg" as="image" fetchPriority="high" />
        <link rel="preload" href="/icon-192.png" as="image" fetchPriority="high" />

        {/* ── Critical CSS inlining — above-the-fold styles ── */}
        <style dangerouslySetInnerHTML={{
          __html: [
            'body{--bg:#000;--fg:#e7e9ea;background:var(--bg);color:var(--fg);margin:0;font-family:Inter,system-ui,sans-serif}',
            '.dark body,html.dark body{--bg:#000;--fg:#e7e9ea}',
            'html:not(.dark) body{--bg:#fff;--fg:#171717}',
            '.shell-header{height:64px;position:fixed;top:0;left:0;right:0;z-index:50}',
            '.skip-link{position:absolute;top:-100%;left:0;z-index:100;padding:8px 16px}',
            '.skip-link:focus{top:0}',
            '.main-content{padding-top:64px}',
            '@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}',
          ].join(''),
        }} />

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
                'The web3 social super app — every network, one feed. Aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS.',
              applicationCategory: 'SocialNetworkingApplication',
              operatingSystem: 'All',
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
              screenshot: {
                '@type': 'ImageObject',
                url: 'https://app.degenfeed.xyz/og-image.png',
              },
              featureList: [
                'Multi-protocol feed aggregation',
                'Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS',
                'Cross-protocol search',
                'Real-time notifications',
                'Token and community pages',
                'Premium subscriptions',
              ],
            }),
          }}
        />
        <SolanaProvider>
          <Web3Provider>
            <ToastProvider>
              <AuthProvider>
                <RealtimeClientProvider>
                  <GlobalErrorBoundary>
                    <Shell>{children}</Shell>
                  </GlobalErrorBoundary>
                </RealtimeClientProvider>
              </AuthProvider>
            </ToastProvider>
          </Web3Provider>
        </SolanaProvider>
      </body>
    </html>
  );
}
