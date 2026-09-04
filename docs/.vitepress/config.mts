import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Tortuga',
  description: 'Front-of-house for your Plex server: newsletters, announcements, invites, and a self-hosted user portal.',
  base: '/tortuga/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['specs/**', 'superpowers/**'],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/newsletter' },
      { text: 'Configuration', link: '/configuration/' },
      { text: 'Reference', link: '/reference/api' },
      { text: 'Operations', link: '/operations/deployment' },
      { text: 'Development', link: '/development/' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/getting-started/' },
          { text: 'Installation', link: '/getting-started/installation' },
          { text: 'First run', link: '/getting-started/first-run' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'Overview', link: '/configuration/' },
          { text: 'Environment variables', link: '/configuration/environment' },
          { text: 'tortuga.yml', link: '/configuration/tortuga-yml' },
          { text: 'Portal', link: '/configuration/portal' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Newsletter', link: '/guide/newsletter' },
          { text: 'Announcements', link: '/guide/announcements' },
          { text: 'Recipients', link: '/guide/recipients' },
          { text: 'Invites', link: '/guide/invites' },
          { text: 'Portal', link: '/guide/portal' },
          { text: 'Alerts', link: '/guide/alerts' },
          { text: 'Email providers', link: '/guide/email-providers' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'API', link: '/reference/api' }],
      },
      {
        text: 'Operations',
        items: [
          { text: 'Deployment', link: '/operations/deployment' },
          { text: 'Upgrading', link: '/operations/upgrading' },
          { text: 'Backup & restore', link: '/operations/backup-restore' },
          { text: 'Troubleshooting', link: '/operations/troubleshooting' },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Overview', link: '/development/' },
          { text: 'Architecture', link: '/development/architecture' },
          { text: 'Contributing', link: '/development/contributing' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/evandcoleman/tortuga' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/evandcoleman/tortuga/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Evan Coleman',
    },
  },
});
