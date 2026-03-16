import type { ProviderId, ProviderDisplayConfig } from '@/types/hub';

// Display-only config. OAuth credentials/scopes are configured in Nango dashboard.
export const PROVIDER_CONFIGS: Record<ProviderId, ProviderDisplayConfig> = {
  slack: {
    id: 'slack',
    name: 'Slack',
    icon: 'MessageSquare',
    category: 'communication',
    nangoIntegrationId: 'slack',
    defaultLaunchUrl: 'https://app.slack.com',
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: 'Github',
    category: 'code',
    nangoIntegrationId: 'github',
    defaultLaunchUrl: 'https://github.com',
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    icon: 'HardDrive',
    category: 'files',
    nangoIntegrationId: 'google-drive',
    defaultLaunchUrl: 'https://drive.google.com',
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    icon: 'LayoutGrid',
    category: 'project-management',
    nangoIntegrationId: 'trello',
    defaultLaunchUrl: 'https://trello.com',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    icon: 'BookOpen',
    category: 'docs',
    nangoIntegrationId: 'notion',
    defaultLaunchUrl: 'https://notion.so',
  },
};

export function getProviderConfig(provider: ProviderId): ProviderDisplayConfig {
  return PROVIDER_CONFIGS[provider];
}
