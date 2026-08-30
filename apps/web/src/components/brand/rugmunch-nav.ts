'use client';

/**
 * RugMunch platform navigation — mirrors rmi-frontend/src/components/layout/
 * SidebarLayout.tsx (the rugmunch.io left-hand nav) exactly: same groups,
 * same items, same labels, same ordering. This makes feed.rugmunch.io read as
 * a sub-page of the Rug Munch Intelligence platform.
 *
 * NOTE on hrefs: rugmunch.io serves these routes via rmi-frontend (a separate
 * SPA from this feed). degenfeed-web does NOT implement /scanner, /rugcharts,
 * /rugmaps, /intelligence, /markets, /alerts, etc. as local routes, so those
 * items are rendered as cross-platform links pointing to the canonical
 * rugmunch.io origin. Items that ARE part of this feed (Feed, News, Pricing,
 * Premium, Discover, Profile) link to local routes.
 */

export interface RugMunchNavItem {
  to: string;
  label: string;
  external?: boolean;
}

export interface RugMunchNavGroup {
  title: string;
  items: RugMunchNavItem[];
}

/** The canonical rugmunch.io origin for platform-only routes. */
export const RUGMUNCH_ORIGIN = 'https://rugmunch.io';

export const RUGMUNCH_NAV: RugMunchNavGroup[] = [
  {
    title: 'Command',
    items: [
      { to: '/', label: 'Dashboard', external: true },
      { to: '/intelligence', label: 'Intel Hub', external: true },
      { to: '/live-threats', label: 'Live Threats', external: true },
      { to: '/feed', label: 'Live Feed' },
      { to: '/alerts', label: 'Threat Alerts', external: true },
      { to: '/chat', label: 'AI Chat', external: true },
    ],
  },
  {
    title: 'Market',
    items: [
      { to: '/markets', label: 'Live Markets', external: true },
      { to: '/market-overview', label: 'Overview', external: true },
      { to: '/market-intel', label: 'Deep Intel', external: true },
      { to: '/markets/breakdown', label: 'Breakdown', external: true },
      { to: '/markets/compare', label: 'Compare', external: true },
      { to: '/news', label: 'News' },
      { to: '/campaigns', label: 'Campaigns', external: true },
    ],
  },
  {
    title: 'Social',
    items: [
      { to: '/feed', label: 'Social Feed' },
      { to: '/community', label: 'Bulletin Board', external: true },
      { to: '/community-forensics', label: 'Forensics Lab', external: true },
      { to: '/blog', label: '@CryptoRugMunch', external: true },
    ],
  },
  {
    title: 'Security',
    items: [
      { to: '/scanner', label: 'Token Scanner', external: true },
      { to: '/wallet', label: 'Wallet Analyzer', external: true },
      { to: '/portfolio', label: 'Portfolio', external: true },
      { to: '/investigate', label: 'Deep Investigation', external: true },
      { to: '/walletsafe', label: 'Wallet Safe', external: true },
    ],
  },
  {
    title: 'Tools & Learn',
    items: [
      { to: '/rugmaps', label: 'RugMaps', external: true },
      { to: '/rugcharts', label: 'RugCharts', external: true },
      { to: '/explorer', label: 'Token Explorer', external: true },
      { to: '/discover', label: 'Discover' },
      { to: '/is-this-a-rug', label: 'Is This a Rug?', external: true },
      { to: '/wallet-checker', label: 'Wallet Checker', external: true },
      { to: '/rug-checker', label: 'Rug Detector', external: true },
      { to: '/scam-lookup', label: 'Scam Database', external: true },
      { to: '/my-cases', label: 'My Cases', external: true },
      { to: '/school', label: 'Scam School', external: true },
      { to: '/rehab', label: 'Rug Pull Rehab', external: true },
      { to: '/hunter', label: 'Leaderboard', external: true },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/ask', label: 'Ask AI', external: true },
      { to: '/tools', label: 'MCP Tools', external: true },
      { to: '/tools/docs', label: 'API Docs', external: true },
      { to: '/market', label: 'Tool Market', external: true },
      { to: '/pricing', label: 'Pricing' },
      { to: '/premium', label: 'Premium' },
      { to: '/hunter', label: 'Hunter Game', external: true },
      { to: '/profile', label: 'Profile' },
    ],
  },
];
