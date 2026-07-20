import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ConditionalShell } from '../components/ConditionalShell';
import { ErrorTracker } from '../components/ErrorTracker';
import { GlobalErrorBoundary } from '../components/GlobalErrorBoundary';
import { RealtimeClientProvider } from '../components/RealtimeClientProvider';
import { SolanaProvider } from '../components/SolanaProvider';
import { ToastProvider } from '../components/Toast';
import { Web3Provider } from '../components/Web3Provider';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' });
const sora = Sora({ subsets: ['latin'], display: 'swap', variable: '--font-heading' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  manifest: '/manifest.json',
  metadataBase: new URL('https://app.degenfeed.xyz'),
  title: {
    default: 'DegenFeed — Web3 Social Media Aggregator | Nostr, Farcaster, Lens, Bluesky',
    template: '%s — DegenFeed',
  },
  description:
    'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified feed. Cross-post across protocols, tip creators in crypto, and follow web3 communities without switching apps.',
  keywords: [
    'nostr feed',
    'farcaster client',
    'lens protocol app',
    'bluesky aggregator',
    'mastodon reader',
    'fediverse cross-post',
    'web3 social feed',
    'crypto tipping app',
    'multi protocol social',
    'decentralized social media',
  ],
  openGraph: {
    title: 'DegenFeed — Web3 Social Media Aggregator | Nostr, Farcaster, Lens, Bluesky',
    description:
      'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified feed. Cross-post across protocols, tip creators in crypto, and follow web3 communities without switching apps.',
    url: 'https://app.degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — Web3 social media aggregator connecting Nostr, Farcaster, Lens, Bluesky, Mastodon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — Web3 Social Media Aggregator',
    description:
      'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS in one unified feed. Cross-post and tip creators in crypto.',
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
    <html
      lang="en"
      className={`${theme} ${inter.variable} ${sora.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {/* ⚡ SSR-safe theme: sync localStorage before paint to prevent flash */}
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
        {/* == PWA platform tags == */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DegenFeed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="DegenFeed" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Windows PWA */}
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* == LCP: Preconnect to critical origins == */}
        <link rel="preconnect" href="https://app.degenfeed.xyz" />
        <link rel="preconnect" href="https://degenfeed.xyz" />
        <link rel="preconnect" href="https://community.degenfeed.xyz" />
        <link rel="preconnect" href="https://video.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://app.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://community.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://video.degenfeed.xyz" />
        <link rel="dns-prefetch" href="https://pbs.twimg.com" />
        <link rel="dns-prefetch" href="https://cdn.bsky.app" />

        {/* == LCP: Defer non-critical third-party scripts == */}
        <link rel="preload" href="/icon.svg" as="image" fetchPriority="high" />
        <link rel="preload" href="/icon-192.png" as="image" fetchPriority="high" />

        {/* == Critical CSS inlining — above-the-fold styles (<14KB) == */}
        <style data-critical="1">
          {[
            'body{--bg:#000;--fg:#e7e9ea;background:var(--bg);color:var(--fg);margin:0;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}',
            'html:not(.dark) body{--bg:#fff;--fg:#171717}',
            '.skip-link{position:absolute;top:-100%;left:0;z-index:100;padding:8px 16px;background:var(--color-accent,#16a34a);color:#000;font-weight:600}',
            '.skip-link:focus{top:0}',
            '.aurora-bg{position:fixed;inset:0;pointer-events:none;z-index:0}',
            '.noise-overlay{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:.03}',
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
        />
        <Script
          id="sw-register"
          strategy="afterInteractive"
        >{`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`}</Script>
        {/* JSON-LD structured data — tiny payload, no render impact */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'DegenFeed',
              url: 'https://app.degenfeed.xyz',
              description:
                'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified feed. Cross-post across protocols, tip creators in crypto, and follow web3 communities without switching apps.',
              applicationCategory: 'SocialNetworkingApplication',
              operatingSystem: 'All',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: {
                '@type': 'Organization',
                name: 'Rug Munch Media LLC',
                url: 'https://app.degenfeed.xyz',
              },
              screenshot: { '@type': 'ImageObject', url: 'https://app.degenfeed.xyz/og-image.png' },
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
                    <main id="main-content">
                      <ConditionalShell>{children}</ConditionalShell>
                    </main>
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
