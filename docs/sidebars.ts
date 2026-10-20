import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'index', label: 'Introduction' },
    { type: 'doc', id: 'installation', label: 'Installation' },
    { type: 'doc', id: 'quick-start', label: 'Quick start' },
    {
      type: 'category',
      label: 'Commands',
      collapsed: false,
      items: [
        'commands/sync',
        'commands/list',
        'commands/where',
        'commands/devices',
        'commands/install',
        'commands/match',
        'commands/ui',
        'commands/whoami',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: ['guides/local-builds', 'guides/daily-sync', 'guides/store'],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        'reference/json-output',
        'reference/ai-agents',
        'reference/security',
      ],
    },
  ],
}

export default sidebars
