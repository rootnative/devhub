import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'

// Docusaurus adds `baseUrl` to `favicon` and `themeConfig.image`, but not to
// a `headTags` href, so the apple-touch-icon builds its href from this value.
const baseUrl = '/devhub/'

const config: Config = {
  title: 'DevHub by Root Native',
  tagline: 'Keep every dev build. Launch any one in one click.',
  url: 'https://rootnative.github.io',
  baseUrl,
  favicon: 'img/favicon.png',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: `${baseUrl}img/favicon.png`,
      },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/rootnative/devhub/edit/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        docsRouteBasePath: '/',
        indexBlog: false,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    image: 'img/social-card.png',
    navbar: {
      title: 'DevHub',
      logo: {
        alt: 'DevHub',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      hideOnScroll: true,
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {
          to: '/commands/sync',
          label: 'Commands',
          position: 'left',
        },
        {
          to: '/guides/local-builds',
          label: 'Cache provider',
          position: 'left',
        },
        {
          href: 'https://github.com/rootnative/devhub',
          position: 'right',
          className: 'navbar-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/introduction' },
            { label: 'Installation', to: '/installation' },
            { label: 'Quick start', to: '/quick-start' },
            { label: 'Sync every day', to: '/guides/daily-sync' },
          ],
        },
        {
          title: 'Commands',
          items: [
            { label: 'devhub sync', to: '/commands/sync' },
            { label: 'devhub install', to: '/commands/install' },
            { label: 'devhub match', to: '/commands/match' },
            { label: 'devhub ui', to: '/commands/ui' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'For AI agents', to: '/reference/ai-agents' },
            { label: 'Security', to: '/reference/security' },
            { label: 'GitHub', href: 'https://github.com/rootnative/devhub' },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@rootnative/devhub',
            },
            { label: 'Root Native', href: 'https://rootnative.github.io/' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Root Native · MIT Licensed`,
    },
    prism: {
      additionalLanguages: ['bash', 'powershell'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
