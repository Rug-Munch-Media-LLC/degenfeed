import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'DegenFeed',
  description: 'Multi-protocol social aggregator — docs',
  lang: 'en-US',
  base: '/docs/',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [/^\.\/LICENSE$/, /^\.\.\//, /^\.\/\.\.\//],

  head: [
    ['link', { rel: 'icon', href: '/icon.svg' }],
    ['meta', { name: 'theme-color', content: '#00ff41' }],
  ],

  themeConfig: {
    logo: '/icon.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'API', link: '/api/' },
      { text: 'App', link: 'https://app.degenfeed.xyz' },
    ],

    sidebar: {
      '/guide/': [
        { text: 'Getting Started', link: '/guide/' },
        { text: 'Protocols', link: '/guide/protocols' },
        { text: 'Authentication', link: '/guide/auth' },
        { text: 'Composer', link: '/guide/composer' },
        { text: 'Tipping', link: '/guide/tipping' },
        { text: 'Notifications', link: '/guide/notifications' },
        { text: 'Self-Hosted Community', link: '/guide/self-host' },
      ],
      '/architecture/': [
        { text: 'Overview', link: '/architecture/' },
        { text: 'Frontend', link: '/architecture/frontend' },
        { text: 'Worker API', link: '/architecture/worker' },
        { text: 'Protocol SDKs', link: '/architecture/sdks' },
        { text: 'Feed Pipeline', link: '/architecture/feed-pipeline' },
        { text: 'Ranking', link: '/architecture/ranking' },
        { text: 'Deployment', link: '/architecture/deployment' },
      ],
      '/api/': [
        { text: 'Overview', link: '/api/' },
        { text: 'Feed', link: '/api/feed' },
        { text: 'Authentication', link: '/api/auth' },
        { text: 'Publishing', link: '/api/publish' },
        { text: 'Engagement', link: '/api/engage' },
        { text: 'Notifications', link: '/api/notifications' },
        { text: 'Preferences', link: '/api/preferences' },
        { text: 'Tips', link: '/api/tips' },
        { text: 'Features', link: '/api/features' },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web' }],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Copyright © 2026 Rug Munch Media LLC',
    },

    editLink: {
      pattern: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web/_edit/main/docs/:path',
      text: 'Edit this page on Forgejo',
    },
  },
});
