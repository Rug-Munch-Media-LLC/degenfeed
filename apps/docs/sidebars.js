// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Protocols',
      items: ['protocols'],
    },
    'quickstart',
    'architecture',
    'api',
  ],
};

module.exports = sidebars;
