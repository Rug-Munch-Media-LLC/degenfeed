// @ts-check
// Docusaurus config for DegenFeed Docs.
// Brand: matrix-green accent (#00ff41) on black.

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'DegenFeed Docs',
  tagline: 'One feed. Every decentralized protocol.',
  favicon: 'img/favicon.ico',

  url: 'https://degenfeed.xyz',
  baseUrl: '/docs/',

  organizationName: 'RugMunchMedia',
  projectName: 'degenfeed',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/', // docs live at baseUrl root (/docs/ in prod)
          sidebarPath: './sidebars.js',
          editUrl: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web/-/edit/main/apps/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'DegenFeed',
        logo: {
          alt: 'DegenFeed logo',
          src: 'img/logo.svg',
        },
        items: [
          { to: '/', label: 'Intro', position: 'left' },
          { to: '/protocols', label: 'Protocols', position: 'left' },
          { to: '/quickstart', label: 'Self-Host', position: 'left' },
          { to: '/architecture', label: 'Architecture', position: 'left' },
          { to: '/api', label: 'API', position: 'left' },
          {
            href: 'https://degenfeed.xyz',
            label: 'App',
            position: 'right',
          },
          {
            href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web',
            label: 'Git',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} Rug Munch Media LLC. AGPL-3.0.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.vsDark,
        darkTheme: require('prism-react-renderer').themes.vsDark,
      },
    }),
};

module.exports = config;
